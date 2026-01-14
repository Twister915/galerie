# galerie

A fast, minimal static site generator for photo galleries. Takes a directory of images and produces a complete static website with optimized images, EXIF metadata, and customizable themes.

## Features

- **20 languages supported**: English, Chinese, Spanish, French, Dutch, German, Ukrainian, Russian, Japanese, Arabic, Hindi, Hebrew, Italian, Korean, Polish, Czech, Finnish, Danish, Hungarian, and Portuguese with instant client-side switching
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

# Optional: theme name or path (defaults to "fancy")
# Can be "basic", "fancy", or a path to a local theme directory
# Simple format:
theme = "fancy"
# Extended format with configuration - see "Theme Configuration" section below

# Optional: source directory for photos (defaults to "photos")
photos = "albums"

# Optional: output directory (defaults to "dist")
build = "public"

# Optional: whether to minify output (defaults to true)
minify = true

# Optional: GPS privacy mode (defaults to "on")
# See "GPS Privacy" section below
gps = "general"

# Optional: enable all 20 supported languages
all_languages = true

# Or specify languages individually (names auto-detected)
# [[languages]]
# code = "en"
# [[languages]]
# code = "zh_CN"
```

## GPS Privacy

Control how GPS location data is handled with the `gps` setting:

| Mode | Coordinates | City/Country | Map | Original EXIF |
|------|-------------|--------------|-----|---------------|
| `on` | Shown | Shown | Yes | Preserved |
| `general` | Hidden | Shown | No | GPS stripped |
| `off` | Hidden | Hidden | No | GPS stripped |

**`on`** (default): Full GPS data. Coordinates are displayed, maps are shown, and original files retain their GPS EXIF tags. Use this for public landmarks or when location privacy isn't a concern.

**`general`**: Location privacy with context. Shows city, region, and country (via reverse geocoding) but hides exact coordinates and maps. GPS EXIF is stripped from downloadable originals. Good for travel galleries where you want location context without revealing exact positions.

**`off`**: Maximum privacy. No GPS data is shown or preserved. Use this when location data should be completely removed.

## Theme Configuration

Themes can define configuration options that users can customize. Use the extended `[theme]` table format in `site.toml`:

```toml
[theme]
name = "fancy"
slideshow_delay = 8000
default_sort = "date"
default_sort_direction = "asc"
```

This is equivalent to the simple `theme = "fancy"` format, but allows additional settings.

### How It Works

1. **Theme defaults**: Themes define default values in `theme.toml`
2. **User overrides**: Settings in `site.toml` override theme defaults
3. **Template access**: Config is available as `theme_config` in Tera templates
4. **Frontend access**: Config is injected as `THEME_CONFIG` JavaScript global

### Fancy Theme Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `slideshow_delay` | number | 5000 | Milliseconds between slideshow transitions |
| `default_sort` | string | "shuffle" | Initial sort: shuffle, date, rating, photographer, name |
| `default_sort_direction` | string | "desc" | Sort direction: asc or desc (ignored for shuffle) |

### Creating Theme Configuration

Custom themes can define their own configuration by creating a `theme.toml` file:

```toml
# theme.toml
[defaults]
my_option = "default_value"
another_option = 42
```

In templates, access config values:

```html
{% if theme_config.my_option %}
  <div>{{ theme_config.my_option }}</div>
{% endif %}
```

In JavaScript (for Vite themes):

```javascript
const value = THEME_CONFIG.my_option ?? 'fallback';
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

Themes control the look and behavior of generated sites.

### Classic Themes

Simple themes with plain HTML templates and static assets:

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

### Vite Themes

Modern themes with npm-based builds supporting TypeScript, SCSS, and component frameworks:

```
my-theme/
├── package.json        # Dependencies and build scripts
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
├── src/
│   ├── main.tsx        # Entry point
│   └── styles/
│       └── main.scss   # SCSS styles
├── templates/          # Tera templates (copied to dist)
│   └── index.html
└── dist/               # Built output (auto-generated)
    ├── static/
    │   ├── app.js
    │   └── style.css
    └── templates/
```

Vite themes are automatically detected by the presence of both `package.json` and `vite.config.*`. The build process:
1. Detects package manager (bun, pnpm, yarn, or npm based on lockfiles)
2. Installs dependencies (if `node_modules/` is missing)
3. Cleans the `dist/` directory (removes stale files)
4. Runs `npm run build`

**When does this happen?**
- **Built-in themes**: Built during `cargo build` and embedded into the binary
- **Custom themes**: Built automatically when you run `galerie build` or `galerie serve`

This means you can create a custom Vite theme with TypeScript, Preact, SCSS, etc. and galerie will build it for you—no separate build step required.

See the [Theme Structure](wiki/theme-structure.md) wiki page for detailed Vite theme documentation.

### Built-in Themes

**basic**: Minimal, clean layout. Good starting point for customization. Classic theme with plain CSS.

**fancy**: Feature-rich dark mode theme built with modern tooling:
- Built with Preact (~4KB) and Zustand for state management
- TypeScript and SCSS source code
- Masonry grid layout (via Masonry.js CDN)
- Photo viewer with keyboard navigation (arrow keys)
- Info drawer with EXIF metadata (press `i`)
- Big picture mode with slideshow (press `f`, then `space`)
- OpenStreetMap integration for GPS coordinates (via Leaflet CDN)
- Virtualized filmstrip navigation
- Touch swipe support for mobile
- Hash-based routing (SPA-like experience)
- Responsive design with 20 language support

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
        latitude: 35.6762,       // null when gps = "general" or "off"
        longitude: 139.6503,     // null when gps = "general" or "off"
        display: "35.6762, 139.6503",  // null when gps = "general" or "off"
        city: "Shibuya",
        region: "Tokyo",
        country: "Japan",
        flag: "🇯🇵"
    },
    exposure: {
        aperture: "f/2.8",
        shutter_speed: "1/250",
        iso: 400,
        focal_length: "50mm"
    }
}
```

When `gps = "general"`, the `latitude`, `longitude`, and `display` fields are `null`, but `city`, `region`, `country`, and `flag` are still populated. When `gps = "off"`, the entire `gps` object is `null`.

### Template Functions

**`static(path)`**: Resolves a static asset path to its cache-busted URL:

```html
<link rel="stylesheet" href="{{ static(path='style.css') }}">
<!-- Output: /static/style-abc123.css -->
```

## Internationalization (i18n)

galerie includes a client-side internationalization system supporting 20 languages out of the box.

### Supported Languages

| Code | Language |
|------|----------|
| en | English |
| zh_CN | Simplified Chinese (简体中文) |
| es | Spanish (Español) |
| fr | French (Français) |
| nl | Dutch (Nederlands) |
| de | German (Deutsch) |
| uk | Ukrainian (Українська) |
| ru | Russian (Русский) |
| ja | Japanese (日本語) |
| ar | Arabic (العربية) |
| hi | Hindi (हिन्दी) |
| he | Hebrew (עברית) |
| it | Italian (Italiano) |
| ko | Korean (한국어) |
| pl | Polish (Polski) |
| cs | Czech (Čeština) |
| fi | Finnish (Suomi) |
| da | Danish (Dansk) |
| hu | Hungarian (Magyar) |
| pt | Portuguese (Português) |

### Configuration

**Enable all 20 languages:**

```toml
all_languages = true
```

**Or select specific languages** (display names are auto-detected):

```toml
[[languages]]
code = "en"

[[languages]]
code = "zh_CN"

[[languages]]
code = "ja"
```

**Override display names** if needed:

```toml
[[languages]]
code = "en"
name = "English (US)"
```

If neither `all_languages` nor `languages` is specified, the site defaults to English only and no language picker is shown.

### How It Works

- **Client-side switching**: All translations are embedded in the HTML as JSON. Language switching happens instantly via JavaScript without page reloads.
- **Browser detection**: On first visit, the user's browser language preferences are checked and the best matching language is auto-selected.
- **Persistence**: User's language choice is saved in `localStorage` and persists across sessions.
- **Fallback**: If a translation key is missing in the selected language, English is used as fallback.

### What Gets Translated

- **UI elements**: Navigation labels, section headers, field names, action buttons
- **Country names**: ~50 common countries are translated in all languages
- **Footer branding**: "Built with galerie" adapts to each language's word order

### Theme Integration

Both built-in themes (`basic` and `fancy`) support i18n. For the `fancy` theme:
- A dropdown language picker appears in the header when multiple languages are configured
- The info drawer metadata labels are translated
- Country names in GPS location data are localized

For custom themes, use the `data-i18n` attribute on elements:

```html
<span data-i18n="nav.previous">Previous</span>
```

Or use the `t()` function in JavaScript:

```javascript
var label = t('field.camera');  // Returns translated "Camera"
```

### Available Translation Keys

**Navigation**: `nav.previous`, `nav.next`, `nav.index`, `nav.close`

**Sections**: `section.albums`, `section.photo`, `section.date`, `section.camera`, `section.exposure`, `section.location`, `section.copyright`

**Fields**: `field.name`, `field.taken`, `field.camera`, `field.lens`, `field.aperture`, `field.shutter`, `field.iso`, `field.focal_length`, `field.place`, `field.country`, `field.coordinates`

**Actions**: `action.download`, `action.toggle_info`

**Footer**: `footer.built_with`, `footer.built_with_suffix`

**Countries**: `country.{CODE}` where CODE is ISO 3166-1 alpha-2 (e.g., `country.US`, `country.JP`)

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
- `little_exif` - EXIF metadata extraction and modification
- `reverse_geocoder` - Offline reverse geocoding for GPS privacy modes
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
