//! Asset minification for HTML, CSS, and JavaScript.

use crate::error::{Error, Result};

/// Minify HTML content.
pub fn html(input: &str) -> Result<String> {
    let cfg = minify_html::Cfg {
        minify_css: true,
        minify_js: true,
        ..Default::default()
    };

    let bytes = minify_html::minify(input.as_bytes(), &cfg);
    String::from_utf8(bytes).map_err(|e| Error::Other(e.to_string()))
}

/// Minify CSS content.
pub fn css(input: &str) -> Result<String> {
    use lightningcss::stylesheet::{ParserOptions, PrinterOptions, StyleSheet};

    let stylesheet = StyleSheet::parse(input, ParserOptions::default())
        .map_err(|e| Error::Other(format!("CSS parse error: {}", e)))?;

    let minified = stylesheet
        .to_css(PrinterOptions {
            minify: true,
            ..Default::default()
        })
        .map_err(|e| Error::Other(format!("CSS minify error: {}", e)))?;

    Ok(minified.code)
}

/// Minify JavaScript content.
///
/// Returns the original input if minification fails.
pub fn js(input: &str) -> String {
    use oxc::allocator::Allocator;
    use oxc::codegen::{Codegen, CodegenOptions};
    use oxc::minifier::{Minifier, MinifierOptions};
    use oxc::parser::Parser;
    use oxc::span::SourceType;

    let allocator = Allocator::default();
    let source_type = SourceType::mjs();
    let ret = Parser::new(&allocator, input, source_type).parse();

    if !ret.errors.is_empty() {
        tracing::warn!("JS parse error, using original");
        return input.to_string();
    }

    let mut program = ret.program;
    let options = MinifierOptions::default();
    Minifier::new(options).minify(&allocator, &mut program);

    let codegen_options = CodegenOptions {
        minify: true,
        ..Default::default()
    };
    Codegen::new().with_options(codegen_options).build(&program).code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_minifies_whitespace() {
        let input = r#"
            <html>
                <head>
                    <title>Test</title>
                </head>
                <body>
                    <p>Hello   world</p>
                </body>
            </html>
        "#;
        let output = html(input).unwrap();
        assert!(!output.contains("    "));
        assert!(output.contains("<title>Test</title>"));
    }

    #[test]
    fn css_minifies() {
        let input = r#"
            body {
                margin: 0;
                padding: 0;
            }
        "#;
        let output = css(input).unwrap();
        assert!(!output.contains('\n'));
        assert!(output.contains("margin:0"));
    }

    #[test]
    fn js_minifies() {
        // Use top-level code that won't be eliminated by DCE
        let input = r#"
            var x = 1;
            var y = 2;
            console.log(x + y);
        "#;
        let output = js(input);
        eprintln!("JS minified output: {:?}", output);
        // Output should be more compact (less whitespace)
        assert!(output.len() < input.len());
        assert!(output.contains("console"));
    }
}
