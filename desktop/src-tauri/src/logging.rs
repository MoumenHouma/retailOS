use anyhow::{Context, Result};
use std::fs::{File, OpenOptions};
use std::path::Path;

// Stdio::piped() with nobody reading the pipe deadlocks the child once the
// OS pipe buffer (~64KB) fills — postgres logs to inherited stderr with no
// logging_collector, and Next.js writes to stdout, so a busy shop crosses
// that within a day and queries start silently hanging. Redirecting to a
// real file (append, so restarts don't clobber prior history) avoids the
// pipe entirely.
pub fn open_log(log_dir: &Path, name: &str) -> Result<File> {
    std::fs::create_dir_all(log_dir).context("creating log directory")?;
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(name))
        .with_context(|| format!("opening log file {name}"))
}
