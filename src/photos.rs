use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{Error, Result};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

/// URL-encode a string for use in URL paths.
/// Encodes spaces and other special characters while preserving alphanumerics,
/// hyphens, underscores, periods, and tildes.
fn url_encode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => {
                result.push(c);
            }
            _ => {
                for byte in c.to_string().as_bytes() {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    result
}

/// URL-encode a path, encoding each segment but preserving '/' separators.
fn url_encode_path(path: &str) -> String {
    path.split('/')
        .map(url_encode)
        .collect::<Vec<_>>()
        .join("/")
}

/// A single photo in the gallery.
#[derive(Debug, Clone, Serialize)]
pub struct Photo {
    /// Original source path (absolute)
    #[serde(skip)]
    pub source: PathBuf,

    /// Filename without extension (e.g., "DSC01234")
    pub stem: String,

    /// File extension without dot (e.g., "jpg")
    pub extension: String,

    /// Content hash (first 8 chars of BLAKE3 hex) for cache-busting
    pub hash: String,

    /// Original image width in pixels
    pub width: u32,

    /// Original image height in pixels
    pub height: u32,

    /// EXIF metadata extracted from the image
    pub metadata: PhotoMetadata,
}

/// EXIF metadata extracted from a photo.
#[derive(Debug, Clone, Serialize, Default)]
pub struct PhotoMetadata {
    /// Date/time the photo was taken (ISO 8601 format)
    pub date_taken: Option<String>,

    /// Copyright notice
    pub copyright: Option<String>,

    /// Camera make and model (e.g., "Canon EOS R5")
    pub camera: Option<String>,

    /// Lens model (e.g., "RF 24-70mm F2.8L IS USM")
    pub lens: Option<String>,

    /// GPS coordinates
    pub gps: Option<GpsCoords>,

    /// Exposure settings
    pub exposure: Option<ExposureInfo>,
}

/// GPS coordinates from EXIF data.
#[derive(Debug, Clone, Serialize)]
pub struct GpsCoords {
    pub latitude: f64,
    pub longitude: f64,
}

/// Camera exposure settings from EXIF data.
#[derive(Debug, Clone, Serialize)]
pub struct ExposureInfo {
    /// Aperture (e.g., "f/2.8")
    pub aperture: Option<String>,

    /// Shutter speed (e.g., "1/250")
    pub shutter_speed: Option<String>,

    /// ISO sensitivity
    pub iso: Option<u32>,

    /// Focal length (e.g., "50mm")
    pub focal_length: Option<String>,
}

impl Photo {
    pub(crate) fn from_path(path: &Path) -> Option<Self> {
        let extension = path.extension()?.to_str()?.to_lowercase();

        if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
            return None;
        }

        let stem = path.file_stem()?.to_str()?.to_string();

        Some(Self {
            source: path.to_path_buf(),
            extension,
            stem,
            hash: String::new(),
            width: 0,
            height: 0,
            metadata: PhotoMetadata::default(),
        })
    }

    /// URL path to the full-size WebP image (e.g., "images/album/photo-abc123-full.webp")
    pub fn image_path(&self, album_path: &Path) -> String {
        let encoded_stem = url_encode(&self.stem);
        if album_path.as_os_str().is_empty() {
            format!("images/{}-{}-full.webp", encoded_stem, self.hash)
        } else {
            let encoded_album = url_encode_path(&album_path.display().to_string());
            format!(
                "images/{}/{}-{}-full.webp",
                encoded_album,
                encoded_stem,
                self.hash
            )
        }
    }

    /// URL path to the thumbnail WebP (e.g., "images/album/photo-abc123-thumb.webp")
    pub fn thumb_path(&self, album_path: &Path) -> String {
        let encoded_stem = url_encode(&self.stem);
        if album_path.as_os_str().is_empty() {
            format!("images/{}-{}-thumb.webp", encoded_stem, self.hash)
        } else {
            let encoded_album = url_encode_path(&album_path.display().to_string());
            format!(
                "images/{}/{}-{}-thumb.webp",
                encoded_album,
                encoded_stem,
                self.hash
            )
        }
    }

    /// URL path to the original image (e.g., "images/album/photo-abc123-original.jpg")
    pub fn original_path(&self, album_path: &Path) -> String {
        let encoded_stem = url_encode(&self.stem);
        if album_path.as_os_str().is_empty() {
            format!("images/{}-{}-original.{}", encoded_stem, self.hash, self.extension)
        } else {
            let encoded_album = url_encode_path(&album_path.display().to_string());
            format!(
                "images/{}/{}-{}-original.{}",
                encoded_album,
                encoded_stem,
                self.hash,
                self.extension
            )
        }
    }

    /// URL path to the photo's HTML page (e.g., "album/photo.html")
    pub fn html_path(&self, album_path: &Path) -> String {
        let encoded_stem = url_encode(&self.stem);
        if album_path.as_os_str().is_empty() {
            format!("{}.html", encoded_stem)
        } else {
            let encoded_album = url_encode_path(&album_path.display().to_string());
            format!("{}/{}.html", encoded_album, encoded_stem)
        }
    }
}

/// An album containing photos and possibly child albums.
#[derive(Debug, Serialize)]
pub struct Album {
    /// Display name (directory name, titlecased)
    pub name: String,

    /// URL-safe slug (directory name, lowercased)
    pub slug: String,

    /// Path relative to photos root (empty for root album)
    #[serde(skip)]
    pub path: PathBuf,

    /// Photos directly in this album
    pub photos: Vec<Photo>,

    /// Child albums (subdirectories)
    pub children: Vec<Album>,
}

impl Album {
    /// Create a new empty album.
    fn new(name: String, slug: String, path: PathBuf) -> Self {
        Self {
            name,
            slug,
            path,
            photos: Vec::new(),
            children: Vec::new(),
        }
    }

    /// Create the root album.
    fn root() -> Self {
        Self::new("Gallery".to_string(), String::new(), PathBuf::new())
    }

    /// Collect all photos from this album and all descendants.
    pub fn all_photos(&self) -> Vec<&Photo> {
        let mut result: Vec<&Photo> = self.photos.iter().collect();

        for child in &self.children {
            result.extend(child.all_photos());
        }

        result
    }

    /// URL path for this album's index page.
    #[allow(dead_code)]
    pub fn html_path(&self) -> String {
        if self.path.as_os_str().is_empty() {
            "index.html".to_string()
        } else {
            format!("{}/index.html", self.path.display())
        }
    }

    /// Count total photos in this album and descendants.
    pub fn photo_count(&self) -> usize {
        self.photos.len() + self.children.iter().map(Album::photo_count).sum::<usize>()
    }
}

/// Discover photos and build album hierarchy from directory structure.
pub fn discover(photos_dir: &Path) -> Result<Album> {
    let photos_dir = photos_dir.canonicalize()?;
    let mut root = Album::root();

    discover_recursive(&photos_dir, &photos_dir, &mut root)?;

    // Sort children and photos for consistent ordering
    sort_album(&mut root);

    if root.photo_count() == 0 {
        return Err(Error::NoPhotos {
            path: photos_dir.to_path_buf(),
        });
    }

    Ok(root)
}

fn discover_recursive(base: &Path, dir: &Path, album: &mut Album) -> Result<()> {
    let entries: Vec<_> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .collect();

    for entry in entries {
        let path = entry.path();

        if path.is_dir() {
            // Skip hidden directories
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with('.'))
            {
                continue;
            }

            let dir_name = path.file_name().unwrap().to_str().unwrap();
            let relative_path = path.strip_prefix(base).unwrap();

            let mut child = Album::new(
                titlecase(dir_name),
                dir_name.to_lowercase(),
                relative_path.to_path_buf(),
            );

            discover_recursive(base, &path, &mut child)?;

            // Only add non-empty albums
            if child.photo_count() > 0 {
                album.children.push(child);
            }
        } else if let Some(photo) = Photo::from_path(&path) {
            album.photos.push(photo);
        }
    }

    Ok(())
}

fn sort_album(album: &mut Album) {
    album.photos.sort_by(|a, b| a.stem.cmp(&b.stem));
    album.children.sort_by(|a, b| a.slug.cmp(&b.slug));

    for child in &mut album.children {
        sort_album(child);
    }
}

/// Convert a directory name to title case for display.
fn titlecase(s: &str) -> String {
    s.split(['-', '_'])
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    first.to_uppercase().chain(chars).collect()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titlecase_simple() {
        assert_eq!(titlecase("vacation"), "Vacation");
    }

    #[test]
    fn titlecase_with_dashes() {
        assert_eq!(titlecase("2025-china-trip"), "2025 China Trip");
    }

    #[test]
    fn titlecase_with_underscores() {
        assert_eq!(titlecase("my_photo_album"), "My Photo Album");
    }

    #[test]
    fn photo_paths_root_album() {
        let photo = Photo {
            source: PathBuf::from("/photos/test.jpg"),
            stem: "test".to_string(),
            extension: "jpg".to_string(),
            hash: "abc12345".to_string(),
            width: 1920,
            height: 1080,
            metadata: PhotoMetadata::default(),
        };

        let root_path = PathBuf::new();
        assert_eq!(photo.image_path(&root_path), "images/test-abc12345-full.webp");
        assert_eq!(photo.thumb_path(&root_path), "images/test-abc12345-thumb.webp");
        assert_eq!(photo.original_path(&root_path), "images/test-abc12345-original.jpg");
        assert_eq!(photo.html_path(&root_path), "test.html");
    }

    #[test]
    fn photo_paths_nested_album() {
        let photo = Photo {
            source: PathBuf::from("/photos/vacation/test.jpg"),
            stem: "test".to_string(),
            extension: "jpg".to_string(),
            hash: "def67890".to_string(),
            width: 3000,
            height: 2000,
            metadata: PhotoMetadata::default(),
        };

        let album_path = PathBuf::from("vacation");
        assert_eq!(photo.image_path(&album_path), "images/vacation/test-def67890-full.webp");
        assert_eq!(photo.thumb_path(&album_path), "images/vacation/test-def67890-thumb.webp");
        assert_eq!(photo.original_path(&album_path), "images/vacation/test-def67890-original.jpg");
        assert_eq!(photo.html_path(&album_path), "vacation/test.html");
    }

    #[test]
    fn photo_paths_with_spaces() {
        let photo = Photo {
            source: PathBuf::from("/photos/My Vacation/Beach Day.jpg"),
            stem: "Beach Day".to_string(),
            extension: "jpg".to_string(),
            hash: "abc12345".to_string(),
            width: 4000,
            height: 3000,
            metadata: PhotoMetadata::default(),
        };

        let root_path = PathBuf::new();
        assert_eq!(photo.image_path(&root_path), "images/Beach%20Day-abc12345-full.webp");
        assert_eq!(photo.thumb_path(&root_path), "images/Beach%20Day-abc12345-thumb.webp");
        assert_eq!(photo.original_path(&root_path), "images/Beach%20Day-abc12345-original.jpg");
        assert_eq!(photo.html_path(&root_path), "Beach%20Day.html");

        let album_path = PathBuf::from("My Vacation");
        assert_eq!(photo.image_path(&album_path), "images/My%20Vacation/Beach%20Day-abc12345-full.webp");
        assert_eq!(photo.thumb_path(&album_path), "images/My%20Vacation/Beach%20Day-abc12345-thumb.webp");
        assert_eq!(photo.original_path(&album_path), "images/My%20Vacation/Beach%20Day-abc12345-original.jpg");
        assert_eq!(photo.html_path(&album_path), "My%20Vacation/Beach%20Day.html");
    }

    #[test]
    fn url_encode_special_chars() {
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(url_encode("test&file"), "test%26file");
        assert_eq!(url_encode("photo#1"), "photo%231");
        assert_eq!(url_encode("normal-file_name.jpg"), "normal-file_name.jpg");
    }

    #[test]
    fn album_html_path_root() {
        let album = Album::root();
        assert_eq!(album.html_path(), "index.html");
    }

    #[test]
    fn album_html_path_nested() {
        let album = Album::new(
            "Vacation".to_string(),
            "vacation".to_string(),
            PathBuf::from("vacation"),
        );
        assert_eq!(album.html_path(), "vacation/index.html");
    }
}
