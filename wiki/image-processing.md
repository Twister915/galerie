# Image Processing

galerie processes source images to generate optimized web-ready outputs.

## Supported Input Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| JPEG | `.jpg`, `.jpeg` | Most common, EXIF metadata extracted |
| PNG | `.png` | Transparency preserved in original |
| WebP | `.webp` | Both lossy and lossless supported |
| GIF | `.gif` | First frame used for static output |

## Generated Outputs

For each source image, galerie generates:

| Output | Format | Max Dimension | Quality | Purpose |
|--------|--------|---------------|---------|---------|
| Thumbnail | WebP | 600px | 80% | Grid previews, filmstrips |
| Full | WebP | 2400px | 90% | Lightbox viewing |
| Original | As-is | Unchanged | Unchanged | Download option |

Images smaller than the max dimension are not upscaled.

### Output Paths

```
dist/
└── images/
    ├── {stem}-{hash}-thumb.webp    # 600px thumbnail
    ├── {stem}-{hash}-full.webp     # 2400px web version
    └── {stem}-{hash}-original.jpg  # Original file
```

The `{hash}` is an 8-character BLAKE3 content hash for cache-busting.

## Incremental Builds

galerie uses content-addressed caching:

1. Each source image is hashed with BLAKE3
2. If the hash matches a previous build, outputs are reused
3. Only changed or new images are processed

This makes rebuilds fast even for large galleries.

## Parallel Processing

Image processing uses all available CPU cores via Rayon. On multi-core systems, many images are processed simultaneously.

## EXIF Metadata

galerie extracts metadata from source images:

- **Date taken**: Original capture timestamp
- **Camera**: Make and model
- **Lens**: Lens model (if available)
- **GPS**: Coordinates (subject to privacy settings)
- **Exposure**: Aperture, shutter speed, ISO, focal length
- **Copyright**: Copyright notice

See [Template Context](template-context.md#photometadata) for how to use metadata in templates.

### GPS Privacy

The `gps` setting in `site.toml` controls how GPS data is handled:

| Mode | In Template | In Original Download |
|------|-------------|---------------------|
| `on` | Full coordinates | Preserved |
| `general` | City/country only | GPS EXIF stripped |
| `off` | Not available | GPS EXIF stripped |

When stripping GPS, galerie modifies the EXIF data in downloaded originals so exact coordinates are not leaked.

## Stale File Cleanup

galerie tracks all generated files. When source images are renamed or deleted, the old outputs are automatically removed on the next build.

## Asset Optimization

Static assets (CSS, JavaScript) are also optimized:

| Type | Processing | Tool |
|------|------------|------|
| HTML | Whitespace removal, attribute minification | minify-html |
| CSS | Minification, vendor prefixes | lightningcss |
| JavaScript | Parsing, dead code elimination, minification | oxc |

All static assets receive content-based hashes in filenames for cache-busting:

```
dist/static/
├── style-abc123.css
└── app-def456.js
```

Disable with `minify = false` in `site.toml` for debugging.
