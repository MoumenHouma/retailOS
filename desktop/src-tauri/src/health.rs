use anyhow::{bail, Result};
use std::time::{Duration, Instant};

// Reuses the existing, unmodified GET /api/health/ready route — no new
// backend code needed for readiness detection.
pub fn wait_ready(port: u16, timeout: Duration) -> Result<()> {
    // "localhost" to match HOSTNAME in server.rs (see comment there) — the
    // server may be bound to ::1 only, where a 127.0.0.1 probe never lands.
    let url = format!("http://localhost:{port}/api/health/ready");
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Ok(response) = ureq::get(&url).call() {
            if response.status() == 200 {
                return Ok(());
            }
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    bail!("server did not report ready at {url} within {timeout:?}");
}
