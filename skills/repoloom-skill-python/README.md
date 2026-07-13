# repoloom-skill-python

Claude Code skill for Python. Activates when a project contains `requirements.txt`, `pyproject.toml`, or `setup.py` and guides Claude through type hints, data structure choices, file system APIs, logging, error handling, context managers, and modern packaging.

Covers: `from __future__ import annotations`, `pathlib.Path` over `os.path`, `logging` over print, specific exception catching, `pyproject.toml` with `ruff` and `mypy --strict`, dataclasses vs Pydantic, f-strings, comprehensions, and the walrus operator.

```bash
npx repoloom install python
```
