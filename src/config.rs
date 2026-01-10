use serde::Deserialize;
use std::path::PathBuf;

/// Site configuration loaded from site.toml
#[derive(Debug, Deserialize)]
pub struct Site {
    /// The domain where this site will be hosted
    pub domain: String,

    /// Theme to use for rendering
    #[serde(deserialize_with = "deserialize_theme")]
    pub theme: Theme,

    /// Directory containing source photos (relative to site root)
    #[serde(default = "default_photos")]
    pub photos: PathBuf,

    /// Directory for build output (relative to site root)
    #[serde(default = "default_build")]
    pub build: PathBuf,
}

/// Theme source specification
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Theme {
    /// Theme located in a local directory (relative to site root)
    Local(PathBuf),
    // Future variants:
    // Git { url: String, rev: Option<String> },
    // Remote(Url),
}

impl Theme {
    /// Returns the path where this theme's files are located.
    ///
    /// For local themes, this is the path as specified.
    /// For remote themes (future), this would be the cached/extracted location.
    pub fn path(&self) -> &PathBuf {
        match self {
            Self::Local(path) => path,
        }
    }
}

fn deserialize_theme<'de, D>(deserializer: D) -> Result<Theme, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    Ok(Theme::Local(PathBuf::from(value)))
}

fn default_photos() -> PathBuf {
    PathBuf::from("photos")
}

fn default_build() -> PathBuf {
    PathBuf::from("dist")
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
        assert_eq!(site.theme, Theme::Local(PathBuf::from("themes/minimal")));
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
        assert_eq!(site.theme, Theme::Local(PathBuf::from("my-theme")));
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
    fn missing_theme_fails() {
        let toml = r#"domain = "example.com""#;
        let result: Result<Site, _> = toml::from_str(toml);

        assert!(result.is_err());
    }

    #[test]
    fn theme_path() {
        let theme = Theme::Local(PathBuf::from("themes/gallery"));
        assert_eq!(theme.path(), &PathBuf::from("themes/gallery"));
    }
}
