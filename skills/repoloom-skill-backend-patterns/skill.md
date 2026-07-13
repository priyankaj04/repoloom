# Backend Patterns Skill Instructions

You are working on a Node.js backend service. Apply these architectural patterns consistently.

## Layered Architecture

Structure every service in four layers with strict dependency direction:

```
Route Handler  →  Controller  →  Service  →  Repository
```

- **Route Handler**: parse HTTP request, call controller, return response. No logic.
- **Controller**: validate input shape, call one or more service methods, map to HTTP response.
- **Service**: business logic, orchestration, domain rules. No HTTP knowledge.
- **Repository**: data access only. All SQL/ORM queries live here. No business logic.

```
src/
  routes/       user.routes.ts
  controllers/  user.controller.ts
  services/     user.service.ts
  repositories/ user.repository.ts
  models/       user.model.ts
```

## Dependency Injection Over Global Singletons

Pass dependencies into constructors. Never import a DB client or service instance globally
inside a business function:

```typescript
// Bad
import { db } from "../db"; // global singleton

// Good
class UserService {
    constructor(private readonly userRepo: UserRepository) {}

    async getUser(id: number): Promise<User> {
        return this.userRepo.findById(id);
    }
}
```

Wire dependencies at the application root (main.ts / app.ts). This makes unit testing
trivial — inject a mock repository without touching the filesystem or network.

## Repository Pattern for Data Access

Every DB interaction goes through a repository. Controllers and services never write SQL
directly:

```typescript
interface UserRepository {
    findById(id: number): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    save(user: User): Promise<User>;
    delete(id: number): Promise<void>;
}
```

Define the repository as an interface in the service layer. The concrete implementation
lives in the repository layer. This decouples business logic from database technology.

## Never Put Business Logic in Route Handlers

Route handlers should be 5-10 lines maximum:

```typescript
// Bad — logic in route handler
router.post("/orders", async (req, res) => {
    if (!req.body.userId) return res.status(400).json({ error: "userId required" });
    const user = await db.query("SELECT * FROM users WHERE id = $1", [req.body.userId]);
    if (!user) return res.status(404).json({ error: "user not found" });
    const order = await db.query("INSERT INTO orders ...");
    await sendEmail(user.email, order);
    res.status(201).json(order);
});

// Good — orchestration only
router.post("/orders", asyncHandler(orderController.create));
```

## Database Connection Pooling

Always use a connection pool. Never create a new connection per request:

```typescript
// PostgreSQL via pg
const pool = new Pool({
    host: config.db.host,
    max: 20,           // max pool size — tune to (2 × CPU cores) + disk spindles
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
});
```

Set `max` based on your Postgres `max_connections` and number of application instances.
Log pool wait times — sustained waits indicate you need more connections or slower queries.

## Query Optimization

Before deploying any new query:
1. Run `EXPLAIN ANALYZE` against production-scale data.
2. Confirm indexes exist on all filtered and joined columns.
3. Never use `SELECT *` — name only the columns you need.

```sql
-- Bad
SELECT * FROM orders WHERE user_id = $1;

-- Good
SELECT id, status, total_amount, created_at
FROM orders
WHERE user_id = $1
  AND status != 'cancelled'
ORDER BY created_at DESC
LIMIT 20;
```

Index foreign keys that appear in JOIN conditions. Use partial indexes for filtered queries
on large tables.

## Caching Strategy — Cache-Aside with TTL

Use cache-aside (lazy population) as the default pattern:

```typescript
async getUser(id: number): Promise<User> {
    const cached = await cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User", id);

    await cache.set(`user:${id}`, JSON.stringify(user), { EX: 300 }); // 5 min TTL
    return user;
}
```

Invalidate on write — do not wait for TTL expiry for data the user just modified:

```typescript
async updateUser(id: number, data: Partial<User>): Promise<User> {
    const updated = await this.userRepo.update(id, data);
    await cache.del(`user:${id}`);
    return updated;
}
```

Never cache mutable state without invalidation logic. Document the TTL rationale.

## Job Queues for Async Work

Any operation that takes > 100ms or touches an external service belongs in a queue:
- Sending emails
- Generating reports
- Calling third-party APIs
- Image processing

```typescript
await queue.add("send-welcome-email", { userId: user.id }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
});
```

Return `202 Accepted` from the API endpoint, not `200` with the result. Include a job ID
the client can poll or subscribe to.

## Circuit Breakers for External Services

Wrap all external HTTP calls in a circuit breaker to prevent cascade failures:

```typescript
const breaker = new CircuitBreaker(paymentClient.charge, {
    timeout: 3000,          // fail fast after 3s
    errorThresholdPercentage: 50,
    resetTimeout: 30_000,   // retry after 30s
});

breaker.fallback(() => ({ status: "queued" }));
```

Alert when a circuit opens — it always indicates a real dependency problem.

## Structured Logging with Request IDs

Every log line must be structured JSON with a request ID for tracing:

```typescript
const requestId = req.headers["x-request-id"] ?? crypto.randomUUID();
const logger = baseLogger.child({ requestId, userId: req.user?.id });

logger.info({ action: "order.created", orderId: order.id }, "Order created");
logger.error({ err, orderId }, "Failed to process payment");
```

Propagate `requestId` through all downstream calls (service layer, queue jobs, external
API calls via `X-Request-ID` header).

## Health Check Endpoints

Expose at minimum:

```
GET /health        — liveness: is the process up? (no DB check)
GET /health/ready  — readiness: can the service handle traffic? (checks DB, cache, queue)
```

The readiness check should verify actual connectivity, not just that the client is
instantiated. Return `503` when any dependency is down so the load balancer stops routing.
