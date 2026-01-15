# Installation

## Pre-built Binaries

*Coming soon* - Pre-built binaries for Linux (x86_64, ARM64) and macOS will be available on the [releases page](https://github.com/Twister915/galerie/releases).

For now, follow the source-based installation below.

## Building from Source

Building from source works on any platform and ensures optimal performance for your architecture.

### Prerequisites

You'll need:
- **Rust** (nightly) - The programming language galerie is written in
- **Node.js** (18+) - Required for building the default Vite-based theme

### Step 1: Install Rust

Install Rust using rustup:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Follow the prompts (defaults are fine). Then reload your shell:

```bash
source ~/.cargo/env
```

Switch to nightly Rust (required by galerie):

```bash
rustup default nightly
```

Verify installation:

```bash
rustc --version
# Should show: rustc 1.xx.0-nightly
```

### Step 2: Install Node.js

The default "fancy" theme uses Vite and requires Node.js to build.

**Ubuntu/Debian (including Raspberry Pi OS):**

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

**macOS (with Homebrew):**

```bash
brew install node
```

**Other platforms:**

Download from [nodejs.org](https://nodejs.org/) or use your package manager.

### Step 3: Clone and Build

```bash
# Clone the repository
git clone https://github.com/Twister915/galerie.git
cd galerie

# Build in release mode (optimized)
cargo build --release
```

The build takes 5-15 minutes depending on your hardware. On a Raspberry Pi 4, expect 15-25 minutes for the first build.

The binary will be at `target/release/galerie`.

### Step 4: Install the Binary

Copy the binary to a location in your PATH:

```bash
sudo cp target/release/galerie /usr/local/bin/
```

Verify installation:

```bash
galerie --version
```

## Updating

To update to the latest version:

```bash
cd galerie
git pull
cargo build --release
sudo cp target/release/galerie /usr/local/bin/
```

## Platform-Specific Notes

### Raspberry Pi

On Raspberry Pi OS, you may need to install build dependencies first:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev
```

The first build is slow, but subsequent builds (after code updates) are much faster due to incremental compilation.

**Tip:** If building on a Pi with limited RAM (2GB or less), you may need to add swap space or close other applications during the build.

### macOS

On Apple Silicon (M1/M2/M3), the build is native ARM64 and very fast. On Intel Macs, you get native x86_64.

You may need Xcode Command Line Tools:

```bash
xcode-select --install
```

### Windows (WSL2)

galerie works well under WSL2 with Ubuntu. Follow the Ubuntu instructions above within your WSL2 environment.

Native Windows builds are possible but not officially tested.

## Troubleshooting

### "rustup: command not found"

Your shell didn't pick up the cargo environment. Run:

```bash
source ~/.cargo/env
```

Or start a new terminal session.

### Build fails with "linker cc not found"

Install build tools:

```bash
# Ubuntu/Debian
sudo apt install build-essential

# Fedora
sudo dnf groupinstall "Development Tools"
```

### Build fails with npm/node errors

Make sure Node.js is installed and in your PATH:

```bash
node --version
npm --version
```

If not found, revisit Step 2.

### Out of memory during build

On low-memory systems (2GB RAM), try:

```bash
# Build with fewer parallel jobs
cargo build --release -j 2
```

Or add temporary swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Build, then remove swap
cargo build --release

sudo swapoff /swapfile
sudo rm /swapfile
```
