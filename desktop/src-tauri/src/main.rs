#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use retailos_desktop::config::Config;
use retailos_desktop::postgres::{self, PgPaths};
use retailos_desktop::state::ManagedProcesses;
use retailos_desktop::{health, server};
use std::path::PathBuf;
#[cfg(debug_assertions)]
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

// Dev mode (`cargo run`/`tauri dev`, no installer): fall back to the
// system PATH and the source tree directly, since externalBin/resources
// aren't staged next to a dev binary the way they are in an installed
// bundle.
#[cfg(debug_assertions)]
fn which_node(_app: &tauri::AppHandle) -> PathBuf {
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

// Installed app: externalBin ships as
// "binaries/node-x86_64-pc-windows-msvc.exe" but Tauri strips the target
// triple when it copies the sidecar next to the main executable, landing
// it as "node.exe" in the same directory — never the dev machine's PATH,
// which a clean install won't have.
#[cfg(not(debug_assertions))]
fn which_node(_app: &tauri::AppHandle) -> PathBuf {
    let exe = std::env::current_exe().expect("current_exe");
    let dir = exe.parent().expect("exe has a parent dir");
    let candidate = dir.join("node.exe");
    if !candidate.exists() {
        panic!("bundled node.exe not found next to the app executable at {candidate:?}");
    }
    candidate
}

fn app_data_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").expect("%APPDATA% not set");
    PathBuf::from(appdata).join("RetailOS")
}

// Tauri's resource_dir() returns a Windows verbatim ("\\?\"-prefixed)
// path. postgres.exe runs fine when invoked with one directly, but
// initdb.exe's own sibling-executable lookup (used to find postgres.exe
// to run the bootstrap script) breaks on it -- confirmed live: identical
// initdb invocation succeeds with a plain path and fails with "programme
// postgres... non trouve" only when given the \\?\ form. Stripping the
// prefix back to a normal path fixes it with no loss of correctness
// (these paths are always well under MAX_PATH here, or #12 wouldn't have
// built at all).
#[cfg(not(debug_assertions))]
fn simplify_verbatim(path: PathBuf) -> PathBuf {
    let s = path.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        path
    }
}

// Postgres binaries stay under the source tree even in dev mode (fetched
// there directly by fetch-postgres.ps1) -- no MAX_PATH pressure, their own
// directory depth tops out under 130 chars (confirmed live).
#[cfg(debug_assertions)]
fn pg_resource_dir(_app: &tauri::AppHandle) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources")
}

#[cfg(not(debug_assertions))]
fn pg_resource_dir(app: &tauri::AppHandle) -> PathBuf {
    simplify_verbatim(app.path().resource_dir().expect("resource_dir"))
}

// The app bundle + bootstrap SQL stage at a short drive-root path in dev
// mode too (see prepare-resources.mjs's win32 default) -- .pnpm's own
// folder-naming depth pushes real runtime files (next/dist/compiled/*.js)
// past Windows' 260-char MAX_PATH once nested under this repo's own path,
// confirmed live via makensis failing to open one. In the installed app
// this collapses back to the same resource_dir() as pg -- Tauri unifies
// every bundle.resources source into one resource_dir() regardless of
// where each was copied from at build time.
#[cfg(debug_assertions)]
fn app_resource_dir(_app: &tauri::AppHandle) -> PathBuf {
    PathBuf::from("C:\\retailos-dist")
}

#[cfg(not(debug_assertions))]
fn app_resource_dir(app: &tauri::AppHandle) -> PathBuf {
    simplify_verbatim(app.path().resource_dir().expect("resource_dir"))
}

fn bootstrap_and_run(app: &tauri::AppHandle) -> anyhow::Result<()> {
    let pg_root = pg_resource_dir(app);
    let app_root = app_resource_dir(app);
    let pg_bin = pg_root.join("pg/bin");
    let app_dir = app_root.join("app");

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

    let sql_file = app_root.join("bootstrap-sql/01-roles.sql");
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
    let node_exe = which_node(app);
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
