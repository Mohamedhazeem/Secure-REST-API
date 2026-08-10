# AGENTS.md

## Project Overview

A secure, production-style REST API portfolio project built with Node.js, Express 5, and MongoDB. Demonstrates clean architecture with repository pattern, JWT authentication with HTTP-only cookies, token refresh/rotation with Redis blacklist, RBAC + ABAC authorization, ownership-based access control, Zod request validation, idempotency, Redis-backed rate limiting, correlation IDs, structured logging, and metrics. Backend-only by design — no UI.

## Tech Stack

- **Node.js** (>= 20, currently 26) with ES Modules (`"type": "module"`)
- **Express** 5.x
- **MongoDB** via Mongoose 9 (app data)
- **Redis** via ioredis 6 (rate limiting store, token blacklist, session revocation, idempotency)
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
- `npm test` — run vitest (integration + e2e + performance)
- `npm run test:watch` — vitest watch mode
- `npm run test:coverage` — vitest with V8 coverage
- `npm run e2e` — run Newman Postman collections
- `npm run contract:lint` — validate OpenAPI spec with redocly
- `npm run contract:sync` — copy docs to specs directory
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

## Architecture

```
backend/src/
├── app.js                      — Express app wiring
├── index.js                    — server entrypoint + seed bootstrap
├── configs/
│   ├── config.js               — Centralized env access (no scattered process.env)
│   ├── constants.js            — rate-limit & token constants
│   ├── cors.js                 — environment-driven origin allowlist
│   ├── database.js             — Mongoose connection
│   ├── redis.js                — ioredis singleton (or in-memory in test)
│   └── seed.js                 — dev seed for roles & permissions
├── controller/
│   ├── auth.controller.js      — register, login, logout, refresh, delete account
│   ├── error.controller.js     — 404 handler
│   ├── health.controller.js    — liveness & readiness probes
│   ├── post.controller.js      — CRUD for posts
│   ├── refresh_token.controller.js — token rotation
│   └── user.controller.js      — user management
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
│   ├── ratelimiter.middleware.js — global API limiter (200 / 15 min)
│   ├── role.middleware.js      — RBAC (requirePermission) + ABAC (requireAttributes)
│   └── validate.middleware.js  — Zod schema validation
├── models/
│   ├── permission.model.js     — code, description
│   ├── post.model.js           — name, description, age, author (ref: User)
│   ├── refresh-token.model.js  — tokenId (jti), userId, expiresAt, revokedAt
│   ├── role.model.js           — name, permissions (ref: Permission)
│   └── user.model.js           — username, email, password (hashed), roles (ref: Role)
├── repositories/
│   ├── interfaces/             — Pure abstract contracts (no ORM)
│   │   ├── permission.repository.js
│   │   ├── post.repository.js
│   │   ├── refresh.repository.js
│   │   ├── role.repository.js
│   │   └── user.repository.js
│   └── implementations/
│       └── mongoose/           — Production Mongoose-backed implementations
│           ├── permission.repository.js
│           ├── post.repository.js
│           ├── refresh.repository.js
│           ├── role.repository.js
│           └── user.repository.js
├── routes/
│   ├── auth.routes.js
│   ├── post.routes.js
│   └── user.routes.js
├── service/
│   ├── audit.service.js        — audit event writer (not yet wired in app.js)
│   ├── error.service.js        — classifies errors, generates traceId
│   ├── post.service.js         — post CRUD with ownership checks
│   └── user.service.js         — registration, login, delete, JTI generation
├── utils/
│   ├── errors.js               — stable error codes & envelope definitions
│   ├── generateToken.js        — JWT access + refresh generation
│   ├── logger.js               — structured JSON logger (redacts secrets/PII)
│   ├── metrics.js              — in-memory counters + duration histograms
│   └── response.js             — JSON envelope helper
└── validators/
    ├── auth.validator.js        — register, login schemas
    ├── post.validator.js        — create, update schemas
    └── user.validator.js        — assign roles schema
```

### Dependency Rules

- **Controllers** never import Mongoose models or talk to Redis directly.
- **Services** depend only on repository **interfaces**, not on Mongoose.
- **Repositories** isolate persistence and own indexes and query batching.
- **Middleware** handles cross-cutting concerns (auth, RBAC, rate limit, CORS, validation, error mapping).
- **Models** are pure schemas; no service logic.

### Middleware Pipeline (app.js order)

1. `express.json()` + `cookieParser()`
2. `corsMiddleware` — origin validation
3. `correlationMiddleware` — AsyncLocalStorage correlation IDs
4. `metricsMiddleware` — request duration/status counters
5. Health routes (unprotected)
6. Route mounts:
   - `/api/v1/auth` — authLimiter on public routes
   - `/api/v1/posts` — authMiddleware + apiLimiter + requirePermission
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
- Idempotency: POST/PATCH/PUT/DELETE with `Idempotency-Key` header is deduplicated via Redis SET NX.
- Correlation IDs: `X-Correlation-Id` header propagated via AsyncLocalStorage; included in all logs.

## API Endpoints (summary)

### Auth
- `POST /api/v1/auth` — register (rate-limited)
- `POST /api/v1/auth/login` — login (rate-limited)
- `POST /api/v1/auth/logout` — invalidate refresh token (auth required)
- `POST /api/v1/auth/refresh` — rotate refresh token (rate-limited)
- `DELETE /api/v1/auth/me` — delete own account (auth required)

### Users
- Routes defined in `user.routes.js` (role assignment, etc.)

### Posts (authenticated, permission-gated)
- `POST /api/v1/posts` — create post (`posts:create`)
- `GET /api/v1/posts/me` — list own posts (`posts:read`)
- `GET /api/v1/posts` — list all posts (`posts:read`)
- `PATCH /api/v1/posts/:id` — update own post (`posts:update`)
- `DELETE /api/v1/posts/:id` — delete own post (`posts:delete`)

### Health (unprotected)
- `GET /api/v1/health` — liveness probe
- `GET /api/v1/health/ready` — readiness probe (Mongo + Redis)

## Authentication & Authorization

**Authentication** is JWT with two tokens:
- **Access token** — short-lived (default 5m), HTTP-only cookie (`access_token`), validated on every protected request.
- **Refresh token** — longer-lived (default 15m), HTTP-only cookie (`refresh_token`), rotated on every refresh. Old refresh tokens are blacklisted in Redis with TTL = remaining lifetime.
- **Session revocation**: access tokens carry a `sid` claim; revoking a session writes `session:revoked:<sid>` in Redis.
- **Multi-session support**: each refresh token gets a unique `jti`.

**Authorization** is RBAC + ABAC:
- `requirePermission("posts:delete")` — checks `req.user.permissions` array.
- `requireAttributes(evaluate)` — evaluates arbitrary predicates against user/params/query/body.
- Permissions and roles are stored in DB and seeded on boot in development.
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

Limiter state is shared across processes via Redis.

## Testing

- **Framework**: Vitest v4 + Supertest + mongodb-memory-server
- **Integration tests**: `tests/integration/` — auth, RBAC, ownership, errors, CORS, architecture, contract
- **E2E tests**: `tests/e2e/` — full flows against live server
- **Performance tests**: `tests/performance/` — pagination & rate-limit latency (p95 < 950ms)
- **Contract validation**: `src/docs/contract-check.js` — verifies implementation matches OpenAPI spec

## OpenAPI Contract

- Root: `specs/002-trustfeed-social-api/contracts/openapi.yaml` (canonical)
- Components: `specs/002-trustfeed-social-api/contracts/components/` (schemas, responses, security)
- Paths: `specs/002-trustfeed-social-api/contracts/paths/` (auth, posts)
- Published copy: `backend/src/docs/openapi/` — must stay byte-identical to canonical (`contract:sync` regenerates it)
- Validate: `npm run contract:lint`
- Sync: `npm run contract:sync`

## Notable Current State

- `audit.service.js` has a `setAuditWriter` function but is not wired in `app.js` or `index.js` — audit events are skipped.
- `refresh-token.model.js` and its repository exist but the auth flow stores refresh tokens as plain strings in Redis (`auth:refresh:<userId>`), not in MongoDB.
- `requireAttributes` ABAC middleware is implemented but no route currently uses it.
- Health endpoints are unprotected (no auth middleware).
