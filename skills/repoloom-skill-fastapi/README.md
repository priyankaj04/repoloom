# repoloom-skill-fastapi

Claude Code skill for FastAPI. Activates when a project depends on `fastapi` and guides Claude through Pydantic v2 request/response models, dependency injection patterns, async vs sync endpoint decisions, correct HTTP status codes, router organization, the lifespan context manager, and response model output filtering.

Covers: separate request/response models, `Annotated` dependency shortcuts, async I/O safety, `HTTPException` usage, custom exception handlers, `BackgroundTasks` vs task queues, CORS middleware configuration, and generic `Page[T]` pagination.

```bash
npx repoloom install fastapi
```
