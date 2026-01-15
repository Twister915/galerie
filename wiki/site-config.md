# Site Configuration

galerie sites are configured via a `site.toml` file in the site root directory.

## Example

Minimal configuration:
```toml
domain = "photos.example.com"
theme = "theme"
```

Full configuration:
```toml
domain = "photos.example.com"
theme = "themes/gallery"
photos = "albums"
build = "public"
```

## Fields

### `domain` (required)

The domain where this site will be hosted. Used in templates for generating absolute URLs.

```toml
domain = "photos.example.com"
```

### `theme` (required)

Path to the theme directory, relative to the site root.

```toml
theme = "theme"
theme = "themes/minimal"
theme = "../shared-themes/gallery"
```

The theme directory must contain a `templates/` subdirectory with at least an `index.html` template. See [Theme Structure](theme-structure.md) for details.

### `photos` (optional)

Path to the photos directory, relative to the site root. Defaults to `"photos"`.

```toml
photos = "photos"
photos = "albums"
photos = "."  # Photos in site root
```

The directory structure within `photos` determines album hierarchy. See [Templates](templates.md) for how albums are rendered.

### `build` (optional)

Path for the generated output, relative to the site root. Defaults to `"dist"`.

```toml
build = "dist"
build = "public"
build = "_site"
```

This directory will be created (or cleared) when galerie runs.

### `title` (optional)

Site title used in templates. Defaults to the domain value.

```toml
title = "My Photo Gallery"
```

### `minify` (optional)

Whether to minify HTML, CSS, and JavaScript output. Defaults to `true`.

```toml
minify = true   # HTML, CSS, JS minification enabled
minify = false  # Output is not minified (useful for debugging)
```

When enabled:
- HTML: Whitespace removal, attribute minification (via minify-html)
- CSS: Full minification with vendor prefix handling (via lightningcss)
- JavaScript: Parsing, dead code elimination, minification (via oxc)

### `gps` (optional)

Controls how GPS location data is handled. Defaults to `"on"`.

```toml
gps = "on"       # Full GPS data preserved
gps = "general"  # City/country shown, coordinates hidden
gps = "off"      # No GPS data shown or preserved
```

| Mode | Coordinates in UI | City/Country in UI | GPS in Downloads |
|------|-------------------|-------------------|------------------|
| `on` | Shown | Shown | Preserved |
| `general` | Hidden | Shown | Stripped |
| `off` | Hidden | Hidden | Stripped |

**`on`**: Full GPS data. Coordinates are displayed, maps work, and original files retain GPS EXIF tags. Use for public landmarks or when privacy isn't a concern.

**`general`**: Location privacy with context. Shows city, region, and country (via offline reverse geocoding) but hides exact coordinates and disables maps. GPS EXIF is stripped from downloadable originals. Good for travel galleries where you want location context without revealing exact positions.

**`off`**: Maximum privacy. No GPS data is shown or preserved.

### `all_languages` (optional)

Enable all 20 supported languages. When enabled, a language picker appears in themes that support i18n.

```toml
all_languages = true
```

See [Internationalization](i18n.md) for the full language list.

### `[[languages]]` (optional)

Select specific languages instead of enabling all. Display names are auto-detected from the language code.

```toml
[[languages]]
code = "en"

[[languages]]
code = "zh_CN"

[[languages]]
code = "ja"
```

Override display names if needed:

```toml
[[languages]]
code = "en"
name = "English (US)"
```

If neither `all_languages` nor `languages` is specified, the site defaults to English only and no language picker is shown.

## Theme Configuration

Themes can accept custom configuration. Use the extended `[theme]` table format:

```toml
[theme]
name = "fancy"
slideshow_delay = 8000
default_sort = "date"
```

This is equivalent to `theme = "fancy"` but allows additional settings.

### How It Works

1. **Theme defaults**: Themes define defaults in `theme.toml` at the theme root
2. **User overrides**: Settings in `site.toml` override theme defaults
3. **Template access**: Config is available as `theme_config` in templates
4. **Frontend access**: Config is injected as `THEME_CONFIG` JavaScript global

### Example Theme Defaults

A theme's `theme.toml`:

```toml
[defaults]
slideshow_delay = 5000
default_sort = "shuffle"
```

### Fancy Theme Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `slideshow_delay` | number | 5000 | Milliseconds between slideshow transitions |
| `default_sort` | string | "shuffle" | Initial sort: shuffle, date, rating, photographer, name |
| `default_sort_direction` | string | "desc" | Sort direction: asc or desc (ignored for shuffle) |
