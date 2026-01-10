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
