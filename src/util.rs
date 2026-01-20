//! Utility functions.

/// URL-encode a string for use in URL paths.
/// Encodes spaces and other special characters while preserving alphanumerics,
/// hyphens, underscores, periods, and tildes.
pub fn url_encode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => {
                result.push(c);
            }
            _ => {
                for byte in c.to_string().as_bytes() {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    result
}

/// URL-encode a path, encoding each segment but preserving '/' separators.
pub fn url_encode_path(path: &str) -> String {
    path.split('/')
        .map(url_encode)
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encode_special_chars() {
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(url_encode("test&file"), "test%26file");
        assert_eq!(url_encode("photo#1"), "photo%231");
        assert_eq!(url_encode("normal-file_name.jpg"), "normal-file_name.jpg");
    }

    #[test]
    fn url_encode_path_preserves_slashes() {
        assert_eq!(url_encode_path("album/photo"), "album/photo");
        assert_eq!(url_encode_path("2025 in Virginia/photo"), "2025%20in%20Virginia/photo");
        assert_eq!(url_encode_path("a/b/c"), "a/b/c");
    }
}
