mod builtin_themes;
mod config;
mod error;
mod i18n;
mod minify;
mod photos;
mod pipeline;
mod processing;
mod theme;
mod theme_build;
mod util;
mod watch;

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::Level;

const VERSION: &str = env!("GIT_VERSION");

#[derive(Debug, Parser)]
#[command(name = env!("CARGO_PKG_NAME"))]
#[command(version = VERSION)]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
struct Args {
    /// Site directory (contains site.toml and photo directories)
    #[arg(short = 'C', long, default_value = ".", global = true)]
    directory: PathBuf,

    /// Path to site configuration file (relative to site directory)
    #[arg(short, long, default_value = "site.toml", global = true)]
    config: PathBuf,

    /// Logging verbosity (-v: debug, -vv: trace)
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    verbose: u8,

    /// Suppress all output except errors
    #[arg(short, long, global = true)]
    quiet: bool,

    /// Override theme (for testing)
    #[arg(short, long, global = true)]
    theme: Option<String>,

    /// Include source maps for debugging (copies .map files without hashing)
    #[arg(long, global = true)]
    source_maps: bool,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Build the site (default if no command specified)
    Build,

    /// Build and serve the site locally
    Serve {
        /// Port to serve on
        #[arg(short, long, default_value = "3000")]
        port: u16,

        /// Debounce delay in seconds for file watching
        #[arg(long, default_value = "5")]
        debounce: u64,

        /// Disable automatic rebuild on file changes
        #[arg(long)]
        no_watch: bool,
    },

    /// Watch for changes and rebuild automatically
    Watch {
        /// Debounce delay in seconds
        #[arg(long, default_value = "5")]
        debounce: u64,
    },

    /// Delete the output directory
    Clean,
}

impl Args {
    fn log_level(&self) -> Level {
        if self.quiet {
            Level::ERROR
        } else {
            match self.verbose {
                0 => Level::INFO,
                1 => Level::DEBUG,
                _ => Level::TRACE,
            }
        }
    }

    fn config_path(&self) -> PathBuf {
        self.directory.join(&self.config)
    }
}

fn init_tracing(level: Level) {
    use tracing_subscriber::{EnvFilter, fmt};

    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level.as_str()));

    #[cfg(distribute)]
    {
        fmt().json().with_env_filter(filter).init();
    }

    #[cfg(not(distribute))]
    {
        fmt().pretty().with_env_filter(filter).init();
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    init_tracing(args.log_level());

    tracing::debug!(?args, "parsed arguments");

    // Watch command handles its own config loading (for hot-reload support)
    if let Some(Command::Watch { debounce }) = args.command {
        let config_path = args.config_path();
        watch::watch(args.directory, config_path, args.theme, debounce)?;
        return Ok(());
    }

    // Load site configuration
    let config_path = args.config_path();
    tracing::info!(path = %config_path.display(), "loading site config");

    let config_content = std::fs::read_to_string(&config_path)?;
    let mut site: config::Site = toml::from_str(&config_content)?;

    // Override theme if specified via CLI
    if let Some(theme_name) = &args.theme {
        tracing::info!(theme = %theme_name, "overriding theme from CLI");
        site.theme = config::ThemeConfig::Name(theme_name.clone());
    }

    // Disable minification when source maps are enabled (easier debugging)
    if args.source_maps && site.minify {
        tracing::info!("disabling minification for source map debugging");
        site.minify = false;
    }

    tracing::info!(
        domain = %site.domain,
        theme = %site.theme,
        photos = %site.photos.display(),
        build = %site.build.display(),
        "site configured"
    );

    // Handle command
    match args.command.unwrap_or(Command::Build) {
        Command::Build => {
            let mut pipeline =
                pipeline::Pipeline::load(args.directory.clone(), site, args.source_maps)?;
            pipeline.build()?;
            tracing::info!("build complete");
        }
        Command::Serve {
            port,
            debounce,
            no_watch,
        } => {
            let mut pipeline =
                pipeline::Pipeline::load(args.directory.clone(), site, args.source_maps)?;
            pipeline.build()?;

            if !no_watch {
                let watch_dir = args.directory.clone();
                let watch_config = config_path.clone();
                let watch_theme = args.theme.clone();
                std::thread::spawn(move || {
                    let _ = watch::watch_and_rebuild(
                        watch_dir,
                        watch_config,
                        watch_theme,
                        std::time::Duration::from_secs(debounce),
                    );
                });
            }

            serve(&pipeline.site_dir.join(&pipeline.config.build), port)?;
        }
        Command::Watch { .. } => unreachable!("handled above"),
        Command::Clean => {
            let output_dir = args.directory.join(&site.build);
            if output_dir.exists() {
                std::fs::remove_dir_all(&output_dir)?;
                tracing::info!(path = %output_dir.display(), "cleaned output directory");
            } else {
                tracing::info!(path = %output_dir.display(), "output directory does not exist");
            }
        }
    }

    Ok(())
}

fn serve(dir: &std::path::Path, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    use std::fs;
    use tiny_http::{Header, Response, Server};

    let addr = format!("0.0.0.0:{}", port);
    let server = Server::http(&addr).map_err(|e| format!("failed to start server: {}", e))?;

    tracing::info!(url = %format!("http://localhost:{}", port), "serving site");
    println!(
        "\n  Serving at http://localhost:{}\n  Press Ctrl+C to stop\n",
        port
    );

    for request in server.incoming_requests() {
        let url_path = request.url().to_string();
        let url_path = url_path.trim_start_matches('/');

        // URL-decode the path (handles %20 for spaces, etc.)
        let decoded_path = url_decode(url_path);

        // Determine file path
        let file_path = if decoded_path.is_empty() {
            dir.join("index.html")
        } else {
            let path = dir.join(&decoded_path);
            if path.is_dir() {
                path.join("index.html")
            } else {
                path
            }
        };

        // Serve the file
        if file_path.exists() && file_path.is_file() {
            let content = fs::read(&file_path)?;
            let content_type = guess_content_type(&file_path);

            let response = Response::from_data(content)
                .with_header(Header::from_bytes("Content-Type", content_type).unwrap());

            request.respond(response)?;
            tracing::debug!(path = %url_path, "200 OK");
        } else {
            let response = Response::from_string("404 Not Found")
                .with_status_code(404)
                .with_header(Header::from_bytes("Content-Type", "text/plain").unwrap());

            request.respond(response)?;
            tracing::debug!(path = %url_path, "404 Not Found");
        }
    }

    Ok(())
}

fn guess_content_type(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") => "application/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}

/// Decode URL-encoded strings (e.g., %20 -> space).
fn url_decode(s: &str) -> String {
    let mut result = Vec::with_capacity(s.len());
    let mut bytes = s.bytes();

    while let Some(b) = bytes.next() {
        if b == b'%' {
            match (bytes.next(), bytes.next()) {
                (Some(h1), Some(h2)) => {
                    let hex = [h1, h2];
                    match u8::from_str_radix(std::str::from_utf8(&hex).unwrap_or(""), 16) {
                        Ok(byte) => result.push(byte),
                        Err(_) => {
                            result.push(b'%');
                            result.extend_from_slice(&hex);
                        }
                    }
                }
                (Some(h1), None) => {
                    result.push(b'%');
                    result.push(h1);
                }
                _ => result.push(b'%'),
            }
        } else if b == b'+' {
            result.push(b' ');
        } else {
            result.push(b);
        }
    }

    String::from_utf8_lossy(&result).into_owned()
}
