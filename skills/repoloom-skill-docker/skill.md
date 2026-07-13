# Docker Best Practices

## Multi-Stage Builds

- Use multi-stage builds to separate the build environment from the runtime image.
  The builder stage installs toolchains, compilers, and dev dependencies. The final
  stage copies only the compiled artifact and runtime dependencies.
- Name stages explicitly: `FROM node:20-alpine AS builder` and `FROM node:20-alpine AS runner`.
  Reference them in `COPY --from=builder`.
- The final image should contain nothing that isn't required to run the application:
  no build tools, no test dependencies, no source code in interpreted languages.

## Pinning Base Image Versions

- Never use `:latest` as a base image tag. It changes without warning and breaks
  reproducible builds. Pin to a specific version: `FROM node:20.14-alpine3.19`.
- Prefer `-alpine` or `-slim` variants to minimize attack surface and image size.
- Review and update pinned versions on a schedule (monthly is reasonable). Stale base
  images accumulate unpatched CVEs.
- Use image digest pinning (`FROM node@sha256:...`) for maximum reproducibility in
  production pipelines.

## Non-Root User

- The final image must run as a non-root user. Running as root inside a container is a
  privilege escalation path if the container escapes.
- Create a dedicated user in the Dockerfile: `RUN addgroup -S app && adduser -S app -G app`.
  Switch with `USER app` before the final `CMD`.
- Set file ownership during the build stage: `COPY --chown=app:app . .`.

## .dockerignore

- Every Dockerized project needs a `.dockerignore` file. Without it, `COPY . .`
  sends the entire build context to the daemon including `node_modules`, `dist`, `.git`,
  `.env`, and test artifacts — this is slow and may leak secrets.
- Exclude at minimum: `node_modules/`, `dist/`, `.git/`, `.env*`, `*.log`,
  `coverage/`, `.DS_Store`, and any local secrets files.

## Layer Ordering for Cache Efficiency

- Order Dockerfile instructions from least-frequently-changed to most-frequently-changed.
  Docker invalidates all layers after the first changed layer.
- The canonical Node.js pattern:
  ```
  COPY package.json package-lock.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  ```
  This way, the `npm ci` layer is cached unless dependencies change, not on every
  source file edit.
- Apply the same principle to Python (`requirements.txt` before source), Go
  (`go.mod` and `go.sum` before source), etc.

## CMD and ENTRYPOINT

- Use exec form for `CMD` and `ENTRYPOINT`: `CMD ["node", "server.js"]` not
  `CMD node server.js`. Shell form starts a shell process that swallows signals —
  `SIGTERM` from `docker stop` will not reach your application, causing hard kills.
- Use `ENTRYPOINT` for the binary and `CMD` for default arguments that callers may
  override. Use only `CMD` when the container should be flexible about what runs.

## Health Checks

- Define a `HEALTHCHECK` instruction for long-running services. Kubernetes and
  compose orchestrators use it to determine when a container is ready and to restart
  unhealthy ones.
- Use the application's own health endpoint: `HEALTHCHECK --interval=30s --timeout=5s
  CMD curl -f http://localhost:8080/health || exit 1`.
- Set a `--start-period` that accounts for slow startup: `--start-period=10s`.

## Compose Patterns

- Use `compose.override.yml` for local development overrides (volume mounts, debug
  ports, hot reload commands). The base `compose.yml` should describe the production-like
  configuration. `docker compose up` automatically merges both.
- Use named volumes for persistent data: `volumes: postgres_data:`. Anonymous volumes
  are difficult to manage and are lost on `docker compose down -v` accidentally.
- Use networks to isolate services: internal services should not be on the default
  network. Only expose ports to the host that need to be accessible externally.
- Pass non-secret configuration via environment variables in `compose.yml`. Load
  secrets from `.env` (development) or Docker secrets (production).

## Secrets in Production

- Do not pass production secrets as environment variables in compose or Kubernetes specs
  committed to version control.
- Use Docker Swarm secrets or Kubernetes Secrets mounted as files. Read them from the
  filesystem in the application, not from environment variables.
- For cloud deployments, use the provider's secrets manager (AWS Secrets Manager,
  GCP Secret Manager) and inject at runtime via the init container pattern or SDK.
- Environment variables are visible to any process in the container and appear in
  `docker inspect` output. Filesystem-mounted secrets are scoped to the intended process.
