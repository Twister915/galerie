//! File system watcher for automatic rebuilds.
//!
//! Watches the site directory and triggers rebuilds when photos are added,
//! modified, or deleted. Includes debouncing to handle batch uploads and
//! partial file transfers.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{RecvTimeoutError, channel};
use std::time::Duration;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};

use crate::config::{Site, ThemeConfig};
use crate::error::Result;
use crate::pipeline::Pipeline;

/// Watch a site directory for changes and rebuild automatically.
///
/// This function blocks forever, continuously watching for file changes
/// and triggering rebuilds after a debounce period.
pub fn watch(
    site_dir: PathBuf,
    config_path: PathBuf,
    theme_override: Option<String>,
    debounce_secs: u64,
) -> Result<()> {
    // Initial build
    tracing::info!("performing initial build");
    if let Err(e) = do_build(&site_dir, &config_path, theme_override.as_deref()) {
        tracing::error!(error = %e, "initial build failed");
    }

    watch_and_rebuild(
        site_dir,
        config_path,
        theme_override,
        Duration::from_secs(debounce_secs),
    )
}

/// Watch for file changes and rebuild automatically.
///
/// This function blocks forever. Unlike `watch()`, it does not perform an
/// initial build - use this when you've already built the site and just
/// want to watch for changes.
pub fn watch_and_rebuild(
    site_dir: PathBuf,
    config_path: PathBuf,
    theme_override: Option<String>,
    debounce: Duration,
) -> Result<()> {
    let debounce_secs = debounce.as_secs();

    // Load config to determine what paths to watch
    let config_content = std::fs::read_to_string(&config_path)?;
    let site: Site = toml::from_str(&config_content)?;

    let photos_dir = site_dir.join(&site.photos);
    // Canonicalize output_dir so it matches absolute paths from notify events
    let output_dir = site_dir
        .join(&site.build)
        .canonicalize()
        .unwrap_or_else(|_| site_dir.join(&site.build));

    // Determine theme directory if it's local
    let theme_dir = {
        let dir = site_dir.join(site.theme.name());
        if dir.is_dir() { Some(dir) } else { None }
    };

    // Set up file watcher
    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        },
        Config::default(),
    )?;

    // Watch photos directory
    tracing::info!(path = %photos_dir.display(), "watching photos directory");
    watcher.watch(&photos_dir, RecursiveMode::Recursive)?;

    // Watch site.toml
    tracing::info!(path = %config_path.display(), "watching config file");
    watcher.watch(&config_path, RecursiveMode::NonRecursive)?;

    // Watch local theme if present
    if let Some(ref dir) = theme_dir {
        tracing::info!(path = %dir.display(), "watching theme directory");
        watcher.watch(dir, RecursiveMode::Recursive)?;
    }

    tracing::info!(
        debounce_secs = debounce_secs,
        "watch mode active, press Ctrl+C to stop"
    );
    tracing::debug!(
        output_dir = %output_dir.display(),
        "output directory for filtering"
    );

    // Event loop with debouncing
    let mut needs_rebuild = false;

    loop {
        match rx.recv_timeout(debounce) {
            Ok(event) => {
                let _span = tracing::debug_span!(
                    "file_event",
                    kind = ?event.kind,
                    paths = ?event.paths,
                )
                .entered();

                tracing::debug!("received file event");

                // Filter out events we don't care about
                if should_ignore_event(&event, &output_dir) {
                    tracing::debug!("ignoring event (filtered)");
                    continue;
                }

                tracing::debug!("event passed filters");

                if !needs_rebuild {
                    tracing::info!(
                        "change detected, waiting {}s for more changes...",
                        debounce_secs
                    );
                }
                needs_rebuild = true;
                // Continue loop to reset timeout
            }
            Err(RecvTimeoutError::Timeout) => {
                if needs_rebuild {
                    tracing::info!("rebuilding site...");

                    match do_build(&site_dir, &config_path, theme_override.as_deref()) {
                        Ok(()) => tracing::info!("build complete"),
                        Err(e) => tracing::error!(error = %e, "build failed"),
                    }

                    needs_rebuild = false;
                }
                // Continue watching
            }
            Err(RecvTimeoutError::Disconnected) => {
                tracing::warn!("watcher disconnected, stopping");
                break;
            }
        }
    }

    Ok(())
}

/// Perform a single build of the site.
pub fn do_build(site_dir: &Path, config_path: &Path, theme_override: Option<&str>) -> Result<()> {
    do_build_with_options(site_dir, config_path, theme_override, false)
}

/// Perform a single build of the site with options.
pub fn do_build_with_options(
    site_dir: &Path,
    config_path: &Path,
    theme_override: Option<&str>,
    source_maps: bool,
) -> Result<()> {
    // Reload config each time in case it changed
    let config_content = std::fs::read_to_string(config_path)?;
    let mut site: Site = toml::from_str(&config_content)?;

    // Apply theme override if specified
    if let Some(theme_name) = theme_override {
        site.theme = ThemeConfig::Name(theme_name.to_string());
    }

    // Disable minification when source maps are enabled (easier debugging)
    if source_maps && site.minify {
        site.minify = false;
    }

    let mut pipeline = Pipeline::load(site_dir.to_path_buf(), site, source_maps)?;
    pipeline.build()?;

    Ok(())
}

/// Check if an event should be ignored.
pub fn should_ignore_event(event: &notify::Event, output_dir: &Path) -> bool {
    use notify::EventKind;

    // Only care about create, modify, and remove events
    // Ignore access events (file reads during build), metadata changes, etc.
    match &event.kind {
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {}
        other => {
            tracing::trace!(kind = ?other, "ignoring: non-content event");
            return true;
        }
    }

    // Ignore events in the output directory
    for path in &event.paths {
        if path.starts_with(output_dir) {
            tracing::trace!(
                path = %path.display(),
                output_dir = %output_dir.display(),
                "ignoring: in output directory"
            );
            return true;
        }

        // Ignore hidden files
        if let Some(name) = path.file_name().and_then(|n| n.to_str())
            && name.starts_with('.')
        {
            tracing::trace!(
                path = %path.display(),
                "ignoring: hidden file"
            );
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_should_ignore_hidden_files() {
        let output_dir = PathBuf::from("/site/dist");

        let event = notify::Event {
            kind: notify::EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/site/photos/.DS_Store")],
            attrs: Default::default(),
        };

        assert!(should_ignore_event(&event, &output_dir));
    }

    #[test]
    fn test_should_ignore_output_dir() {
        let output_dir = PathBuf::from("/site/dist");

        let event = notify::Event {
            kind: notify::EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/site/dist/index.html")],
            attrs: Default::default(),
        };

        assert!(should_ignore_event(&event, &output_dir));
    }

    #[test]
    fn test_should_not_ignore_photo() {
        let output_dir = PathBuf::from("/site/dist");

        let event = notify::Event {
            kind: notify::EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/site/photos/vacation/beach.jpg")],
            attrs: Default::default(),
        };

        assert!(!should_ignore_event(&event, &output_dir));
    }

    #[test]
    fn test_should_ignore_access_events() {
        let output_dir = PathBuf::from("/site/dist");

        let event = notify::Event {
            kind: notify::EventKind::Access(notify::event::AccessKind::Read),
            paths: vec![PathBuf::from("/site/photos/vacation/beach.jpg")],
            attrs: Default::default(),
        };

        assert!(should_ignore_event(&event, &output_dir));
    }

    #[test]
    fn test_should_ignore_other_events() {
        let output_dir = PathBuf::from("/site/dist");

        let event = notify::Event {
            kind: notify::EventKind::Other,
            paths: vec![PathBuf::from("/site/photos/vacation/beach.jpg")],
            attrs: Default::default(),
        };

        assert!(should_ignore_event(&event, &output_dir));
    }
}
