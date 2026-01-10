# galerie

A fast, minimal static site generator for photo galleries. Takes a directory of images and produces a complete static website with optimized images, EXIF metadata, and customizable themes.

## Features

- **Automatic image optimization**: Generates WebP thumbnails (600px) and full-size web images (2400px) from any JPEG, PNG, WebP, or GIF source
- **EXIF metadata extraction**: Pulls date taken, camera, lens, GPS coordinates, and exposure settings from photos
- **Hierarchical albums**: Directory structure becomes album hierarchy automatically
- **Incremental builds**: Only regenerates images when source files change (content-addressed with BLAKE3 hashes)
- **Asset minification**: Minifies HTML, CSS, and JavaScript output by default
- **Cache-busting**: Static assets get content-hashed filenames for optimal browser caching
- **Built-in themes**: Ships with `basic` and `fancy` themes; supports custom local themes
- **Parallel processing**: Uses all available CPU cores via Rayon
- **Development server**: Built-in HTTP server for local preview

## Installation

Requires Rust nightly (uses edition 2024).

```bash
# Clone and build
git clone https://github.com/yourname/galerie.git
cd galerie
cargo build --release

# Or install globally
cargo install --path .
```

For optimized production builds:

```bash
cargo build --profile distribute
```

## Quick Start

1. Create a site directory with your photos:

```
my-gallery/
├── site.toml
└── photos/
    ├── landscape.jpg
    ├── portrait.jpg
    └── vacation/
        ├── day1.jpg
        └── day2.jpg
```

2. Create a minimal `site.toml`:

```toml
domain = "photos.example.com"
```

3. Build and serve:

```bash
galerie -C my-gallery serve
```

Open http://localhost:3000 to view your gallery.

## Configuration

The `site.toml` file controls site generation:

```toml
# Required: the domain where this site will be hosted
domain = "photos.example.com"

# Optional: site title (defaults to domain)
title = "My Photo Gallery"

# Optional: theme name or path (defaults to "basic")
# Can be "basic", "fancy", or a path to a local theme directory
theme = "fancy"

# Optional: source directory for photos (defaults to "photos")
photos = "albums"

# Optional: output directory (defaults to "dist")
build = "public"

# Optional: whether to minify output (defaults to true)
minify = true
```

## Commands

```bash
# Build the site (default command)
galerie -C path/to/site build

# Build and serve locally
galerie -C path/to/site serve --port 8080

# Delete the output directory
galerie -C path/to/site clean

# Verbose logging
galerie -C path/to/site -v build    # debug level
galerie -C path/to/site -vv build   # trace level

# Quiet mode (errors only)
galerie -C path/to/site -q build
```

## Output Structure

Running `galerie build` generates:

```
dist/
├── index.html              # Main gallery page
├── photo-name.html         # Individual photo pages (if theme supports)
├── album-name/
│   └── index.html          # Album index (if theme supports)
├── images/
│   ├── photo-abc123-thumb.webp     # 600px thumbnail
│   ├── photo-abc123-full.webp      # 2400px web version
│   └── photo-abc123-original.jpg   # Original file
└── static/
    ├── style-def456.css    # Minified, cache-busted CSS
    └── app-789ghi.js       # Minified, cache-busted JS
```

## Themes

Themes control the look and behavior of generated sites. A theme is a directory with:

```
my-theme/
├── templates/
│   ├── base.html       # Base template (optional, for inheritance)
│   ├── index.html      # Required: main gallery page
│   ├── album.html      # Optional: album index pages
│   └── photo.html      # Optional: individual photo pages
└── static/
    ├── style.css       # Stylesheets
    └── app.js          # JavaScript
```

### Built-in Themes

**basic**: Minimal, clean layout. Good starting point for customization.

**fancy**: Feature-rich dark mode theme with:
- Masonry grid layout (via Masonry.js)
- Photo viewer with keyboard navigation (arrow keys)
- Info drawer with EXIF metadata (press `i`)
- OpenStreetMap integration for GPS coordinates (via Leaflet)
- Filmstrip navigation
- Hash-based routing (SPA-like experience)
- Responsive design

### Theme Resolution

Themes are resolved in order:
1. Local directory matching the theme name
2. Built-in theme with that name
3. Error if not found

To use a local theme:

```toml
# Use ./my-theme/ directory
theme = "my-theme"
```

### Template Variables

Templates receive these variables:

**All templates:**
- `site.domain` - Site domain from config
- `site.title` - Site title (or domain if not set)
- `root` - Root album with all photos and children

**index.html:**
- `photos` - All photos with computed paths:
  - `photo.stem` - Filename without extension
  - `photo.hash` - Content hash
  - `photo.width`, `photo.height` - Dimensions
  - `photo.metadata` - EXIF data (see below)
  - `image_path` - Path to full-size WebP
  - `thumb_path` - Path to thumbnail WebP
  - `original_path` - Path to original file
  - `html_path` - Path to photo's HTML page

**album.html:**
- `album` - Current album
- `photos` - Photos in this album

**photo.html:**
- `album` - Parent album
- `photo` - Current photo
- `prev_photo`, `next_photo` - Adjacent photos (if any)

### Photo Metadata

Each photo includes extracted EXIF metadata:

```javascript
photo.metadata = {
    date_taken: "2024:01:15 14:30:00",
    copyright: "Jane Doe",
    camera: "Canon EOS R5",
    lens: "RF 24-70mm F2.8L IS USM",
    gps: {
        latitude: 35.6762,
        longitude: 139.6503
    },
    exposure: {
        aperture: "f/2.8",
        shutter_speed: "1/250",
        iso: 400,
        focal_length: "50mm"
    }
}
```

### Template Functions

**`static(path)`**: Resolves a static asset path to its cache-busted URL:

```html
<link rel="stylesheet" href="{{ static(path='style.css') }}">
<!-- Output: /static/style-abc123.css -->
```

## Image Processing

galerie processes each source image to generate:

| Output | Format | Max Size | Quality | Purpose |
|--------|--------|----------|---------|---------|
| Thumbnail | WebP | 600px | 80% | Grid previews |
| Full | WebP | 2400px | 90% | Lightbox viewing |
| Original | As-is | - | - | Download option |

Processing is parallelized across CPU cores and cached based on content hash. If a photo hasn't changed, its processed images are reused.

## Asset Optimization

When `minify = true` (default):

- **HTML**: Whitespace removal, attribute minification (via minify-html)
- **CSS**: Full minification with vendor prefix handling (via lightningcss)
- **JavaScript**: Parsing, dead code elimination, minification (via oxc)

Static assets receive content-based hashes in their filenames for cache-busting, enabling aggressive browser caching without stale content issues.

## Stale File Cleanup

galerie tracks all generated files and removes stale outputs from previous builds. If you rename or delete a source photo, the old generated files are cleaned up automatically.

## Supported Image Formats

| Format | Read | Write |
|--------|------|-------|
| JPEG | Yes | As original only |
| PNG | Yes | As original only |
| WebP | Yes | Generated outputs |
| GIF | Yes | As original only |

All generated web images use WebP for optimal file size and quality.

## Development

```bash
# Run with debug logging
RUST_LOG=debug cargo run -- -C example

# Run tests
cargo test

# Format code
cargo fmt

# Lint
cargo clippy
```

## Dependencies

Core processing:
- `image` - Image decoding and resizing
- `webp` - WebP encoding
- `kamadak-exif` - EXIF metadata extraction
- `blake3` - Fast content hashing

Templating and output:
- `tera` - Jinja2-style templates
- `minify-html` - HTML minification
- `lightningcss` - CSS minification
- `oxc` - JavaScript minification

Infrastructure:
- `rayon` - Parallel processing
- `clap` - CLI argument parsing
- `serde` + `toml` - Configuration
- `tracing` - Logging

## License

MIT
