use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use colored::*;

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub api_url: String,
    pub token: Option<String>,
    pub username: Option<String>,
    pub threads: usize,
    pub gpu_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            api_url: "https://api.proton.fun".to_string(),
            token: None,
            username: None,
            threads: num_cpus::get(),
            gpu_enabled: false,
        }
    }
}

pub fn config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".proton").join("config.json")
}

pub fn load_config() -> Config {
    let path = config_path();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Config::default()
    }
}

pub fn save_config(config: &Config) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    let data = serde_json::to_string_pretty(config).unwrap();
    fs::write(&path, data).ok();
}

pub fn show_config() {
    let config = load_config();
    println!("  {} Configuration", "⚙️".bright_white());
    println!("  {}", "━".repeat(40).dimmed());
    println!("  API URL:    {}", config.api_url.bright_cyan());
    println!("  Username:   {}", config.username.unwrap_or("Not logged in".to_string()).bright_yellow());
    println!("  Threads:    {}", config.threads.to_string().bright_green());
    println!("  GPU:        {}", if config.gpu_enabled { "Enabled".bright_green() } else { "Disabled".red() });
    println!("  Config at:  {}", config_path().display().to_string().dimmed());
    println!("  Token:      {}", if config.token.is_some() { "Set ✓".bright_green() } else { "Not set ✗".red() });
}
