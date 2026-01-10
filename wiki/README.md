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

- [Site Configuration](site-config.md) - How to configure `site.toml`
- [Theme Structure](theme-structure.md) - How to organize a theme
- [Templates](templates.md) - Well-known template names and behavior
- [Template Context](template-context.md) - Variables available in templates

## Design Philosophy

**Convention over configuration**: Template presence determines what gets generated. No manifest files or complex configuration needed.

**Hierarchical albums**: Your directory structure becomes your album hierarchy.

**Theme flexibility**: Themes can be minimal (single page) or full-featured (individual photo pages with navigation).
