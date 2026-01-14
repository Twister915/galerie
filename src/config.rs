use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::i18n;

/// GPS privacy mode for controlling location data visibility.
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GpsMode {
    /// No GPS data shown, GPS EXIF stripped from originals.
    Off,
    /// General location only (city/country), no coordinates or map.
    /// GPS EXIF still stripped from originals.
    General,
    /// Full GPS data shown (default).
    #[default]
    On,
}

impl GpsMode {
    /// Returns the filename suffix for original files.
    ///
    /// When GPS is stripped (Off or General mode), originals get a `-nogps` suffix
    /// so they're cached separately from unmodified originals.
    pub fn original_suffix(self) -> &'static str {
        match self {
            GpsMode::On => "",
            GpsMode::Off | GpsMode::General => "-nogps",
        }
    }
}

/// Theme configuration supporting both simple and extended formats.
///
/// Simple format (backwards compatible):
/// ```toml
/// theme = "fancy"
/// ```
///
/// Extended format with settings:
/// ```toml
/// [theme]
/// name = "fancy"
/// slideshow_delay = 8000
/// default_sort = "date"
/// ```
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum ThemeConfig {
    /// Simple string format: `theme = "fancy"`
    Name(String),
    /// Table format with name and optional settings
    Table(ThemeTableConfig),
}

impl Default for ThemeConfig {
    fn default() -> Self {
        ThemeConfig::Name("fancy".to_string())
    }
}

impl std::fmt::Display for ThemeConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

impl ThemeConfig {
    /// Returns the theme name.
    pub fn name(&self) -> &str {
        match self {
            ThemeConfig::Name(name) => name,
            ThemeConfig::Table(table) => &table.name,
        }
    }

    /// Returns user-provided settings (empty for simple string format).
    pub fn settings(&self) -> &HashMap<String, toml::Value> {
        match self {
            ThemeConfig::Name(_) => {
                // Return empty HashMap for simple format
                static EMPTY: std::sync::LazyLock<HashMap<String, toml::Value>> =
                    std::sync::LazyLock::new(HashMap::new);
                &EMPTY
            }
            ThemeConfig::Table(table) => &table.settings,
        }
    }
}

/// Table-based theme configuration with name and arbitrary settings.
#[derive(Debug, Clone, Deserialize)]
pub struct ThemeTableConfig {
    /// Theme name (required)
    pub name: String,
    /// Arbitrary theme-specific settings
    #[serde(flatten)]
    pub settings: HashMap<String, toml::Value>,
}

/// Language configuration for i18n support.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LangConfig {
    /// Language code (e.g., "en", "zh_CN")
    pub code: String,
    /// Display name for language switcher (e.g., "English", "简体中文")
    /// If not specified, looked up from built-in language list.
    #[serde(default)]
    pub name: Option<String>,
}

/// Resolved language config with guaranteed name.
#[derive(Debug, Clone, Serialize)]
pub struct ResolvedLangConfig {
    pub code: String,
    pub name: String,
}

fn default_languages() -> Vec<LangConfig> {
    vec![LangConfig {
        code: "en".to_string(),
        name: None,
    }]
}

/// Site configuration loaded from site.toml
#[derive(Debug, Deserialize)]
pub struct Site {
    /// The domain where this site will be hosted
    pub domain: String,

    /// Site title (defaults to domain if not specified)
    pub title: Option<String>,

    /// Theme configuration (defaults to "fancy").
    ///
    /// Supports both simple format (`theme = "fancy"`) and extended format
    /// with settings (`[theme]` table).
    ///
    /// Resolution order (handled by Pipeline::load):
    /// 1. Local directory with this name → use local
    /// 2. Built-in theme with this name → use embedded
    /// 3. Error
    #[serde(default)]
    pub theme: ThemeConfig,

    /// Directory containing source photos (relative to site root)
    #[serde(default = "default_photos")]
    pub photos: PathBuf,

    /// Directory for build output (relative to site root)
    #[serde(default = "default_build")]
    pub build: PathBuf,

    /// Whether to minify HTML, CSS, and JS output (defaults to true)
    #[serde(default = "default_minify")]
    pub minify: bool,

    /// GPS privacy mode (defaults to "on")
    #[serde(default)]
    pub gps: GpsMode,

    /// Languages to generate (defaults to English only)
    /// Ignored if `all_languages` is true.
    #[serde(default = "default_languages")]
    pub languages: Vec<LangConfig>,

    /// Enable all supported languages (overrides `languages` list)
    #[serde(default)]
    pub all_languages: bool,

    /// Default language code (defaults to first in languages list)
    pub default_language: Option<String>,
}

impl Site {
    /// Returns the default language code.
    pub fn default_lang(&self) -> String {
        self.default_language
            .clone()
            .unwrap_or_else(|| {
                self.languages
                    .first()
                    .map(|l| l.code.clone())
                    .unwrap_or_else(|| "en".to_string())
            })
    }

    /// Returns the languages to use, respecting `all_languages` flag.
    /// Names are resolved from built-in list if not specified.
    pub fn languages(&self) -> Vec<ResolvedLangConfig> {
        let builtin: std::collections::HashMap<&str, &str> = i18n::all_supported_languages()
            .into_iter()
            .map(|l| (l.code, l.name))
            .collect();

        if self.all_languages {
            i18n::all_supported_languages()
                .into_iter()
                .map(|l| ResolvedLangConfig {
                    code: l.code.to_string(),
                    name: l.name.to_string(),
                })
                .collect()
        } else {
            self.languages
                .iter()
                .map(|l| {
                    let name = l.name.clone().unwrap_or_else(|| {
                        builtin
                            .get(l.code.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| l.code.clone())
                    });
                    ResolvedLangConfig {
                        code: l.code.clone(),
                        name,
                    }
                })
                .collect()
        }
    }
}

fn default_photos() -> PathBuf {
    PathBuf::from("photos")
}

fn default_build() -> PathBuf {
    PathBuf::from("dist")
}

fn default_minify() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimal_config() {
        let toml = r#"
            domain = "photos.example.com"
            theme = "themes/minimal"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.domain, "photos.example.com");
        assert_eq!(site.theme.name(), "themes/minimal");
        assert!(site.theme.settings().is_empty());
        assert_eq!(site.photos, PathBuf::from("photos"));
        assert_eq!(site.build, PathBuf::from("dist"));
    }

    #[test]
    fn full_config() {
        let toml = r#"
            domain = "photos.example.com"
            theme = "my-theme"
            photos = "albums/vacation"
            build = "output"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.domain, "photos.example.com");
        assert_eq!(site.theme.name(), "my-theme");
        assert_eq!(site.photos, PathBuf::from("albums/vacation"));
        assert_eq!(site.build, PathBuf::from("output"));
    }

    #[test]
    fn missing_domain_fails() {
        let toml = r#"theme = "default""#;
        let result: Result<Site, _> = toml::from_str(toml);

        assert!(result.is_err());
    }

    #[test]
    fn default_theme() {
        let toml = r#"domain = "example.com""#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.theme.name(), "fancy");
    }

    #[test]
    fn theme_table_format() {
        let toml = r#"
            domain = "example.com"

            [theme]
            name = "fancy"
            slideshow_delay = 8000
            default_sort = "date"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.theme.name(), "fancy");

        let settings = site.theme.settings();
        assert_eq!(
            settings.get("slideshow_delay"),
            Some(&toml::Value::Integer(8000))
        );
        assert_eq!(
            settings.get("default_sort"),
            Some(&toml::Value::String("date".to_string()))
        );
    }

    #[test]
    fn theme_table_minimal() {
        let toml = r#"
            domain = "example.com"

            [theme]
            name = "basic"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.theme.name(), "basic");
        assert!(site.theme.settings().is_empty());
    }

    #[test]
    fn gps_mode_default() {
        let toml = r#"domain = "example.com""#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.gps, GpsMode::On);
    }

    #[test]
    fn gps_mode_off() {
        let toml = r#"
            domain = "example.com"
            gps = "off"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.gps, GpsMode::Off);
    }

    #[test]
    fn gps_mode_general() {
        let toml = r#"
            domain = "example.com"
            gps = "general"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.gps, GpsMode::General);
    }

    #[test]
    fn gps_mode_on() {
        let toml = r#"
            domain = "example.com"
            gps = "on"
        "#;
        let site: Site = toml::from_str(toml).unwrap();

        assert_eq!(site.gps, GpsMode::On);
    }
}
