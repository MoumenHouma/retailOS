use crate::logging::open_log;
use anyhow::{bail, Context, Result};
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::{Duration, Instant};

// postgres.exe on Windows runs every backend/background worker (including
// the logical replication launcher, always started even unused) as a
// freshly-spawned copy of itself (EXEC_BACKEND -- Windows has no fork()).
// Without this flag those workers share our own process's console/job
// group, and confirmed live: ~6s after a clean startup, the logical
// replication launcher dies with exception 0xC000013A
// (STATUS_CONTROL_C_EXIT), taking the whole postmaster down with it, even
// with zero external interference. CREATE_NEW_PROCESS_GROUP detaches
// postgres (and everything it spawns) into its own group so a signal
// aimed at -- or generated within -- our process's group can't reach it.
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub struct PgPaths {
    pub bin_dir: PathBuf,
    pub pgdata_dir: PathBuf,
}

impl PgPaths {
    fn exe(&self, name: &str) -> PathBuf {
        self.bin_dir.join(format!("{name}.exe"))
    }
}

pub fn is_initialized(pgdata_dir: &Path) -> bool {
    pgdata_dir.join("PG_VERSION").exists()
}

// initdb reads the superuser password from a file, not argv or an env var,
// so it never shows up in a process listing (`ps`/Task Manager command
// line column) while it runs.
pub fn initdb(paths: &PgPaths, superuser_password: &str) -> Result<()> {
    if is_initialized(&paths.pgdata_dir) {
        return Ok(());
    }
    std::fs::create_dir_all(&paths.pgdata_dir)?;
    let pwfile = paths.pgdata_dir.with_extension("pwfile.tmp");
    std::fs::write(&pwfile, superuser_password)?;
    let result = Command::new(paths.exe("initdb"))
        .arg("-D")
        .arg(&paths.pgdata_dir)
        .arg("-U")
        .arg("postgres")
        .arg("--auth=scram-sha-256")
        .arg("--pwfile")
        .arg(&pwfile)
        .arg("-E")
        .arg("UTF8")
        .status();
    std::fs::remove_file(&pwfile).ok();
    let status = result.context("spawning initdb")?;
    if !status.success() {
        bail!("initdb exited with {status}");
    }
    Ok(())
}

// postgres.exe refuses to run under a token where BUILTIN\Administrators
// is an *enabled* group (`pgwin32_is_admin`, via CheckTokenMembership) —
// confirmed live from an elevated dev shell ("running as administrator is
// not permitted"). This is not the same as "the Windows account is an
// administrator": UAC gives a non-elevated process from an admin account
// a *filtered* token where Administrators is present but deny-only, which
// CheckTokenMembership does not count — so a normally-launched Tauri app
// (medium integrity, no elevation manifest) starts fine even for admin
// accounts. Only relevant tail case: shops running with UAC disabled
// entirely, where every process (including this one) keeps an enabled
// Administrators SID — unverified whether that actually needs handling
// here until task #13's clean-VM pass hits it for real.
pub fn start(paths: &PgPaths, port: u16, log_dir: &Path) -> Result<Child> {
    let out = open_log(log_dir, "postgres.log")?;
    let err = open_log(log_dir, "postgres.log")?;
    Command::new(paths.exe("postgres"))
        .arg("-D")
        .arg(&paths.pgdata_dir)
        .arg("-p")
        .arg(port.to_string())
        .arg("-h")
        .arg("127.0.0.1")
        .creation_flags(CREATE_NEW_PROCESS_GROUP)
        .stdout(out)
        .stderr(err)
        .spawn()
        .context("spawning postgres")
}

pub fn wait_ready(port: u16, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    bail!("postgres did not become ready on port {port} within {timeout:?}");
}

// wait_ready() only proves the TCP port is open, not that postgres is
// actually accepting SQL connections -- confirmed live: right after an
// unclean-shutdown crash recovery, the port accepts connections but the
// server rejects queries with "l'etat de restauration coherent n'a pas
// encore ete atteint" for a brief window. The existence check below used
// to treat that failure the same as "database not found" (only looked at
// stdout, never the psql exit status), so it fell through to createdb,
// which then failed for a different reason -- the database already
// existed -- and that failure was fatal, silently killing bootstrap with
// no visible error (this is a GUI-subsystem process; eprintln goes
// nowhere). Retrying the check until psql itself actually succeeds closes
// the race at its source.
fn database_exists(paths: &PgPaths, port: u16, superuser_password: &str, db_name: &str, timeout: Duration) -> Result<bool> {
    let deadline = Instant::now() + timeout;
    loop {
        let output = Command::new(paths.exe("psql"))
            .arg("-h")
            .arg("127.0.0.1")
            .arg("-p")
            .arg(port.to_string())
            .arg("-U")
            .arg("postgres")
            .arg("-d")
            .arg("postgres")
            .arg("-tAc")
            .arg(format!("SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            .env("PGPASSWORD", superuser_password)
            .output()
            .context("spawning psql to check database existence")?;
        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).trim() == "1");
        }
        if Instant::now() >= deadline {
            bail!(
                "checking database existence timed out: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

pub fn ensure_database(paths: &PgPaths, port: u16, superuser_password: &str, db_name: &str) -> Result<()> {
    if database_exists(paths, port, superuser_password, db_name, Duration::from_secs(15))? {
        return Ok(());
    }
    let status = Command::new(paths.exe("createdb"))
        .arg("-h")
        .arg("127.0.0.1")
        .arg("-p")
        .arg(port.to_string())
        .arg("-U")
        .arg("postgres")
        .arg(db_name)
        .env("PGPASSWORD", superuser_password)
        .status()
        .context("spawning createdb")?;
    if !status.success() {
        bail!("createdb exited with {status}");
    }
    Ok(())
}

// Idempotent (safe to run every launch, not just first run) — see
// bootstrap-sql/01-roles.sql's own header comment for why.
pub fn run_bootstrap_sql(
    paths: &PgPaths,
    port: u16,
    superuser_password: &str,
    app_user_password: &str,
    db_name: &str,
    sql_file: &Path,
) -> Result<()> {
    let status = Command::new(paths.exe("psql"))
        .arg("-h")
        .arg("127.0.0.1")
        .arg("-p")
        .arg(port.to_string())
        .arg("-U")
        .arg("postgres")
        .arg("-d")
        .arg(db_name)
        .arg("-v")
        .arg(format!("app_user_password={app_user_password}"))
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-f")
        .arg(sql_file)
        .env("PGPASSWORD", superuser_password)
        .status()
        .context("spawning psql for bootstrap SQL")?;
    if !status.success() {
        bail!("bootstrap SQL exited with {status}");
    }
    Ok(())
}

// Also safe on every launch — `migrate deploy` is a documented no-op when
// there are no pending migrations, and this is how future app updates
// ship new ones without a separate "run migrations" step.
pub fn run_migrate_deploy(node_exe: &Path, app_dir: &Path, database_url: &str) -> Result<()> {
    let prisma_entry = app_dir.join("node_modules/prisma/build/index.js");
    let status = Command::new(node_exe)
        .arg(&prisma_entry)
        .arg("migrate")
        .arg("deploy")
        .current_dir(app_dir)
        .env("DATABASE_URL", database_url)
        .status()
        .context("spawning prisma migrate deploy")?;
    if !status.success() {
        bail!("prisma migrate deploy exited with {status}");
    }
    Ok(())
}
