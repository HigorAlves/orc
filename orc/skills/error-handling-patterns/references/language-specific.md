# Language-Specific Error Handling

Idioms and full type definitions per language. Cross-cutting patterns (Result types,
propagation, retries) live in their own reference files; this file captures the
language-native scaffolding they build on.

## Python

- Define a base `ApplicationError` and subclass per failure category — see
  `references/exceptions.md` for the full hierarchy.
- Use `@contextmanager` / `with` for guaranteed cleanup.
- Use `raise ... from e` to preserve the original cause chain.

## TypeScript / JavaScript

- Subclass `Error`, set `this.name = this.constructor.name`, and call
  `Error.captureStackTrace` for clean stacks — see `references/exceptions.md`.
- Model expected failures with a `Result<T, E>` union — see `references/result-types.md`.
- Mind unhandled promise rejections; `await` inside `try`/`catch` or attach `.catch`.

## Rust

Custom error enum with `From` conversions powers the `?` operator's auto-conversion:

```rust
use std::io;

// Custom error types
#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(std::num::ParseIntError),
    NotFound(String),
    Validation(String),
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}
```

`Result<T, E>` and `Option<T>` are the core primitives — see `references/result-types.md`
for usage and `references/propagation.md` for the `?` operator.

## Go

Explicit `error` return values, sentinel errors, custom error structs, and `%w`
wrapping.

```go
// Basic error handling
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    }
    if user == nil {
        return nil, errors.New("user not found")
    }
    return user, nil
}

// Custom error types
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed for %s: %s", e.Field, e.Message)
}

// Sentinel errors for comparison
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrInvalidInput = errors.New("invalid input")
)
```

See `references/propagation.md` for `errors.Is` / `errors.As` and wrapping examples.
