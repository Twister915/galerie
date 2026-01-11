//! Parallel image processing pipeline.
//!
//! Processes photos to generate:
//! - BLAKE3 content hash for cache-busting
//! - EXIF metadata extraction
//! - Micro thumbnail (120px WebP, lossy) for filmstrips
//! - Thumbnail (600px WebP, lossy) for grid display
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
use little_exif::exif_tag::ExifTag;
use little_exif::filetype::FileExtension;
use little_exif::metadata::Metadata;
use little_exif::rational::uR64;
use rayon::prelude::*;

use crate::config::GpsMode;
use crate::error::Result;
use crate::photos::{Album, ExposureInfo, GpsCoords, Photo, PhotoMetadata};

// Hardcoded defaults - can be made configurable later if needed
const MICRO_THUMB_SIZE: u32 = 120;
const MICRO_THUMB_QUALITY: f32 = 70.0;
const THUMB_SIZE: u32 = 600;
const THUMB_QUALITY: f32 = 80.0;
const FULL_SIZE: u32 = 2400;
const FULL_QUALITY: f32 = 90.0;

/// Stats from processing an album tree.
pub struct ProcessingStats {
    pub total: usize,
    pub cached: usize,
    pub generated: usize,
    pub copied: usize,
}

/// What was processed for a single photo.
struct PhotoProcessingResult {
    /// WebP thumb or full was generated.
    generated_webp: bool,
    /// Original file was copied (with or without GPS stripping).
    copied_original: bool,
}

/// Process all photos in an album tree in parallel.
///
/// Files are written directly to `images_dir` during processing.
/// Cached images (same hash already exists) are skipped.
pub fn process_album(
    album: &mut Album,
    images_dir: &Path,
    gps_mode: GpsMode,
) -> Result<ProcessingStats> {
    let total = AtomicUsize::new(0);
    let cached = AtomicUsize::new(0);
    let generated = AtomicUsize::new(0);
    let copied = AtomicUsize::new(0);

    process_album_recursive(
        album,
        images_dir,
        gps_mode,
        &total,
        &cached,
        &generated,
        &copied,
    )?;

    Ok(ProcessingStats {
        total: total.load(Ordering::Relaxed),
        cached: cached.load(Ordering::Relaxed),
        generated: generated.load(Ordering::Relaxed),
        copied: copied.load(Ordering::Relaxed),
    })
}

fn process_album_recursive(
    album: &mut Album,
    images_dir: &Path,
    gps_mode: GpsMode,
    total: &AtomicUsize,
    cached: &AtomicUsize,
    generated: &AtomicUsize,
    copied: &AtomicUsize,
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
            let result = process_photo(photo, &album_images_dir, gps_mode)?;
            total.fetch_add(1, Ordering::Relaxed);
            if !result.generated_webp && !result.copied_original {
                cached.fetch_add(1, Ordering::Relaxed);
            }
            if result.generated_webp {
                generated.fetch_add(1, Ordering::Relaxed);
            }
            if result.copied_original {
                copied.fetch_add(1, Ordering::Relaxed);
            }
            Ok(())
        })?;

    // Recursively process child albums
    for child in &mut album.children {
        process_album_recursive(child, images_dir, gps_mode, total, cached, generated, copied)?;
    }

    Ok(())
}

/// Process a single photo: hash, extract EXIF, generate and write image variants.
fn process_photo(
    photo: &mut Photo,
    images_dir: &Path,
    gps_mode: GpsMode,
) -> Result<PhotoProcessingResult> {
    // Read the original file
    let original_data = fs::read(&photo.source)?;

    // Compute BLAKE3 hash (first 8 chars of hex) based on content only
    // This hash is used for cache-busting URLs and doesn't change with GPS mode
    let hash = blake3::hash(&original_data);
    photo.hash = hash.to_hex()[..8].to_string();

    // Extract EXIF metadata (cheap operation, always do it)
    photo.metadata = extract_exif(&original_data, &photo.extension, gps_mode);

    // Extract image dimensions (reads header only, doesn't decode full image)
    let reader = image::ImageReader::new(Cursor::new(&original_data))
        .with_guessed_format()
        .map_err(|e| crate::error::Error::Image(image::ImageError::IoError(e)))?;
    let (width, height) = reader.into_dimensions()?;
    photo.width = width;
    photo.height = height;

    // Build output paths
    let micro_thumb_path =
        images_dir.join(format!("{}-{}-micro.webp", photo.stem, photo.hash));
    let thumb_path = images_dir.join(format!("{}-{}-thumb.webp", photo.stem, photo.hash));
    let full_path = images_dir.join(format!("{}-{}-full.webp", photo.stem, photo.hash));
    let original_path = images_dir.join(format!(
        "{}-{}-original{}.{}",
        photo.stem, photo.hash, gps_mode.original_suffix(), photo.extension
    ));

    // Check what needs to be generated
    let need_micro = !micro_thumb_path.exists();
    let need_thumb = !thumb_path.exists();
    let need_full = !full_path.exists();
    let need_original = !original_path.exists();

    if !need_micro && !need_thumb && !need_full && !need_original {
        tracing::debug!(photo = %photo.stem, hash = %photo.hash, "cached");
        return Ok(PhotoProcessingResult {
            generated_webp: false,
            copied_original: false,
        });
    }

    tracing::debug!(
        photo = %photo.stem,
        need_micro,
        need_thumb,
        need_full,
        need_original,
        "processing"
    );

    // Only decode image if we need any webp variant
    if need_micro || need_thumb || need_full {
        let img = image::load_from_memory(&original_data)?;

        if need_micro {
            let micro_data = generate_variant(&img, MICRO_THUMB_SIZE, MICRO_THUMB_QUALITY)?;
            fs::write(&micro_thumb_path, &micro_data)?;
        }

        if need_thumb {
            let thumb_data = generate_variant(&img, THUMB_SIZE, THUMB_QUALITY)?;
            fs::write(&thumb_path, &thumb_data)?;
        }

        if need_full {
            let full_data = generate_variant(&img, FULL_SIZE, FULL_QUALITY)?;
            fs::write(&full_path, &full_data)?;
        }
    }

    // Write original (with GPS stripped if needed)
    if need_original {
        let final_original = if gps_mode != GpsMode::On {
            strip_gps_from_image(&original_data, &photo.extension)?
        } else {
            original_data
        };
        fs::write(&original_path, &final_original)?;
    }

    Ok(PhotoProcessingResult {
        generated_webp: need_thumb || need_full,
        copied_original: need_original,
    })
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

/// Get file extension as little_exif FileExtension.
fn get_file_extension(extension: &str) -> Option<FileExtension> {
    match extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => Some(FileExtension::JPEG),
        "png" => Some(FileExtension::PNG { as_zTXt_chunk: true }),
        "webp" => Some(FileExtension::WEBP),
        _ => None,
    }
}

/// Extract EXIF metadata from image data using little_exif.
fn extract_exif(data: &[u8], extension: &str, gps_mode: GpsMode) -> PhotoMetadata {
    let Some(file_type) = get_file_extension(extension) else {
        return PhotoMetadata::default();
    };

    let data_vec = data.to_vec();
    let Ok(metadata) = Metadata::new_from_vec(&data_vec, file_type) else {
        return PhotoMetadata::default();
    };

    // Extract date/time
    let date_taken = metadata
        .get_tag(&ExifTag::DateTimeOriginal(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::DateTimeOriginal(s) => Some(s.clone()),
            _ => None,
        });

    // Extract copyright
    let copyright = metadata
        .get_tag(&ExifTag::Copyright(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::Copyright(s) => Some(s.clone()),
            _ => None,
        });

    // Extract camera (Make + Model)
    let make = metadata
        .get_tag(&ExifTag::Make(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::Make(s) => Some(s.clone()),
            _ => None,
        });

    let model = metadata
        .get_tag(&ExifTag::Model(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::Model(s) => Some(s.clone()),
            _ => None,
        });

    let camera = match (make, model) {
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
    };

    // Extract lens
    let lens = metadata
        .get_tag(&ExifTag::LensModel(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::LensModel(s) => Some(s.clone()),
            _ => None,
        });

    // Extract GPS based on mode
    let gps = match gps_mode {
        GpsMode::Off => None,
        GpsMode::General => extract_gps(&metadata).map(|(lat, lon)| GpsCoords::new_general(lat, lon)),
        GpsMode::On => extract_gps(&metadata).map(|(lat, lon)| GpsCoords::new(lat, lon)),
    };

    // Extract exposure info
    let exposure = extract_exposure(&metadata);

    PhotoMetadata {
        date_taken,
        copyright,
        camera,
        lens,
        gps,
        exposure,
    }
}

/// Extract GPS coordinates from EXIF metadata.
/// Returns (latitude, longitude) if both are present.
fn extract_gps(metadata: &Metadata) -> Option<(f64, f64)> {
    // Get latitude values (degrees, minutes, seconds as rationals)
    let lat_vals = metadata
        .get_tag(&ExifTag::GPSLatitude(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::GPSLatitude(vals) => Some(vals.clone()),
            _ => None,
        })?;

    // Get latitude reference (N or S)
    let lat_ref = metadata
        .get_tag(&ExifTag::GPSLatitudeRef(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::GPSLatitudeRef(s) => Some(s.clone()),
            _ => None,
        })?;

    // Get longitude values
    let lon_vals = metadata
        .get_tag(&ExifTag::GPSLongitude(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::GPSLongitude(vals) => Some(vals.clone()),
            _ => None,
        })?;

    // Get longitude reference (E or W)
    let lon_ref = metadata
        .get_tag(&ExifTag::GPSLongitudeRef(String::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::GPSLongitudeRef(s) => Some(s.clone()),
            _ => None,
        })?;

    // Convert to decimal degrees
    let lat = gps_rational_to_decimal(&lat_vals, &lat_ref)?;
    let lon = gps_rational_to_decimal(&lon_vals, &lon_ref)?;

    Some((lat, lon))
}

/// Convert GPS rational values to decimal degrees.
fn gps_rational_to_decimal(vals: &[uR64], direction: &str) -> Option<f64> {
    if vals.len() < 3 {
        return None;
    }

    let degrees = if vals[0].denominator != 0 {
        vals[0].nominator as f64 / vals[0].denominator as f64
    } else {
        return None;
    };

    let minutes = if vals[1].denominator != 0 {
        vals[1].nominator as f64 / vals[1].denominator as f64
    } else {
        0.0
    };

    let seconds = if vals[2].denominator != 0 {
        vals[2].nominator as f64 / vals[2].denominator as f64
    } else {
        0.0
    };

    let mut coord = degrees + minutes / 60.0 + seconds / 3600.0;

    // Apply direction
    if direction == "S" || direction == "W" {
        coord = -coord;
    }

    Some(coord)
}

/// Extract exposure settings from EXIF metadata.
fn extract_exposure(metadata: &Metadata) -> Option<ExposureInfo> {
    // Aperture (FNumber)
    let aperture = metadata
        .get_tag(&ExifTag::FNumber(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::FNumber(vals) if !vals.is_empty() && vals[0].denominator != 0 => {
                let f_num = vals[0].nominator as f64 / vals[0].denominator as f64;
                Some(format!("f/{:.1}", f_num))
            }
            _ => None,
        });

    // Shutter speed (ExposureTime)
    let shutter_speed = metadata
        .get_tag(&ExifTag::ExposureTime(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::ExposureTime(vals) if !vals.is_empty() && vals[0].denominator != 0 => {
                let num = vals[0].nominator;
                let denom = vals[0].denominator;
                if num >= denom {
                    // Whole seconds
                    Some(format!("{}s", num / denom))
                } else {
                    // Fraction
                    Some(format!("1/{}", denom / num))
                }
            }
            _ => None,
        });

    // ISO
    let iso = metadata
        .get_tag(&ExifTag::ISO(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::ISO(vals) if !vals.is_empty() => Some(vals[0] as u32),
            _ => None,
        });

    // Focal length
    let focal_length = metadata
        .get_tag(&ExifTag::FocalLength(Vec::new()))
        .next()
        .and_then(|t| match t {
            ExifTag::FocalLength(vals) if !vals.is_empty() && vals[0].denominator != 0 => {
                let fl = vals[0].nominator / vals[0].denominator;
                Some(format!("{}mm", fl))
            }
            _ => None,
        });

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

/// Strip GPS EXIF tags from image data.
/// Preserves all other EXIF metadata (camera, lens, exposure, etc.).
fn strip_gps_from_image(data: &[u8], extension: &str) -> Result<Vec<u8>> {
    let Some(file_type) = get_file_extension(extension) else {
        // Unknown format, return unchanged
        return Ok(data.to_vec());
    };

    let data_vec = data.to_vec();
    let mut metadata = match Metadata::new_from_vec(&data_vec, file_type) {
        Ok(m) => m,
        Err(_) => {
            // No EXIF or parse error, return unchanged
            return Ok(data.to_vec());
        }
    };

    // Remove all GPS-related tags
    metadata.remove_tag(ExifTag::GPSLatitude(Vec::new()));
    metadata.remove_tag(ExifTag::GPSLatitudeRef(String::new()));
    metadata.remove_tag(ExifTag::GPSLongitude(Vec::new()));
    metadata.remove_tag(ExifTag::GPSLongitudeRef(String::new()));
    metadata.remove_tag(ExifTag::GPSAltitude(Vec::new()));
    metadata.remove_tag(ExifTag::GPSAltitudeRef(Vec::new()));
    metadata.remove_tag(ExifTag::GPSTimeStamp(Vec::new()));
    metadata.remove_tag(ExifTag::GPSDateStamp(String::new()));
    metadata.remove_tag(ExifTag::GPSVersionID(Vec::new()));
    metadata.remove_tag(ExifTag::GPSMapDatum(String::new()));
    metadata.remove_tag(ExifTag::GPSProcessingMethod(Vec::new()));
    metadata.remove_tag(ExifTag::GPSAreaInformation(Vec::new()));

    // Write back to image
    let mut output = data.to_vec();
    metadata
        .write_to_vec(&mut output, file_type)
        .map_err(|e| crate::error::Error::Other(format!("EXIF write error: {}", e)))?;

    Ok(output)
}
