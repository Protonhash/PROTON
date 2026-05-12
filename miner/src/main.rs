use clap::{Parser, Subcommand};
use colored::*;

mod config;
mod auth;
mod miner;
mod benchmark;
mod tasks;

#[derive(Parser)]
#[command(name = "proton")]
#[command(about = "⚡ PROTON - AI Compute Miner for Solana", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start mining
    Mine {
        /// Number of threads (default: auto-detect)
        #[arg(short, long)]
        threads: Option<usize>,
        /// Enable GPU acceleration
        #[arg(short, long)]
        gpu: bool,
    },
    /// Login to your account
    Login {
        /// Username
        #[arg(short, long)]
        username: Option<String>,
        /// Password
        #[arg(short, long)]
        password: Option<String>,
    },
    /// Register new account
    Register {
        /// Referral code (optional)
        #[arg(short, long)]
        referral: Option<String>,
    },
    /// Run benchmark
    Benchmark,
    /// Show mining stats
    Stats,
    /// Show configuration
    Config,
}

fn print_banner() {
    let banner = r#"
    ██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ███╗   ██╗
    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗████╗  ██║
    ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██╔██╗ ██║
    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║╚██╗██║
    ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚████║
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═══╝
    "#;
    println!("{}", banner.bright_cyan());
    println!("    {} {}", "AI Compute Mining for Solana".bright_white(), "v0.1.0".dimmed());
    println!("    {}", "━".repeat(50).dimmed());
    println!();
}

#[tokio::main]
async fn main() {
    print_banner();
    let cli = Cli::parse();

    match cli.command {
        Commands::Mine { threads, gpu } => {
            miner::start_mining(threads, gpu).await;
        }
        Commands::Login { username, password } => {
            auth::login(username, password).await;
        }
        Commands::Register { referral } => {
            auth::register(referral).await;
        }
        Commands::Benchmark => {
            benchmark::run_benchmark().await;
        }
        Commands::Stats => {
            miner::show_stats().await;
        }
        Commands::Config => {
            config::show_config();
        }
    }
}
