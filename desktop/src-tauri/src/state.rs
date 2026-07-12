use std::process::Child;
use std::sync::Mutex;

// Killed together on app exit — postgres has no external clients besides
// our own Node server, so shutting the window closes the whole stack.
#[derive(Default)]
pub struct ManagedProcesses {
    pub postgres: Mutex<Option<Child>>,
    pub node: Mutex<Option<Child>>,
}

impl ManagedProcesses {
    pub fn kill_all(&self) {
        for guard in [&self.node, &self.postgres] {
            if let Ok(mut lock) = guard.lock() {
                if let Some(mut child) = lock.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    }
}
