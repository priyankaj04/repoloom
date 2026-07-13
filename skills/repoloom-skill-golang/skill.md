# Go Skill Instructions

You are working in a Go project. Apply idiomatic Go patterns consistently.

## Errors Are Values — Handle Them Explicitly

Never ignore errors. Every `err` return must be handled.
Wrap errors with context using `fmt.Errorf` and `%w` so callers can inspect the chain:

```go
func fetchUser(id int) (*User, error) {
    u, err := db.QueryRow(id)
    if err != nil {
        return nil, fmt.Errorf("fetchUser %d: %w", id, err)
    }
    return u, nil
}
```

Check error identity with `errors.Is` and extract typed errors with `errors.As`:

```go
if errors.Is(err, sql.ErrNoRows) {
    return nil, ErrNotFound
}

var valErr *ValidationError
if errors.As(err, &valErr) {
    // handle validation failure
}
```

Do not use `panic` for expected error conditions. Reserve panic for truly unrecoverable
programmer errors (e.g., impossible state in init).

## Interfaces — Small and Focused

Interfaces should describe behavior, not objects. Aim for 1-2 methods:

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type UserStore interface {
    GetUser(ctx context.Context, id int) (*User, error)
    SaveUser(ctx context.Context, u *User) error
}
```

Define interfaces at the point of use (consumer side), not at the point of declaration.
This keeps packages decoupled and prevents interface pollution.

**Accept interfaces, return concrete types.** Callers get the flexibility; implementations
stay simple.

## Context Propagation

`context.Context` is always the first argument of any function that does I/O, calls an
external service, or may be cancelled:

```go
func (s *Service) ProcessOrder(ctx context.Context, orderID int) error {
    order, err := s.store.GetOrder(ctx, orderID)
    if err != nil {
        return fmt.Errorf("ProcessOrder: %w", err)
    }
    return s.notifier.Notify(ctx, order)
}
```

Never store Context in a struct. Never pass nil — use `context.Background()` at the
top of a call chain (e.g., main, test setup) and `context.TODO()` as a temporary placeholder.

## Concurrency — Channels and Goroutines

Prefer communicating via channels over sharing memory with mutexes where the design allows it.
Always document goroutine ownership: who creates it, who waits for it, who can cancel it.

Use `errgroup` for fan-out with error collection:

```go
import "golang.org/x/sync/errgroup"

g, ctx := errgroup.WithContext(ctx)
for _, item := range items {
    item := item // capture loop variable
    g.Go(func() error {
        return process(ctx, item)
    })
}
if err := g.Wait(); err != nil {
    return fmt.Errorf("processing batch: %w", err)
}
```

Never start a goroutine without knowing how it will stop. Goroutine leaks are production bugs.
Use `sync.WaitGroup` when you need to wait without error collection.

## Defer for Cleanup

Use `defer` to pair open/close, lock/unlock, and start/stop operations:

```go
mu.Lock()
defer mu.Unlock()

f, err := os.Open(path)
if err != nil {
    return err
}
defer f.Close()
```

Defer runs at function return, not block exit — be careful in loops. In loops, extract
into a function or close explicitly.

## Table-Driven Tests

Tests should be declarative and exhaustive. Table-driven tests scale well:

```go
func TestAdd(t *testing.T) {
    cases := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got := Add(tc.a, tc.b)
            if got != tc.expected {
                t.Errorf("Add(%d, %d) = %d, want %d", tc.a, tc.b, got, tc.expected)
            }
        })
    }
}
```

Use `t.Parallel()` in subtests where state is not shared.

## Project Layout

Follow the standard community layout:

```
cmd/            # main packages — one per binary
  myapp/
    main.go
pkg/            # exported packages safe to import by others
internal/       # packages private to this module
  service/
  repository/
```

Keep `main.go` thin — just wiring (config, DI, server start). All logic lives in packages.

## No Global State

Avoid package-level `var` for mutable state. Pass dependencies explicitly:

```go
// Bad
var db *sql.DB

// Good
type Server struct {
    db     *sql.DB
    logger *slog.Logger
}
```

Use `init()` only for registering things that truly cannot be done elsewhere (e.g., codec
registration). Never use `init()` for application configuration.

## Linting

Run `golangci-lint run` before every commit. The minimum enabled linters should include:
`errcheck`, `govet`, `staticcheck`, `gosimple`, `unused`, `revive`.
Fix lint errors — do not suppress them without a documented reason.
