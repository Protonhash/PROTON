use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

use crate::config::load_config;
use crate::tasks::{execute_task, Task};

static TASKS_COMPLETED: AtomicU64 = AtomicU64::new(0);
static POINTS_EARNED: AtomicU64 = AtomicU64::new(0);

pub async fn start_mining(threads: Option<usize>, gpu: bool) {
    let config = load_config();

    if config.token.is_none() {
        println!("  {} Not logged in! Run {} first.", "✗".red(), "proton login".bright_green());
        return;
    }

    let num_threads = threads.unwrap_or(config.threads);
    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    // Handle Ctrl+C
    ctrlc::set_handler(move || {
        r.store(false, Ordering::SeqCst);
    }).ok();

    println!("  {} Starting PROTON Miner", "⚡".bright_yellow());
    println!("  {}", "━".repeat(40).dimmed());
    println!("  Worker:    {}", config.username.clone().unwrap_or("unknown".to_string()).bright_cyan());
    println!("  Threads:   {}", num_threads.to_string().bright_green());
    println!("  GPU:       {}", if gpu { "Enabled".bright_green() } else { "Disabled".dimmed() });
    println!("  Server:    {}", config.api_url.dimmed());
    println!("  {}", "━".repeat(40).dimmed());
    println!("  {} Press Ctrl+C to stop", "ℹ".dimmed());
    println!();

    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("  {spinner:.cyan} {msg}")
            .unwrap()
    );

    // Heartbeat task
    let hb_config = config.clone();
    let hb_running = running.clone();
    tokio::spawn(async move {
        loop {
            if !hb_running.load(Ordering::SeqCst) { break; }
            send_heartbeat(&hb_config).await;
            sleep(Duration::from_secs(30)).await;
        }
    });

    // Mining loop
    let client = reqwest::Client::new();
    let token = config.token.clone().unwrap();
    let api_url = config.api_url.clone();

    while running.load(Ordering::SeqCst) {
        spinner.set_message(format!(
            "Mining... Tasks: {} | Points: {}",
            TASKS_COMPLETED.load(Ordering::Relaxed).to_string().bright_green(),
            POINTS_EARNED.load(Ordering::Relaxed).to_string().bright_yellow(),
        ));

        // Get task from server
        let task_res = client
            .get(format!("{}/api/tasks/get", api_url))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await;

        match task_res {
            Ok(response) if response.status().is_success() => {
                let task: Task = match response.json().await {
                    Ok(t) => t,
                    Err(_) => {
                        sleep(Duration::from_secs(2)).await;
                        continue;
                    }
                };

                spinner.set_message(format!(
                    "Computing {} (difficulty {})...",
                    task.task_type.bright_cyan(),
                    task.difficulty.to_string().bright_yellow()
                ));

                // Execute task
                let result = execute_task(&task);

                // Submit result
                let submit_res = client
                    .post(format!("{}/api/tasks/submit", api_url))
                    .header("Authorization", format!("Bearer {}", token))
                    .json(&result)
                    .send()
                    .await;

                if let Ok(resp) = submit_res {
                    if let Ok(body) = resp.json::<serde_json::Value>().await {
                        if body["valid"].as_bool().unwrap_or(false) {
                            let pts = body["points_awarded"].as_u64().unwrap_or(0);
                            TASKS_COMPLETED.fetch_add(1, Ordering::Relaxed);
                            POINTS_EARNED.fetch_add(pts, Ordering::Relaxed);
                        }
                    }
                }
            }
            Ok(response) if response.status() == 401 => {
                println!("  {} Session expired. Please login again.", "✗".red());
                break;
            }
            _ => {
                spinner.set_message("Reconnecting...".dimmed().to_string());
                sleep(Duration::from_secs(5)).await;
            }
        }

        // Small delay between tasks
        sleep(Duration::from_millis(100)).await;
    }

    spinner.finish_with_message("Mining stopped.".dimmed().to_string());
    println!();
    println!("  {} Session Summary", "📊".bright_white());
    println!("  Tasks Completed: {}", TASKS_COMPLETED.load(Ordering::Relaxed).to_string().bright_green());
    println!("  Points Earned:   {}", POINTS_EARNED.load(Ordering::Relaxed).to_string().bright_yellow());
}

async fn send_heartbeat(config: &crate::config::Config) {
    if let Some(token) = &config.token {
        let client = reqwest::Client::new();
        client
            .post(format!("{}/api/miner/heartbeat", config.api_url))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "hashrate": TASKS_COMPLETED.load(Ordering::Relaxed) * 100,
                "tasks_in_progress": 1
            }))
            .send()
            .await
            .ok();
    }
}

pub async fn show_stats() {
    let config = load_config();

    if config.token.is_none() {
        println!("  {} Not logged in!", "✗".red());
        return;
    }

    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/miner/stats", config.api_url))
        .header("Authorization", format!("Bearer {}", config.token.unwrap()))
        .send()
        .await;

    match res {
        Ok(response) if response.status().is_success() => {
            let stats: serde_json::Value = response.json().await.unwrap();
            println!("  {} Mining Stats for {}", "📊".bright_white(), config.username.unwrap_or("unknown".to_string()).bright_cyan());
            println!("  {}", "━".repeat(40).dimmed());
            println!("  Total Points:     {}", stats["total_points"].to_string().bright_green().bold());
            println!("  Tasks Completed:  {}", stats["total_tasks"].to_string().bright_white());
            println!("  Tier:             {}", stats["tier"].as_str().unwrap_or("bronze").bright_yellow());
            println!("  Last 24h Points:  {}", stats["last_24h"]["points"].to_string().bright_cyan());
            println!("  Last 24h Tasks:   {}", stats["last_24h"]["tasks"].to_string().bright_white());
            println!("  {}", "━".repeat(40).dimmed());
            println!("  {} Estimated Allocation: {} PROTON",
                "🪙".bright_yellow(),
                stats["estimated_allocation"].to_string().bright_green().bold()
            );
        }
        _ => {
            println!("  {} Could not fetch stats", "✗".red());
        }
    }
}
