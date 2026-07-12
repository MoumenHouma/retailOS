use crate::logging::open_log;
use anyhow::{Context, Result};
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};

// No console for the node sidecar — same reasoning as postgres.rs's
// DETACHED_PROCESS (see the comment there): a console-subsystem child of
// a GUI parent otherwise gets a fresh conhost, whose console-wide ctrl
// events are a proven kill vector, and stdout/stderr already go to
// node.log anyway.
const DETACHED_PROCESS: u32 = 0x0000_0008;

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
        .env("NEXTAUTH_URL", format!("http://localhost:{port}"))
        .env("PORT", port.to_string())
        // "localhost", not "127.0.0.1" — and every other URL that reaches
        // this server (window URL, health checks) must use the same name.
        // Next's router treats a proxy/middleware rewrite as *external*
        // when the rewrite's host doesn't match its own notion of self,
        // which is always "localhost"; with HOSTNAME=127.0.0.1 every page
        // route (rewritten by next-intl) got re-proxied to
        // http://localhost:<port>, which Windows resolves to ::1 first —
        // where nothing listens — hanging every page for the 30s
        // proxyTimeout and then 500ing (APIs, never rewritten, worked
        // fine). Confirmed live against the packaged app; with
        // HOSTNAME=localhost Node binds whatever localhost resolves to
        // first, so the internal hop, the window, and the health checks
        // all agree.
        .env("HOSTNAME", "localhost")
        .env("NODE_ENV", "production")
        // Confirmed necessary live (task #9 testing): NextAuth v5 refuses
        // requests with "UntrustedHost" unless the exact Host header is
        // pre-trusted — 127.0.0.1 on a non-default port trips this.
        .env("AUTH_TRUST_HOST", "true")
        .creation_flags(DETACHED_PROCESS)
        .stdout(out)
        .stderr(err)
        .spawn()
        .context("spawning node server.js")
}
