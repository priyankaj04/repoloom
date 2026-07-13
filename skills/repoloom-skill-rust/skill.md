# Rust Skill Instructions

You are working in a Rust project. Apply idiomatic Rust patterns consistently.

## Ownership and Borrowing — Prefer References Over Cloning

Cloning is a code smell when a reference suffices. Default to borrowing:

```rust
// Bad: unnecessary clone
fn print_name(name: String) {
    println!("{}", name);
}
let n = String::from("Alice");
print_name(n.clone()); // n still needed later

// Good: borrow
fn print_name(name: &str) {
    println!("{}", name);
}
print_name(&n);
```

Accept `&str` instead of `&String`, `&[T]` instead of `&Vec<T>`, and `&Path` instead of
`&PathBuf` in function signatures — these are strictly more general.

Only clone when you genuinely need owned data that outlives the borrow scope.

## Error Handling — Result and Option, Never Panic in Production

Use `Result<T, E>` for recoverable errors and `Option<T>` for optional values.
Use the `?` operator to propagate errors up the call stack cleanly:

```rust
fn read_config(path: &Path) -> Result<Config, AppError> {
    let contents = fs::read_to_string(path)?;
    let config: Config = toml::from_str(&contents)?;
    Ok(config)
}
```

**Library crates**: use `thiserror` to define typed error enums with clear messages:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("record not found: {id}")]
    NotFound { id: u64 },
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}
```

**Application binaries**: use `anyhow` for ergonomic error propagation with context:

```rust
use anyhow::{Context, Result};

fn run() -> Result<()> {
    let config = read_config(path).context("failed to load config")?;
    Ok(())
}
```

Never mix the two in the same layer — `thiserror` for public API surfaces, `anyhow` for
top-level application glue.

## Avoid unwrap() in Production Code

`unwrap()` panics on `None` or `Err` — treat it as a production bug waiting to happen.

```rust
// Bad
let val = map.get("key").unwrap();

// Good — with context
let val = map.get("key").expect("key must always be present after init");

// Better — propagate properly
let val = map.get("key").ok_or(AppError::MissingKey)?;
```

`expect()` with a message is acceptable when the invariant is genuinely guaranteed and you
want to document the assumption. Use `?` everywhere else.

## Derive Macros

Always derive standard traits where they are semantically correct:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct UserId(u64);
```

- `Debug` on every type (required for `?` in tests, logging, error context)
- `Clone` only if the type genuinely needs to be copied
- `PartialEq` + `Eq` for value types used in assertions or collections
- `Hash` when used as `HashMap` keys

Do not derive `Copy` for types that represent resources or have non-trivial cost to copy.

## Traits — Implement, Don't Duplicate

Implement standard traits to integrate with Rust's ecosystem:

- `Display` for user-facing formatting
- `From`/`Into` for infallible conversions
- `Iterator` for custom sequences — the entire iterator adapter chain becomes available
- `Deref` for smart pointer types (only — do not abuse for convenience)

Write trait bounds at the function level, not on the struct, unless the struct itself
requires the bound to be sound:

```rust
// Prefer this
fn process<T: Serialize>(item: T) -> Result<Vec<u8>, Error> { ... }

// Over this (unless the struct needs it)
struct Processor<T: Serialize> { item: T }
```

## Iterators Over Explicit Loops

Iterators are zero-cost abstractions and express intent more clearly:

```rust
// Instead of
let mut total = 0;
for item in &orders {
    if item.active {
        total += item.amount;
    }
}

// Use
let total: u64 = orders.iter()
    .filter(|o| o.active)
    .map(|o| o.amount)
    .sum();
```

Use `collect()` with a type annotation to materialize. Use `fold()` for aggregations that
don't map cleanly to `sum`/`product`/`count`.

## Lifetimes — Only When the Compiler Requires Them

Do not add lifetime annotations speculatively. Wait for a compile error, then add the
minimum annotation needed:

```rust
// Lifetime needed: return borrows from input
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() > b.len() { a } else { b }
}
```

If lifetime annotations are making a design hard to express, consider returning owned types
instead of references — the ergonomic cost of cloning is often worth it.

## Shared State — Arc<Mutex<T>>

For shared mutable state across threads:

```rust
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct AppState {
    cache: Arc<Mutex<HashMap<String, Value>>>,
}
```

Use `RwLock<T>` when reads vastly outnumber writes. Prefer message-passing via channels
(`std::sync::mpsc` or `tokio::sync::mpsc`) over shared state when the design allows it.

Lock as briefly as possible — never hold a lock across `.await`.

## Cargo Clippy Must Pass

Run `cargo clippy -- -D warnings` before every commit. Zero warnings tolerance.
Clippy catches real bugs and anti-patterns — do not `#[allow(...)]` without a comment
explaining the suppression.

## Doc Comments With Examples

Public API items must have doc comments with a working example:

```rust
/// Parses a user ID from a string.
///
/// # Examples
/// ```
/// let id = UserId::parse("42").unwrap();
/// assert_eq!(id.value(), 42);
/// ```
/// # Errors
/// Returns `ParseError::InvalidFormat` if the string is not a valid integer.
pub fn parse(s: &str) -> Result<UserId, ParseError> { ... }
```

Run `cargo test --doc` to verify examples compile and pass.
