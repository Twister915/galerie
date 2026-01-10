# Theme Structure

A galerie theme is a directory containing templates and optional static assets.

## Directory Layout

```
my-theme/
├── templates/
│   ├── base.html       # Optional: common wrapper
│   ├── index.html      # Required: site homepage
│   ├── album.html      # Optional: album pages
│   └── photo.html      # Optional: photo pages
└── static/             # Optional: CSS, JS, images
    ├── style.css
    └── ...
```

## Required Files

### `templates/index.html`

Every theme must have an `index.html` template. This is the site homepage.

See [Templates](templates.md) for details on what context is available.

## Optional Files

### `templates/album.html`

If present, galerie generates a page for each album at `/{album-slug}/index.html`.

If absent, no album pages are generated.

### `templates/photo.html`

If present, galerie generates a page for each photo at `/{album-slug}/{photo-stem}.html`.

If absent, no individual photo pages are generated. This is useful for SPA-style themes where JavaScript handles photo viewing.

### `templates/base.html`

By convention, themes use `base.html` as a wrapper that other templates extend. This is not enforced - you can organize templates however you prefer.

### `static/`

If present, the entire `static/` directory is copied to the output at `/static/`.

Reference static assets from templates:
```html
<link rel="stylesheet" href="/static/style.css">
<script src="/static/gallery.js"></script>
```

## Theme Examples

### Minimal Theme (SPA-style)

```
minimal-theme/
└── templates/
    └── index.html
```

Single page, all photos rendered inline. JavaScript handles navigation.

### Standard Theme

```
standard-theme/
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── album.html
│   └── photo.html
└── static/
    └── style.css
```

Full multi-page experience with album and photo pages.

### Album-Only Theme

```
album-theme/
├── templates/
│   ├── base.html
│   ├── index.html
│   └── album.html
└── static/
    ├── style.css
    └── lightbox.js
```

Album pages with JavaScript lightbox for viewing individual photos.

## Using a Theme

Reference a theme in `site.toml`:

```toml
theme = "theme"                    # Relative to site root
theme = "themes/gallery"           # Nested directory
theme = "../shared-themes/minimal" # Outside site root
```

The theme path is always relative to the site root directory.
