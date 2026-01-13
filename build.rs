use std::fs;
use std::path::Path;
use std::process::Command;

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

    // Auto-discover and build themes that need it
    build_builtin_themes();
}

/// Scan themes/ directory and build any that need it.
fn build_builtin_themes() {
    let themes_dir = Path::new("themes");
    if !themes_dir.is_dir() {
        return;
    }

    // Rerun if themes directory changes (new theme added)
    println!("cargo:rerun-if-changed=themes");

    for entry in fs::read_dir(themes_dir).expect("Failed to read themes directory") {
        let entry = entry.expect("Failed to read theme entry");
        let theme_dir = entry.path();

        if !theme_dir.is_dir() {
            continue;
        }

        let theme_name = theme_dir.file_name().unwrap().to_string_lossy();

        // Detect theme type
        if is_vite_theme(&theme_dir) {
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
        }
        // Classic themes (no build step) are skipped
    }
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

    // Run build
    run_command(dir, &pm, &["run", "build"]);
}

fn find_package_manager(dir: &Path) -> String {
    // Check lockfiles first (respect user's choice)
    if dir.join("bun.lockb").exists() {
        return "bun".to_string();
    }
    if dir.join("pnpm-lock.yaml").exists() {
        return "pnpm".to_string();
    }
    if dir.join("yarn.lock").exists() {
        return "yarn".to_string();
    }
    if dir.join("package-lock.json").exists() {
        return "npm".to_string();
    }

    // Fall back to first available in PATH
    for pm in ["bun", "pnpm", "npm", "yarn"] {
        if Command::new(pm).arg("--version").output().is_ok() {
            return pm.to_string();
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
