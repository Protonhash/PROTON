use colored::*;
use dialoguer::{Input, Password};
use serde::{Deserialize, Serialize};

use crate::config::{load_config, save_config};

#[derive(Serialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct RegisterRequest {
    username: String,
    password: String,
    referral_code: Option<String>,
}

#[derive(Deserialize)]
struct AuthResponse {
    token: String,
    user: UserInfo,
}

#[derive(Deserialize)]
struct UserInfo {
    username: String,
    referral_code: String,
    total_points: i64,
    tier: String,
}

pub async fn login(username: Option<String>, password: Option<String>) {
    let username = username.unwrap_or_else(|| {
        Input::new()
            .with_prompt("Username")
            .interact_text()
            .unwrap()
    });

    let password = password.unwrap_or_else(|| {
        Password::new()
            .with_prompt("Password")
            .interact()
            .unwrap()
    });

    println!("  {} Logging in...", "⏳".dimmed());

    let config = load_config();
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/login", config.api_url))
        .json(&LoginRequest { username: username.clone(), password })
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                let auth: AuthResponse = response.json().await.unwrap();
                let mut config = load_config();
                config.token = Some(auth.token);
                config.username = Some(auth.user.username.clone());
                save_config(&config);

                println!("  {} Logged in as {}", "✓".bright_green(), auth.user.username.bright_cyan());
                println!("  {} Points: {}", "⚡".bright_yellow(), auth.user.total_points.to_string().bright_white());
                println!("  {} Tier: {}", "🏆".bright_yellow(), auth.user.tier.bright_white());
                println!("  {} Referral: {}", "🔗".bright_yellow(), auth.user.referral_code.bright_white());
            } else {
                let text = response.text().await.unwrap_or_default();
                println!("  {} Login failed: {}", "✗".red(), text.red());
            }
        }
        Err(e) => {
            println!("  {} Connection error: {}", "✗".red(), e.to_string().red());
        }
    }
}

pub async fn register(referral: Option<String>) {
    let username: String = Input::new()
        .with_prompt("Choose a username")
        .interact_text()
        .unwrap();

    let password: String = Password::new()
        .with_prompt("Choose a password")
        .with_confirmation("Confirm password", "Passwords don't match")
        .interact()
        .unwrap();

    let referral_code = referral.or_else(|| {
        let code: String = Input::new()
            .with_prompt("Referral code (optional, press Enter to skip)")
            .allow_empty(true)
            .interact_text()
            .unwrap();
        if code.is_empty() { None } else { Some(code) }
    });

    println!("  {} Creating account...", "⏳".dimmed());

    let config = load_config();
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/register", config.api_url))
        .json(&RegisterRequest {
            username: username.clone(),
            password,
            referral_code,
        })
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                let auth: AuthResponse = response.json().await.unwrap();
                let mut config = load_config();
                config.token = Some(auth.token);
                config.username = Some(auth.user.username.clone());
                save_config(&config);

                println!("  {} Account created!", "✓".bright_green());
                println!("  {} Welcome, {}!", "🎉".bright_yellow(), auth.user.username.bright_cyan());
                println!("  {} Your referral code: {}", "🔗".bright_yellow(), auth.user.referral_code.bright_white());
                println!();
                println!("  Run {} to start mining!", "proton mine".bright_green());
            } else {
                let text = response.text().await.unwrap_or_default();
                println!("  {} Registration failed: {}", "✗".red(), text.red());
            }
        }
        Err(e) => {
            println!("  {} Connection error: {}", "✗".red(), e.to_string().red());
        }
    }
}
