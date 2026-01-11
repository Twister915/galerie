use serde::Deserialize;
use std::path::PathBuf;

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

/// Site configuration loaded from site.toml
#[derive(Debug, Deserialize)]
pub struct Site {
    /// The domain where this site will be hosted
    pub domain: String,

    /// Site title (defaults to domain if not specified)
    pub title: Option<String>,

    /// Theme to use for rendering (defaults to "basic").
    ///
    /// Resolution order (handled by Pipeline::load):
    /// 1. Local directory with this name → use local
    /// 2. Built-in theme with this name → use embedded
    /// 3. Error
    #[serde(default = "default_theme")]
    pub theme: String,

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
}

fn default_theme() -> String {
    "basic".to_string()
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
        assert_eq!(site.theme, "themes/minimal");
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
        assert_eq!(site.theme, "my-theme");
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

        assert_eq!(site.theme, "basic");
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
