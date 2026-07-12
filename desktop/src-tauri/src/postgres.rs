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
// CREATE_NEW_PROCESS_GROUP alone turned out not to be enough: a new
// process *group* still attaches to the parent's console, and
// console-wide events (CTRL_CLOSE when a conhost dies, CTRL_C broadcast
// to group 0) ignore group boundaries. Confirmed live in the packaged
// app: 0xC000013A kept recurring at irregular intervals (5s to 5min
// after startup), killing the replication launcher or even a backend
// mid-query, while a postmaster started via pg_ctl ran on the same
// machine, same pgdata, with zero crashes.
//
// The fix is CREATE_NO_WINDOW -- a *private, hidden* console for the
// postmaster: no other process shares it (so no stray ctrl events), and
// every EXEC_BACKEND child inherits it invisibly. DETACHED_PROCESS (no
// console at all) was tried first and did stop the crashes, but with no
// console to inherit, Windows allocated a fresh *visible* console window
// for every postgres backend -- one cmd-style window per connection,
// confirmed live by the user's own launch ("it opens lots of cmd
// windows"). CREATE_NO_WINDOW keeps the isolation without the popups.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

// Every helper below used to run via .status(), which inherits stdio from
// this process -- a windows_subsystem="windows" GUI app with no console,
// so the child's own error output (the actually useful part -- prisma's
// specific migration error, psql's specific SQL error) went nowhere.
// Confirmed live: a real "prisma migrate deploy exited with exit code: 1"
// failure reached the user with zero detail on *why*. Running via
// .output() and folding stdout+stderr into the bail! message means it
// lands in logs/bootstrap.log automatically, through the existing
// error-to-file logging in main.rs.
fn run_capturing(mut cmd: Command, label: &str) -> Result<()> {
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output().with_context(|| format!("spawning {label}"))?;
    if !output.status.success() {
        bail!(
            "{label} exited with {}\nstdout: {}\nstderr: {}",
            output.status,
            String::from_utf8_lossy(&output.stdout).trim(),
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(())
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
    let mut cmd = Command::new(paths.exe("initdb"));
    cmd.arg("-D")
        .arg(&paths.pgdata_dir)
        .arg("-U")
        .arg("postgres")
        .arg("--auth=scram-sha-256")
        .arg("--pwfile")
        .arg(&pwfile)
        .arg("-E")
        .arg("UTF8");
    let result = run_capturing(cmd, "initdb");
    std::fs::remove_file(&pwfile).ok();
    result
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
        .creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW)
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
    let mut cmd = Command::new(paths.exe("createdb"));
    cmd.arg("-h")
        .arg("127.0.0.1")
        .arg("-p")
        .arg(port.to_string())
        .arg("-U")
        .arg("postgres")
        .arg(db_name)
        .env("PGPASSWORD", superuser_password);
    run_capturing(cmd, "createdb")
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
    let mut cmd = Command::new(paths.exe("psql"));
    cmd.arg("-h")
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
        .env("PGPASSWORD", superuser_password);
    run_capturing(cmd, "bootstrap SQL")
}

// Also safe on every launch — `migrate deploy` is a documented no-op when
// there are no pending migrations, and this is how future app updates
// ship new ones without a separate "run migrations" step.
pub fn run_migrate_deploy(node_exe: &Path, app_dir: &Path, database_url: &str) -> Result<()> {
    let prisma_entry = app_dir.join("node_modules/prisma/build/index.js");
    let mut cmd = Command::new(node_exe);
    cmd.arg(&prisma_entry)
        .arg("migrate")
        .arg("deploy")
        .current_dir(app_dir)
        .env("DATABASE_URL", database_url);
    run_capturing(cmd, "prisma migrate deploy")
}
