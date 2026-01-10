//! Built-in themes shipped with the binary.
//!
//! Each theme is embedded separately to avoid path prefix issues.

use include_dir::{include_dir, Dir};

/// The "basic" built-in theme.
static BASIC: Dir = include_dir!("$CARGO_MANIFEST_DIR/themes/basic");

/// The "fancy" built-in theme - dark mode SPA with masonry grid.
static FANCY: Dir = include_dir!("$CARGO_MANIFEST_DIR/themes/fancy");

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
