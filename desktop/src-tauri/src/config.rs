use anyhow::{Context, Result};
use rand::distributions::Alphanumeric;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// Generated once on first run and persisted — every subsequent launch
// reuses the same port/passwords/secret so the bundled Postgres data
// directory and NextAuth sessions stay valid across restarts.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub pg_port: u16,
    pub node_port: u16,
    pub superuser_password: String,
    pub app_user_password: String,
    pub nextauth_secret: String,
}

fn random_secret(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

impl Config {
    pub fn load_or_create(path: &Path) -> Result<Config> {
        if path.exists() {
            let data = fs::read_to_string(path).with_context(|| format!("reading config at {}", path.display()))?;
            let cfg: Config =
                serde_json::from_str(&data).with_context(|| format!("parsing config at {}", path.display()))?;
            return Ok(cfg);
        }
        let cfg = Config {
            pg_port: 55432,
            node_port: 3100,
            superuser_password: random_secret(32),
            app_user_password: random_secret(32),
            nextauth_secret: random_secret(48),
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string_pretty(&cfg)?)
            .with_context(|| format!("writing config at {}", path.display()))?;
        Ok(cfg)
    }
}
