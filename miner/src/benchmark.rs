use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use sha2::{Sha256, Digest};
use std::time::Instant;

use crate::config::load_config;

pub async fn run_benchmark() {
    println!("  {} Running PROTON Benchmark...", "🔥".bright_yellow());
    println!("  {}", "━".repeat(40).dimmed());
    println!();

    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("  [{bar:40.cyan/blue}] {pos}% {msg}")
            .unwrap()
            .progress_chars("█▓░"),
    );

    // CPU Benchmark - SHA256
    pb.set_message("Testing SHA256...");
    let cpu_score = bench_sha256();
    pb.set_position(33);

    // CPU Benchmark - Vector math
    pb.set_message("Testing Vector Math...");
    let vector_score = bench_vector();
    pb.set_position(66);

    // Memory benchmark
    pb.set_message("Testing Memory...");
    let mem_score = bench_memory();
    pb.set_position(100);
    pb.finish_with_message("Complete!");
    println!();

    let total_cpu = cpu_score + vector_score + mem_score;
    let cores = num_cpus::get();
    let memory_mb = 8192; // Assume 8GB for now

    // Tier calculation
    let tier = if total_cpu > 50000 {
        "Diamond"
    } else if total_cpu > 20000 {
        "Platinum"
    } else if total_cpu > 10000 {
        "Gold"
    } else if total_cpu > 5000 {
        "Silver"
    } else {
        "Bronze"
    };

    println!("  {} Benchmark Results", "📊".bright_white());
    println!("  {}", "━".repeat(40).dimmed());
    println!("  SHA256 Score:     {}", cpu_score.to_string().bright_cyan());
    println!("  Vector Score:     {}", vector_score.to_string().bright_cyan());
    println!("  Memory Score:     {}", mem_score.to_string().bright_cyan());
    println!("  {}", "━".repeat(40).dimmed());
    println!("  Total CPU Score:  {}", total_cpu.to_string().bright_green().bold());
    println!("  CPU Cores:        {}", cores.to_string().bright_white());
    println!("  Tier:             {}", tier.bright_yellow().bold());
    println!();

    // Submit to server if logged in
    let config = load_config();
    if config.token.is_some() {
        println!("  {} Submitting benchmark to server...", "📤".dimmed());
        let client = reqwest::Client::new();
        let res = client
            .post(format!("{}/api/miner/benchmark", config.api_url))
            .header("Authorization", format!("Bearer {}", config.token.unwrap()))
            .json(&serde_json::json!({
                "cpu_score": total_cpu,
                "gpu_score": 0,
                "memory_mb": memory_mb,
                "cores": cores,
                "device_name": format!("CPU {}c", cores)
            }))
            .send()
            .await;

        match res {
            Ok(r) if r.status().is_success() => {
                println!("  {} Benchmark submitted!", "✓".bright_green());
            }
            _ => {
                println!("  {} Could not submit benchmark", "⚠".yellow());
            }
        }
    }
}

fn bench_sha256() -> u64 {
    let start = Instant::now();
    let iterations = 100_000;

    let mut hash = String::from("proton-benchmark-seed");
    for _ in 0..iterations {
        let mut hasher = Sha256::new();
        hasher.update(hash.as_bytes());
        hash = format!("{:x}", hasher.finalize());
    }

    let elapsed = start.elapsed().as_millis() as u64;
    if elapsed == 0 { return 50000; }
    (iterations as u64 * 1000) / elapsed
}

fn bench_vector() -> u64 {
    let start = Instant::now();
    let size = 10000;
    let iterations = 100;

    let vec_a: Vec<f64> = (0..size).map(|i| i as f64 * 0.001).collect();
    let vec_b: Vec<f64> = (0..size).map(|i| (size - i) as f64 * 0.001).collect();

    for _ in 0..iterations {
        let _dot: f64 = vec_a.iter().zip(vec_b.iter()).map(|(a, b)| a * b).sum();
    }

    let elapsed = start.elapsed().as_millis() as u64;
    if elapsed == 0 { return 30000; }
    (size as u64 * iterations * 1000) / elapsed
}

fn bench_memory() -> u64 {
    let start = Instant::now();
    let size: usize = 1_000_000;

    let mut data: Vec<u64> = (0..size as u64).collect();
    for i in 0..size - 1 {
        data[i] = data[i].wrapping_add(data[i + 1]);
    }

    let elapsed = start.elapsed().as_millis() as u64;
    if elapsed == 0 { return 20000; }
    (size as u64 * 1000) / elapsed
}
