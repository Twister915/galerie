//! Runtime Vite theme support for custom themes.
//!
//! Built-in themes are compiled at build time by build.rs.
//! This module handles custom Vite themes at runtime.

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{Error, Result};

/// Theme type based on presence of build configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThemeType {
    /// Classic theme - no build step required, use as-is.
    Classic,
    /// Vite theme - requires npm/bun build, use dist/ directory.
    Vite,
}

/// Detect the type of theme based on presence of build configuration.
pub fn detect_theme_type(theme_dir: &Path) -> ThemeType {
    if !theme_dir.join("package.json").exists() {
        return ThemeType::Classic;
    }

    // Check for vite.config.{js,ts,mjs,mts}
    for ext in ["ts", "js", "mts", "mjs"] {
        if theme_dir.join(format!("vite.config.{}", ext)).exists() {
            return ThemeType::Vite;
        }
    }

    ThemeType::Classic
}

/// Build a Vite theme and return the path to the dist/ directory.
///
/// This is used for custom themes at runtime. Built-in themes are
/// pre-built at compile time by build.rs.
pub fn build_vite_theme(theme_dir: &Path) -> Result<PathBuf> {
    let (pm_name, pm_path) = find_package_manager(theme_dir)?;

    tracing::info!(
        theme = %theme_dir.display(),
        package_manager = pm_name,
        "building Vite theme"
    );

    // Install dependencies if node_modules missing
    if !theme_dir.join("node_modules").exists() {
        tracing::debug!("installing dependencies");
        run_command(theme_dir, &pm_path, &["install"])?;
    }

    // Run build
    tracing::debug!("running build");
    run_command(theme_dir, &pm_path, &["run", "build"])?;

    let dist_dir = theme_dir.join("dist");
    if !dist_dir.is_dir() {
        return Err(Error::ThemeBuild {
            message: format!(
                "build completed but dist/ directory not found at {}",
                dist_dir.display()
            ),
        });
    }

    Ok(dist_dir)
}

/// Find a package manager to use for the theme.
///
/// Returns (name, path) tuple.
fn find_package_manager(theme_dir: &Path) -> Result<(&'static str, PathBuf)> {
    // Check lockfiles first (respect user's choice)
    let preferred = if theme_dir.join("bun.lockb").exists() {
        Some("bun")
    } else if theme_dir.join("pnpm-lock.yaml").exists() {
        Some("pnpm")
    } else if theme_dir.join("yarn.lock").exists() {
        Some("yarn")
    } else if theme_dir.join("package-lock.json").exists() {
        Some("npm")
    } else {
        None
    };

    // If we have a preferred package manager from lockfile, try to find it
    if let Some(pm) = preferred {
        if let Ok(path) = which::which(pm) {
            return Ok((pm, path));
        }
        // Fall through to try others if preferred not found
    }

    // Try each package manager in order of preference
    for pm in ["bun", "pnpm", "npm", "yarn"] {
        if let Ok(path) = which::which(pm) {
            return Ok((pm, path));
        }
    }

    Err(Error::ToolNotFound {
        tool: "package manager".to_string(),
        hint: "Install Node.js (includes npm) or Bun to build Vite themes.".to_string(),
    })
}

/// Run a package manager command.
fn run_command(dir: &Path, pm: &Path, args: &[&str]) -> Result<()> {
    let output = Command::new(pm)
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| Error::ThemeBuild {
            message: format!("failed to run {}: {}", pm.display(), e),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(Error::ThemeBuild {
            message: format!(
                "{} {} failed (exit code {:?}):\n{}\n{}",
                pm.display(),
                args.join(" "),
                output.status.code(),
                stdout,
                stderr
            ),
        });
    }

    Ok(())
}
