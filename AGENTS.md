# AGENTS.md

## Project Overview

A secure, production-style REST API portfolio project built with Node.js, Express 5, and MongoDB. Demonstrates clean architecture with repository pattern, JWT authentication with HTTP-only cookies, token refresh/rotation with Redis blacklist, RBAC + ABAC authorization, ownership-based access control, Zod request validation, idempotency, Redis-backed rate limiting, correlation IDs, structured logging, metrics, and asynchronous notifications via BullMQ. Backend-only by design — no UI.

## Tech Stack

- **Node.js** (>= 20, currently 26) with ES Modules (`"type": "module"`)
- **Express** 5.x
- **MongoDB** via Mongoose 9 (app data)
- **Redis** via ioredis 6 (rate limiting store, token blacklist, session revocation, idempotency, BullMQ backend)
- **BullMQ** for durable background notification delivery with bounded retry and dead-letter queue
- **JWT** auth with `jsonwebtoken`, access + refresh tokens in HTTP-only cookies
- **express-rate-limit** + **rate-limit-redis** for rate limiting
- **Zod** v4 for request validation
- **cookie-parser** for cookie handling
- **js-yaml** for OpenAPI spec loading

## Commands

All commands run from `backend/`:

- `npm install` — install dependencies
- `npm run dev` — start with nodemon watch
- `npm run dev-watch` — start with native node `--watch`
- `npm start` — start server
- `npm test` — run vitest (integration + performance + e2e)
- `npm run test:watch` — vitest watch mode
- `npm run test:coverage` — vitest with V8 coverage
- `npm run contract:lint` — validate OpenAPI spec with redocly
- `npm run contract:sync` — sync docs to specs directory
- Verify individual files with `node --check <file>`

## Environment Variables

Copy to `backend/.env`:

- `MONGODB_URI` — MongoDB cloud URI (main app database)
- `REDIS_DB_URI` — Redis URI (optional; falls back to in-memory in test)
- `PORT` — server port (default 1430)
- `NODE_ENV` — `production`, `development`, or `test`
- `JWT_AUTH_KEY` — access token signing secret
- `JWT_REFRESH_KEY` — refresh token signing secret
- `JWT_ACCESS_EXPIRES_IN` — e.g. `5m`
- `JWT_REFRESH_EXPIRES_IN` — e.g. `15m`
- `ALLOWED_ORIGINS` — comma-separated CORS origins (required for CORS)
- `API_RATE_LIMIT` — max requests per window (default 200)
- `API_RATE_WINDOW_MS` — rate limit window in ms (default 900000)
- `LOGIN_RATE_LIMIT` — max login attempts per window (default 5)
- `LOGIN_RATE_WINDOW_MS` — login limit window in ms (default 300000)
- `API_SOCIAL_RATE_LIMIT` — max social mutation requests per window (default 60)
- `API_SOCIAL_RATE_WINDOW_MS` — social mutation limit window in ms (default 900000)
- `BULLMQ_URL` — Redis URI for BullMQ (defaults to `REDIS_DB_URI` or `redis://127.0.0.1:6379`)
- `FEED_CACHE_TTL_SECONDS` — feed cache TTL (default 300)
- `SESSION_IDLE_TTL_SECONDS` — session idle TTL (default 2592000)
- `IDEMPOTENCY_TTL_DAYS` — idempotency key TTL (default 7)
- `HEALTH_TIMEOUT_MS` — health check timeout (default 5000)
- `GRACEFUL_SHUTDOWN_HTTP_TIMEOUT_MS` — HTTP shutdown timeout (default 10000)
- `GRACEFUL_SHUTDOWN_JOBS_TIMEOUT_MS` — background jobs shutdown timeout (default 30000)

## Architecture

```
backend/src/
├── app.js                      — Express app wiring
├── index.js                    — server entrypoint + seed bootstrap + graceful shutdown
├── configs/
│   ├── config.js               — Centralized env access (no scattered process.env)
│   ├── constants.js            — rate-limit & token constants
│   ├── cors.js                 — environment-driven origin allowlist
│   ├── database.js             — Mongoose connection + index build
│   ├── redis.js                — ioredis singleton (or in-memory in test)
│   └── seed.js                 — dev seed for roles & permissions
├── controller/
│   ├── auth.controller.js      — session list/revoke
│   ├── comment.controller.js   — comment CRUD
│   ├── error.controller.js     — 404 handler
│   ├── follow.controller.js    — follow/unfollow
│   ├── health.controller.js    — liveness & readiness probes
│   ├── like.controller.js      — like/unlike
│   ├── notification.controller.js — notification list/read
│   ├── post.controller.js      — post CRUD + feed
│   ├── refresh_token.controller.js — token rotation
│   └── user.controller.js      — registration, login, logout, delete
├── controllers/
│   └── admin.controller.js     — role & permission CRUD
├── docs/
│   ├── extension-pattern.md    — guide for adding new resources
│   └── openapi/
│       └── contract-check.js   — validates implementation matches contract
├── middleware/
│   ├── auth.middleware.js       — JWT verify + blacklist check + user/permissions attach
│   ├── authlimiter.middleware.js — strict login endpoint limiter (5 / 5 min)
│   ├── correlation.middleware.js — AsyncLocalStorage correlation IDs
│   ├── cors.middleware.js      — CORS origin validation + preflight
│   ├── error.middleware.js     — fail-fast + envelope shaping
│   ├── idempotency.middleware.js — Redis-backed dedup via Idempotency-Key header
│   ├── ratelimiter.middleware.js — global API limiter (200 / 15 min) + social mutation limiter (60 / 15 min)
│   ├── role.middleware.js      — RBAC (requirePermission) + inline ABAC attributes
│   └── validate.middleware.js  — Zod schema validation
├── models/
│   ├── audit-log.model.js      — security event audit trail
│   ├── comment.model.js        — post comments with optimistic lock
│   ├── follow.model.js         — user follow relationships
│   ├── like.model.js           — post likes with uniqueness
│   ├── notification.model.js   — async notification deliveries
│   ├── permission.model.js     — code, description
│   ├── post.model.js           — name, description, age, author (ref: User), visibility, version
│   ├── role.model.js           — name, permissions (ref: Permission)
│   ├── session.model.js        — refresh token sessions with jti, idle TTL
│   └── user.model.js           — username, email, password (hashed), roles (ref: Role)
├── repositories/
│   ├── interfaces/             — Pure abstract contracts (no ORM)
│   │   ├── audit-log.repository.js
│   │   ├── comment.repository.js
│   │   ├── follow.repository.js
│   │   ├── like.repository.js
│   │   ├── notification.repository.js
│   │   ├── permission.repository.js
│   │   ├── post.repository.js
│   │   ├── role.repository.js
│   │   ├── session.repository.js
│   │   └── user.repository.js
│   └── implementations/
│       └── mongoose/           — Production Mongoose-backed implementations
│           ├── audit-log.repository.js
│           ├── comment.repository.js
│           ├── follow.repository.js
│           ├── like.repository.js
│           ├── notification.repository.js
│           ├── permission.repository.js
│           ├── post.repository.js
│           ├── role.repository.js
│           ├── session.repository.js
│           └── user.repository.js
├── routes/
│   ├── admin.routes.js         — runtime role/permission management
│   ├── auth.routes.js          — register, login, refresh, session management
│   ├── comment.routes.js       — comments on posts
│   ├── follow.routes.js        — follow/unollow users
│   ├── like.routes.js          — like/unlike posts
│   ├── notification.routes.js  — notification list/read
│   ├── post.routes.js          — post CRUD + feed
│   └── user.routes.js          — account management
├── service/
│   ├── audit.service.js        — audit event writer (wired in app.js via AuditLog repository)
│   ├── auth.service.js         — registration, login, delete, JTI generation
│   ├── comment.service.js      — comment CRUD with optimistic locking + audit
│   ├── error.service.js        — classifies errors, generates traceId
│   ├── feed.service.js         — cursor-paginated feed with Redis write-fanout cache
│   ├── follow.service.js       — atomic follow/unfollow + notification dispatch
│   ├── like.service.js         — like/unlike with uniqueness + notification dispatch
│   ├── notification.queue.js   — queue facade for notification jobs
│   ├── notification.service.js — notification delivery
│   ├── post.service.js         — post CRUD with ownership checks + audit
│   └── session.service.js      — session management + idle sweep
├── utils/
│   ├── errors.js               — stable error codes & envelope definitions
│   ├── generateToken.js        — JWT access + refresh generation
│   ├── logger.js               — structured JSON logger (redacts secrets/PII)
│   ├── metrics.js              — in-memory counters + duration histograms
│   └── response.js             — JSON envelope helper
├── validators/
│   ├── admin.validator.js      — role & permission schemas
│   ├── auth.validator.js       — register, login schemas
│   ├── comment.validator.js    — comment schemas
│   ├── follow.validator.js     — follow schemas
│   ├── like.validator.js       — like schemas
│   ├── notification.validator.js — notification schemas
│   ├── post.validator.js       — create, update schemas
│   ├── session.validator.js    — session schemas
│   └── user.validator.js       — assign roles schema
└── workers/
    └── notification.worker.js  — BullMQ worker + inline fallback for notifications
```

### Dependency Rules

- **Controllers** never import Mongoose models or talk to Redis directly.
- **Services** depend only on repository **interfaces**, not on Mongoose.
- **Repositories** isolate persistence and own indexes and query batching.
- **Middleware** handles cross-cutting concerns (auth, RBAC, rate limit, CORS, validation, error mapping).
- **Models** are pure schemas; no service logic.
- **Workers** handle durable background processing; services publish jobs through a queue facade.

### Middleware Pipeline (app.js order)

1. `express.json()` + `cookieParser()`
2. `corsMiddleware` — origin validation
3. `correlationMiddleware` — AsyncLocalStorage correlation IDs
4. `metricsMiddleware` — request duration/status counters
5. Health routes (unprotected)
6. Route mounts:
   - `/api/v1/auth` — authLimiter on public routes + session routes
   - `/api/v1/users` — authMiddleware + user routes
   - `/api/v1/posts` — authMiddleware + apiLimiter + post routes + comment routes + like routes
   - `/api/v1/users` — authMiddleware + socialMutationLimiter + follow routes
   - `/api/v1/feed` — authMiddleware + apiLimiter + feed routes
   - `/api/v1/notifications` — authMiddleware + apiLimiter + notification routes
   - `/api/v1/admin` — authMiddleware + admin routes
7. `notFoundHandler` — 404 catch-all
8. `errorHandler` — envelope shaping

## Key Conventions

- ES modules (`import`/`export`) everywhere; default exports for middleware/store instances, named exports elsewhere.
- Controllers stay thin; logic lives in `service/`.
- Services depend on repository interfaces; implementations are instantiated directly (no DI container).
- Sensitive fields (password, token, secret, cookie) are excluded from responses, `populate()`, and redacted from logs.
- Rate limiters use `sendCommand: (...args) => redisClient.call(...args)` with `rate-limit-redis`; do not pass the redis client directly.
- Request identification: authenticated requests key rate limits by `user:<id>`, public endpoints by IP (`ipKeyGenerator`).
- Routes are prefixed under `/api/v1`.
- Passwords hashed with bcrypt before storage; never log secrets or tokens.
- Validation uses Zod schemas at the controller boundary via `validate.middleware.js`.
- Idempotency: POST/PATCH/PUT/DELETE with `Idempotency-Key` header is deduplicated via Redis SET NX (7-day TTL).
- Correlation IDs: `X-Correlation-Id` header propagated via AsyncLocalStorage; included in all logs.
- Social events (follow, like, comment) publish notification jobs through a queue facade; a BullMQ worker delivers them asynchronously with bounded retry and dead-letter handling.
- Audit events are persisted through the AuditLog repository for security-relevant actions.

## API Endpoints (summary)

### Auth
- `POST /api/v1/auth` — register (rate-limited)
- `POST /api/v1/auth/login` — login (rate-limited)
- `POST /api/v1/auth/logout` — invalidate refresh token (auth required)
- `POST /api/v1/auth/refresh` — rotate refresh token (rate-limited)
- `DELETE /api/v1/auth/me` — delete own account (auth required)
- `GET /api/v1/auth/sessions` — list own sessions (auth required)
- `DELETE /api/v1/auth/sessions/:id` — revoke session (auth required)

### Users
- `GET /api/v1/users` — list users (admin)
- `GET /api/v1/users/:id` — get user by ID (admin)
- `POST /api/v1/users/:id/roles` — assign roles (admin)

### Posts (authenticated, permission-gated)
- `POST /api/v1/posts` — create post (`posts:create`)
- `GET /api/v1/posts/me` — list own posts (`posts:read`)
- `GET /api/v1/posts` — list all posts (`posts:read`)
- `PATCH /api/v1/posts/:id` — update own post (`posts:update`)
- `DELETE /api/v1/posts/:id` — delete own post (`posts:delete`)

### Comments (authenticated, permission-gated)
- `POST /api/v1/posts/:id/comments` — comment on post (`comments:create`)
- `GET /api/v1/posts/:id/comments` — list comments (`comments:read`)

### Follows (authenticated, permission-gated)
- `POST /api/v1/users/:id/follow` — follow user (`follows:create`)
- `DELETE /api/v1/users/:id/unfollow` — unfollow user (`follows:delete`)

### Likes (authenticated, permission-gated)
- `POST /api/v1/posts/:id/likes` — like post (`likes:create`, social mutation limiter)
- `DELETE /api/v1/posts/:id/likes` — unlike post (`likes:delete`, social mutation limiter)
- `GET /api/v1/posts/:id/likes/me` — check if liked (`likes:read`)

### Feed (authenticated, permission-gated)
- `GET /api/v1/feed` — cursor-paginated personalized feed (`feed:read`)

### Notifications (authenticated, permission-gated)
- `GET /api/v1/notifications` — list own notifications (`notifications:read`)
- `PATCH /api/v1/notifications/:id/read` — mark as read (`notifications:update`)

### Admin (authenticated, admin role required)
- `GET /api/v1/admin/roles` — list roles
- `GET /api/v1/admin/roles/:id` — get role
- `POST /api/v1/admin/roles` — create role
- `PATCH /api/v1/admin/roles/:id` — update role
- `DELETE /api/v1/admin/roles/:id` — delete role
- `GET /api/v1/admin/permissions` — list permissions
- `GET /api/v1/admin/permissions/:id` — get permission
- `POST /api/v1/admin/permissions` — create permission
- `PATCH /api/v1/admin/permissions/:id` — update permission
- `DELETE /api/v1/admin/permissions/:id` — delete permission

### Health (unprotected)
- `GET /api/v1/health` — liveness probe
- `GET /api/v1/health/ready` — readiness probe (Mongo + Redis)

## Authentication & Authorization

**Authentication** is JWT with two tokens:
- **Access token** — short-lived (default 5m), HTTP-only cookie (`access_token`), validated on every protected request.
- **Refresh token** — longer-lived (default 15m), HTTP-only cookie (`refresh_token`), rotated on every refresh. Old refresh tokens are blacklisted in Redis with TTL = remaining lifetime.
- **Session model**: refresh tokens are tracked as `Session` documents with `jti`, `expiresAt`, and idle TTL. A background sweep removes inactive sessions per `SESSION_IDLE_TTL_SECONDS`.
- **Session revocation**: access tokens carry a `sid` claim; revoking a session writes `session:revoked:<sid>` in Redis.
- **Multi-session support**: each refresh token gets a unique `jti`.

**Authorization** is RBAC + inline ABAC:
- `requirePermission("posts:delete")` — checks `req.user.permissions` array.
- Inline ABAC: `requirePermission("posts:update", { attributes: ctx => ctx.user._id === ctx.params.id })` evaluates arbitrary predicates against user/params/query/body per request.
- Permissions and roles are stored in DB, seeded on boot in development, and manageable at runtime via the admin API.
- Adding a role or permission does not require touching endpoint code.

**Ownership** is enforced in the service layer:
- A user can only PATCH or DELETE their own posts.
- A deleted user's tokens become inert because the auth middleware re-resolves the user on every request.
- A revoked role or missing permission is re-evaluated per request — no cached authorization.

## Error Model

All error responses use a **flat envelope**: `{ code, message, traceId }`.

Stable codes (defined in `src/utils/errors.js`):

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request body or params failed validation |
| `UNAUTHORIZED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Bad email or password |
| `AUTH_REUSE_DETECTED` | 401 | Refresh token reuse detected |
| `FORBIDDEN` | 403 | Permission denied |
| `ROLE_DENIED` | 403 | Required role or permission missing |
| `OWNERSHIP_REQUIRED` | 403 | Caller is not the resource owner |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | State conflict (e.g. duplicate) |
| `IDEMPOTENCY_CONFLICT` | 409 | Concurrent request with same idempotency key |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `DEPENDENCY_FAILURE` | 503 | External dependency is unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected error |

No category field, no retry guidance, no HTTP-text duplication.

## Rate Limiting

| Scope | Default | Window | Key |
|-------|---------|--------|-----|
| Global API (authenticated) | 200 requests | 15 min | `user:<id>` |
| Global API (public) | 200 requests | 15 min | IP |
| Login (`POST /auth/login`) | 5 requests | 5 min | IP |
| Social mutations | 60 requests | 15 min | `user:<id>` |

Limiter state is shared across processes via Redis.

## Testing

- **Framework**: Vitest v4 + Supertest + mongodb-memory-server
- **Integration tests**: `tests/integration/` — auth, RBAC, ownership, errors, CORS, architecture, contract, sessions, follow, like, notifications, rate limit
- **E2E tests**: `tests/e2e/` — full flows (auth, post CRUD, social flows)
- **Performance tests**: `tests/performance/` — feed cache hit rate, pagination & rate-limit latency, load (p95 < 950ms)
- **Contract validation**: `src/docs/contract-check.js` — verifies implementation matches OpenAPI spec

## OpenAPI Contract

- Root: `specs/002-trustfeed-social-api/contracts/openapi.yaml` (canonical)
- Components: `specs/002-trustfeed-social-api/contracts/components/` (schemas, responses, security, headers)
- Paths: `specs/002-trustfeed-social-api/contracts/paths/` (auth, posts, comments, follows, likes, feed, notifications, users, health)
- Published copy: `backend/src/docs/openapi/` — must stay byte-identical to canonical (`contract:sync` regenerates it)
- Validate: `npm run contract:lint`
- Sync: `npm run contract:sync`

## Notable Current State

- `audit.service.js` is wired in `app.js` through the `AuditLog` repository; security-relevant events are persisted with correlation IDs.
- `refresh-token.model.js` and its repository exist but the auth flow stores refresh tokens as plain strings in Redis (`auth:refresh:<userId>`) rather than in MongoDB; the `Session` model is the active implementation for session tracking and idle sweep.
- `requireAttributes` is integrated into `requirePermission` as an optional inline ABAC parameter (`attributes`); no standalone `requireAttributes` middleware is exported.
- Health endpoints are unprotected (no auth middleware).
