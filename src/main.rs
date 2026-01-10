use clap::Parser;
use std::path::PathBuf;

const VERSION: &str = env!("GIT_VERSION");

#[derive(Debug, Parser)]
#[command(name = env!("CARGO_PKG_NAME"))]
#[command(version = VERSION)]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
struct Args {
    /// Input directory containing images
    #[arg(short, long)]
    input: PathBuf,

    /// Output directory for generated site
    #[arg(short, long, default_value = "output")]
    output: PathBuf,

    /// Configuration file path
    #[arg(short, long)]
    config: Option<PathBuf>,

    /// Enable verbose output
    #[arg(short, long, default_value_t = false)]
    verbose: bool,
}

fn init_tracing(verbose: bool) {
    use tracing_subscriber::{fmt, EnvFilter};

    let default_level = if verbose { "debug" } else { "info" };
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(default_level));

    #[cfg(distribute)]
    {
        // Production: JSON logs, no ANSI
        fmt().json().with_env_filter(filter).init();
    }

    #[cfg(not(distribute))]
    {
        // Development: pretty logs with colors
        fmt().pretty().with_env_filter(filter).init();
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    init_tracing(args.verbose);

    tracing::info!(
        input = %args.input.display(),
        output = %args.output.display(),
        "galerie starting"
    );

    // TODO: Implement gallery generation pipeline

    tracing::info!("galerie complete");

    Ok(())
}
