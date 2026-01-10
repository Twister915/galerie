# Joey's Rust Style Guide

You are working on a Rust project that follows Joey's engineering philosophy. This guide teaches you how to write Rust code the way Joey wants it.

## Core Philosophy

**Always use nightly Rust.** All projects build against nightly. This gives access to the latest features and optimizations.

**Longevity over convenience.** Code should work in 5-10 years without modification. This means:
- Minimize dependencies (each one is a liability over time)
- Prefer pure Rust dependencies over native/FFI bindings
- Avoid experimental language features unless they solve something cleanly (nightly is fine, unstable features need justification)

**Performance is non-negotiable.** Prefer static dispatch, stack allocation, and iterator chains. Avoid premature abstraction.

**Reuse over rewrite.** Before writing new code, search the codebase for existing patterns. Build shared abstractions when you see duplication.

---

## Decision Framework

When facing a trade-off, ask these questions in order:

1. **Will this still compile and run in 5 years?** Fewer dependencies = more durable.
2. **Is this the fastest reasonable approach?** Prefer zero-cost abstractions.
3. **Does similar code already exist here?** Reuse or generalize it.
4. **Am I certain this abstraction is needed?** Wait until you've seen the full picture.

---

## Dependencies

**Note:** Version numbers in these examples may be outdated. Always check crates.io for current stable versions before adding dependencies.

<dependencies_by_project_type>

### Executables / Programs

**Always include:**
```toml
thiserror = "1"
tracing = "0.1"

[dependencies.tracing-subscriber]
version = "0.3"
features = ["env-filter", "json"]
```

**Usually include:**
```toml
[dependencies.serde]
version = "1"
features = ["derive"]

serde_json = "1"    # only when you actually need JSON
```

**For async programs (80% of the time):**
```toml
[dependencies.tokio]
version = "1"
features = ["rt-multi-thread", "macros", "net", "sync", "time", "fs", "io-util"]
# IMPORTANT: Pick specific features. Never use "full".

[dependencies.tokio-util]
version = "0.7"

[dependencies.tokio-stream]
version = "0.1"

[dependencies.futures]
version = "0.3"

[dependencies.pin-project]
version = "1"
# Use when building custom Stream/Future implementations
```

**For CLI programs with arguments:**
```toml
[dependencies.clap]
version = "4"
features = ["derive"]
```

**For web/WASM applications (yew is the default):**
```toml
[dependencies.yew]
version = "0.21"
features = ["csr"]

js-sys = "0.3"
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
web-sys = "0.3"        # Add features as needed, never use default features
tracing-web = "0.1"    # For browser console logging
```

**For terminal-style web apps (ratatui + ratzilla), only if explicitly requested:**
```toml
ratatui = "0.29"
ratzilla = "0.7"

js-sys = "0.3"
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
```

### Libraries / Crates

- Support `no_std` when possible (not all crates need to allocate)
- Make dependencies optional with feature flags
- Minimize the public dependency surface

</dependencies_by_project_type>

---

## Web/WASM Projects

<trunk_setup>

**Build tool:** Use [Trunk](https://trunkrs.dev/) for building and serving WASM apps. Avoid creating a `Trunk.toml` unless it becomes necessary—Trunk's defaults work well.

**Required files at project root:**

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>app-name</title>
    <link data-trunk rel="scss" href="style.scss">
    <link data-trunk rel="rust" data-wasm-opt="z">
</head>
<body></body>
</html>
```

The `<link data-trunk rel="rust">` tells Trunk to compile the Rust code to WASM and inject it. The `data-wasm-opt="z"` optimizes for size.

</trunk_setup>

<wasm_target>

**Add the WASM target:**
```bash
rustup target add wasm32-unknown-unknown
```

**Development commands:**
```bash
trunk serve    # Dev server with hot reload
trunk build    # Debug build to dist/
trunk build --release --profile distribute  # Production build
```

</wasm_target>

<web_sys_features>

**web-sys requires explicit features.** Never use defaults—pick only what you need:

```toml
[dependencies.web-sys]
version = "0.3"
features = [
    "Window",
    "Document",
    "Element",
    "HtmlElement",
    "console",
]
```

Common feature groups:
- DOM manipulation: `Window`, `Document`, `Element`, `Node`, `HtmlElement`
- Events: `Event`, `MouseEvent`, `KeyboardEvent`, `EventTarget`
- Storage: `Storage`, `Navigator`
- Canvas: `HtmlCanvasElement`, `CanvasRenderingContext2d`, `WebGlRenderingContext`
- Fetch: `Request`, `Response`, `Headers`, `RequestInit`

</web_sys_features>

<yew_patterns>

**Yew entry point:**
```rust
use yew::prelude::*;

#[function_component(App)]
fn app() -> Html {
    html! {
        <main>
            <h1>{ "Hello, World!" }</h1>
        </main>
    }
}

fn main() {
    tracing_web::set_as_global_default();
    yew::Renderer::<App>::new().render();
}
```

</yew_patterns>

<ratzilla_patterns>

**Ratzilla entry point:**
```rust
use ratzilla::prelude::*;

fn main() {
    ratzilla::run(app);
}

fn app(terminal: &mut Terminal) {
    // ratatui drawing code
}
```

</ratzilla_patterns>

<wasm_logging>

**WASM apps use console logging, not tracing-subscriber.** The browser doesn't have stdout, so use `tracing-web` or `console_log` to redirect tracing output to the browser console:

```toml
[dependencies]
tracing = "0.1"
tracing-web = "0.1"
```

```rust
fn main() {
    // Initialize tracing for WASM (logs to browser console)
    tracing_web::set_as_global_default();

    yew::Renderer::<App>::new().render();
}
```

</wasm_logging>

<dependency_format>

**Simple version-only dependencies:** one line
```toml
serde_json = "1"
```

**Any configuration beyond version:** use block format
```toml
[dependencies.tracing-subscriber]
version = "0.3"
features = ["env-filter", "json"]
```

**Version pinning:** Use major version only (e.g., `"1"` not `"1.0.123"`) unless pinning a specific minor is required. This allows `cargo update` to get compatible updates.

</dependency_format>

---

## Performance Patterns

<prefer>

**Static dispatch over dynamic:**
```rust
// GOOD: Compiler can inline and optimize
fn process<T>(item: T)
where
    T: Processor,
{ ... }

// AVOID when possible: Creates optimization boundary
fn process(item: &dyn Processor) { ... }
```

**Iterators over collect:**
```rust
// GOOD: Lazy, no intermediate allocation
fn get_names(users: &[User]) -> impl Iterator<Item = &str> {
    users.iter().map(|u| u.name.as_str())
}

// AVOID: Allocates unnecessarily
fn get_names(users: &[User]) -> Vec<&str> {
    users.iter().map(|u| u.name.as_str()).collect()
}
```

**Stack over heap:**
```rust
// GOOD: Stack allocated, no heap
let buffer: [u8; 256] = [0; 256];

// AVOID when size is known: Heap allocation
let buffer: Vec<u8> = vec![0; 256];
```

**Lifetimes over cloning:**
```rust
// GOOD: Zero-copy reference
fn process_data(data: &str) -> &str { ... }

// AVOID as first resort: Hidden allocation cost
fn process_data(data: &str) -> String { data.to_string() }
```

</prefer>

<acceptable_when_needed>

These patterns are acceptable when the situation calls for them, but reach for simpler alternatives first:

- `Arc`/`Rc` — when you genuinely need shared ownership
- `RefCell`/`Mutex` — when interior mutability is unavoidable
- `.clone()` — when the borrow checker legitimately requires it
- `Box<dyn Trait>` — when runtime polymorphism is the right abstraction

</acceptable_when_needed>

<async_patterns>

**Avoid boxing futures and streams.** Even though `Box<dyn Future>` or `Box<dyn Stream>` can be convenient, they add heap allocation and prevent the compiler from optimizing across await points. Use `impl Future` or `impl Stream` instead.

```rust
// GOOD: Zero-cost, compiler can optimize
async fn fetch_data(url: &str) -> Result<Data, Error> {
    // ...
}

fn make_stream(items: Vec<Item>) -> impl Stream<Item = Processed> {
    stream::iter(items).map(|i| process(i))
}

// AVOID: Heap allocation, optimization boundary
fn fetch_data(url: &str) -> Box<dyn Future<Output = Result<Data, Error>>> {
    Box::new(async move { /* ... */ })
}

fn make_stream(items: Vec<Item>) -> Box<dyn Stream<Item = Processed>> {
    Box::new(stream::iter(items).map(|i| process(i)))
}
```

When you genuinely need type erasure (e.g., storing heterogeneous futures in a collection), boxing is acceptable—but it should be the exception, not the default.

</async_patterns>

<lifetime_elision>

**Use lifetime elision whenever possible.** Don't write explicit lifetimes when the compiler can infer them.

```rust
// GOOD: Elided lifetimes
fn first_word(s: &str) -> &str { ... }
fn get_name(&self) -> &str { ... }

// AVOID: Unnecessary explicit lifetimes
fn first_word<'a>(s: &'a str) -> &'a str { ... }
fn get_name<'a>(&'a self) -> &'a str { ... }
```

Only write explicit lifetimes when:
- The compiler requires disambiguation
- Multiple lifetimes need different relationships
- Documentation clarity genuinely benefits (rare)

</lifetime_elision>

<generics_syntax>

**Use `where` clauses instead of inline bounds.** This improves readability, especially with multiple bounds.

```rust
// GOOD: where clause
fn process<T>(item: T) -> Result<Output, Error>
where
    T: Serialize + Debug + Send,
{
    // ...
}

// AVOID: Inline bounds
fn process<T: Serialize + Debug + Send>(item: T) -> Result<Output, Error> {
    // ...
}
```

**Prefer `impl Trait` when you don't need to name the type.** It's cleaner and often enables better compiler optimizations.

```rust
// GOOD: impl Trait (when caller doesn't need to name the type)
fn get_processor() -> impl Processor { ... }
fn load_items(path: &Path) -> impl Iterator<Item = Item> { ... }

// Use generics when caller needs to specify the type
fn process<T>(item: T)
where
    T: Processor,
{ ... }

// Use where clause for complex bounds
fn transform<I, O>(input: I) -> O
where
    I: IntoIterator<Item = RawData>,
    O: FromIterator<ProcessedData>,
{
    // ...
}
```

</generics_syntax>

<derives>

**Derive `Debug` on almost all types.** This makes debugging, logging, and test failures much easier.

```rust
// GOOD: Debug on everything
#[derive(Debug)]
pub struct User {
    id: u64,
    name: String,
}

#[derive(Debug)]
pub enum Status {
    Active,
    Inactive,
    Pending { reason: String },
}

// Common derive combinations:
#[derive(Debug, Clone, PartialEq)]              // Value types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]    // Small value types
#[derive(Debug, Default)]                        // Types with sensible defaults
#[derive(Debug, Error)]                          // Error types (with thiserror)
#[derive(Debug, Serialize, Deserialize)]         // Data transfer types
#[derive(Debug, Parser)]                         // CLI args (with clap)
```

Only skip `Debug` when:
- The type contains sensitive data (passwords, keys) that shouldn't appear in logs
- The type wraps something that doesn't implement `Debug` (rare with modern crates)

</derives>

---

## Testing

<table_based_tests>

**Use table-based tests with `test-case` instead of many individual test functions.** This reduces duplication and makes it easy to add new cases.

```rust
use test_case::test_case;

// GOOD: Table-based tests
#[test_case("hello", "HELLO" ; "lowercase to upper")]
#[test_case("WORLD", "WORLD" ; "already upper")]
#[test_case("", "" ; "empty string")]
#[test_case("123", "123" ; "numbers unchanged")]
fn test_to_uppercase(input: &str, expected: &str) {
    assert_eq!(to_uppercase(input), expected);
}

// AVOID: Repetitive individual tests
#[test]
fn test_to_uppercase_lowercase() {
    assert_eq!(to_uppercase("hello"), "HELLO");
}

#[test]
fn test_to_uppercase_already_upper() {
    assert_eq!(to_uppercase("WORLD"), "WORLD");
}

#[test]
fn test_to_uppercase_empty() {
    assert_eq!(to_uppercase(""), "");
}
// ... and so on
```

**For complex inputs, use variables or helper functions:**

```rust
#[test_case(Point { x: 0, y: 0 }, Point { x: 1, y: 1 }, 1.414 ; "unit diagonal")]
#[test_case(Point { x: 0, y: 0 }, Point { x: 3, y: 4 }, 5.0 ; "3-4-5 triangle")]
fn test_distance(a: Point, b: Point, expected: f64) {
    let result = a.distance_to(&b);
    assert!((result - expected).abs() < 0.001);
}
```

**Extract shared test setup into helper functions:**

```rust
fn make_test_config() -> Config {
    Config {
        timeout: Duration::from_secs(5),
        retries: 3,
        ..Default::default()
    }
}

fn make_test_client() -> Client {
    Client::new(make_test_config())
}

#[test_case("valid_endpoint", 200 ; "success")]
#[test_case("not_found", 404 ; "missing resource")]
#[test_case("server_error", 500 ; "server failure")]
fn test_request_status(endpoint: &str, expected_status: u16) {
    let client = make_test_client();
    let response = client.get(endpoint).unwrap();
    assert_eq!(response.status(), expected_status);
}
```

</table_based_tests>

---

## Logging with tracing

<log_levels>

| Level | Use for | Example |
|-------|---------|---------|
| `trace` | Low-level execution flow | `entering function`, `loop iteration 5` |
| `debug` | Development-useful events | `loaded plugin "auth"`, `cache miss for key X` |
| `info` | Top-level milestones | `server listening on :8080`, `processed 1000 items` |
| `warn` | Handled but notable problems | `retrying after timeout`, `deprecated config option` |
| `error` | Unrecoverable failures (max context) | `database connection failed: {err}` |

</log_levels>

<structured_logging>

Use structured fields, not string interpolation:

```rust
// GOOD: Queryable structured data
tracing::info!(user_id = %user.id, action = "login", "user authenticated");

// AVOID: Unstructured, hard to query
tracing::info!("user {} logged in", user.id);
```

Use `#[tracing::instrument]` on functions, but customize to avoid dumping sensitive or verbose data:

```rust
#[tracing::instrument(skip(password, db_conn), fields(user_id = %user.id))]
async fn authenticate(user: &User, password: &str, db_conn: &Pool) -> Result<Token> {
    // ...
}
```

</structured_logging>

---

## Error Handling

**Always use `thiserror` for error types.** Errors must be enums that work with `match`.

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("database query failed: {0}")]
    Database(#[from] sqlx::Error),

    #[error("user {user_id} not found")]
    UserNotFound { user_id: i64 },

    #[error("invalid input: {reason}")]
    InvalidInput { reason: String },
}
```

**Avoid `anyhow` in application code.** If you need to handle errors differently based on type, you need enums.

---

## Unsafe Code

**Avoid `unsafe` when possible.** But when it's necessary, document it thoroughly.

<unsafe_block_rules>

When calling unsafe code, write a `// SAFETY:` comment that:
1. States the requirements of the unsafe operation (check the docs for the function/method you're calling)
2. Explains how you meet each requirement

```rust
let ptr = slice.as_ptr();
let len = slice.len();

// SAFETY:
// - `ptr` is valid for reads of `len` bytes because it comes from a valid slice
// - `ptr` is properly aligned because it comes from a valid slice of T
// - The memory is initialized because it comes from a valid slice
// - The total size is <= isize::MAX because Rust slices enforce this
let raw_slice = unsafe { std::slice::from_raw_parts(ptr, len) };
```

</unsafe_block_rules>

<unsafe_function_rules>

When writing an `unsafe fn`, document what the caller must guarantee in the function's doc comment:

```rust
/// Converts a raw pointer and length to a slice.
///
/// # Safety
///
/// The caller must guarantee:
/// - `ptr` is valid for reads of `len * size_of::<T>()` bytes
/// - `ptr` is properly aligned for type `T`
/// - The memory region is initialized with valid `T` values
/// - The memory is not mutated during the lifetime `'a`
/// - The total size `len * size_of::<T>()` is <= `isize::MAX`
pub unsafe fn ptr_to_slice<'a, T>(ptr: *const T, len: usize) -> &'a [T] {
    std::slice::from_raw_parts(ptr, len)
}
```

</unsafe_function_rules>

---

## Configuration Strategies

Choose the simplest strategy that works:

1. **No configuration** — if there's nothing to configure, don't add machinery
2. **Environment variables** — for ≤5 options with sensible defaults (LOG_LEVEL, DATABASE_URL)
3. **Clap CLI flags** — for terminal programs with branching/subcommands
4. **TOML config file** — for complex configuration that doesn't fit above

---

## Project Setup

<cargo_toml_profiles>

```toml
[profile.release]
lto = "fat"
codegen-units = 1

[profile.distribute]
inherits = "release"
strip = "symbols"

# For WASM targets:
# [profile.distribute]
# inherits = "release"
# strip = "symbols"
# opt-level = "z"
```

</cargo_toml_profiles>

<build_rs>

Create a `build.rs` for executables that:
1. Injects git commit/tag as a compile-time constant
2. Enables `#[cfg(distribute)]` when using the distribute profile

```rust
use std::process::Command;

fn main() {
    // Inject git version info
    let output = Command::new("git")
        .args(["describe", "--tags", "--always", "--dirty"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=GIT_VERSION={}", output);

    // Enable cfg(distribute) for distribute profile
    if std::env::var("PROFILE").unwrap() == "distribute" {
        println!("cargo:rustc-cfg=distribute");
    }

    // Rerun if git HEAD changes
    println!("cargo:rerun-if-changed=.git/HEAD");
}
```

Usage in code:

```rust
const VERSION: &str = env!("GIT_VERSION");

#[cfg(distribute)]
fn setup_logging() {
    // Production: JSON logs, no ANSI colors
}

#[cfg(not(distribute))]
fn setup_logging() {
    // Development: pretty logs with colors
}
```

</build_rs>

<bootstrapping>

**Tracing initialization (use in all executables):**

```rust
fn init_tracing() {
    use tracing_subscriber::{fmt, EnvFilter};

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    #[cfg(distribute)]
    {
        // Production: JSON logs, no ANSI
        fmt()
            .json()
            .with_env_filter(filter)
            .init();
    }

    #[cfg(not(distribute))]
    {
        // Development: pretty logs with colors
        fmt()
            .pretty()
            .with_env_filter(filter)
            .init();
    }
}
```

**Async main (when using tokio):**

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();
    tracing::info!("starting up");

    // your code here

    Ok(())
}
```

**Sync main with error handling:**

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();
    tracing::info!("starting up");

    // your code here

    Ok(())
}
```

**CLI with clap:**

```rust
use std::path::PathBuf;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(name = env!("CARGO_PKG_NAME"))]
#[command(version = env!("GIT_VERSION"))]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
struct Args {
    /// Input file to process
    #[arg(short, long)]
    input: Option<PathBuf>,

    /// Enable verbose output
    #[arg(short, long, default_value_t = false)]
    verbose: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let filter = if args.verbose { "debug" } else { "info" };
    // ... init tracing with filter

    Ok(())
}
```

**Simple configuration pattern (when needed):**

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: Option<String>,
}

fn default_port() -> u16 { 8080 }

impl Config {
    pub fn from_env() -> Result<Self, envy::Error> {
        envy::from_env()
    }
}
```

When using env-based config, add `envy = "0.4"` to dependencies.

</bootstrapping>

<dev_dependencies>

Always include:
```toml
[dev-dependencies]
test-case = "3"  # For table-driven tests
```

</dev_dependencies>

<workspaces>

**When to use workspaces:** For larger projects that benefit from splitting into multiple crates (shared libraries, separation of concerns, faster incremental builds).

**Structure:**
```
project-root/
├── Cargo.toml          # Workspace root
├── CLAUDE.md           # Project overview (lean, ~50-80 lines)
├── README.md
├── rust-toolchain.toml
├── .rustfmt.toml
├── .gitlab-ci.yml
├── .claude/
│   └── rust-style.md   # Full style guide
└── crates/
    ├── <project>-bin/  # Binary crate (application entry point)
    │   ├── Cargo.toml
    │   ├── build.rs
    │   └── src/
    │       └── main.rs
    ├── <project>-core/  # Core library (optional)
    │   ├── Cargo.toml
    │   └── src/
    │       └── lib.rs
    └── <project>-*/     # Additional crates as needed
```

**Dependency organization:**

| Dependency | Where | Why |
|------------|-------|-----|
| `thiserror` | workspace | Any crate may define errors |
| `tracing` | workspace | Any crate may emit logs |
| `serde` | workspace | Data types often in library crates |
| `test-case` | workspace | Shared test framework |
| Core framework (bevy, axum, yew) | workspace | Whole project built around it |
| Async ecosystem (tokio, futures) | workspace | Shared across async crates |
| `tracing-subscriber` | binary only | Only binary initializes logging |
| `clap` | binary only | Only binary parses CLI |
| Config crates | binary only | Only binary reads config |

**Root Cargo.toml:**
```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
version = "0.1.0"
edition = "2024"
authors = ["Joey"]

[workspace.dependencies]
# Shared across crates
thiserror = "1"
tracing = "0.1"
test-case = "3"

# Core framework (example: Bevy game)
bevy = "0.15"

[workspace.dependencies.serde]
version = "1"
features = ["derive"]

[profile.release]
lto = "fat"
codegen-units = 1

[profile.distribute]
inherits = "release"
strip = "symbols"
```

**Binary crate Cargo.toml:**
```toml
[package]
name = "<project>-bin"
version.workspace = true
edition.workspace = true
authors.workspace = true

[dependencies]
thiserror.workspace = true
tracing.workspace = true
serde.workspace = true
bevy.workspace = true
<project>-core = { path = "../<project>-core" }

# Binary-only dependencies
[dependencies.tracing-subscriber]
version = "0.3"
features = ["env-filter", "json"]

[dependencies.clap]
version = "4"
features = ["derive"]

[dev-dependencies]
test-case.workspace = true
```

**Library crate Cargo.toml:**
```toml
[package]
name = "<project>-core"
version.workspace = true
edition.workspace = true
authors.workspace = true

[dependencies]
thiserror.workspace = true
tracing.workspace = true
serde.workspace = true
bevy.workspace = true
# No tracing-subscriber, no clap

[dev-dependencies]
test-case.workspace = true
```

</workspaces>

<git_setup>

Initialize with:
```bash
git init
git branch -m main  # Ensure main branch, not master
```

</git_setup>

<rust_toolchain_toml>

```toml
[toolchain]
channel = "nightly"
```

</rust_toolchain_toml>

<rustfmt_toml>

```toml
edition = "2024"
max_width = 100
tab_spaces = 4
```

</rustfmt_toml>

<tarpaulin_toml>

```toml
[default]
timeout = "120s"
out = ["Xml"]
run-types = ["Tests"]
follow-exec = true
count = true
all-features = true
ignore-tests = false
verbose = true
```

</tarpaulin_toml>

---

## CI Pipeline (.gitlab-ci.yml)

The CI pipeline should run on every MR and main branch push:
- `lint` — rustfmt check + clippy with `-D warnings -A dead_code -A unused`
- `test` — full test suite with `--all-features`
- `coverage` — tarpaulin with Cobertura output
- `build:debug` — validation build

Use `rustlang/rust:nightly-slim` image. Cache `.cargo/` and `target/` keyed on `Cargo.lock`.

```yaml
stages:
  - validate

variables:
  CARGO_HOME: "${CI_PROJECT_DIR}/.cargo"

cache:
  key:
    files:
      - Cargo.lock
  paths:
    - .cargo/
    - target/

lint:
  stage: validate
  image: rustlang/rust:nightly-slim
  script:
    - rustup component add rustfmt clippy
    - cargo fmt --all --check
    - cargo clippy --all-targets --all-features -- -D warnings -A dead_code -A unused

test:
  stage: validate
  image: rustlang/rust:nightly-slim
  script:
    - cargo test --all-features

coverage:
  stage: validate
  image: rustlang/rust:nightly-slim
  script:
    - cargo install cargo-tarpaulin
    - cargo tarpaulin --out Xml
  coverage: '/^\d+.\d+% coverage/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: cobertura.xml

build:debug:
  stage: validate
  image: rustlang/rust:nightly-slim
  script:
    - cargo build --all-features
```

---

## Examples

<example name="adding_a_new_dependency">

When you need JSON parsing:

```toml
# In Cargo.toml
serde_json = "1"
```

When you need JSON with custom serialization:

```toml
[dependencies.serde]
version = "1"
features = ["derive"]

serde_json = "1"
```

</example>

<example name="creating_an_async_service">

```rust
use thiserror::Error;
use tracing::{info, instrument};

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("connection failed: {0}")]
    Connection(#[from] std::io::Error),
}

pub struct MyService {
    // fields
}

impl MyService {
    #[instrument(skip(self))]
    pub async fn run(&self) -> Result<(), ServiceError> {
        info!("service starting");
        // implementation
        Ok(())
    }
}
```

</example>

<example name="returning_iterators">

```rust
// Return impl Iterator instead of collecting
pub fn active_users(users: &[User]) -> impl Iterator<Item = &User> {
    users.iter().filter(|u| u.is_active)
}

// Chain iterator adapters instead of intermediate collections
// Note: explicit lifetime needed here because impl Trait + 'a binds the iterator's lifetime to the input
pub fn process_pipeline<'a>(items: &'a [Item]) -> impl Iterator<Item = Output> + 'a {
    items
        .iter()
        .filter(|i| i.is_valid())
        .map(|i| i.transform())
        .filter_map(|i| i.try_finalize())
}
```

</example>

<example name="choosing_between_reference_and_owned">

```rust
// Use references when caller retains ownership
fn analyze(data: &[u8]) -> Analysis { ... }

// Use owned types when function needs ownership
fn consume(data: Vec<u8>) -> Result { ... }

// Use Cow when you sometimes need to modify
fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains('\t') {
        Cow::Owned(input.replace('\t', "    "))
    } else {
        Cow::Borrowed(input)
    }
}
```

</example>

---

## Trade-offs Reminder

Every rule here can be broken when the situation demands it. The goal is principled decisions, not rigid compliance. When you deviate, know why.
