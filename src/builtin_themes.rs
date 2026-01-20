//! Built-in themes shipped with the binary.
//!
//! Each theme is embedded separately to avoid path prefix issues.
//!
//! - **Classic themes** (like basic): Embed entire theme directory.
//! - **Vite themes** (like fancy): Embed dist/ subdirectory (built at compile time by build.rs).

use include_dir::{Dir, include_dir};

/// The "basic" built-in theme - classic theme, embed entire directory.
static BASIC: Dir = include_dir!("$CARGO_MANIFEST_DIR/themes/basic");

/// The "fancy" built-in theme - Vite theme, embed dist/ (built at compile time).
static FANCY: Dir = include_dir!("$CARGO_MANIFEST_DIR/themes/fancy/dist");

/// Look up a built-in theme by name.
///
/// Returns the theme directory if found.
pub fn get(name: &str) -> Option<&'static Dir<'static>> {
    match name {
        "basic" => Some(&BASIC),
        "fancy" => Some(&FANCY),
        _ => None,
    }
}
