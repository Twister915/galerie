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

## User Documentation

User-facing documentation lives in `wiki/`. When making changes that affect user-visible behavior:

- `wiki/site-config.md` - Configuration options in `site.toml`
- `wiki/image-processing.md` - Image pipeline behavior
- `wiki/i18n.md` - Language support and translation keys
- `wiki/theme-structure.md` - Theme development
- `wiki/templates.md` - Template file conventions
- `wiki/template-context.md` - Variables available in templates

Update relevant wiki pages when changing user-facing features.

## Internationalization (i18n)

galerie supports 20 languages. When making changes that involve user-facing text, you MUST:

1. **Never hardcode user-facing strings** in templates or JavaScript. Use translation keys instead.

2. **Add new translation keys** to `src/i18n.rs` in ALL language functions when adding new UI text:
   - `translations_en()` - English
   - `translations_zh_cn()` - Simplified Chinese
   - `translations_es()` - Spanish
   - `translations_fr()` - French
   - `translations_nl()` - Dutch
   - `translations_de()` - German
   - `translations_uk()` - Ukrainian
   - `translations_ru()` - Russian
   - `translations_ja()` - Japanese
   - `translations_ar()` - Arabic
   - `translations_hi()` - Hindi
   - `translations_he()` - Hebrew
   - `translations_it()` - Italian
   - `translations_ko()` - Korean
   - `translations_pl()` - Polish
   - `translations_cs()` - Czech
   - `translations_fi()` - Finnish
   - `translations_da()` - Danish
   - `translations_hu()` - Hungarian
   - `translations_pt()` - Portuguese

3. **Use proper key namespacing**:
   - `nav.*` - Navigation elements
   - `section.*` - Section headers
   - `field.*` - Field labels
   - `action.*` - Action buttons
   - `footer.*` - Footer text
   - `country.*` - Country names (ISO 3166-1 alpha-2 codes)

4. **Handle word order differences**: Some languages (Japanese, Chinese, Hindi, Korean) place verbs after nouns. Use `footer.built_with` (prefix) and `footer.built_with_suffix` (suffix) pattern when needed.

5. **In templates**: Use `data-i18n` attributes for static text:
   ```html
   <span data-i18n="nav.previous">Previous</span>
   ```

6. **In JavaScript**: Use the `t()` function:
   ```javascript
   var label = t('field.camera');
   ```

7. **For country names**: The GPS data includes `countryCode` (ISO alpha-2). Use `t('country.' + countryCode)` to get localized country names.

## Theme Configuration

Themes can accept arbitrary configuration from `site.toml`. The system works as follows:

1. **User configuration** in `site.toml` can use either simple or extended format:
   ```toml
   # Simple format
   theme = "fancy"

   # Extended format with settings
   [theme]
   name = "fancy"
   slideshow_delay = 8000
   ```

2. **Theme defaults** are defined in `theme.toml` at the theme root:
   ```toml
   [defaults]
   slideshow_delay = 5000
   default_sort = "shuffle"
   ```

3. **Config merging**: Theme defaults are merged with user overrides (user wins).

4. **Template access**: Use `{{ theme_config.key }}` in Tera templates.

5. **Frontend access**: For Vite themes, config is injected as `THEME_CONFIG` global.

Key files:
- `src/config.rs` - `ThemeConfig` enum with untagged serde for both formats
- `src/theme.rs` - `Theme.defaults` field, loaded from `theme.toml`
- `src/pipeline.rs` - Merging logic and `theme_config` template variable
