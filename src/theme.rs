use std::path::{Path, PathBuf};

use tera::Tera;

use crate::error::{Error, Result};

/// Well-known template names.
pub mod templates {
    /// Site homepage (required)
    pub const INDEX: &str = "index.html";
    /// Album index pages (optional)
    pub const ALBUM: &str = "album.html";
    /// Individual photo pages (optional)
    pub const PHOTO: &str = "photo.html";
}

/// A loaded theme with templates and static assets.
#[derive(Debug)]
pub struct Theme {
    /// Tera template engine with all templates loaded
    pub templates: Tera,

    /// Path to static assets directory (if it exists)
    pub static_dir: Option<PathBuf>,

    /// Whether album.html template exists
    pub has_album_template: bool,

    /// Whether photo.html template exists
    pub has_photo_template: bool,
}

impl Theme {
    /// Load a theme from the given directory.
    ///
    /// The directory must contain a `templates/` subdirectory with at least
    /// an `index.html` template.
    pub fn load(theme_dir: &Path) -> Result<Self> {
        let templates_dir = theme_dir.join("templates");
        let static_dir = theme_dir.join("static");

        // Load all templates from templates/**/*.html
        let glob_pattern = format!("{}/**/*.html", templates_dir.display());
        let templates = Tera::new(&glob_pattern)?;

        // Validate required templates
        if !templates.get_template_names().any(|n| n == templates::INDEX) {
            return Err(Error::MissingIndexTemplate);
        }

        // Check for optional templates
        let has_album_template = templates
            .get_template_names()
            .any(|n| n == templates::ALBUM);
        let has_photo_template = templates
            .get_template_names()
            .any(|n| n == templates::PHOTO);

        // Check for static directory
        let static_dir = if static_dir.is_dir() {
            Some(static_dir)
        } else {
            None
        };

        tracing::info!(
            has_album = has_album_template,
            has_photo = has_photo_template,
            has_static = static_dir.is_some(),
            "theme loaded"
        );

        Ok(Self {
            templates,
            static_dir,
            has_album_template,
            has_photo_template,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_temp_theme(templates: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let templates_dir = dir.path().join("templates");
        fs::create_dir(&templates_dir).unwrap();

        for (name, content) in templates {
            fs::write(templates_dir.join(name), content).unwrap();
        }

        dir
    }

    #[test]
    fn load_minimal_theme() {
        let dir = create_temp_theme(&[("index.html", "<html></html>")]);

        let theme = Theme::load(dir.path()).unwrap();

        assert!(!theme.has_album_template);
        assert!(!theme.has_photo_template);
        assert!(theme.static_dir.is_none());
    }

    #[test]
    fn load_full_theme() {
        let dir = create_temp_theme(&[
            ("index.html", "<html></html>"),
            ("album.html", "<html></html>"),
            ("photo.html", "<html></html>"),
        ]);

        // Create static directory
        fs::create_dir(dir.path().join("static")).unwrap();

        let theme = Theme::load(dir.path()).unwrap();

        assert!(theme.has_album_template);
        assert!(theme.has_photo_template);
        assert!(theme.static_dir.is_some());
    }

    #[test]
    fn missing_index_fails() {
        let dir = create_temp_theme(&[("photo.html", "<html></html>")]);

        let result = Theme::load(dir.path());

        assert!(result.is_err());
    }
}
