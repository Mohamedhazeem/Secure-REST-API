# TrustFeed — Production-Grade Security, Reliability & Observability Social API

## 1. Project Positioning

**Elevator pitch:** TrustFeed is a modular-monolith social API that treats social features as a realistic testbed for demonstrating senior-level backend engineering. It is not another CRUD social clone; it is a production-referenced system showcasing security-first architecture, end-to-end observability, and the patterns that separate junior implementations from production-ready systems.

**For whom:** Senior backend hiring managers evaluating architecture depth, security thinking, and operational maturity; consulting clients assessing whether a candidate can design for scale, reliability, and maintainability.

**Why it stands out:** Most portfolio APIs stop at "auth works." TrustFeed proves you understand token-binding, audit logging, idempotency, concurrency control, distributed tracing, and graceful degradation—patterns that matter at scale.

**One-liner:** "A social API built to production standards, where every architectural decision is documented, tested, and justified."

---

## 2. MVP Scope

### In Scope (Must Ship)

| Feature | Technical Depth Demonstrated |
|---------|------------------------------|
| Registration / login / logout | JWT access + refresh tokens, password hashing, input validation |
| Access + refresh token sessions | Rotation, reuse detection, device fingerprinting, session store in Redis |
| User profiles | CRUD, avatar placeholder, bio, privacy flags (ABAC) |
| Follow / unfollow | Atomic operations, fanout-on-write notification trigger |
| Posts | CRUD, optimistic concurrency control (`__v`), author attribution |
| Comments | Nested under post, atomic push, idempotency key support |
| Cursor-paginated feed | Redis-backed feed timeline, cursor-based pagination, cache-aside |
| Basic async notifications | BullMQ worker, retry + exponential backoff, dead-letter queue |

### Out of Scope (Explicitly Deferred)

| Capability | Rationale |
|------------|-----------|
| WebSockets / Socket.IO | Pushing notifications via async jobs; real-time adds state complexity without proportional portfolio gain |
| Full-text search | Not required for MVP; future evolution documented |
| Multi-tenancy | Adds context propagation and tenant isolation overhead; out of scope for 2–4 weeks |
| Kafka / RabbitMQ | BullMQ sufficient; message broker is premature optimization |
| GraphQL / gRPC | REST + OpenAPI is the contract; adds gateway complexity |
| Media uploads | Requires storage (S3), CDN, virus scanning; defer to Phase 2 |
| Recommendation systems | ML/relevance is a separate product concern |
| Kubernetes | Docker Compose sufficient; K8s is infrastructure, not backend engineering |
| Complex frontend | Optional 3-screen React/Vite demo only; API is the deliverable |

---

## 3. Non-Goals

1. **No naive CRUD everywhere.** Every endpoint must demonstrate at least one production-grade pattern (idempotency, cursor pagination, optimistic locking, etc.).
2. **No hidden magic.** BullMQ queues, Redis keys, token secrets—all configurable and documented. No "it just works" without explaining why.
3. **No security through obscurity.** Threat model (STRIDE) is published. Audit logs are inspectable. Attack surface is known.
4. **No untested critical paths.** Auth, authorization, concurrency, and failure modes have automated verification.
5. **No premature scale.** Designed for 1k–10k concurrent users; architecture supports horizontal scaling but does not implement it.

---

## 4. System Architecture

### Layered Modular Monolith

```
src/
├── modules/                    # Feature modules (social domain)
│   ├── auth/
│   ├── users/
│   ├── posts/
│   ├── comments/
│   ├── follows/
│   ├── feed/
│   └── notifications/
├── common/                     # Cross-cutting concerns
│   ├── config/
│   ├── middleware/
│   ├── guards/
│   ├── errors/
│   ├── utils/
│   ├── types/
│   └── constants/
├── infrastructure/             # External adapters
│   ├── mongo/
│   ├── redis/
│   ├── bullmq/
│   ├── otel/
│   └── logger/
├── app.js                      # Express app factory
└── index.js                    # Server bootstrap, graceful shutdown
```

**Layers (inside each module):**

```
modules/auth/
├── auth.controller.ts       # Thin: request → response
├── auth.service.ts          # Business logic, orchestration
├── auth.repository.ts       # Mongo queries, atomic ops
├── auth.schema.ts           # Zod validation
├── auth.routes.ts           # Route definitions
├── auth.middleware.ts       # Route guards (auth, roles)
└── auth.types.ts            # Domain types
```

**Dependency rule:** `modules → common → infrastructure`. Modules never import directly from another module's internals.

### Request Lifecycle

```
Client Request
  → CORS / Helmet / Compression
  → Rate Limiter (Redis, sliding window)
  → Correlation ID Middleware (injects `x-request-id`)
  → OpenTelemetry Span start
  → Pino request logger (structured)
  → Idempotency Middleware (Redis store, 24h TTL)
  → Auth Middleware (JWT verify + session check + blacklist)
  → Route Guard (RBAC + ABAC)
  → Controller (parse, validate)
  → Service (business logic)
  → Repository (atomic Mongo ops, cache-aside)
  → Response
  → Metrics (request duration, status, endpoint)
  → Audit Logger (async, BullMQ)
```

---

## 5. Modules and Responsibilities

| Module | Responsibility | Key Complexity |
|--------|---------------|----------------|
| `auth` | Registration, login, logout, token refresh, session management | Rotation + reuse detection, device binding |
| `users` | Profile CRUD, privacy settings | ABAC on profile visibility |
| `posts` | Post CRUD, optimistic locking | `__v` concurrency control |
| `comments` | Comment CRUD under posts | Atomic push, idempotency keys |
| `follows` | Follow/unollow, follower/following counts | Atomic `$inc` + fanout trigger |
| `feed` | Cursor-paginated timeline, cache-aside | Redis sorted set, cursor encoding |
| `notifications` | Async notification creation, delivery | BullMQ worker, retry, DLQ |
| `common/guards` | RBAC + ABAC policy engine | Resource-level permission evaluation |
| `common/errors` | Flat error model (code, message, traceId) | Stable codes, no categories |
| `infrastructure/bullmq` | Queue definitions, worker registration | Graceful shutdown, job deduplication |

---

## 6. Authentication / Session Design

### Token Strategy

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access | 5 minutes | HTTP-only cookie (frontend) / Authorization header (API) | Authenticate requests |
| Refresh | 15 minutes | HTTP-only cookie, Redis session store | Obtain new access token |

### Refresh-Token Rotation + Reuse Detection

**Flow:**
1. Client sends refresh token → `/auth/refresh`
2. Server looks up session in Redis by token hash (SHA-256)
3. If valid and not expired:
   - Generate new refresh token
   - Delete old session atomically
   - Create new session
   - Set new HTTP-only cookie
4. If token already used (reuse detected):
   - **Revoke all sessions for that user**
   - Invalidate all access tokens
   - Alert (audit log + optional webhook)
   - Return `401` with error code `TOKEN_REUSED`
5. If expired/missing:
   - Return `401` with error code `SESSION_EXPIRED`

**Why it matters:** Prevents replay attacks and limits exposure if a refresh token is leaked. This is a *portfolio-grade* auth implementation.

### Session / Device Management

- Sessions stored in Redis: `session:{userId}:{sessionId}` → `{ refreshTokenHash, deviceFingerprint, ip, userAgent, createdAt, expiresAt }`
- Device fingerprint: SHA-256 of `userAgent + screenResolution + timezone` (client sends on login)
- List sessions: `GET /auth/sessions` → returns active sessions with device info
- Revoke single session: `DELETE /auth/sessions/:id`
- Revoke all: `DELETE /auth/sessions` (triggered on reuse detection)

### Logout

- Blacklist current access token in Redis (TTL = access token lifetime)
- Delete session from Redis
- Clear HTTP-only cookie

---

## 7. Authorization Design

### RBAC (Role-Based Access Control)

- Roles: `user`, `moderator`, `admin`
- Permissions: granular strings (`post:create`, `post:delete:any`, `user:read`, `audit:read`)
- Roles assigned at registration; middleware checks `requiredPermission`
- Route decorator: `@RequirePermission('post:delete')`

### ABAC (Attribute-Based Access Control) + Resource Policies

RBAC handles *endpoint-level* access. ABAC handles *resource-level* access (can this user delete *this specific post*?).

**Policy engine:** Common `Authorizer` service evaluates rules:
```typescript
can(user, action, resource) {
  // 1. Check RBAC permission
  // 2. Check resource owner (user._id === resource.authorId)
  // 3. Check custom policy (post visibility, account status)
  // 4. Return boolean + reason
}
```

**Applied to:**
- Post update/delete: owner OR moderator
- Profile view: owner OR public profile flag
- Follow: cannot follow self, block check
- Notification access: recipient only

### Ownership Enforcement

Every mutating operation passes through `Authorizer`. No controller or service bypasses it. This eliminates the #1 class of social API bugs (IDOR).

---

## 8. MongoDB Data Model

### Collections

**users**
```typescript
{
  _id: ObjectId,
  username: string (unique, lowercase),
  email: string (unique, lowercase),
  passwordHash: string,
  displayName: string,
  bio: string,
  avatarUrl: string | null,
  privacy: { profilePublic: boolean, showFollows: boolean },
  roles: [ObjectId -> Role],
  status: 'active' | 'suspended' | 'deleted',
  __v: number (optimistic locking)
}
```

**posts**
```typescript
{
  _id: ObjectId,
  content: string,
  authorId: ObjectId -> User,
  visibility: 'public' | 'private',
  __v: number,
  createdAt: ISODate,
  updatedAt: ISODate
}
// Index: { authorId: 1, createdAt: -1 }
```

**comments**
```typescript
{
  _id: ObjectId,
  postId: ObjectId -> Post,
  authorId: ObjectId -> User,
  content: string,
  parentCommentId: ObjectId | null,  // threaded
  __v: number,
  createdAt: ISODate
}
// Index: { postId: 1, createdAt: 1 }
```

**follows**
```typescript
{
  _id: ObjectId,
  followerId: ObjectId -> User,
  followingId: ObjectId -> User,
  createdAt: ISODate
}
// Unique index: { followerId: 1, followingId: 1 } (prevents duplicates)
// Index: { followingId: 1, createdAt: -1 } (for follower list)
```

**notifications** (async-generated)
```typescript
{
  _id: ObjectId,
  recipientId: ObjectId -> User,
  actorId: ObjectId -> User,
  type: 'follow' | 'comment' | 'like',
  resourceId: ObjectId,  // postId, commentId, etc.
  read: boolean,
  createdAt: ISODate
}
// Index: { recipientId: 1, createdAt: -1 }
```

**sessions** (Redis, not Mongo)
```
Key: session:{userId}:{sessionId}
TTL: refresh token lifetime + buffer
Value: JSON { refreshTokenHash, deviceFingerprint, ip, userAgent, createdAt, expiresAt }
```

**revoked_tokens** (Redis)
```
Key: revoked:{tokenJti}
TTL: access token lifetime
Value: JSON { userId, revokedAt, reason }
```

**audit_logs** (Mongo, async-write via BullMQ)
```typescript
{
  _id: ObjectId,
  actorId: ObjectId | null,  // null for unauthenticated events
  action: string,  // e.g., 'auth.login', 'post.delete', 'token.reuse_detected'
  resourceType: string,  // e.g., 'Post', 'User'
  resourceId: ObjectId | null,
  ip: string,
  userAgent: string,
  metadata: object,  // additional context
  traceId: string,  // correlates to OTel trace
  severity: 'info' | 'warning' | 'critical',
  createdAt: ISODate
}
// Index: { actorId: 1, createdAt: -1 }, { action: 1, createdAt: -1 }
```

---

## 9. Redis Strategy

### Key Namespaces

| Namespace | Pattern | Purpose |
|-----------|---------|---------|
| Sessions | `session:{userId}:{sessionId}` | Active refresh tokens |
| Revoked tokens | `revoked:{jti}` | Blacklisted access tokens |
| Rate limits | `ratelimit:{identifier}:{window}` | Sliding window counters |
| Cache | `cache:{resource}:{id}` | Cache-aside for hot resources |
| Feed timeline | `feed:{userId}` | Sorted set for cursor-paginated feed |
| Idempotency | `idempotency:{key}` | Request dedup (24h TTL) |
| BullMQ | `bull:queues:*` | Queue state, job metadata |

### Cache-Aside Pattern

```
GET /posts/:id
  1. Try Redis: GET cache:post:{id}
  2. Hit? Return cached (set TTL 5min, stale-while-revalidate 30s)
  3. Miss? Query Mongo
  4. Populate Redis: SET cache:post:{id} { ... } EX 300
  5. Return
```

**Invalidation:** On post update/delete, delete Redis key and update Mongo. No write-through complexity.

### Rate Limiting

- **Global API:** 100 req/min per IP (sliding window, Redis)
- **Authenticated API:** 200 req/min per user (sliding window, Redis)
- **Auth endpoints:** 10 req/min per IP (strict, separate limiter)
- Fail-open on Redis failure (log warning, allow request) to avoid self-DDoS

---

## 10. BullMQ Architecture

### Queues

| Queue | Purpose | Retry | DLQ |
|-------|---------|-------|-----|
| `audit-log` | Persist audit events to Mongo | 3x, exponential backoff (1s, 5s, 30s) | `audit-log-dlq` |
| `notification` | Create + deliver notifications | 5x, backoff (2s, 10s, 60s, 5m) | `notification-dlq` |
| `feed-fanout` | Push new posts to followers' feeds | 2x, backoff (1s, 10s) | `feed-fanout-dlq` |

### Worker Design

- **Idempotent:** Jobs carry `jobId` = hash of `(type, resourceId, recipientId)`. Redis set `processed:{jobId}` prevents duplicates.
- **Graceful shutdown:** BullMQ `waitUntilFinished()` on SIGTERM. In-flight jobs complete or re-queue.
- **Dead-letter handling:** DLQ jobs logged + alertable. Manual replay via admin endpoint (requires `audit:read` permission).

### Failure Strategy

```
Job fails → retry with backoff
  → max retries exhausted → move to DLQ
  → DLQ job age > 24h → alert + mark for manual review
  → operator replays via POST /admin/jobs/{queue}/replay
```

---

## 11. Reliability / Failure Strategy

### Graceful Shutdown

```
SIGTERM / SIGINT
  1. Stop accepting new requests (Express `close()`)
  2. Tell BullMQ to stop fetching new jobs
  3. Wait for in-flight HTTP requests (max 10s)
  4. Wait for in-flight jobs to finish (max 30s)
  5. Close Mongo connection
  6. Close Redis connection
  7. Flush Pino buffer
  8. Exit
```

### Dependency Failure Handling

| Dependency | Failure Mode | Response |
|------------|--------------|----------|
| MongoDB | Connection lost | Fail fast: `503 Service Unavailable`, structured error `DB_UNAVAILABLE` |
| Redis | Connection lost | Rate limit fail-open, cache miss (serve from Mongo), session ops fail with `503` |
| BullMQ | Queue unavailable | Jobs enqueue in-memory buffer (bounded), flush when Redis recovers; alert |
| External services | N/A (none in MVP) | — |

**Rule:** No automatic retries at API layer. Consumers decide retry behavior using stable error codes.

### Retry + Exponential Backoff

Applied only to:
- BullMQ workers (internal async jobs)
- Outbound HTTP calls (if any added later)
- Never on incoming request handlers

### Circuit Breaker (BullMQ Worker Level)

If Mongo write latency > 5s for 3 consecutive jobs → pause queue → alert → resume when latency normalizes. Prevents cascading failures.

---

## 12. Observability Strategy

### Three Pillars

**1. Distributed Tracing (OpenTelemetry)**
- Every request creates a root span
- Mongo queries, Redis commands, BullMQ jobs create child spans
- Exports to OTLP (console for dev, Jaeger/Tempo for prod)
- Trace ID injected into request context, Pino logs, and audit entries

**2. Structured Logging (Pino)**
- Request log: `{ method, url, statusCode, durationMs, userId, traceId }`
- Error log: `{ error: { code, message, stack }, traceId, context }`
- Audit log: `{ action, actorId, resourceType, resourceId, severity, traceId }`
- Pretty-print in dev, JSON in prod

**3. Metrics (Prometheus)**
- `http_request_duration_seconds` (histogram, by method, route, status)
- `http_requests_total` (counter, by method, route, status)
- `auth_login_total` (counter, by result: success/failure/reuse)
- `bullmq_jobs_total` (counter, by queue, status)
- `cache_hit_ratio` (gauge)
- `mongo_operation_duration_seconds` (histogram)
- `active_sessions` (gauge)
- `rate_limit_remaining` (gauge, by endpoint)

### Health Endpoints

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `GET /health/live` | Liveness (am I running?) | Always 200 |
| `GET /health/ready` | Readiness (can I serve traffic?) | Mongo ping, Redis ping, BullMQ connection |

### Request Correlation

- Middleware generates `x-request-id` if missing
- Propagated to all child spans, logs, audit entries
- Exposed in response headers for client debugging

---

## 13. Security / Threat Model Priorities

### STRIDE Analysis (Top Threats)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| **Spoofing** | JWT signed with strong secret (HS256), token introspection, session binding | MVP |
| **Tampering** | Input validation (Zod), MongoDB atomic operators (no client-side mutation), optimistic locking | MVP |
| **Repudiation** | Audit logging (actor, action, IP, traceId), non-repudiable log entries | MVP |
| **Information Disclosure** | Password hashing (bcrypt 10), no sensitive fields in responses, HTTP-only cookies, CORS allowlist | MVP |
| **Denial of Service** | Rate limiting (IP + user), request size limits, Redis fail-open, BullMQ circuit breaker | MVP |
| **Elevation of Privilege** | RBAC + ABAC, ownership checks on every mutating op, no trust in client-supplied `authorId` | MVP |

### Security Testing

- Automated OWASP Top 10 scan (ZAP or equivalent)
- Manual pen-test checklist: token replay, IDOR, mass assignment, rate limit bypass, session fixation
- Dependency audit: `npm audit`, Snyk or Dependabot

### Secrets Management

- All secrets via environment variables
- `.env` gitignored
- JWT secrets: 256-bit random, rotated quarterly (documented in runbook)
- No secrets in logs, responses, or audit entries

---

## 14. Testing Strategy

### Test Pyramid

```
        /\
       /E2E\          k6 load tests, smoke flows
      /------\
     /Integr.\        Supertest + Testcontainers (Mongo, Redis)
    /----------\
   /Unit Tests\       Vitest, pure functions, services, guards
  /--------------\
```

### Coverage by Layer

| Layer | Tool | Scope |
|-------|------|-------|
| **Unit** | Vitest | Services, guards, utils, idempotency logic, token generation |
| **Integration** | Supertest + Testcontainers | End-to-end HTTP flows against real Mongo/Redis |
| **Contract** | OpenAPI + Dredd (or similar) | Every endpoint matches spec |
| **Security** | Custom + ZAP | IDOR, auth bypass, rate limit, token reuse |
| **Concurrency** | Custom + Testcontainers | Optimistic locking retries, race conditions |
| **Performance** | k6 | 1000 concurrent users, p95 < 950ms |

### Critical Paths (Must Have Tests)

1. **Auth flow:** register → login → refresh → logout → reuse detection
2. **Authorization:** user A cannot delete user B's post
3. **Concurrency:** two clients update same post → one gets 409
4. **Idempotency:** duplicate `Idempotency-Key` → same response, no duplicate resource
5. **Failure:** Mongo down → structured error, no crash
6. **Cache:** hot post served from Redis, invalidation on update

### CI Pipeline (GitHub Actions)

```yaml
jobs:
  lint: npm run lint
  test: npm run test:unit && npm run test:integration
  contract: npm run test:contract
  security: npm run test:security
  performance: npm run test:performance:ci
```

---

## 15. MongoDB Data Model

*(See Section 8 for full schema. Key design decisions below.)*

### Indexing Strategy

| Collection | Index | Purpose |
|------------|-------|---------|
| `posts` | `{ authorId: 1, createdAt: -1 }` | User's post history |
| `posts` | `{ createdAt: -1 }` | Global feed (if not using Redis feed) |
| `comments` | `{ postId: 1, createdAt: 1 }` | Comment thread ordering |
| `follows` | `{ followerId: 1, followingId: 1 }` (unique) | Prevent duplicate follows |
| `follows` | `{ followingId: 1, createdAt: -1 }` | Follower list lookup |
| `notifications` | `{ recipientId: 1, createdAt: -1 }` | User notification feed |
| `audit_logs` | `{ actorId: 1, createdAt: -1 }` | User activity audit |
| `audit_logs` | `{ action: 1, createdAt: -1 }` | Security event audit |

### Atomic Operations

- Follow/unfollow: `$addToSet` / `$pull` on follows array + `$inc` counters in single `updateOne`
- Post creation: `insertOne` with `authorId` from auth context (never client-supplied)
- Comment push: `$push` with `$each` and positional operator
- Optimistic locking: `__v` field, `updateOne` with `{ __v: current }` → check `matchedCount`

---

## 16. Redis Strategy

*(See Section 9 for full strategy. Key design decisions below.)*

### Data Shapes

```typescript
// Session
session:{userId}:{sessionId} → JSON { refreshTokenHash, deviceFingerprint, ip, userAgent, createdAt, expiresAt }

// Revoked token
revoked:{jti} → JSON { userId, revokedAt, reason } (TTL = access token lifetime)

// Cache
cache:post:{postId} → JSON post document (TTL 300s, background refresh at 240s)

// Feed timeline
feed:{userId} → Sorted set: score = createdAt timestamp, value = postId

// Rate limit (sliding window)
ratelimit:{hash}:{window} → String (increment, TTL = window size)

// Idempotency
idempotency:{key} → JSON { statusCode, responseBody, createdAt } (TTL 24h)
```

### Failure Modes

- **Redis down:** Rate limiting fail-open (log + allow), cache miss (serve from Mongo), session ops return `503`
- **Partial data:** If `feed:{userId}` exists but corrupted, rebuild from Mongo on next read

---

## 17. BullMQ Architecture

*(See Section 10 for full architecture. Key design decisions below.)*

### Queue Topology

```
feed-fanout (new post created)
  → For each follower: add postId to their feed sorted set
  → Retry 2x, DLQ if exhausted

notification (follow, comment, like)
  → Create notification document in Mongo
  → Retry 5x, DLQ if exhausted

audit-log (every significant event)
  → Append to audit_logs collection
  → Retry 3x, DLQ if exhausted
```

### Job Deduplication

```typescript
const jobId = crypto
  .createHash('sha256')
  .update(`${type}:${resourceId}:${recipientId}`)
  .digest('hex');
```

Before enqueueing, check Redis: `processed:{jobId}`. If exists, skip. If not, set with TTL 1h.

### Graceful Shutdown Integration

```typescript
process.on('SIGTERM', async () => {
  await server.close();           // Stop accepting requests
  await worker.close();           // Finish in-flight jobs
  await mongoConnection.close();  // Drain Mongo pool
  await redisConnection.quit();   // Flush Redis buffers
  process.exit(0);
});
```

---

## 18. Reliability / Failure Strategy

### Retry Policy (Centralized)

```typescript
const RETRY_POLICIES = {
  'audit-log':        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  'notification':     { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
  'feed-fanout':      { attempts: 2, backoff: { type: 'fixed', delay: 1000 } },
};
```

### Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Redis down | Cache miss, rate limit fail-open, session ops 503 |
| Mongo down | All writes fail fast with `DB_UNAVAILABLE`, reads fail with 503 |
| BullMQ down | Jobs buffered in-memory (bounded 1000), flush on recovery; alert if buffer > 500 |
| OpenTelemetry collector down | Traces logged locally, no crash; reconnect with backoff |

### Circuit Breaker (BullMQ Workers)

```typescript
class MongoCircuitBreaker {
  private failures = 0;
  private threshold = 3;
  private state: 'closed' | 'open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') throw new Error('Mongo circuit open');
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) this.state = 'open';
      setTimeout(() => { this.state = 'closed'; }, 30000); // 30s recovery
      throw err;
    }
  }
}
```

---

## 19. Observability Strategy

*(See Section 12 for full strategy. Key implementation details below.)*

### Pino Logger Setup

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatter: (log) => ({ ...log, service: 'trustfeed', env: process.env.NODE_ENV }),
  redact: ['password', 'token', 'refreshToken', 'authorization'], // never log secrets
});
```

### OpenTelemetry Configuration

```typescript
const provider = new NodeTracerProvider({
  resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: 'trustfeed' }),
});
provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
provider.register();
```

### Key Metrics to Expose

```typescript
// Prometheus registry
httpRequestDuration: Histogram
httpRequestsTotal: Counter (by method, route, status)
authLoginTotal: Counter (by result)
bullmqJobsTotal: Counter (by queue, status)
cacheHitRatio: Gauge
mongoOperationDuration: Histogram
activeSessions: Gauge
rateLimitRemaining: Gauge (by endpoint)
```

### Health Check Implementation

```typescript
// /health/live — always 200
app.get('/health/live', (req, res) => res.sendStatus(200));

// /health/ready — checks dependencies
app.get('/health/ready', async (req, res) => {
  const checks = {
    mongo: await mongoConnection.db.admin().ping(),
    redis: await redisClient.ping(),
    bullmq: await worker.isConnected(),
  };
  const healthy = Object.values(checks).every(Boolean);
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
});
```

---

## 20. Security / Threat Model Priorities

*(See Section 13 for STRIDE analysis. Implementation priority below.)*

### MVP Security Checklist

- [ ] Password hashing: bcrypt, cost 10
- [ ] JWT signed with 256-bit secret, `httpOnly`, `secure`, `sameSite: 'strict'`
- [ ] Refresh token rotation + reuse detection
- [ ] Device fingerprinting on login
- [ ] Session store in Redis (not stateless JWTs)
- [ ] RBAC: role check on protected routes
- [ ] ABAC: ownership check on every mutating resource op
- [ ] Rate limiting: IP + user sliding window
- [ ] Input validation: Zod schemas on every request
- [ ] CORS: environment-driven allowlist
- [ ] Helmet: security headers
- [ ] Audit logging: async, tamper-evident
- [ ] Idempotency keys: prevent duplicate writes
- [ ] Optimistic locking: prevent lost updates
- [ ] No sensitive data in logs or responses

### Threat Model Document

Published at `/docs/threat-model.md` with STRIDE entries, risk ratings, and mitigation status. This is the "show don't tell" artifact that proves security thinking.

---

## 21. Testing Strategy

*(See Section 14 for full strategy. Implementation priority below.)*

### Test Execution Order (CI)

1. **Lint** — `npm run lint`
2. **Unit** — `vitest run src/**/*.unit.test.ts`
3. **Integration** — `vitest run src/**/*.integration.test.ts` (Testcontainers for Mongo + Redis)
4. **Contract** — `dredd openapi.yaml http://localhost:3000/api/v1`
5. **Security** — Custom test suite + optional ZAP baseline scan
6. **Performance** — `k6 run --vus 100 --duration 30s load-test.js` (CI), `k6 run --vus 1000 stress-test.js` (manual)

### Critical Test Scenarios

| Scenario | Test Type | Priority |
|----------|-----------|----------|
| Register → login → refresh → logout | Integration | P0 |
| Token reuse detection | Integration | P0 |
| User A deletes User B's post → 403 | Integration | P0 |
| Two clients update same post → 409 | Integration | P0 |
| Duplicate idempotency key → same response | Integration | P0 |
| Cursor pagination: no skip, stable ordering | Integration | P0 |
| Redis down → rate limit fail-open | Integration | P1 |
| Mongo down → structured 503 | Integration | P1 |
| BullMQ job retries on failure, DLQ after exhaustion | Integration | P1 |
| OpenTelemetry trace spans complete | Integration | P2 |
| k6: 1000 concurrent authenticated requests, p95 < 950ms | Performance | P2 |

---

## 22. 2–4 Week Implementation Roadmap

### Week 1: Foundation + Auth + Observability

**Days 1–2: Project scaffolding**
- TypeScript, Express, ESLint, Prettier, Husky
- Mongo connection, Redis connection
- Pino logger, OpenTelemetry setup
- Prometheus metrics endpoint
- Health endpoints
- Error handling middleware (flat error model)

**Days 3–4: Auth module**
- Registration, login, logout
- JWT generation + validation
- Refresh token rotation + reuse detection
- Session management (Redis)
- Device fingerprinting
- Idempotency middleware

**Days 5–7: Users module + tests**
- Profile CRUD
- RBAC + ABAC guard
- Audit logging (BullMQ worker)
- Unit + integration tests for auth/users

### Week 2: Social Core + Caching + Reliability

**Days 8–9: Posts + Comments**
- Post CRUD with optimistic locking (`__v`)
- Comment CRUD, atomic push
- Idempotency key support on all mutating endpoints
- Redis cache-aside for posts

**Days 10–11: Follows + Feed**
- Follow/unfollow (atomic, fanout trigger)
- Cursor-paginated feed (Redis sorted set)
- Cache invalidation strategy

**Days 12–14: Notifications + Tests**
- BullMQ notification worker
- Retry + DLQ
- Security tests, concurrency tests
- Contract tests

### Week 3: Polish + Observability + Testing

**Days 15–17: Observability depth**
- OpenTelemetry traces on all critical paths
- Pino structured logs everywhere
- Prometheus metrics dashboard (Grafana optional, screenshot-worthy)
- Request correlation IDs end-to-end

**Days 18–19: Reliability hardening**
- Graceful shutdown
- Circuit breaker (BullMQ worker level)
- Redis/Mongo failure simulation tests
- Rate limiting tuning

**Days 20–21: Testing + CI**
- k6 load test script + results
- Full CI pipeline (GitHub Actions)
- Security scan (npm audit, manual checklist)
- Performance benchmark documentation

### Week 4: Documentation + Portfolio Packaging

**Days 22–24: Documentation**
- OpenAPI spec (YAML + served endpoint)
- ADRs for key decisions (why BullMQ? why cursor pagination? why Redis sessions?)
- Threat model (STRIDE)
- Architecture diagram
- README with setup instructions, tech stack, feature list

**Days 25–26: Portfolio artifacts**
- Demo data seeder (realistic social data)
- Postman collection
- k6 screenshot/video of passing load test
- Grafana dashboard screenshot (if applicable)
- Recorded demo or annotated API calls

**Days 27–28: Final polish**
- Code review pass
- Lint + test final run
- Git clean, tagged release
- Prepare for deployment (optional: Render/Railway demo)

### Contingency Buffer

If scope feels tight, cut in this order:
1. Comments (posts + follows + feed + notifications is enough)
2. ABAC (RBAC + ownership is enough; document ABAC as future)
3. BullMQ circuit breaker (simple retry is enough)
4. k6 load test (document expected results instead)

---

## 23. Portfolio-Ready Acceptance Criteria

### Functional Completeness

- [ ] `POST /auth/register` — creates user, returns access + refresh tokens
- [ ] `POST /auth/login` — returns tokens, creates session, device fingerprint stored
- [ ] `POST /auth/refresh` — rotates refresh token, detects reuse
- [ ] `POST /auth/logout` — blacklists token, deletes session
- [ ] `GET /users/me` — returns own profile
- [ ] `PATCH /users/me` — updates profile, optimistic locking
- [ ] `POST /users/:id/follow` — follows user, triggers notification
- [ ] `DELETE /users/:id/follow` — unfollows
- [ ] `GET /users/:id/posts` — cursor-paginated user's posts
- [ ] `POST /posts` — creates post, triggers feed fanout
- [ ] `PATCH /posts/:id` — updates own post, optimistic locking
- [ ] `DELETE /posts/:id` — deletes own post
- [ ] `POST /posts/:id/comments` — creates comment, idempotent
- [ ] `GET /feed` — cursor-paginated feed from followed users
- [ ] `GET /notifications` — list own notifications

### Security Verification

- [ ] Token reuse detected → all sessions revoked → alert logged
- [ ] User A cannot modify/delete User B's resources (IDOR test)
- [ ] Rate limit enforced on auth endpoints (10/min)
- [ ] Rate limit enforced on API endpoints (200/min authenticated)
- [ ] Password never returned in API response
- [ ] Audit log captures login, logout, token reuse, post deletion
- [ ] CORS rejects unauthorized origins
- [ ] Helmet headers present

### Observability Verification

- [ ] Every request has `x-request-id` header
- [ ] Pino logs include `traceId` for every request
- [ ] `/metrics` endpoint returns Prometheus metrics
- [ ] `/health/ready` returns 503 when Mongo is down
- [ ] OpenTelemetry traces visible in Jaeger/Tempo
- [ ] Audit logs contain traceId correlating to request

### Reliability Verification

- [ ] `POST /posts` with duplicate `Idempotency-Key` → same response, no duplicate post
- [ ] Concurrent updates to same post → one succeeds, one gets 409
- [ ] BullMQ job retries on failure, appears in DLQ after max retries
- [ ] Graceful shutdown: in-flight jobs complete, no data loss
- [ ] Redis down → rate limiting fail-open, cache miss
- [ ] Mongo down → structured 503, no crash

### Performance Verification

- [ ] k6: 1000 concurrent authenticated users, p95 < 950ms
- [ ] Cursor pagination: 1000 items paginated in < 50ms
- [ ] Cache hit ratio > 80% for hot posts
- [ ] Feed generation (fanout): < 200ms for user with 1000 followers

### Testing Verification

- [ ] Unit test coverage > 80%
- [ ] Integration tests cover all 15 functional endpoints
- [ ] Contract tests verify OpenAPI compliance
- [ ] Security tests pass (OWASP Top 10)
- [ ] Concurrency tests pass (optimistic locking, race conditions)
- [ ] CI pipeline green on all checks

### Documentation Verification

- [ ] README with setup, architecture diagram, feature list
- [ ] OpenAPI spec served at `/docs/openapi.yaml`
- [ ] ADRs for: modular monolith, BullMQ, Redis sessions, cursor pagination, optimistic locking
- [ ] Threat model (STRIDE) at `/docs/threat-model.md`
- [ ] Postman collection exported
- [ ] k6 load test results documented

---

## Open Questions (Resolve Before Building)

1. **Idempotency key location:** Header `Idempotency-Key` or request body field? Header is REST-standard; body is more explicit. Recommendation: header for POSTs, auto-generated for webhook retries.
2. **Feed fanout strategy:** Write fanout (post created → push to all followers) vs. read fanout (aggregate on read). For MVP with expected < 1k followers per user, write fanout is simpler and faster for reads. Document threshold for switching to read fanout.
3. **Notification delivery:** MVP stores notifications in Mongo; real delivery (email, push) is future. Should the API return `notification.unreadCount` in user profile? Yes, cheap and useful.
4. **ABAC granularity:** Do we need field-level ABAC (hide `bio` if private) or endpoint-level only? MVP: endpoint-level + `profilePublic` flag. Document field-level as future.
5. **Cursor encoding:** Opaque cursor (base64 of `{ lastId, createdAt }`) vs. simple `createdAt` + `id`. Opaque is more flexible; simple is easier to debug. Recommendation: opaque for production realism.

---

*Document version: 1.0*
*Last updated: 2026-08-09*
*Status: Converged — ready for implementation*
