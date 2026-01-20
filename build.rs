use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Write as _;
use std::path::Path;
use std::process::Command;

use ignore::WalkBuilder;

fn main() {
    // Declare custom cfg for cargo check-cfg
    println!("cargo::rustc-check-cfg=cfg(distribute)");

    // Inject git version info
    let output = Command::new("git")
        .args(["describe", "--tags", "--always", "--dirty"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=GIT_VERSION={}", output);

    // Enable cfg(distribute) for distribute profile
    if std::env::var("PROFILE").unwrap() == "distribute" {
        println!("cargo:rustc-cfg=distribute");
    }

    // Rerun if git HEAD changes
    println!("cargo:rerun-if-changed=.git/HEAD");

    // Auto-discover, build, and stage themes
    process_builtin_themes();
}


/// Scan themes/ directory, build Vite themes, stage all themes, and generate code.
fn process_builtin_themes() {
    let themes_dir = Path::new("themes");
    if !themes_dir.is_dir() {
        // Generate empty themes module if no themes directory
        generate_empty_builtin_themes();
        return;
    }

    // Rerun if themes directory changes (new theme added)
    println!("cargo:rerun-if-changed=themes");

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    let staged_dir = Path::new(&out_dir).join("staged_themes");

    // Clean and recreate staged directory
    if staged_dir.exists() {
        fs::remove_dir_all(&staged_dir).expect("Failed to clean staged_themes");
    }
    fs::create_dir_all(&staged_dir).expect("Failed to create staged_themes");

    // Discover and process all themes (BTreeMap for sorted iteration)
    let mut themes: BTreeMap<String, ()> = BTreeMap::new();

    for entry in fs::read_dir(themes_dir).expect("Failed to read themes directory") {
        let entry = entry.expect("Failed to read theme entry");
        let theme_dir = entry.path();

        if !theme_dir.is_dir() {
            continue;
        }

        // Skip hidden directories and staging directories
        let dir_name = theme_dir.file_name().unwrap().to_string_lossy();
        if dir_name.starts_with('.') {
            continue;
        }

        let theme_name = dir_name.to_string();
        let is_vite = is_vite_theme(&theme_dir);

        if is_vite {
            println!("cargo:warning=Building Vite theme: {}", theme_name);
            build_vite_theme(&theme_dir);

            // Rerun if this theme's source changes
            let theme_str = theme_dir.to_string_lossy();
            println!("cargo:rerun-if-changed={}/package.json", theme_str);
            println!("cargo:rerun-if-changed={}/vite.config.ts", theme_str);
            println!("cargo:rerun-if-changed={}/vite.config.js", theme_str);
            println!("cargo:rerun-if-changed={}/src", theme_str);
            println!("cargo:rerun-if-changed={}/styles", theme_str);
            println!("cargo:rerun-if-changed={}/templates", theme_str);
        } else {
            // Classic theme - rerun if anything changes
            println!("cargo:rerun-if-changed={}", theme_dir.display());
        }

        // Stage the theme
        let source_dir = if is_vite {
            theme_dir.join("dist")
        } else {
            theme_dir.clone()
        };

        let dest_dir = staged_dir.join(&theme_name);
        stage_theme_directory(&source_dir, &dest_dir);

        themes.insert(theme_name, ());
    }

    // Generate the builtin_themes.rs code
    generate_builtin_themes_code(&themes, &out_dir);
}

/// Stage a theme directory to the output, respecting gitignore and filtering unwanted files.
fn stage_theme_directory(source: &Path, dest: &Path) {
    if !source.exists() {
        println!(
            "cargo:warning=Theme source directory does not exist: {}",
            source.display()
        );
        return;
    }

    fs::create_dir_all(dest).expect("Failed to create theme staging directory");

    // Use ignore crate to walk directory respecting .gitignore
    let walker = WalkBuilder::new(source)
        .hidden(true) // Skip hidden files (.DS_Store, etc.)
        .git_ignore(true) // Respect .gitignore
        .git_global(false) // Don't use global gitignore
        .git_exclude(true) // Respect .git/info/exclude
        .require_git(false) // Work even if not in a git repo
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        // Skip the root directory itself
        if path == source {
            continue;
        }

        // Calculate relative path and destination
        let relative = path.strip_prefix(source).expect("Path prefix mismatch");
        let dest_path = dest.join(relative);

        if path.is_dir() {
            fs::create_dir_all(&dest_path).expect("Failed to create directory");
        } else if path.is_file() {
            // Skip unwanted system files
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name == ".DS_Store" || name == "Thumbs.db" || name.ends_with('~') {
                    continue;
                }
            }

            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).expect("Failed to create parent directory");
            }
            fs::copy(path, &dest_path).expect("Failed to copy file");
        }
    }
}

/// Generate the builtin_themes.rs source code.
fn generate_builtin_themes_code(themes: &BTreeMap<String, ()>, out_dir: &str) {
    let out_path = Path::new(out_dir).join("builtin_themes.rs");
    let mut file = File::create(&out_path).expect("Failed to create builtin_themes.rs");

    // Note: Can't use //! doc comments in include!() blocks, so use regular comments
    writeln!(file, "// Auto-generated by build.rs - do not edit manually.").unwrap();
    writeln!(file).unwrap();
    writeln!(file, "use include_dir::{{Dir, include_dir}};").unwrap();
    writeln!(file).unwrap();

    // Generate static declarations for each theme
    for name in themes.keys() {
        let const_name = name.to_uppercase().replace('-', "_");
        writeln!(
            file,
            "static THEME_{}: Dir = include_dir!(\"$OUT_DIR/staged_themes/{}\");",
            const_name, name
        )
        .unwrap();
    }

    writeln!(file).unwrap();

    // Generate the lookup function
    writeln!(
        file,
        "/// Look up a built-in theme by name.\n///\n/// Returns the theme directory if found."
    )
    .unwrap();
    writeln!(
        file,
        "pub fn get(name: &str) -> Option<&'static Dir<'static>> {{"
    )
    .unwrap();
    writeln!(file, "    match name {{").unwrap();

    for name in themes.keys() {
        let const_name = name.to_uppercase().replace('-', "_");
        writeln!(file, "        \"{}\" => Some(&THEME_{}),", name, const_name).unwrap();
    }

    writeln!(file, "        _ => None,").unwrap();
    writeln!(file, "    }}").unwrap();
    writeln!(file, "}}").unwrap();

    writeln!(file).unwrap();

    // Generate list function for discoverability
    writeln!(file, "/// List all built-in theme names.").unwrap();
    writeln!(file, "pub fn list() -> &'static [&'static str] {{").unwrap();
    write!(file, "    &[").unwrap();
    for (i, name) in themes.keys().enumerate() {
        if i > 0 {
            write!(file, ", ").unwrap();
        }
        write!(file, "\"{}\"", name).unwrap();
    }
    writeln!(file, "]").unwrap();
    writeln!(file, "}}").unwrap();
}

/// Generate an empty builtin_themes module (when no themes directory exists).
fn generate_empty_builtin_themes() {
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    let out_path = Path::new(&out_dir).join("builtin_themes.rs");
    let mut file = File::create(&out_path).expect("Failed to create builtin_themes.rs");

    writeln!(file, "// Auto-generated by build.rs - do not edit manually.").unwrap();
    writeln!(file).unwrap();
    writeln!(file, "use include_dir::Dir;").unwrap();
    writeln!(file).unwrap();
    writeln!(
        file,
        "/// Look up a built-in theme by name.\n///\n/// Returns the theme directory if found."
    )
    .unwrap();
    writeln!(
        file,
        "pub fn get(_name: &str) -> Option<&'static Dir<'static>> {{"
    )
    .unwrap();
    writeln!(file, "    None").unwrap();
    writeln!(file, "}}").unwrap();
    writeln!(file).unwrap();
    writeln!(file, "/// List all built-in theme names.").unwrap();
    writeln!(file, "pub fn list() -> &'static [&'static str] {{").unwrap();
    writeln!(file, "    &[]").unwrap();
    writeln!(file, "}}").unwrap();
}

/// Check if theme is a Vite theme (has package.json AND vite.config.*).
fn is_vite_theme(dir: &Path) -> bool {
    if !dir.join("package.json").exists() {
        return false;
    }
    // Check for vite.config.{js,ts,mjs,mts}
    for ext in ["ts", "js", "mts", "mjs"] {
        if dir.join(format!("vite.config.{}", ext)).exists() {
            return true;
        }
    }
    false
}

fn build_vite_theme(dir: &Path) {
    let pm = find_package_manager(dir);

    // Install dependencies if node_modules missing
    if !dir.join("node_modules").exists() {
        run_command(dir, &pm, &["install"]);
    }

    // Clean dist directory to remove stale files from previous builds
    clean_theme_dist(dir);

    // Run build
    run_command(dir, &pm, &["run", "build"]);
}

/// Remove the theme's dist directory to ensure no stale files remain.
fn clean_theme_dist(dir: &Path) {
    let dist_dir = dir.join("dist");
    if dist_dir.exists()
        && let Err(e) = fs::remove_dir_all(&dist_dir)
    {
        println!(
            "cargo:warning=Failed to clean {}: {}",
            dist_dir.display(),
            e
        );
    }
}

fn find_package_manager(dir: &Path) -> String {
    // Check lockfiles first (respect user's choice)
    let preferred = if dir.join("bun.lockb").exists() {
        Some("bun")
    } else if dir.join("pnpm-lock.yaml").exists() {
        Some("pnpm")
    } else if dir.join("yarn.lock").exists() {
        Some("yarn")
    } else if dir.join("package-lock.json").exists() {
        Some("npm")
    } else {
        None
    };

    // Try preferred first, then fall back to any available
    let candidates: Vec<&str> = if let Some(pref) = preferred {
        std::iter::once(pref)
            .chain(
                ["bun", "pnpm", "npm", "yarn"]
                    .into_iter()
                    .filter(|&p| p != pref),
            )
            .collect()
    } else {
        vec!["bun", "pnpm", "npm", "yarn"]
    };

    for pm in candidates {
        if let Ok(path) = which::which(pm) {
            return path.to_string_lossy().to_string();
        }
    }

    panic!("No package manager found. Install Node.js (npm) or Bun.");
}

fn run_command(dir: &Path, pm: &str, args: &[&str]) {
    let status = Command::new(pm)
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap_or_else(|e| panic!("Failed to run {} {}: {}", pm, args.join(" "), e));

    if !status.success() {
        panic!(
            "{} {} failed with exit code {:?}",
            pm,
            args.join(" "),
            status.code()
        );
    }
}
