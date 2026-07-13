# Python Development Guidelines

## Type Hints

- Every function and method must have type hints on all parameters and the return type.
  Type hints are not optional — they are the primary documentation for what a function
  accepts and returns, and they enable static analysis.
- Use `from __future__ import annotations` at the top of every module. This enables
  postponed evaluation of annotations, allowing forward references without quotes and
  improving runtime performance since annotations are not evaluated eagerly.
- Use `X | Y` union syntax (Python 3.10+) instead of `Optional[X]` or `Union[X, Y]`.
  `str | None` is cleaner than `Optional[str]`.
- Use `list[str]`, `dict[str, int]`, `tuple[int, ...]` (lowercase built-in generics,
  Python 3.9+) instead of `List[str]`, `Dict[str, int]` from `typing`.
- For complex return types, define a TypedDict or dataclass rather than returning
  untyped `dict`. Callers should not have to guess what keys exist.

## Data Structures

- Use `@dataclass` for plain data containers: grouped fields, no behavior.
  Add `frozen=True` for immutable value objects.
- Use Pydantic `BaseModel` for data that crosses a boundary: API inputs, config files,
  database rows. Pydantic validates at runtime, not just at the type-checker level.
- Do not return or pass around plain `dict` when the shape is known and stable. Define
  the structure.
- Use `NamedTuple` for small, simple value objects where you also want tuple unpacking.

## File System

- Use `pathlib.Path` for all file and directory operations. Never use `os.path.join`,
  `os.path.exists`, `os.getcwd`, or string concatenation for paths.
- `Path` objects compose with `/`: `base_dir / 'subdir' / 'file.txt'`. This is readable
  and cross-platform.
- Use `Path.read_text()` and `Path.write_text()` for simple file reads and writes rather
  than open/read/close sequences.

## Logging

- Use the `logging` module. Never use `print` for diagnostic output in library or
  application code.
- Configure logging once at the application entry point, not in library modules. Library
  modules should only call `logging.getLogger(__name__)` and use it.
- Use structured log messages: `logger.info("User logged in", extra={"user_id": user.id})`
  rather than f-string interpolation in the message. This makes log parsing and
  aggregation reliable.
- Log at the appropriate level: DEBUG for development diagnostics, INFO for normal
  operational events, WARNING for recoverable anomalies, ERROR for failures that need
  attention.

## Error Handling

- Catch specific exceptions, not bare `except` or `except Exception`. Bare except catches
  `SystemExit` and `KeyboardInterrupt` — it breaks Ctrl-C.
- Raise specific, meaningful exceptions. Define custom exception classes that inherit
  from appropriate base classes when the call site needs to distinguish error types.
- Use `contextlib.suppress(ExceptionType)` when you genuinely want to ignore a specific
  exception. It is more explicit than a bare `try/except: pass`.
- Re-raise with `raise ... from err` to preserve the original traceback when wrapping
  exceptions.
- Do not use exceptions for control flow. Return `None` or a result type instead.

## Context Managers

- Use context managers (`with` statements) for any resource that needs cleanup: files,
  database connections, network sockets, locks.
- Use `contextlib.contextmanager` to write simple context managers as generators without
  defining a full class.
- Prefer `contextlib.ExitStack` when you need to manage a variable number of context
  managers dynamically.

## Code Style

- Use f-strings for string interpolation. Do not use `%` formatting or `.format()` in
  new code.
- Use list, dict, and set comprehensions where they improve clarity. Do not use them for
  side effects — that is what `for` loops are for.
- Use the walrus operator (`:=`) when it genuinely improves clarity by eliminating a
  re-computation or making a while-loop condition readable. Do not use it just because it
  exists.
- `enumerate()` over range/index combinations, `zip()` over parallel index access.
  These are clearer and less error-prone.

## Packaging and Tooling

- Use `pyproject.toml` for all project configuration: package metadata, dependencies,
  tool config (ruff, mypy, pytest). Do not use `setup.py` or `setup.cfg` in new projects.
- Use `ruff` for both linting and formatting. It replaces `flake8`, `isort`, and `black`
  with one fast tool. Configure it in `pyproject.toml` under `[tool.ruff]`.
- Run `mypy` with `strict = true` in CI. Type errors are bugs waiting to happen.
- Use virtual environments. Do not install project dependencies into the system Python.
  Document the environment setup in the README.
- Pin direct dependencies with minimum versions in `pyproject.toml`. Pin transitive
  dependencies in a lockfile (`uv.lock` or `requirements.lock`) for reproducible builds.
