use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use include_dir::Dir;
use serde::Deserialize;
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

/// Source of static assets for a theme.
#[derive(Debug)]
pub enum StaticSource {
    /// Static files in a local directory
    Directory(PathBuf),
    /// Static files embedded at compile time
    Builtin(&'static Dir<'static>),
    /// No static files
    None,
}

/// A loaded theme with templates, static assets, and configuration defaults.
#[derive(Debug)]
pub struct Theme {
    /// Tera template engine with all templates loaded
    pub templates: Tera,

    /// Source of static assets
    pub static_source: StaticSource,

    /// Whether album.html template exists
    pub has_album_template: bool,

    /// Whether photo.html template exists
    pub has_photo_template: bool,

    /// Theme default configuration from theme.toml
    pub defaults: BTreeMap<String, toml::Value>,
}

/// Structure for parsing theme.toml files.
#[derive(Debug, Deserialize)]
struct ThemeToml {
    #[serde(default)]
    defaults: BTreeMap<String, toml::Value>,
}

/// Load theme defaults from theme.toml file.
fn load_theme_defaults(theme_dir: &Path) -> Result<BTreeMap<String, toml::Value>> {
    let theme_toml = theme_dir.join("theme.toml");

    if !theme_toml.exists() {
        return Ok(BTreeMap::new());
    }

    let content = std::fs::read_to_string(&theme_toml)?;
    let parsed: ThemeToml = toml::from_str(&content)?;

    tracing::debug!(
        keys = ?parsed.defaults.keys().collect::<Vec<_>>(),
        "loaded theme defaults"
    );

    Ok(parsed.defaults)
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
        let mut templates = Tera::new(&glob_pattern)?;

        // Disable autoescaping - we control all template data
        templates.autoescape_on(vec![]);

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
        let static_source = if static_dir.is_dir() {
            StaticSource::Directory(static_dir)
        } else {
            StaticSource::None
        };

        // Load theme defaults from theme.toml
        let defaults = load_theme_defaults(theme_dir)?;

        tracing::info!(
            has_album = has_album_template,
            has_photo = has_photo_template,
            has_static = !matches!(static_source, StaticSource::None),
            defaults = defaults.len(),
            "theme loaded"
        );

        Ok(Self {
            templates,
            static_source,
            has_album_template,
            has_photo_template,
            defaults,
        })
    }

    /// Load a theme from an embedded directory.
    ///
    /// The directory must contain a `templates/` subdirectory with at least
    /// an `index.html` template.
    pub fn from_builtin(dir: &'static Dir<'static>) -> Result<Self> {
        let mut templates = Tera::default();

        // Load all templates from templates/ subdirectory
        let templates_dir = dir.get_dir("templates").ok_or(Error::MissingIndexTemplate)?;

        for file in templates_dir.files() {
            let Some(name) = file.path().file_name().and_then(|n| n.to_str()) else {
                continue;
            };

            // Skip hidden files (.DS_Store, etc.)
            if name.starts_with('.') {
                continue;
            }

            // Only process .html files
            if !name.ends_with(".html") {
                continue;
            }

            let Some(content) = file.contents_utf8() else {
                continue;
            };

            templates.add_raw_template(name, content)?;
        }

        // Disable autoescaping - we control all template data
        templates.autoescape_on(vec![]);

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

        // Get static/ subdirectory if it exists
        let static_source = dir
            .get_dir("static")
            .map(StaticSource::Builtin)
            .unwrap_or(StaticSource::None);

        // Load theme defaults from embedded theme.toml
        let defaults = if let Some(file) = dir.get_file("theme.toml") {
            if let Some(content) = file.contents_utf8() {
                let parsed: ThemeToml = toml::from_str(content)?;
                tracing::debug!(
                    keys = ?parsed.defaults.keys().collect::<Vec<_>>(),
                    "loaded theme defaults"
                );
                parsed.defaults
            } else {
                BTreeMap::new()
            }
        } else {
            BTreeMap::new()
        };

        tracing::info!(
            has_album = has_album_template,
            has_photo = has_photo_template,
            has_static = !matches!(static_source, StaticSource::None),
            defaults = defaults.len(),
            "theme loaded"
        );

        Ok(Self {
            templates,
            static_source,
            has_album_template,
            has_photo_template,
            defaults,
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
        assert!(matches!(theme.static_source, StaticSource::None));
        assert!(theme.defaults.is_empty());
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
        assert!(matches!(theme.static_source, StaticSource::Directory(_)));
        assert!(theme.defaults.is_empty());
    }

    #[test]
    fn load_theme_with_defaults() {
        let dir = create_temp_theme(&[("index.html", "<html></html>")]);

        // Create theme.toml with defaults
        fs::write(
            dir.path().join("theme.toml"),
            r#"
                [defaults]
                slideshow_delay = 5000
                default_sort = "shuffle"
            "#,
        )
        .unwrap();

        let theme = Theme::load(dir.path()).unwrap();

        assert_eq!(
            theme.defaults.get("slideshow_delay"),
            Some(&toml::Value::Integer(5000))
        );
        assert_eq!(
            theme.defaults.get("default_sort"),
            Some(&toml::Value::String("shuffle".to_string()))
        );
    }

    #[test]
    fn missing_index_fails() {
        let dir = create_temp_theme(&[("photo.html", "<html></html>")]);

        let result = Theme::load(dir.path());

        assert!(result.is_err());
    }
}
