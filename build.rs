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
}
