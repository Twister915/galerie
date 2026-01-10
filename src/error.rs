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

    #[error("no photos found in {}", path.display())]
    NoPhotos { path: PathBuf },
}

pub type Result<T> = std::result::Result<T, Error>;
