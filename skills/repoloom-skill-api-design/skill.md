# API Design Skill Instructions

You are designing or reviewing a REST API. Apply these patterns consistently.

## Resource Naming — Nouns, Not Verbs

URLs identify resources. HTTP methods express the action.

```
# Bad — verbs in URL
POST /createUser
GET  /getOrderById/123
POST /cancelOrder/123

# Good — nouns, plural, actions via method or sub-resource
POST   /users
GET    /orders/123
POST   /orders/123/cancellation
```

Use plural nouns for collections: `/users`, `/orders`, `/products`.
Nest sub-resources to express ownership, but cap nesting at two levels:

```
/users/{userId}/orders          — orders belonging to a user
/orders/{orderId}/line-items    — line items within an order
```

Avoid deep nesting like `/users/{id}/orders/{id}/line-items/{id}/adjustments` —
flatten with a query param instead: `GET /line-items?orderId=123`.

## HTTP Method Semantics

| Method | Semantics | Idempotent | Safe |
|--------|-----------|------------|------|
| GET    | Read resource | Yes | Yes |
| POST   | Create or trigger | No | No |
| PUT    | Replace entire resource | Yes | No |
| PATCH  | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

Use `PUT` only when the client provides the full replacement. Use `PATCH` for partial
updates (prefer JSON Merge Patch or JSON Patch format). Never use `GET` for state changes.

## Status Codes — Use the Right One

```
200 OK              — successful GET, PUT, PATCH
201 Created         — successful POST that created a resource; include Location header
204 No Content      — successful DELETE or action with no response body
400 Bad Request     — malformed request, missing required field
401 Unauthorized    — not authenticated (misleading name — means unauthenticated)
403 Forbidden       — authenticated but not authorized
404 Not Found       — resource does not exist
409 Conflict        — state conflict (duplicate key, version mismatch)
422 Unprocessable   — syntactically valid but semantically invalid (validation failure)
429 Too Many Reqs   — rate limit exceeded
500 Internal Error  — unexpected server failure
```

Do not return `200` with an error body. Do not return `400` for authorization failures.
The status code must accurately reflect the outcome.

## Consistent Error Response Shape

Every error response must follow the same structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": [
      { "field": "email", "message": "must be a valid email address" },
      { "field": "age",   "message": "must be at least 18" }
    ]
  }
}
```

`code` is a machine-readable string constant (SCREAMING_SNAKE_CASE).
`message` is a human-readable summary.
`details` is an array for field-level errors — omit when not applicable.
Never expose stack traces or internal identifiers in error responses.

## Pagination — Cursor-Based for Large Sets

Offset pagination breaks under concurrent writes and is O(n) for large offsets.
Use cursor-based pagination for any list that can grow:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIzfQ==",
    "has_more": true
  }
}
```

Request: `GET /orders?cursor=eyJpZCI6MTIzfQ==&limit=20`

Offset pagination is acceptable for small, static datasets (e.g., reference tables under
1,000 rows). Document the chosen strategy in OpenAPI.

## API Versioning

Use URL prefix versioning: `/v1/users`, `/v2/users`.
It is explicit, easy to route, and easy to deprecate.

Never break a published version. When a breaking change is needed, increment the version.
Add a `Sunset` response header to deprecated endpoints:

```
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Deprecation: true
Link: <https://api.example.com/v2/users>; rel="successor-version"
```

## Idempotency Keys for POST

POST is not idempotent by default. For financial or critical mutation endpoints, require
an idempotency key from the client:

```
POST /payments
Idempotency-Key: 7f4e3b2a-1234-5678-abcd-ef0123456789
```

Store the key with the result and replay the stored response for duplicate requests within
a 24-hour window. Return `409 Conflict` if the same key is submitted with different payload.

## ETag for Caching and Optimistic Locking

Return `ETag` on GET responses. Clients send `If-None-Match` to avoid re-downloading
unchanged data (304 Not Modified). Clients send `If-Match` on PUT/PATCH for optimistic
concurrency:

```
GET /orders/123 → ETag: "a1b2c3d4"
PATCH /orders/123 + If-Match: "a1b2c3d4" → 200 or 412 Precondition Failed
```

## Rate Limiting Headers

Include rate limit information in every response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1720000000
Retry-After: 60   (on 429 responses only)
```

## OpenAPI Spec First

Define the OpenAPI (3.x) spec before writing implementation code. The spec is the contract.
Generate server stubs and client SDKs from it — do not write them by hand.
Validate request/response against the spec in tests using an OpenAPI validator.

## HATEOAS Links for Discoverability

Include links to related actions in responses to reduce client-side URL construction:

```json
{
  "id": 123,
  "status": "pending",
  "links": {
    "self":   { "href": "/orders/123" },
    "cancel": { "href": "/orders/123/cancellation", "method": "POST" },
    "items":  { "href": "/orders/123/line-items" }
  }
}
```

Keep link relation names consistent across the API. This is pragmatic HATEOAS — not
full RFC 5988 compliance, but enough to make the API self-describing.
