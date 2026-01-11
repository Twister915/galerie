# galerie

A static site generator for image galleries. Like Hugo for blogs, but optimized for photo galleries.

## Overview

`galerie` takes a folder (or folder tree) full of images and generates a static HTML site with all images properly encoded for web delivery. It combines:
- User configuration
- Theme templates
- Image directory with images and optional sidecar files
- EXIF metadata extraction from images

The system is structured as a pipeline/plugin architecture, where different modules can read input data and transform the output.

## Tech Stack

- **Language:** Rust (nightly)
- **Platform:** Cross-platform CLI (macOS, Linux, Windows)
- **Core dependencies:**
  - `image` - Image processing and format conversion
  - `webp` - WebP encoding for thumbnails and full-size images
  - `walkdir` - Recursive directory traversal
  - `little_exif` - EXIF metadata extraction and modification (read/write)
  - `reverse_geocoder` - Offline reverse geocoding for GPS privacy modes
  - `tera` - Template engine (Jinja2-style)
  - `clap` - CLI argument parsing
  - `toml` - Configuration file parsing
  - `serde` - Serialization/deserialization
  - `thiserror` - Error handling
  - `tracing` - Structured logging

## Build & Run

```bash
# Development build and run
cargo run

# Run with verbose logging
RUST_LOG=debug cargo run

# Production build
cargo build --profile distribute

# Run tests
cargo test

# Format code
cargo fmt

# Run linter
cargo clippy
```

## Project Structure

Single crate application:
- `src/main.rs` - Entry point with CLI parsing and initialization
- `build.rs` - Git version injection and distribute profile support

## Coding Standards

This project follows Joey's Rust style guide in `.claude/rust-style.md`.

Key principles:
- Nightly Rust, minimal dependencies, longevity over convenience
- Static dispatch, iterators over collect, lifetimes over cloning
- `thiserror` for errors, `tracing` for logs, `test-case` for tests
- `where` clauses over inline bounds, `impl Trait` when possible
- Derive `Debug` on all types, use table-based tests
- Block format for dependencies with features

Reference the full style guide when writing new modules or making architectural decisions.
