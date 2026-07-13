# Deployment Guidelines

## 12-Factor App Principles

- Config belongs in environment variables, not in code. Any value that differs between
  deploy environments (dev/staging/prod) is config: DB URLs, API keys, feature flags.
- Treat backing services (databases, queues, caches) as attached resources. Swap a
  local Postgres for a managed RDS by changing a URL — no code change.
- Build once, deploy many times. The same image artifact deploys to every environment.
  Environment-specific behavior comes from env vars, not from separate builds.
- Export logs to stdout/stderr. Let the infrastructure (log aggregator, Kubernetes,
  Vercel) handle routing, storage, and rotation. Do not write to files.
- Explicitly declare all dependencies. No implicit reliance on system packages or
  globally installed tools.

## Environment Parity

- Dev, staging, and production must run the same Docker image. "Works on my machine"
  is caused by environment divergence.
- Use the same database engine in development as production. An SQLite dev DB against
  a Postgres production DB guarantees surprises.
- Run staging on the same infrastructure class as production (same cloud provider,
  same k8s version, same managed service tier). Staging is where production bugs
  are caught, not discovered.

## Blue-Green Deployments

- Maintain two identical production environments: blue (live) and green (idle).
- Deploy the new version to the idle environment. Run smoke tests. Then switch the
  load balancer to route traffic to the newly deployed environment.
- Rollback is instant: flip the load balancer back. No re-deploy required.
- Blue-green requires that both versions can run simultaneously (no destructive DB
  migrations without backward compatibility).

## Kubernetes

- Always set CPU and memory `requests` and `limits` on every container. Without
  them, a runaway pod can starve the entire node. `requests` informs scheduling;
  `limits` enforces the ceiling.
- Define a `livenessProbe` to restart a container that is deadlocked, and a
  `readinessProbe` to remove a container from the load balancer during startup or
  when it cannot serve traffic. These are not optional for production workloads.
- Use `HorizontalPodAutoscaler` (HPA) to scale on CPU/memory or custom metrics.
  Set conservative `minReplicas` (at least 2 for HA) and a sensible `maxReplicas`.
- Store non-secret configuration in `ConfigMap` objects. Store sensitive values in
  `Secret` objects (and back them with an external secrets manager in production —
  do not rely on etcd encryption alone).
- Use namespaces to isolate environments (dev/staging/prod) or teams within a cluster.
  Apply RBAC: service accounts should have the minimum permissions required.
- Set `PodDisruptionBudget` on critical workloads to prevent cluster operations from
  taking all replicas offline simultaneously.

## Vercel

- Use preview deployments for every pull request. Each PR gets a unique URL — share
  it in the PR description for QA review without spinning up a staging environment.
- Scope environment variables by environment: use the Vercel dashboard to set
  production-only secrets, and different values for preview/development. Do not
  hard-code environment-specific values.
- Edge Functions run at the CDN edge with lower latency for latency-sensitive paths
  (geolocation, A/B routing, auth token refresh). Use them deliberately — they have
  runtime constraints (no Node.js APIs, limited execution time).
- Server Components fetch data on the server; use them for anything that requires
  secrets or benefits from being close to the data source. Keep edge functions
  thin and stateless.

## CI/CD Pipeline Structure

- Pipeline stages in order: `lint` → `test` → `build` → `deploy`.
- Lint and test run in parallel where possible to minimize wall-clock time.
- Build produces the deployable artifact (Docker image, static bundle). Tag the image
  with the commit SHA for traceability: `ghcr.io/org/app:sha-abc1234`.
- Deploy to production only on merge to `main`. Never deploy directly from a feature
  branch to production.
- Gate production deploy on successful staging deploy and smoke test. Do not rely on
  CI tests alone as a production gate — test in a production-like environment.

## Rollback Strategy

- Define the rollback procedure before the deploy, not after an incident.
- For Kubernetes: `kubectl rollout undo deployment/<name>` reverts to the previous
  ReplicaSet. Keep `revisionHistoryLimit` at 3-5.
- For Vercel: instant rollback to any prior deployment from the dashboard.
- For database migrations: every migration must have a `down` migration that is tested.
  Prefer additive/backward-compatible migrations (add column before removing old one)
  to enable rollback without data loss.

## Zero-Downtime Deploys

- Use `RollingUpdate` strategy in Kubernetes with `maxUnavailable: 0` to ensure
  at least one replica is always serving traffic during a rollout.
- Ensure your readiness probe correctly signals when the new version is ready before
  old replicas are terminated.
- For database schema changes: deploy application code that handles both old and new
  schema (backward-compatible), then run the migration, then clean up the compatibility
  code in a follow-up deploy. Never change schema and application code in a single deploy.
- Drain connections gracefully: handle `SIGTERM` in your application to stop accepting
  new requests, finish in-flight requests, then exit. Set `terminationGracePeriodSeconds`
  in Kubernetes to allow time for this.
