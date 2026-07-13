# Go Testing Guidelines

## Table-Driven Tests

- Default to table-driven tests for any function with more than one meaningful input.
  They make the test cases self-documenting and make adding cases trivial.
- Use `t.Run(tc.name, func(t *testing.T) { ... })` for each case. This gives each
  sub-test an independent pass/fail status, allows targeting with `-run`, and enables
  parallel execution per case.
- Define the test table as a slice of anonymous structs at the top of the test function.
  Keep field names short: `name`, `input`, `want`, `wantErr`.
- When a table case expects an error, check `wantErr bool` and use
  `errors.Is(err, tc.wantErr)` for sentinel errors — not string matching.

## File and Package Conventions

- Test files use the `_test.go` suffix. The Go toolchain excludes them from production
  builds automatically — no build tag required.
- For white-box tests (testing unexported identifiers), use the same package name as
  the code under test: `package mypackage`.
- For black-box tests (testing public API only), use the `_test` suffix on the package
  name: `package mypackage_test`. Prefer this for packages that expose a public API —
  it prevents tests from depending on internal implementation details.
- A single package can have both `package foo` and `package foo_test` files. Use both
  where appropriate.

## Assertions with testify

- Use `github.com/stretchr/testify/assert` and `testify/require` over manual
  `if got != want { t.Errorf(...) }`. testify produces readable failure output including
  diffs for structs.
- Use `require` (not `assert`) when a failure should stop the test immediately — for
  example, when a nil check failure would cause a panic on the next line.
- Use `assert.Equal(t, want, got)` — `want` first, then `got`. This matches the standard
  Go convention and produces correct "expected X, got Y" output.
- Do not write custom error message strings like `t.Errorf("got %v, want %v", got, want)`.
  testify does this better automatically.

## HTTP Handler Tests

- Use `net/http/httptest` for testing HTTP handlers without starting a real server.
  `httptest.NewRecorder()` captures the response; `httptest.NewServer()` starts a real
  local server for integration-style tests.
- Test handlers at the handler level (call the handler function directly) for unit tests.
  Test the full router for integration tests using `httptest.NewServer`.
- Assert on response status code, headers, and body. Do not only assert that no error
  was returned.

## Reader/Writer Tests

- Use `testing/iotest` for testing `io.Reader` implementations. `iotest.NewReadLogger`
  and `iotest.OneByteReader` surface edge cases that real readers encounter.
- Test that your readers/writers handle empty input, partial reads, and `io.EOF` correctly.

## Goroutine Leak Detection

- Use `go.uber.org/goleak` to detect goroutine leaks in tests. Add
  `defer goleak.VerifyNone(t)` at the top of tests (or in `TestMain`) for any code
  that spawns goroutines.
- A leaking goroutine is a production bug, not just a test hygiene issue. goleak surfaces
  it at test time when it is cheapest to fix.

## Benchmarks

- Write benchmarks as `func BenchmarkX(b *testing.B)` in `_test.go` files.
- Call `b.ResetTimer()` after any setup that should not be included in the measurement.
- Call `b.StopTimer()` / `b.StartTimer()` to exclude teardown operations from measurement.
- Run benchmarks with `go test -bench=. -benchmem` to include allocation counts.
  Allocation count is often a better signal than raw throughput.
- Prevent compiler optimization from eliminating benchmark results by assigning the
  return value to a package-level `var sink interface{}`.

## Fuzz Testing

- Add fuzz targets for any function that parses external input: `func FuzzX(f *testing.F)`.
- Seed the corpus with known interesting inputs using `f.Add(...)`.
- Run with `go test -fuzz=FuzzX -fuzztime=60s` in CI nightly or pre-release. Commit any
  crash inputs discovered to the testdata corpus.

## Race Detection

- Always run `go test -race` in CI. Race conditions are frequently invisible in normal
  test runs and catastrophic in production.
- Never suppress a race warning with synchronization that only affects tests. Fix the
  underlying concurrency bug in the production code.

## Integration Tests with Real Databases

- Use `testcontainers-go` to spin up real database instances for integration tests. This
  is more reliable than in-memory fakes that diverge from production behavior.
- Start the container once per `TestMain` or per test suite using a shared instance with
  proper cleanup via `defer container.Terminate(ctx)`.
- Tag integration tests with `//go:build integration` and run them separately:
  `go test -tags integration ./...`.
