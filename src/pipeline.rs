use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::Serialize;
use tera::{Context, Function, Value};

use crate::builtin_themes;
use crate::config::Site;
use crate::error::{Error, Result};
use crate::i18n;
use crate::minify;
use crate::photos::{Album, Photo};
use crate::processing;
use crate::theme::{templates, StaticSource, Theme};

/// Mapping from original asset path to hashed output path.
/// e.g., "style.css" -> "/static/style-abc12345.css"
pub type AssetManifest = HashMap<String, String>;

/// Version injected at build time.
const VERSION: &str = env!("GIT_VERSION");

/// Site context passed to all templates.
#[derive(Debug, Clone, Serialize)]
struct SiteContext {
    domain: String,
    title: String,
    version: &'static str,
}

/// Manifest of generated data files with their hashed URLs.
#[derive(Debug, Default, Serialize)]
struct DataManifest {
    /// Map of language code to i18n JSON URL (e.g., "en" -> "/static/i18n/en-abc12345.json")
    i18n: HashMap<String, String>,
    /// URL to gallery data JSON file (e.g., "/static/gallery-def67890.json")
    gallery: String,
}

/// Gallery data structure for JSON serialization.
#[derive(Debug, Serialize)]
struct GalleryData {
    site: SiteContext,
    albums: Vec<AlbumData>,
    photos: Vec<PhotoData>,
}

/// Album data for gallery JSON.
#[derive(Debug, Serialize)]
struct AlbumData {
    name: String,
    slug: String,
    path: String,
}

/// Photo data for gallery JSON.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhotoData {
    stem: String,
    hash: String,
    width: u32,
    height: u32,
    image_path: String,
    thumb_path: String,
    original_path: String,
    html_path: String,
    metadata: PhotoMetadataData,
}

/// Photo metadata for gallery JSON.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhotoMetadataData {
    date_taken: Option<String>,
    camera: Option<String>,
    lens: Option<String>,
    copyright: Option<String>,
    gps: Option<GpsData>,
    exposure: Option<ExposureData>,
}

/// GPS data for gallery JSON.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GpsData {
    latitude: Option<f64>,
    longitude: Option<f64>,
    display: Option<String>,
    city: Option<String>,
    region: Option<String>,
    country: Option<String>,
    country_code: Option<String>,
    flag: Option<String>,
}

/// Exposure data for gallery JSON.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExposureData {
    aperture: Option<String>,
    shutter_speed: Option<String>,
    iso: Option<u32>,
    focal_length: Option<String>,
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

        // Track all files we generate for cleanup of stale files
        let mut expected_files: HashSet<PathBuf> = HashSet::new();

        // Create output directory (don't delete - we cache processed images)
        fs::create_dir_all(&output_dir)?;

        // Create images directory for caching check
        let images_dir = output_dir.join("images");
        fs::create_dir_all(&images_dir)?;

        // Process images (extract metadata, generate variants)
        // Must happen before data file generation so photo metadata is populated
        tracing::info!("processing photos");
        let stats = processing::process_album(&mut self.root, &images_dir, self.config.gps)?;
        tracing::info!(
            total = stats.total,
            cached = stats.cached,
            generated = stats.generated,
            copied = stats.copied,
            "photos processed"
        );

        // Track expected image files
        self.collect_expected_images(&images_dir, &mut expected_files);

        // Generate static data files (i18n and gallery JSON)
        let data_manifest = self.generate_data_files(&mut expected_files)?;

        // Copy static assets and get manifest for template function
        let asset_manifest = self.copy_static(&output_dir, &mut expected_files)?;

        // Register the static() template function with the asset manifest
        self.theme
            .templates
            .register_function("static", make_static_function(asset_manifest));

        // Render pages
        self.render_index(&output_dir, &data_manifest, &mut expected_files)?;

        if self.theme.has_album_template {
            self.render_albums(&output_dir, &data_manifest, &mut expected_files)?;
        }

        if self.theme.has_photo_template {
            self.render_photos(&output_dir, &data_manifest, &mut expected_files)?;
        }

        // Clean up stale files from previous builds
        let removed = self.cleanup_stale_files(&output_dir, &expected_files)?;
        if removed > 0 {
            tracing::info!(removed, "cleaned up stale files");
        }

        tracing::info!("build complete");

        Ok(())
    }

    /// Copy static assets from theme to output, returning the asset manifest.
    fn copy_static(
        &self,
        output_dir: &Path,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<AssetManifest> {
        let dest = output_dir.join("static");
        let should_minify = self.config.minify;
        let mut manifest = AssetManifest::new();

        match &self.theme.static_source {
            StaticSource::Directory(dir) => {
                fs::create_dir_all(&dest)?;
                copy_dir_with_hashing(dir, &dest, "", expected, should_minify, &mut manifest)?;
                tracing::debug!(
                    from = %dir.display(),
                    to = %dest.display(),
                    minify = should_minify,
                    assets = manifest.len(),
                    "copied static assets"
                );
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

                    let contents = process_static_file(name, file.contents(), should_minify)?;
                    let hashed_name = hash_filename(name, &contents);
                    let file_path = dest.join(&hashed_name);

                    fs::write(&file_path, contents)?;
                    expected.insert(file_path);
                    manifest.insert(name.to_string(), format!("/static/{}", hashed_name));
                }
                tracing::debug!(
                    to = %dest.display(),
                    minify = should_minify,
                    assets = manifest.len(),
                    "copied embedded static assets"
                );
            }
            StaticSource::None => {}
        }

        Ok(manifest)
    }

    /// Render the site index page.
    fn render_index(
        &self,
        output_dir: &Path,
        data_manifest: &DataManifest,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        let mut context = self.base_context(data_manifest);
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
                    original_path: p.original_path(&album_path, self.config.gps),
                    html_path: p.html_path(&album_path),
                }
            })
            .collect();
        context.insert("photos", &all_photos);

        let mut html = self.theme.templates.render(templates::INDEX, &context)?;
        if self.config.minify {
            html = minify::html(&html)?;
        }

        let dest = output_dir.join("index.html");
        fs::write(&dest, html)?;
        expected.insert(dest.clone());

        tracing::debug!(path = %dest.display(), "rendered index");

        Ok(())
    }

    /// Render album pages (if album.html template exists).
    fn render_albums(
        &self,
        output_dir: &Path,
        data_manifest: &DataManifest,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        self.render_album_recursive(&self.root, output_dir, data_manifest, true, expected)?;
        Ok(())
    }

    fn render_album_recursive(
        &self,
        album: &Album,
        output_dir: &Path,
        data_manifest: &DataManifest,
        is_root: bool,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        // Skip root album (it's handled by index.html)
        if !is_root {
            let mut context = self.base_context(data_manifest);
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
                    original_path: p.original_path(&album.path, self.config.gps),
                    html_path: p.html_path(&album.path),
                })
                .collect();
            context.insert("photos", &photos_with_paths);

            let mut html = self.theme.templates.render(templates::ALBUM, &context)?;
            if self.config.minify {
                html = minify::html(&html)?;
            }

            let album_dir = output_dir.join(&album.path);
            fs::create_dir_all(&album_dir)?;

            let dest = album_dir.join("index.html");
            fs::write(&dest, html)?;
            expected.insert(dest.clone());

            tracing::debug!(album = %album.name, path = %dest.display(), "rendered album");
        }

        // Recurse into children
        for child in &album.children {
            self.render_album_recursive(child, output_dir, data_manifest, false, expected)?;
        }

        Ok(())
    }

    /// Render individual photo pages (if photo.html template exists).
    fn render_photos(
        &self,
        output_dir: &Path,
        data_manifest: &DataManifest,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        self.render_photos_in_album(&self.root, output_dir, data_manifest, expected)?;
        Ok(())
    }

    fn render_photos_in_album(
        &self,
        album: &Album,
        output_dir: &Path,
        data_manifest: &DataManifest,
        expected: &mut HashSet<PathBuf>,
    ) -> Result<()> {
        let photos = &album.photos;

        for (i, photo) in photos.iter().enumerate() {
            let prev_photo = if i > 0 { Some(&photos[i - 1]) } else { None };
            let next_photo = photos.get(i + 1);

            let mut context = self.base_context(data_manifest);
            context.insert("root", &self.root);
            context.insert("album", album);

            // Current photo with paths
            let photo_ctx = PhotoWithPaths {
                photo: photo.clone(),
                image_path: photo.image_path(&album.path),
                thumb_path: photo.thumb_path(&album.path),
                original_path: photo.original_path(&album.path, self.config.gps),
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
                        original_path: p.original_path(&album.path, self.config.gps),
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
                        original_path: p.original_path(&album.path, self.config.gps),
                        html_path: p.html_path(&album.path),
                    },
                );
            }

            let mut html = self.theme.templates.render(templates::PHOTO, &context)?;
            if self.config.minify {
                html = minify::html(&html)?;
            }

            // Determine output path
            let dest = if album.path.as_os_str().is_empty() {
                output_dir.join(format!("{}.html", photo.stem))
            } else {
                let album_dir = output_dir.join(&album.path);
                fs::create_dir_all(&album_dir)?;
                album_dir.join(format!("{}.html", photo.stem))
            };

            fs::write(&dest, html)?;
            expected.insert(dest.clone());

            tracing::trace!(photo = %photo.stem, path = %dest.display(), "rendered photo");
        }

        // Recurse into children
        for child in &album.children {
            self.render_photos_in_album(child, output_dir, data_manifest, expected)?;
        }

        Ok(())
    }

    /// Create base context with site info and data URLs.
    fn base_context(&self, data_manifest: &DataManifest) -> Context {
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
                version: VERSION,
            },
        );

        // Add data file URLs for async loading
        context.insert("data_urls", data_manifest);
        context.insert("languages", &self.config.languages());
        context.insert("default_lang", &self.config.default_lang());

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

    /// Collect expected image files based on current photos.
    fn collect_expected_images(&self, images_dir: &Path, expected: &mut HashSet<PathBuf>) {
        self.collect_album_images(&self.root, images_dir, expected);
    }

    fn collect_album_images(&self, album: &Album, images_dir: &Path, expected: &mut HashSet<PathBuf>) {
        // Images for this album go into images/ or images/{album_path}/
        let album_images_dir = if album.path.as_os_str().is_empty() {
            images_dir.to_path_buf()
        } else {
            images_dir.join(&album.path)
        };

        for photo in &album.photos {
            // Matches processing.rs naming: {stem}-{hash}-{variant}.{ext}
            expected.insert(album_images_dir.join(format!(
                "{}-{}-thumb.webp",
                photo.stem, photo.hash
            )));
            expected.insert(album_images_dir.join(format!(
                "{}-{}-full.webp",
                photo.stem, photo.hash
            )));
            expected.insert(album_images_dir.join(format!(
                "{}-{}-original{}.{}",
                photo.stem, photo.hash, self.config.gps.original_suffix(), photo.extension
            )));
        }

        for child in &album.children {
            self.collect_album_images(child, images_dir, expected);
        }
    }

    /// Generate static data files (i18n and gallery JSON) and return their manifest.
    fn generate_data_files(&self, expected: &mut HashSet<PathBuf>) -> Result<DataManifest> {
        let static_dir = self.site_dir.join(&self.config.build).join("static");
        fs::create_dir_all(&static_dir)?;

        let mut manifest = DataManifest::default();

        // Generate per-language i18n JSON files
        let i18n_dir = static_dir.join("i18n");
        fs::create_dir_all(&i18n_dir)?;

        let all_translations = i18n::get_all_translations();
        for (lang_code, translations) in &all_translations {
            let lang_json = serde_json::to_string(translations)
                .map_err(|e| Error::Other(format!("failed to serialize i18n for {}: {}", lang_code, e)))?;
            let lang_hash = &blake3::hash(lang_json.as_bytes()).to_hex()[..8];
            let lang_filename = format!("{}-{}.json", lang_code, lang_hash);
            let lang_path = i18n_dir.join(&lang_filename);
            fs::write(&lang_path, &lang_json)?;
            expected.insert(lang_path);
            manifest.i18n.insert(
                lang_code.clone(),
                format!("/static/i18n/{}", lang_filename),
            );
        }

        // Generate gallery JSON (photos and albums)
        let gallery_data = self.build_gallery_data();
        let gallery_json = serde_json::to_string(&gallery_data)
            .map_err(|e| Error::Other(format!("failed to serialize gallery: {}", e)))?;
        let gallery_hash = &blake3::hash(gallery_json.as_bytes()).to_hex()[..8];
        let gallery_filename = format!("gallery-{}.json", gallery_hash);
        let gallery_path = static_dir.join(&gallery_filename);
        fs::write(&gallery_path, &gallery_json)?;
        expected.insert(gallery_path);
        manifest.gallery = format!("/static/{}", gallery_filename);

        tracing::debug!(
            i18n_languages = manifest.i18n.len(),
            gallery = %manifest.gallery,
            "generated data files"
        );

        Ok(manifest)
    }

    /// Build gallery data structure for JSON serialization.
    fn build_gallery_data(&self) -> GalleryData {
        let site = SiteContext {
            title: self
                .config
                .title
                .clone()
                .unwrap_or_else(|| self.config.domain.clone()),
            domain: self.config.domain.clone(),
            version: VERSION,
        };

        // Collect all albums (excluding root)
        let albums: Vec<AlbumData> = self
            .root
            .children
            .iter()
            .map(|a| AlbumData {
                name: a.name.clone(),
                slug: a.slug.clone(),
                path: a.path.to_string_lossy().to_string(),
            })
            .collect();

        // Collect all photos with computed paths
        let photos: Vec<PhotoData> = self
            .root
            .all_photos()
            .iter()
            .map(|p| {
                let album_path = self.find_album_path_for_photo(p);
                PhotoData {
                    stem: p.stem.clone(),
                    hash: p.hash.clone(),
                    width: p.width,
                    height: p.height,
                    image_path: p.image_path(&album_path),
                    thumb_path: p.thumb_path(&album_path),
                    original_path: p.original_path(&album_path, self.config.gps),
                    html_path: p.html_path(&album_path),
                    metadata: self.convert_photo_metadata(&p.metadata),
                }
            })
            .collect();

        GalleryData {
            site,
            albums,
            photos,
        }
    }

    /// Convert photo metadata to JSON-serializable structure.
    fn convert_photo_metadata(&self, metadata: &crate::photos::PhotoMetadata) -> PhotoMetadataData {
        PhotoMetadataData {
            date_taken: metadata.date_taken.clone(),
            camera: metadata.camera.clone(),
            lens: metadata.lens.clone(),
            copyright: metadata.copyright.clone(),
            gps: metadata.gps.as_ref().map(|g| GpsData {
                latitude: g.latitude,
                longitude: g.longitude,
                display: g.display.clone(),
                city: g.city.clone(),
                region: g.region.clone(),
                country: g.country.clone(),
                country_code: g.country_code.clone(),
                flag: g.flag.clone(),
            }),
            exposure: metadata.exposure.as_ref().map(|e| ExposureData {
                aperture: e.aperture.clone(),
                shutter_speed: e.shutter_speed.clone(),
                iso: e.iso,
                focal_length: e.focal_length.clone(),
            }),
        }
    }

    /// Remove files from output directory that aren't in the expected set.
    fn cleanup_stale_files(&self, output_dir: &Path, expected: &HashSet<PathBuf>) -> Result<usize> {
        let mut removed = 0;
        self.cleanup_recursive(output_dir, expected, &mut removed)?;
        Ok(removed)
    }

    fn cleanup_recursive(
        &self,
        dir: &Path,
        expected: &HashSet<PathBuf>,
        removed: &mut usize,
    ) -> Result<()> {
        let entries: Vec<_> = fs::read_dir(dir)?.collect::<std::result::Result<_, _>>()?;

        for entry in entries {
            let path = entry.path();

            if path.is_dir() {
                // Recurse into subdirectory
                self.cleanup_recursive(&path, expected, removed)?;

                // Remove directory if empty
                if fs::read_dir(&path)?.next().is_none() {
                    fs::remove_dir(&path)?;
                    tracing::debug!(path = %path.display(), "removed empty directory");
                }
            } else if !expected.contains(&path) {
                fs::remove_file(&path)?;
                tracing::debug!(path = %path.display(), "removed stale file");
                *removed += 1;
            }
        }

        Ok(())
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

/// Recursively copy a directory with content-hashed filenames.
fn copy_dir_with_hashing(
    src: &Path,
    dest: &Path,
    relative_path: &str,
    expected: &mut HashSet<PathBuf>,
    should_minify: bool,
    manifest: &mut AssetManifest,
) -> Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let name = file_name.to_str().unwrap_or("");

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        // Build the relative path for manifest keys
        let entry_relative = if relative_path.is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", relative_path, name)
        };

        if src_path.is_dir() {
            let dest_subdir = dest.join(name);
            copy_dir_with_hashing(
                &src_path,
                &dest_subdir,
                &entry_relative,
                expected,
                should_minify,
                manifest,
            )?;
        } else {
            let contents = fs::read(&src_path)?;
            let output = process_static_file(name, &contents, should_minify)?;
            let hashed_name = hash_filename(name, &output);
            let dest_path = dest.join(&hashed_name);

            fs::write(&dest_path, output)?;
            expected.insert(dest_path);

            // Build the hashed path for the manifest
            let hashed_relative = if relative_path.is_empty() {
                format!("/static/{}", hashed_name)
            } else {
                format!("/static/{}/{}", relative_path, hashed_name)
            };
            manifest.insert(entry_relative, hashed_relative);
        }
    }

    Ok(())
}

/// Generate a hashed filename: stem-hash.ext
fn hash_filename(name: &str, contents: &[u8]) -> String {
    let hash = blake3::hash(contents);
    let hash_hex = &hash.to_hex()[..8];

    // Split name into stem and extension
    if let Some(dot_pos) = name.rfind('.') {
        let stem = &name[..dot_pos];
        let ext = &name[dot_pos + 1..];
        format!("{}-{}.{}", stem, hash_hex, ext)
    } else {
        format!("{}-{}", name, hash_hex)
    }
}

/// Create the Tera `static` function that resolves asset paths.
fn make_static_function(manifest: AssetManifest) -> impl Function {
    let manifest = Arc::new(manifest);

    move |args: &HashMap<String, Value>| -> tera::Result<Value> {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| tera::Error::msg("static() requires a 'path' argument"))?;

        match manifest.get(path) {
            Some(hashed_path) => Ok(Value::String(hashed_path.clone())),
            None => Err(tera::Error::msg(format!(
                "static asset not found: '{}'. Available: {:?}",
                path,
                manifest.keys().collect::<Vec<_>>()
            ))),
        }
    }
}

/// Process a static file, optionally minifying based on extension.
fn process_static_file(name: &str, contents: &[u8], should_minify: bool) -> Result<Vec<u8>> {
    if !should_minify {
        return Ok(contents.to_vec());
    }

    // Determine file type by extension
    let ext = name.rsplit('.').next().unwrap_or("");

    match ext {
        "css" => {
            let input = std::str::from_utf8(contents)
                .map_err(|e| Error::Other(format!("invalid UTF-8 in CSS: {}", e)))?;
            let minified = minify::css(input)?;
            Ok(minified.into_bytes())
        }
        "js" => {
            let input = std::str::from_utf8(contents)
                .map_err(|e| Error::Other(format!("invalid UTF-8 in JS: {}", e)))?;
            let minified = minify::js(input);
            Ok(minified.into_bytes())
        }
        _ => Ok(contents.to_vec()),
    }
}
