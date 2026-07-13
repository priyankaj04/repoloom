# Python Testing Guidelines (pytest)

## pytest Over unittest

- Use pytest for all new test code. unittest is verbose and its assertion introspection
  is inferior. pytest's plain `assert` statements produce detailed failure output
  without custom message boilerplate.
- Do not subclass `unittest.TestCase` unless you are testing code that specifically
  requires it (e.g., Django views via `TestCase` transaction rollback). For everything
  else, use module-level functions.

## Fixtures and Scope

- Define fixtures with the narrowest scope that satisfies the test. Default to
  `scope="function"` — it is the safest choice and avoids state leakage between tests.
- Use `scope="module"` for expensive setup that is genuinely stateless across tests in
  a file (e.g., loading a large ML model). Use `scope="session"` only for setup that
  is immutable for the entire test run (e.g., a read-only database populated once).
- A fixture with side effects (writes to DB, starts a process) must include teardown via
  `yield`. Do not rely on `autouse` fixtures to clean up what other fixtures create.
- Keep fixtures focused. A fixture that does five things should be five fixtures with a
  clear dependency graph.

## conftest.py

- Place shared fixtures in `conftest.py` at the appropriate directory level. pytest
  discovers `conftest.py` automatically — no import needed.
- Top-level `conftest.py` is for truly global fixtures (app config, DB connection). 
  Feature-level `conftest.py` files keep related setup co-located with the tests.
- Do not import from `conftest.py` directly. If something needs to be imported, it belongs
  in a proper module, not conftest.

## Parametrize

- Use `@pytest.mark.parametrize` for data-driven tests. It produces one named subtest
  per case and gives much better failure output than looping inside a test function.
- Include an `id` for each parameter set when the default repr is not descriptive:
  `pytest.param(input, expected, id="empty-string-returns-none")`.
- Extract parametrize data to a module-level constant when the list is long. Inline
  parametrize arguments are hard to read beyond 4-5 cases.

## Mocking

- Use `monkeypatch` for patching in pytest. Prefer it over `unittest.mock.patch` because
  it is scoped to the test automatically — no context manager or decorator required.
- Use `unittest.mock.MagicMock` and `unittest.mock.AsyncMock` for creating mock objects.
  Import them directly; do not use the `mocker` fixture from `pytest-mock` unless the
  project already depends on it.
- Patch at the point of use, not at the point of definition. Patch `mymodule.requests.get`,
  not `requests.get`, when `mymodule` imports `requests`.
- Do not mock what you own. Mock external services, not your own code — that is a test
  smell indicating tight coupling.

## File System Tests

- Use the `tmp_path` fixture for any test that reads or writes files. It provides a
  unique temporary directory per test, cleaned up automatically.
- Never write to the project directory or a hardcoded `/tmp` path in tests.

## Complex Object Construction

- Use factory libraries (factory_boy, polyfactory) rather than fixtures for constructing
  complex model instances. Factories allow per-test customization without combinatorial
  fixture explosion.
- Define a `ModelFactory` once; call `ModelFactory.build()` for in-memory objects and
  `ModelFactory.create()` for persisted ones.

## Time-Dependent Tests

- Freeze time with `freezegun` or `time-machine`. Never call `datetime.now()` in test
  setup and hope the assertion happens within the same second.
- Prefer `@freeze_time("2024-01-15")` decorator for tests where time is constant.
  Use the context manager form for tests that need to advance time mid-test.

## Async Tests

- Use `pytest-anyio` (or `pytest-asyncio`) to test async code. Mark async test functions
  with `@pytest.mark.anyio`.
- Do not spin up a real event loop manually in tests. Let the plugin manage it.
- Keep async fixtures `async def` and decorate them normally — pytest-anyio handles the rest.

## Coverage

- Run coverage via `pytest-cov`: `pytest --cov=src --cov-report=term-missing`.
- Set a minimum coverage threshold in `pyproject.toml` under `[tool.coverage.report]`.
  Fail the CI build if coverage drops below it.
- Coverage is a signal, not a goal. 100% line coverage with weak assertions is worse than
  80% with meaningful ones.

## CI Practices

- Use `-x` (fail fast) in CI pipelines. Seeing all failures at once encourages test
  interdependency; stopping at the first failure surfaces root causes faster.
- Mark slow integration tests with `@pytest.mark.slow` and run them in a separate CI
  stage: `pytest -m "not slow"` for the fast suite, `pytest -m slow` for the full suite.
- Run tests with `-n auto` (pytest-xdist) to parallelize across CPU cores in CI.
