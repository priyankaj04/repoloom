# FastAPI Development Guidelines

## Pydantic Models

- Use Pydantic v2 models for all request bodies, response bodies, and query parameter
  schemas. Do not accept or return plain `dict` from endpoints.
- Define separate request and response models. Request models may have fields that the
  response should not expose (passwords, internal IDs). Do not reuse the same model for both.
- Use `model_config = ConfigDict(from_attributes=True)` on response models that are
  populated from ORM instances. This replaces the Pydantic v1 `orm_mode = True`.
- Use `Field(...)` for validation constraints: `Field(min_length=1, max_length=255)`,
  `Field(gt=0)`. Document fields with `description=` — FastAPI surfaces these in the
  OpenAPI schema.
- For optional fields with a default, use `field: str = Field(default='')` not
  `field: Optional[str]`. Be explicit about what the default value actually is.

## Dependency Injection

- Use FastAPI's `Depends()` for all cross-cutting concerns: database sessions, current
  user, permissions, pagination params, rate limiting.
- Database sessions must be managed as dependencies with a `yield`. The session is
  committed or rolled back in the finally block, not in the endpoint.
- Write typed dependency functions, not lambdas. They are easier to test, mock, and
  compose.
- Use `Annotated` to bind dependencies to parameter types at a single declaration point:
  `CurrentUser = Annotated[User, Depends(get_current_user)]`. Import `CurrentUser` across
  all routers rather than repeating `Depends(get_current_user)` everywhere.
- Sub-dependencies are resolved automatically. Declare them as parameters of your
  dependency function — FastAPI handles the resolution order.

## Async Endpoints

- Use `async def` for endpoints that perform I/O: database queries, HTTP calls, file
  reads. This allows FastAPI to handle other requests while waiting.
- Use `def` (synchronous) for endpoints that are CPU-bound. FastAPI runs synchronous
  route handlers in a threadpool automatically — do not wrap synchronous CPU work in
  `asyncio.run_in_executor` manually.
- Never call synchronous blocking I/O (e.g., `requests.get`, synchronous SQLAlchemy)
  inside an `async def` endpoint. This blocks the event loop. Use async equivalents
  (`httpx.AsyncClient`, async SQLAlchemy).

## Status Codes and Errors

- Specify `status_code` explicitly on the route decorator for non-200 responses:
  `@router.post('/items', status_code=201)`.
- Raise `HTTPException` with a specific `status_code` and a human-readable `detail`
  string. Do not return error responses manually.
- Define custom exception classes for domain errors and register exception handlers with
  `app.exception_handler(MyException)`. This keeps error handling out of endpoint logic.
- Use 422 for validation errors (FastAPI handles these automatically via Pydantic). Use
  400 for semantic errors (valid JSON but invalid business logic). Use 404 for missing
  resources. Use 409 for conflicts. Use 403 for forbidden actions.

## Routers and Organization

- Split endpoints into routers using `APIRouter`. One router per resource or feature domain.
- Mount routers on the app with a prefix and tags:
  `app.include_router(users.router, prefix='/users', tags=['Users'])`.
- Tags group endpoints in the OpenAPI docs. Use them consistently — one tag per router.
- Keep endpoint functions thin. Business logic belongs in a service layer or use-case
  functions that the endpoint calls. This makes logic testable without HTTP overhead.

## Lifespan and Startup/Shutdown

- Use the `lifespan` context manager (FastAPI 0.95+) for startup and shutdown logic:
  database connection pools, ML model loading, cache warming.
- Do not use the deprecated `@app.on_event('startup')` and `@app.on_event('shutdown')`
  decorators in new code. The lifespan approach is cleaner and easier to test.
- Resource initialization in lifespan should store references in app state
  (`app.state.db_pool = pool`) so dependencies can access them.

## Background Tasks

- Use `BackgroundTasks` for fire-and-forget work that should happen after the response
  is sent: sending emails, logging events, triggering webhooks.
- Background tasks run in the same process. For long-running or crash-resilient work,
  use a task queue (Celery, ARQ, Dramatiq) instead.
- Pass `background_tasks: BackgroundTasks` as a parameter to your endpoint function.
  Add tasks with `background_tasks.add_task(fn, arg1, arg2)`.

## Middleware

- Add CORS middleware with `CORSMiddleware`. Configure `allow_origins` explicitly — never
  use `allow_origins=['*']` in production.
- Add authentication middleware or use a dependency on a router for auth. Middleware is
  appropriate when every route needs it; otherwise a dependency is more flexible.
- Order matters: middleware wraps the entire app. Put logging middleware outermost,
  auth middleware innermost (closest to the route handler).

## Response Models and Output Filtering

- Always set `response_model` on endpoints that return user-facing data. This ensures
  fields not in the response model are stripped, even if the underlying object has more
  attributes. It is your output sanitization layer.
- Use `response_model_exclude_unset=True` when patching resources — only serialize fields
  that were explicitly set in the response, not all model defaults.
- For paginated responses, define a generic `Page[T]` model and reuse it across endpoints
  rather than defining per-resource pagination wrappers.
