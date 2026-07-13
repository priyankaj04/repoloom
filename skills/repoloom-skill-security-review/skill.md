# Security Best Practices

## Input Validation

- Treat all user input as hostile. Validate and sanitize at the boundary where data
  enters the system — before it touches business logic, persistence, or any external call.
- Validate type, length, format, and range. Reject and return a 400 immediately on
  invalid input rather than attempting to sanitize and continue.
- Use allowlists (permit known-good values) not denylists (block known-bad values).
  Denylists are always incomplete.
- Never pass raw user input to shell commands, file paths, or template engines.

## SQL Injection

- Use parameterized queries or prepared statements unconditionally. String interpolation
  into SQL is never acceptable, regardless of where the data came from.
- ORMs with parameter binding are safe if used correctly — review generated queries for
  any raw string insertion via `.raw()`, `.execute()`, or equivalent escape hatches.
- Validate that foreign key values from user input actually belong to the authenticated
  user before using them in queries (IDOR prevention).

## XSS Prevention

- Escape all user-supplied content before rendering it in HTML. Use your framework's
  built-in templating (Jinja2 autoescaping, React's JSX, etc.) — never build HTML by
  string concatenation.
- Set a Content Security Policy (CSP) header to limit which scripts can execute. Start
  with a strict policy and widen only when necessary.
- Set `HttpOnly` and `Secure` flags on session cookies. `HttpOnly` prevents JavaScript
  from reading the cookie; `Secure` prevents transmission over HTTP.

## CSRF Protection

- Protect all state-changing endpoints (POST/PUT/PATCH/DELETE) with CSRF tokens.
- Use the synchronizer token pattern: embed a unique token in the form, verify it
  server-side. Most web frameworks provide this middleware — enable it.
- For API-only backends consumed by SPAs, use `SameSite=Strict` or `SameSite=Lax`
  cookie attribute plus `Origin` header verification as CSRF mitigation.

## Secrets Management

- Secrets (API keys, database passwords, signing keys) live in environment variables
  or a secrets manager (Vault, AWS Secrets Manager, Doppler). Never in source code,
  config files committed to git, or log output.
- Rotate secrets on suspected exposure immediately. Design systems so rotation does not
  require downtime.
- Audit git history for accidentally committed secrets using tools like `git-secrets`
  or `trufflehog` before making a repository public.

## Password Hashing

- Hash passwords with bcrypt (cost factor ≥ 12) or argon2id. Never use MD5, SHA-1,
  SHA-256, or any fast hash for passwords — they are trivially brute-forceable.
- Never store passwords in plaintext, encrypted (not hashed), or as reversible encodings.
- Use a library function for comparison — never compare hash strings with `==`.
  Timing-safe comparison is handled by `bcrypt.CheckPasswordHash` and equivalents.

## JWT and Session Tokens

- Set short expiry on access tokens (15 minutes is reasonable). Use refresh tokens for
  longer-lived sessions.
- Rotate refresh tokens on use (token rotation). Invalidate the old refresh token
  immediately when a new one is issued. Detect reuse of old tokens as a compromise signal.
- Sign JWTs with RS256 or ES256 (asymmetric), not HS256, when the verifier is a
  different service than the issuer. HS256 requires sharing the secret.
- Validate `iss`, `aud`, and `exp` claims on every JWT verification. Do not accept a
  JWT that is valid in signature but expired or issued for a different audience.
- Never store JWTs in localStorage. Use `HttpOnly` cookies to prevent XSS theft.

## Rate Limiting

- Apply rate limiting on authentication endpoints (login, password reset, OTP verification)
  to prevent brute-force attacks. Limit by IP and by account identifier.
- Return HTTP 429 with a `Retry-After` header. Do not silently drop requests.
- Use exponential backoff or account lockout after repeated failures. Lock the account,
  not just the IP — IPs are easily rotated.

## Principle of Least Privilege

- Database users used by the application should have only the permissions the application
  needs: SELECT/INSERT/UPDATE/DELETE on specific tables. No CREATE, DROP, or GRANT.
- Use separate DB users for read-only replicas if applicable.
- Service accounts and API tokens should be scoped to the minimum required permissions.
  Review permissions quarterly and revoke what is no longer needed.

## HTTPS and Transport Security

- Serve everything over HTTPS. No exceptions for internal services — lateral movement
  exploits plaintext internal traffic.
- Set the `Strict-Transport-Security` (HSTS) header with a long `max-age` and
  `includeSubDomains`. Submit to the HSTS preload list for public domains.
- Disable TLS 1.0 and 1.1. Require TLS 1.2 minimum; prefer TLS 1.3.

## Security Headers

- `X-Frame-Options: DENY` — prevents clickjacking via iframes.
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage.
- `Permissions-Policy` — disable browser features your app does not use (camera, mic, geolocation).
- Use a middleware or helmet-style library to set all headers consistently.

## Dependency Auditing

- Run `npm audit` / `pip-audit` / `go list -m -json all | nancy` in CI on every build.
  Fail the build on high or critical severity findings.
- Pin dependency versions exactly in lockfiles. Review and test dependency updates before
  merging — automated tools like Dependabot help but require human review of breaking changes.
- Minimize dependencies. Every transitive dependency is an attack surface you did not
  explicitly choose.
