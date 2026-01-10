# galerie

A static site generator for image galleries. Like Hugo for blogs, but optimized for photo galleries.

`galerie` takes a folder (or folder tree) full of images and generates a static HTML site with all images properly encoded for web delivery. It combines:
- User configuration
- Theme templates
- Image directory with images and optional sidecar files
- EXIF metadata extraction from images

The system is structured as a pipeline/plugin architecture, where different modules can read input data and transform the output.
