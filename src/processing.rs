//! Parallel image processing pipeline.
//!
//! Processes photos to generate:
//! - BLAKE3 content hash for cache-busting
//! - EXIF metadata extraction
//! - Thumbnail (600px WebP, lossy)
//! - Full-size web image (2400px max WebP, lossy)
//! - Original copy
//!
//! Files are written directly during processing to minimize memory usage
//! and allow progress monitoring.

use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

use image::imageops::FilterType;
use image::DynamicImage;
use rayon::prelude::*;

use crate::error::Result;
use crate::photos::{Album, ExposureInfo, GpsCoords, Photo, PhotoMetadata};

// Hardcoded defaults - can be made configurable later if needed
const THUMB_SIZE: u32 = 600;
const THUMB_QUALITY: f32 = 80.0;
const FULL_SIZE: u32 = 2400;
const FULL_QUALITY: f32 = 90.0;

/// Stats from processing an album tree.
pub struct ProcessingStats {
    pub total: usize,
    pub cached: usize,
    pub generated: usize,
}

/// Process all photos in an album tree in parallel.
///
/// Files are written directly to `images_dir` during processing.
/// Cached images (same hash already exists) are skipped.
pub fn process_album(album: &mut Album, images_dir: &Path) -> Result<ProcessingStats> {
    let cached = AtomicUsize::new(0);
    let generated = AtomicUsize::new(0);

    process_album_recursive(album, images_dir, &cached, &generated)?;

    Ok(ProcessingStats {
        total: cached.load(Ordering::Relaxed) + generated.load(Ordering::Relaxed),
        cached: cached.load(Ordering::Relaxed),
        generated: generated.load(Ordering::Relaxed),
    })
}

fn process_album_recursive(
    album: &mut Album,
    images_dir: &Path,
    cached: &AtomicUsize,
    generated: &AtomicUsize,
) -> Result<()> {
    let album_path = album.path.clone();
    let album_images_dir = if album_path.as_os_str().is_empty() {
        images_dir.to_path_buf()
    } else {
        let dir = images_dir.join(&album_path);
        fs::create_dir_all(&dir)?;
        dir
    };

    // Process photos in this album in parallel
    album
        .photos
        .par_iter_mut()
        .try_for_each(|photo| -> Result<()> {
            let was_cached = process_photo(photo, &album_images_dir)?;
            if was_cached {
                cached.fetch_add(1, Ordering::Relaxed);
            } else {
                generated.fetch_add(1, Ordering::Relaxed);
            }
            Ok(())
        })?;

    // Recursively process child albums
    for child in &mut album.children {
        process_album_recursive(child, images_dir, cached, generated)?;
    }

    Ok(())
}

/// Process a single photo: hash, extract EXIF, generate and write image variants.
///
/// Returns true if the image was cached (no processing needed).
fn process_photo(photo: &mut Photo, images_dir: &Path) -> Result<bool> {
    // Read the original file
    let original_data = fs::read(&photo.source)?;

    // Compute BLAKE3 hash (first 8 chars of hex)
    let hash = blake3::hash(&original_data);
    photo.hash = hash.to_hex()[..8].to_string();

    // Extract EXIF metadata (cheap operation, always do it)
    photo.metadata = extract_exif(&original_data);

    // Extract image dimensions (reads header only, doesn't decode full image)
    let reader = image::ImageReader::new(Cursor::new(&original_data))
        .with_guessed_format()
        .map_err(|e| crate::error::Error::Image(image::ImageError::IoError(e)))?;
    let (width, height) = reader.into_dimensions()?;
    photo.width = width;
    photo.height = height;

    // Check if cached outputs exist
    let thumb_path = images_dir.join(format!("{}-{}-thumb.webp", photo.stem, photo.hash));
    let full_path = images_dir.join(format!("{}-{}-full.webp", photo.stem, photo.hash));
    let original_path = images_dir.join(format!(
        "{}-{}-original.{}",
        photo.stem, photo.hash, photo.extension
    ));

    if thumb_path.exists() && full_path.exists() && original_path.exists() {
        tracing::debug!(photo = %photo.stem, hash = %photo.hash, "cached");
        return Ok(true);
    }

    tracing::debug!(photo = %photo.stem, "processing");

    // Decode image
    let img = image::load_from_memory(&original_data)?;

    // Generate and write thumbnail
    let thumb_data = generate_variant(&img, THUMB_SIZE, THUMB_QUALITY)?;
    fs::write(&thumb_path, &thumb_data)?;

    // Generate and write full-size web image
    let full_data = generate_variant(&img, FULL_SIZE, FULL_QUALITY)?;
    fs::write(&full_path, &full_data)?;

    // Write original
    fs::write(&original_path, &original_data)?;

    tracing::trace!(
        photo = %photo.stem,
        hash = %photo.hash,
        thumb_size = thumb_data.len(),
        full_size = full_data.len(),
        "wrote variants"
    );

    Ok(false)
}

/// Generate a resized WebP variant of the image.
fn generate_variant(img: &DynamicImage, max_size: u32, quality: f32) -> Result<Vec<u8>> {
    // Resize if larger than max_size (preserve aspect ratio)
    let resized = if img.width() > max_size || img.height() > max_size {
        img.resize(max_size, max_size, FilterType::Lanczos3)
    } else {
        img.clone()
    };

    // Encode as lossy WebP using the webp crate
    let rgba = resized.to_rgba8();
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height());
    let webp_data = encoder.encode(quality);

    Ok(webp_data.to_vec())
}

/// Extract EXIF metadata from image data.
fn extract_exif(data: &[u8]) -> PhotoMetadata {
    let Ok(exif) = exif::Reader::new().read_from_container(&mut Cursor::new(data)) else {
        return PhotoMetadata::default();
    };

    let get_string = |tag| {
        exif.get_field(tag, exif::In::PRIMARY).map(|f| {
            let s = f.display_value().to_string();
            // display_value() includes quotes around strings, strip them
            s.trim_matches('"').to_string()
        })
    };

    // Extract date/time
    let date_taken = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());

    // Extract copyright
    let copyright = get_string(exif::Tag::Copyright);

    // Extract camera (Make + Model)
    let camera = {
        let make = get_string(exif::Tag::Make);
        let model = get_string(exif::Tag::Model);
        match (make, model) {
            (Some(m), Some(mo)) => {
                // Avoid duplication like "Canon Canon EOS R5"
                if mo.starts_with(&m) {
                    Some(mo)
                } else {
                    Some(format!("{} {}", m, mo))
                }
            }
            (None, Some(mo)) => Some(mo),
            (Some(m), None) => Some(m),
            (None, None) => None,
        }
    };

    // Extract lens
    let lens = get_string(exif::Tag::LensModel);

    // Extract GPS
    let gps = extract_gps(&exif);

    // Extract exposure info
    let exposure = extract_exposure(&exif);

    PhotoMetadata {
        date_taken,
        copyright,
        camera,
        lens,
        gps,
        exposure,
    }
}

/// Extract GPS coordinates from EXIF data.
fn extract_gps(exif: &exif::Exif) -> Option<GpsCoords> {
    let lat = extract_gps_coord(exif, exif::Tag::GPSLatitude, exif::Tag::GPSLatitudeRef)?;
    let lon = extract_gps_coord(exif, exif::Tag::GPSLongitude, exif::Tag::GPSLongitudeRef)?;
    Some(GpsCoords {
        latitude: lat,
        longitude: lon,
    })
}

/// Extract a single GPS coordinate (latitude or longitude).
fn extract_gps_coord(
    exif: &exif::Exif,
    coord_tag: exif::Tag,
    ref_tag: exif::Tag,
) -> Option<f64> {
    let field = exif.get_field(coord_tag, exif::In::PRIMARY)?;
    let ref_field = exif.get_field(ref_tag, exif::In::PRIMARY)?;

    // GPS coordinates are stored as [degrees, minutes, seconds]
    let exif::Value::Rational(ref rationals) = field.value else {
        return None;
    };

    if rationals.len() < 3 {
        return None;
    }

    let degrees = rationals[0].to_f64();
    let minutes = rationals[1].to_f64();
    let seconds = rationals[2].to_f64();

    let mut coord = degrees + minutes / 60.0 + seconds / 3600.0;

    // Check reference direction (N/S or E/W)
    let ref_str = ref_field.display_value().to_string();
    if ref_str == "S" || ref_str == "W" {
        coord = -coord;
    }

    Some(coord)
}

/// Extract exposure settings from EXIF data.
fn extract_exposure(exif: &exif::Exif) -> Option<ExposureInfo> {
    let aperture = exif
        .get_field(exif::Tag::FNumber, exif::In::PRIMARY)
        .map(|f| format!("f/{}", f.display_value()));

    let shutter_speed = exif
        .get_field(exif::Tag::ExposureTime, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());

    let iso = exif
        .get_field(exif::Tag::PhotographicSensitivity, exif::In::PRIMARY)
        .and_then(|f| {
            if let exif::Value::Short(ref v) = f.value {
                v.first().map(|&x| x as u32)
            } else if let exif::Value::Long(ref v) = f.value {
                v.first().copied()
            } else {
                None
            }
        });

    let focal_length = exif
        .get_field(exif::Tag::FocalLength, exif::In::PRIMARY)
        .map(|f| format!("{}mm", f.display_value()));

    // Only return Some if at least one field is present
    if aperture.is_some() || shutter_speed.is_some() || iso.is_some() || focal_length.is_some() {
        Some(ExposureInfo {
            aperture,
            shutter_speed,
            iso,
            focal_length,
        })
    } else {
        None
    }
}
