use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("config error: {0}")]
    Config(#[from] toml::de::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("template error: {0}")]
    Template(#[from] tera::Error),

    #[error("image processing error: {0}")]
    Image(#[from] image::ImageError),

    #[error("theme missing required template: index.html")]
    MissingIndexTemplate,

    #[error("theme not found: {name} (not a local directory or built-in theme)")]
    ThemeNotFound { name: String },

    #[error("no photos found in {}", path.display())]
    NoPhotos { path: PathBuf },

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
