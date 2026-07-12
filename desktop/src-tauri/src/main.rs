#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use retailos_desktop::config::Config;
use retailos_desktop::postgres::{self, PgPaths};
use retailos_desktop::state::ManagedProcesses;
use retailos_desktop::{health, server};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

fn which_node() -> PathBuf {
    let output = Command::new("where").arg("node").output().expect("running `where node`");
    let first_line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if first_line.is_empty() {
        panic!("node not found on PATH");
    }
    PathBuf::from(first_line)
}

fn app_data_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").expect("%APPDATA% not set");
    PathBuf::from(appdata).join("RetailOS")
}

fn bootstrap_and_run(app: &tauri::AppHandle) -> anyhow::Result<()> {
    // Dev-mode resource paths, CARGO_MANIFEST_DIR-relative — the bundled
    // (task #12) case switches to app.path().resource_dir(), tested
    // against a real installer once one exists.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let desktop_dir = manifest_dir.parent().expect("desktop dir");
    let pg_bin = manifest_dir.join("resources/pg/bin");
    let app_dir = manifest_dir.join("resources/app");

    let data_dir = app_data_dir();
    let cfg = Config::load_or_create(&data_dir.join("config.json"))?;

    let paths = PgPaths {
        bin_dir: pg_bin,
        pgdata_dir: data_dir.join("pgdata"),
    };

    let log_dir = data_dir.join("logs");

    postgres::initdb(&paths, &cfg.superuser_password)?;
    let pg_child = postgres::start(&paths, cfg.pg_port, &log_dir)?;
    app.state::<ManagedProcesses>().postgres.lock().unwrap().replace(pg_child);

    postgres::wait_ready(cfg.pg_port, Duration::from_secs(15))?;
    postgres::ensure_database(&paths, cfg.pg_port, &cfg.superuser_password, "retailos")?;

    let sql_file = desktop_dir.join("scripts/bootstrap-sql/01-roles.sql");
    postgres::run_bootstrap_sql(
        &paths,
        cfg.pg_port,
        &cfg.superuser_password,
        &cfg.app_user_password,
        "retailos",
        &sql_file,
    )?;

    let superuser_url = format!(
        "postgresql://postgres:{}@127.0.0.1:{}/retailos",
        cfg.superuser_password, cfg.pg_port
    );
    let node_exe = which_node();
    postgres::run_migrate_deploy(&node_exe, &app_dir, &superuser_url)?;

    let app_user_url = format!(
        "postgresql://app_user:{}@127.0.0.1:{}/retailos",
        cfg.app_user_password, cfg.pg_port
    );
    let storage_root = data_dir.join("storage");
    let node_child = server::spawn_node_server(
        &node_exe,
        &app_dir,
        cfg.node_port,
        &superuser_url,
        &app_user_url,
        &cfg.nextauth_secret,
        &storage_root,
        &log_dir,
    )?;
    app.state::<ManagedProcesses>().node.lock().unwrap().replace(node_child);

    health::wait_ready(cfg.node_port, Duration::from_secs(30))?;

    if let Some(window) = app.get_webview_window("main") {
        let url = format!("http://127.0.0.1:{}", cfg.node_port).parse()?;
        window.navigate(url)?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(ManagedProcesses::default())
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(err) = bootstrap_and_run(&handle) {
                    eprintln!("bootstrap failed: {err:?}");
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                window.state::<ManagedProcesses>().kill_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
