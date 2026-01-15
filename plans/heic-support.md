# HEIC/HEIF Support Implementation Plan

> **Status:** Planned
> **Created:** 2026-01-15
> **Complexity:** Medium-High (~200 lines new code)

## Summary

Add HEIC/HEIF image support to galerie using **runtime dynamic loading** (dlopen). This approach produces a single binary that:
- Works without libheif installed (HEIC files are skipped with a warning)
- Automatically enables HEIC support when libheif is present at runtime
- Requires no compile-time dependency on libheif

## Why Runtime Loading?

The challenge with HEIC support is that `libheif` depends on codec libraries (libde265, libaom) that cannot be statically linked with current Rust crates. The options were:

1. **Compile-time feature flag** — Two binary variants, users choose which to download
2. **Dynamic linking** — Single binary requires libheif at runtime (fails to start without it)
3. **Runtime dlopen** — Single binary, graceful degradation if libheif unavailable ✓

Option 3 provides the best user experience: one binary that "just works" with enhanced functionality when libheif is present.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      galerie binary                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/heic.rs (new)                                   │  │
│  │  - HeicDecoder::try_init() attempts dlopen           │  │
│  │  - If successful: decode() available                 │  │
│  │  - If failed: None, HEIC files skipped               │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  libloading crate                                    │  │
│  │  - dlopen/LoadLibrary at runtime                     │  │
│  │  - Load libheif symbols dynamically                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (runtime, if available)
              ┌─────────────────────────────┐
              │  libheif.dylib/.so/.dll     │
              │  (system-installed)         │
              └─────────────────────────────┘
```

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `Cargo.toml` | Modify | Add `libloading` dependency, add dev profile opt |
| `src/heic.rs` | **Create** | Runtime HEIC decoder using dlopen |
| `src/main.rs` | Modify | Add `mod heic;` |
| `src/photos.rs` | Modify | Add "heic"/"heif" to IMAGE_EXTENSIONS |
| `src/processing.rs` | Modify | Integrate HEIC decoder, add HEIF to get_file_extension() |
| `.github/workflows/release.yml` | Modify | Install libheif for testing on all platforms |
| `wiki/image-processing.md` | Modify | Document HEIC support and libheif installation |

## Implementation Details

### 1. New `src/heic.rs` Module (~200 lines)

```rust
//! Runtime HEIC/HEIF decoding via dlopen.
//!
//! Attempts to load libheif at runtime. If available, HEIC images
//! are decoded. If not, HEIC files are skipped gracefully.

use std::sync::OnceLock;
use image::DynamicImage;
use libloading::{Library, Symbol};

static DECODER: OnceLock<Option<HeicDecoder>> = OnceLock::new();

/// Check if HEIC support is available at runtime.
pub fn is_available() -> bool {
    DECODER.get_or_init(HeicDecoder::try_init).is_some()
}

/// Decode HEIC/HEIF image data to DynamicImage.
/// Returns None if libheif is not available.
pub fn decode(data: &[u8]) -> Option<Result<DynamicImage, String>> {
    DECODER.get_or_init(HeicDecoder::try_init)
        .as_ref()
        .map(|d| d.decode(data))
}

struct HeicDecoder {
    _lib: Library,  // Keep library loaded
    // Function pointers from libheif
    context_alloc: ContextAllocFn,
    context_read_from_memory: ContextReadFromMemoryFn,
    context_get_primary_image_handle: GetPrimaryHandleFn,
    decode_image: DecodeImageFn,
    image_get_plane_readonly: GetPlaneFn,
    // ... cleanup functions
}

impl HeicDecoder {
    fn try_init() -> Option<Self> {
        let lib_names = if cfg!(target_os = "macos") {
            &[
                "libheif.1.dylib",
                "/opt/homebrew/lib/libheif.dylib",
                "/usr/local/lib/libheif.dylib",
            ]
        } else if cfg!(target_os = "windows") {
            &["heif.dll", "libheif.dll"]
        } else {
            &["libheif.so.1", "libheif.so"]
        };

        for name in lib_names {
            match unsafe { Library::new(name) } {
                Ok(lib) => {
                    match Self::load_symbols(lib) {
                        Ok(decoder) => {
                            tracing::info!("HEIC support enabled via {}", name);
                            return Some(decoder);
                        }
                        Err(e) => {
                            tracing::debug!("Failed to load symbols from {}: {}", name, e);
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        tracing::debug!("libheif not found, HEIC support disabled");
        None
    }

    fn load_symbols(lib: Library) -> Result<Self, libloading::Error> {
        // Load all required function pointers...
    }

    fn decode(&self, data: &[u8]) -> Result<DynamicImage, String> {
        // Use loaded symbols to decode HEIC to RGB pixels
        // Convert to DynamicImage
    }
}
```

### 2. Cargo.toml Changes

```toml
[dependencies]
libloading = "0.8"

[profile.dev.package.libloading]
opt-level = 3
```

### 3. src/photos.rs Changes (line 8)

```rust
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
```

### 4. src/processing.rs Changes

**Add to get_file_extension() (~line 250):**
```rust
"heic" | "heif" => Some(FileExtension::HEIF),
```

**Modify process_photo() to use HEIC decoder (~line 196):**
```rust
// Only decode image if we need any webp variant
if need_micro || need_thumb || need_full {
    let img = if matches!(photo.extension.as_str(), "heic" | "heif") {
        // Use runtime HEIC decoder
        match crate::heic::decode(&original_data) {
            Some(Ok(img)) => img,
            Some(Err(e)) => {
                return Err(Error::Other(format!("HEIC decode error: {}", e)));
            }
            None => {
                return Err(Error::Other(
                    "HEIC file found but libheif not installed. \
                     Install libheif for HEIC support.".into()
                ));
            }
        }
    } else {
        image::load_from_memory(&original_data)?
    };
    // ... rest of processing
}
```

**Handle dimensions for HEIC (~line 155):**
```rust
// Extract image dimensions
let (width, height) = if matches!(photo.extension.as_str(), "heic" | "heif") {
    // For HEIC, we need to decode to get dimensions (or skip if unavailable)
    if !crate::heic::is_available() {
        return Err(Error::Other(
            "HEIC file found but libheif not installed".into()
        ));
    }
    // Will be set after decoding below
    (0, 0)  // Placeholder, actual dimensions come from decoded image
} else {
    let reader = image::ImageReader::new(Cursor::new(&original_data))
        .with_guessed_format()
        .map_err(|e| crate::error::Error::Image(image::ImageError::IoError(e)))?;
    reader.into_dimensions()?
};
```

### 5. GitHub Actions Workflow Changes

**.github/workflows/release.yml:**

```yaml
jobs:
  build:
    # ... existing matrix config ...
    steps:
      - uses: actions/checkout@v4

      # Add libheif installation for each platform
      - name: Install libheif (macOS)
        if: runner.os == 'macOS'
        run: brew install libheif

      - name: Install libheif (Linux)
        if: runner.os == 'Linux' && matrix.target == 'x86_64-unknown-linux-gnu'
        run: |
          sudo apt-get update
          sudo apt-get install -y libheif-dev

      - name: Install libheif (Windows)
        if: runner.os == 'Windows'
        run: |
          vcpkg install libheif:x64-windows
          echo "VCPKG_ROOT=$env:VCPKG_INSTALLATION_ROOT" >> $env:GITHUB_ENV

      # Note: For Linux ARM64 (zigbuild), libheif testing is skipped
      # The binary still works - it just won't have HEIC at test time

      # ... rest of existing steps ...
```

**Add test job for HEIC:**

```yaml
  test-heic:
    name: Test HEIC Support
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install libheif
        run: |
          sudo apt-get update
          sudo apt-get install -y libheif-dev
      - uses: dtolnay/rust-toolchain@nightly
      - name: Run tests
        run: cargo test
      - name: Test HEIC processing
        run: |
          cargo run -- build -v
          # Verify HEIC files were processed
```

### 6. Documentation Updates

**wiki/image-processing.md** - Add section:

```markdown
## HEIC/HEIF Support

galerie automatically supports HEIC/HEIF images (common on Apple devices)
when libheif is installed on your system.

### Installing libheif

**macOS:**
```bash
brew install libheif
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libheif1
```

**Fedora:**
```bash
sudo dnf install libheif
```

**Windows:**
Download from libheif releases or install via vcpkg.

### Behavior Without libheif

If libheif is not installed, galerie will:
- Skip HEIC/HEIF files during processing
- Log a warning message for each skipped file
- Continue processing all other image formats

No rebuild is required - just install libheif and re-run galerie.
```

## libheif C API Functions Required

The dlopen wrapper needs these functions from libheif:

| Function | Purpose |
|----------|---------|
| `heif_context_alloc` | Create decoding context |
| `heif_context_read_from_memory` | Load HEIC data |
| `heif_context_get_primary_image_handle` | Get main image |
| `heif_decode_image` | Decode to RGB |
| `heif_image_get_plane_readonly` | Get pixel data |
| `heif_image_get_width` | Get dimensions |
| `heif_image_get_height` | Get dimensions |
| `heif_context_free` | Cleanup |
| `heif_image_handle_release` | Cleanup |
| `heif_image_release` | Cleanup |

## Verification

1. **Without libheif installed:**
   ```bash
   cargo build --release
   ./target/release/galerie build -v
   # Should log: "libheif not found, HEIC support disabled"
   # HEIC files should be skipped with warnings
   ```

2. **With libheif installed:**
   ```bash
   brew install libheif  # or apt-get install libheif1
   ./target/release/galerie build -v
   # Should log: "HEIC support enabled via libheif.dylib"
   # HEIC files should process to WebP successfully
   ```

3. **Test with example files:**
   ```bash
   ls example/photos/heic/
   # IMG_0826.HEIC, IMG_0828.HEIC, IMG_0830.HEIC
   ```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| libheif API changes | Pin to stable API functions, test in CI |
| Symbol loading failures | Graceful fallback, clear error messages |
| Memory safety in FFI | Careful lifetime management, test with valgrind |
| Platform library paths | Check multiple common paths per platform |

## References

- [libheif GitHub](https://github.com/strukturag/libheif)
- [libheif-rs crate](https://lib.rs/crates/libheif-rs)
- [libloading crate](https://github.com/nagisa/rust_libloading)
- [little_exif HEIF support](https://lib.rs/crates/little_exif)
