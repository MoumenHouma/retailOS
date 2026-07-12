// Task #9 standalone verification (not yet wired into the Tauri shell —
// that's task #10): exercises the full bootstrap sequence — initdb, start,
// wait-ready, createdb, bootstrap SQL, `prisma migrate deploy` — against a
// throwaway pgdata directory, proving it reaches a migrated,
// app_user-granted database from nothing.
use anyhow::{Context, Result};
use retailos_desktop::config::Config;
use retailos_desktop::postgres::{self, PgPaths};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

fn which_node() -> Result<PathBuf> {
    let output = Command::new("where").arg("node").output().context("running `where node`")?;
    let first_line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if first_line.is_empty() {
        anyhow::bail!("node not found on PATH");
    }
    Ok(PathBuf::from(first_line))
}

fn main() -> Result<()> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")); // desktop/src-tauri
    let desktop_dir = manifest_dir.parent().context("no parent of src-tauri")?; // desktop
    let repo_root = desktop_dir.parent().context("no parent of desktop")?; // repo root

    let pg_bin = manifest_dir.join("resources/pg/bin");
    let test_root = std::env::temp_dir().join("retailos-desktop-bootstrap-test");
    let pgdata = test_root.join("pgdata");
    let config_path = test_root.join("config.json");

    println!("repo_root = {}", repo_root.display());
    println!("pg_bin    = {}", pg_bin.display());
    println!("pgdata    = {}", pgdata.display());

    let cfg = Config::load_or_create(&config_path)?;
    println!("port = {}", cfg.pg_port);

    let paths = PgPaths {
        bin_dir: pg_bin,
        pgdata_dir: pgdata,
    };

    println!("[1/5] initdb...");
    postgres::initdb(&paths, &cfg.superuser_password)?;

    println!("[2/5] starting postgres...");
    let mut child = postgres::start(&paths, cfg.pg_port)?;

    let result = (|| -> Result<()> {
        println!("      waiting for ready...");
        postgres::wait_ready(cfg.pg_port, Duration::from_secs(15))?;

        println!("[3/5] ensure database...");
        postgres::ensure_database(&paths, cfg.pg_port, &cfg.superuser_password, "retailos")?;

        println!("[4/5] bootstrap sql...");
        let sql_file = desktop_dir.join("scripts/bootstrap-sql/01-roles.sql");
        postgres::run_bootstrap_sql(
            &paths,
            cfg.pg_port,
            &cfg.superuser_password,
            &cfg.app_user_password,
            "retailos",
            &sql_file,
        )?;

        println!("[5/5] migrate deploy...");
        let node_exe = which_node()?;
        let database_url = format!(
            "postgresql://postgres:{}@127.0.0.1:{}/retailos",
            cfg.superuser_password, cfg.pg_port
        );
        postgres::run_migrate_deploy(&node_exe, repo_root, &database_url)?;

        Ok(())
    })();

    println!("stopping postgres...");
    child.kill().ok();
    child.wait().ok();

    result?;
    println!("SUCCESS");
    Ok(())
}
