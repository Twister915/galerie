use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tera::Context;

use crate::config::Site;
use crate::error::{Error, Result};
use crate::photos::{Album, Photo};
use crate::processing;
use crate::theme::{templates, StaticSource, Theme};
use crate::builtin_themes;

/// Site context passed to all templates.
#[derive(Debug, Serialize)]
struct SiteContext {
    domain: String,
    title: String,
}

/// The pipeline combines configuration, theme, and photos to build a site.
#[derive(Debug)]
pub struct Pipeline {
    /// Site configuration
    pub config: Site,

    /// Loaded theme
    pub theme: Theme,

    /// Root album containing all photos
    pub root: Album,

    /// Site directory (where site.toml lives)
    pub site_dir: PathBuf,
}

impl Pipeline {
    /// Load all components for site generation.
    pub fn load(site_dir: PathBuf, config: Site) -> Result<Self> {
        // Resolve paths relative to site directory
        let local_theme_path = site_dir.join(&config.theme);
        let photos_path = site_dir.join(&config.photos);

        // Try local directory first, then built-in themes
        let theme = if local_theme_path.is_dir() {
            tracing::debug!(theme = %local_theme_path.display(), "loading local theme");
            Theme::load(&local_theme_path)?
        } else if let Some(builtin) = builtin_themes::get(&config.theme) {
            tracing::debug!(theme = %config.theme, "loading built-in theme");
            Theme::from_builtin(builtin)?
        } else {
            return Err(Error::ThemeNotFound {
                name: config.theme.clone(),
            });
        };

        tracing::debug!(photos = %photos_path.display(), "discovering photos");
        let root = crate::photos::discover(&photos_path)?;

        tracing::info!(
            photos = root.photo_count(),
            albums = root.children.len(),
            "pipeline loaded"
        );

        Ok(Self {
            config,
            theme,
            root,
            site_dir,
        })
    }

    /// Build the site to the output directory.
    pub fn build(&mut self) -> Result<()> {
        let output_dir = self.site_dir.join(&self.config.build);

        tracing::info!(output = %output_dir.display(), "building site");

        // Create output directory (don't delete - we cache processed images)
        fs::create_dir_all(&output_dir)?;

        // Create images directory for caching check
        let images_dir = output_dir.join("images");
        fs::create_dir_all(&images_dir)?;

        // Copy static assets
        self.copy_static(&output_dir)?;

        // Process images (extract metadata, generate variants)
        // Cached images are skipped if output files with same hash exist
        // Files are written directly during processing
        tracing::info!("processing photos");
        let stats = processing::process_album(&mut self.root, &images_dir)?;
        tracing::info!(
            total = stats.total,
            cached = stats.cached,
            generated = stats.generated,
            "photos processed"
        );

        // Render pages
        self.render_index(&output_dir)?;

        if self.theme.has_album_template {
            self.render_albums(&output_dir)?;
        }

        if self.theme.has_photo_template {
            self.render_photos(&output_dir)?;
        }

        tracing::info!("build complete");

        Ok(())
    }

    /// Copy static assets from theme to output.
    fn copy_static(&self, output_dir: &Path) -> Result<()> {
        let dest = output_dir.join("static");

        match &self.theme.static_source {
            StaticSource::Directory(dir) => {
                copy_dir_recursive(dir, &dest)?;
                tracing::debug!(from = %dir.display(), to = %dest.display(), "copied static assets");
            }
            StaticSource::Builtin(embedded_dir) => {
                fs::create_dir_all(&dest)?;
                // Write all files from embedded directory (skip hidden files)
                for file in embedded_dir.files() {
                    let Some(name) = file.path().file_name().and_then(|n| n.to_str()) else {
                        continue;
                    };
                    if name.starts_with('.') {
                        continue;
                    }
                    fs::write(dest.join(name), file.contents())?;
                }
                tracing::debug!(to = %dest.display(), "copied embedded static assets");
            }
            StaticSource::None => {}
        }

        Ok(())
    }

    /// Render the site index page.
    fn render_index(&self, output_dir: &Path) -> Result<()> {
        let mut context = self.base_context();
        context.insert("root", &self.root);

        // Collect all photos with their paths pre-computed
        let all_photos: Vec<_> = self
            .root
            .all_photos()
            .iter()
            .map(|p| {
                let album_path = self.find_album_path_for_photo(p);
                PhotoWithPaths {
                    photo: (*p).clone(),
                    image_path: p.image_path(&album_path),
                    thumb_path: p.thumb_path(&album_path),
                    original_path: p.original_path(&album_path),
                    html_path: p.html_path(&album_path),
                }
            })
            .collect();
        context.insert("photos", &all_photos);

        let html = self.theme.templates.render(templates::INDEX, &context)?;

        let dest = output_dir.join("index.html");
        fs::write(&dest, html)?;

        tracing::debug!(path = %dest.display(), "rendered index");

        Ok(())
    }

    /// Render album pages (if album.html template exists).
    fn render_albums(&self, output_dir: &Path) -> Result<()> {
        self.render_album_recursive(&self.root, output_dir, true)?;
        Ok(())
    }

    fn render_album_recursive(
        &self,
        album: &Album,
        output_dir: &Path,
        is_root: bool,
    ) -> Result<()> {
        // Skip root album (it's handled by index.html)
        if !is_root {
            let mut context = self.base_context();
            context.insert("root", &self.root);
            context.insert("album", album);

            // Add photos with pre-computed paths
            let photos_with_paths: Vec<_> = album
                .photos
                .iter()
                .map(|p| PhotoWithPaths {
                    photo: p.clone(),
                    image_path: p.image_path(&album.path),
                    thumb_path: p.thumb_path(&album.path),
                    original_path: p.original_path(&album.path),
                    html_path: p.html_path(&album.path),
                })
                .collect();
            context.insert("photos", &photos_with_paths);

            let html = self.theme.templates.render(templates::ALBUM, &context)?;

            let album_dir = output_dir.join(&album.path);
            fs::create_dir_all(&album_dir)?;

            let dest = album_dir.join("index.html");
            fs::write(&dest, html)?;

            tracing::debug!(album = %album.name, path = %dest.display(), "rendered album");
        }

        // Recurse into children
        for child in &album.children {
            self.render_album_recursive(child, output_dir, false)?;
        }

        Ok(())
    }

    /// Render individual photo pages (if photo.html template exists).
    fn render_photos(&self, output_dir: &Path) -> Result<()> {
        self.render_photos_in_album(&self.root, output_dir)?;
        Ok(())
    }

    fn render_photos_in_album(&self, album: &Album, output_dir: &Path) -> Result<()> {
        let photos = &album.photos;

        for (i, photo) in photos.iter().enumerate() {
            let prev_photo = if i > 0 { Some(&photos[i - 1]) } else { None };
            let next_photo = photos.get(i + 1);

            let mut context = self.base_context();
            context.insert("root", &self.root);
            context.insert("album", album);

            // Current photo with paths
            let photo_ctx = PhotoWithPaths {
                photo: photo.clone(),
                image_path: photo.image_path(&album.path),
                thumb_path: photo.thumb_path(&album.path),
                original_path: photo.original_path(&album.path),
                html_path: photo.html_path(&album.path),
            };
            context.insert("photo", &photo_ctx);

            // Prev/next with paths
            if let Some(p) = prev_photo {
                context.insert(
                    "prev_photo",
                    &PhotoWithPaths {
                        photo: p.clone(),
                        image_path: p.image_path(&album.path),
                        thumb_path: p.thumb_path(&album.path),
                        original_path: p.original_path(&album.path),
                        html_path: p.html_path(&album.path),
                    },
                );
            }
            if let Some(p) = next_photo {
                context.insert(
                    "next_photo",
                    &PhotoWithPaths {
                        photo: p.clone(),
                        image_path: p.image_path(&album.path),
                        thumb_path: p.thumb_path(&album.path),
                        original_path: p.original_path(&album.path),
                        html_path: p.html_path(&album.path),
                    },
                );
            }

            let html = self.theme.templates.render(templates::PHOTO, &context)?;

            // Determine output path
            let dest = if album.path.as_os_str().is_empty() {
                output_dir.join(format!("{}.html", photo.stem))
            } else {
                let album_dir = output_dir.join(&album.path);
                fs::create_dir_all(&album_dir)?;
                album_dir.join(format!("{}.html", photo.stem))
            };

            fs::write(&dest, html)?;

            tracing::trace!(photo = %photo.stem, path = %dest.display(), "rendered photo");
        }

        // Recurse into children
        for child in &album.children {
            self.render_photos_in_album(child, output_dir)?;
        }

        Ok(())
    }

    /// Create base context with site info.
    fn base_context(&self) -> Context {
        let mut context = Context::new();
        context.insert(
            "site",
            &SiteContext {
                title: self
                    .config
                    .title
                    .clone()
                    .unwrap_or_else(|| self.config.domain.clone()),
                domain: self.config.domain.clone(),
            },
        );
        context
    }

    /// Find the album path for a given photo.
    fn find_album_path_for_photo(&self, photo: &Photo) -> PathBuf {
        self.find_album_path_recursive(&self.root, photo)
            .unwrap_or_default()
    }

    fn find_album_path_recursive(&self, album: &Album, photo: &Photo) -> Option<PathBuf> {
        // Check if photo is in this album
        if album.photos.iter().any(|p| p.stem == photo.stem) {
            return Some(album.path.clone());
        }

        // Check children
        for child in &album.children {
            if let Some(path) = self.find_album_path_recursive(child, photo) {
                return Some(path);
            }
        }

        None
    }
}

/// Photo with pre-computed paths for templates.
#[derive(Debug, Serialize)]
struct PhotoWithPaths {
    #[serde(flatten)]
    photo: Photo,
    image_path: String,
    thumb_path: String,
    original_path: String,
    html_path: String,
}

/// Recursively copy a directory.
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}
