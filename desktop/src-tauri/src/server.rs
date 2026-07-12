use crate::logging::open_log;
use anyhow::{Context, Result};
use std::path::Path;
use std::process::{Child, Command};

// src/lib/prisma.ts reads *both* DATABASE_URL (superuser, `prismaSuperuser`)
// and DATABASE_APP_URL (RLS-restricted `app_user`, the normal `withTenant`
// path) at runtime — not just DATABASE_URL for the Prisma CLI — so the
// spawned server needs both, confirmed by reading that file directly.
#[allow(clippy::too_many_arguments)]
pub fn spawn_node_server(
    node_exe: &Path,
    app_dir: &Path,
    port: u16,
    database_url: &str,
    database_app_url: &str,
    nextauth_secret: &str,
    storage_root: &Path,
    log_dir: &Path,
) -> Result<Child> {
    let out = open_log(log_dir, "node.log")?;
    let err = open_log(log_dir, "node.log")?;
    Command::new(node_exe)
        .arg(app_dir.join("server.js"))
        .current_dir(app_dir)
        .env("RETAILOS_EDITION", "desktop")
        .env("STORAGE_DRIVER", "fs")
        .env("STORAGE_FS_ROOT", storage_root)
        .env("DATABASE_URL", database_url)
        .env("DATABASE_APP_URL", database_app_url)
        .env("NEXTAUTH_SECRET", nextauth_secret)
        .env("NEXTAUTH_URL", format!("http://127.0.0.1:{port}"))
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        // Confirmed necessary live (task #9 testing): NextAuth v5 refuses
        // requests with "UntrustedHost" unless the exact Host header is
        // pre-trusted — 127.0.0.1 on a non-default port trips this.
        .env("AUTH_TRUST_HOST", "true")
        .stdout(out)
        .stderr(err)
        .spawn()
        .context("spawning node server.js")
}
