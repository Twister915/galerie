# galerie

A static site generator for image galleries. Like Hugo for blogs, but optimized for photo galleries.

## What is galerie?

galerie takes a folder of images and generates a static HTML website. It combines:

- Your photos (organized into albums via directories)
- A theme (templates + static assets)
- Site configuration (domain, paths)

The output is a fully static site you can deploy anywhere.

## Quick Start

1. Create a site directory with your photos:
   ```
   my-gallery/
   ├── site.toml
   ├── theme/
   │   └── templates/
   │       └── index.html
   └── photos/
       ├── vacation-2025/
       │   ├── beach.jpg
       │   └── sunset.jpg
       └── portraits/
           └── family.jpg
   ```

2. Configure `site.toml`:
   ```toml
   domain = "photos.example.com"
   theme = "theme"
   ```

3. Run galerie:
   ```bash
   galerie -C my-gallery
   ```

4. Your site is generated in `my-gallery/dist/`

## Documentation

- [Installation](install.md) - Build from source or download pre-built binaries
- [Site Configuration](site-config.md) - How to configure `site.toml`
- [Theme Structure](theme-structure.md) - How to organize a theme (classic and Vite-based)
- [Templates](templates.md) - Well-known template names and behavior
- [Template Context](template-context.md) - Variables available in templates
- [Hosting](hosting.md) - Deploy to S3, GCS, nginx, Apache, and Cloudflare
- [Raspberry Pi Setup](raspberry-pi-setup.md) - Auto-rebuild server with systemd and nginx

## Theme Development

galerie supports two types of themes:

- **Classic themes**: Plain HTML/CSS/JS with no build step
- **Vite themes**: Modern npm-based builds with TypeScript, SCSS, Preact/React support

See [Theme Structure](theme-structure.md) for detailed documentation on creating themes with Vite.

## Design Philosophy

**Convention over configuration**: Template presence determines what gets generated. No manifest files or complex configuration needed.

**Hierarchical albums**: Your directory structure becomes your album hierarchy.

**Theme flexibility**: Themes can be minimal (single page) or full-featured (individual photo pages with navigation).
