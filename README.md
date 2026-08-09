# Secure REST API

A production-grade, secure REST API built with Node.js, Express 5, and MongoDB. Designed around clean architecture, SOLID principles, role-based access control, and defense-in-depth security. The codebase is the contract: a published machine-readable OpenAPI specification, layered separation of concerns, and a documented extension pattern that lets a developer add a new resource without touching existing code.

> Backend only. No UI by design. The API is consumed by clients built from the OpenAPI contract.

<p align="center">
  <img src="assets/cover.svg" alt="Secure REST API — Clean architecture, defense-in-depth security, stable API contract" width="100%">
</p>

---

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [Project Goals](#project-goals)
- [Problems It Solves](#problems-it-solves)
- [Implementation Status](#implementation-status)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [API Surface](#api-surface)
- [Authentication, Authorization & Ownership](#authentication-authorization--ownership)
- [Rate Limiting](#rate-limiting)
- [Error Model](#error-model)
- [CORS & API Contract](#cors--api-contract)
- [Repository Pattern & Persistence Swap](#repository-pattern--persistence-swap)
- [Testing Strategy](#testing-strategy)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Adding a New Resource](#adding-a-new-resource)
- [Performance Targets](#performance-targets)
- [License](#license)
- [Author](#author)

---

## Why This Project Exists

Most portfolio REST APIs stop at "register, login, CRUD". That proves the obvious. They don't prove you can:

- Keep business rules independent of the framework, database, or transport.
- Resist a security review without breaking legitimate traffic.
- Add a feature without rewriting or risking existing endpoints.
- Give consumers a stable, machine-readable contract they can code against.
- Fail predictably when dependencies misbehave.

This project does. It is the working artifact behind `specs/001-secure-clean-arch/` and is structured so a technical evaluator can verify the architecture from the directory layout alone.

---

## Project Goals

1. **Clean Architecture & SOLID.** Domain logic is isolated from transport (Express), persistence (Mongoose), and external services (Redis, native MongoDB driver). Dependencies point inward.
2. **Extensibility without regression.** Adding a new resource means creating new files in a documented pattern. Existing handlers, services, and routes are not modified.
3. **Defense-in-depth security.** JWT with HTTP-only cookies, rotating refresh tokens with a Redis-backed blacklist, bcrypt-hashed passwords, per-caller rate limiting, RBAC, and ownership checks on every mutating operation.
4. **Stable, machine-readable API contract.** Every public endpoint is documented in a versioned OpenAPI YAML. The contract is the source of truth for integration.
5. **Testable at every layer.** Unit, integration, performance, and end-to-end tests cover the domain rules, the HTTP boundary, the rate limiter, and the contract.
6. **Predictable failure.** A flat error envelope with stable codes and trace references. No hidden retries, no silent fallbacks, no category fields.
7. **CORS-ready for browser clients.** Environment-driven origin allowlist with credentials and preflight handled correctly.

---

## Problems It Solves

| Problem                                        | How this project addresses it                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Business rules coupled to Express and Mongoose | Services depend only on repository interfaces; controllers stay thin                                 |
| Every feature change risks regressions         | New resources are added by creating new files; existing code is untouched                            |
| Brute-force login attacks                      | Per-IP login limiter (default 5 / 5 min) backed by Redis                                             |
| Token theft via XSS                            | Tokens stored in HTTP-only cookies; never readable from JavaScript                                   |
| Stale refresh tokens reused after theft        | Refresh tokens are rotated and added to a Redis blacklist with TTL                                   |
| A user modifying someone else's data           | Ownership is enforced in the service layer on every mutating operation                               |
| All-or-nothing admin access                    | Role-based access control with configurable roles and permissions, evaluated per-request             |
| Consumers integrating against outdated docs    | OpenAPI YAML is the contract; it is updated alongside the implementation                             |
| Undiagnosable errors for callers               | Flat error envelope: `code`, `message`, `traceId`. Stable codes, no retry guidance baked in          |
| Silent failures when MongoDB or Redis is down  | Fail-fast: dependency errors are detected and returned as `DEPENDENCY_FAILURE` with a 503            |
| N+1 queries degrading list endpoints           | Repositories batch their lookups; pagination is enforced at the service boundary                     |
| Slow APIs under load                           | Sub-second p95 target under 1000 concurrent authenticated requests; performance tests gate the build |
| Browser clients blocked by CORS                | Environment-driven origin allowlist with credentials and preflight handling                          |

---

## Key Features

**Architecture**

- Clean architecture: `routes → controllers → services → repositories → models`
- Repository pattern with Mongoose and in-memory implementations
- Centralized configuration (`src/configs/config.js`) — no scattered `process.env`
- Zod-based request validation at the HTTP boundary
- Documented extension pattern (`src/docs/extension-pattern.md`) for adding new resources without modifying existing files
- Hot-path Big-O complexity documented in code comments

**Security**

- JWT authentication (HTTP-only cookies, never exposed to JS)
- Refresh token rotation with Redis-backed blacklist and TTL
- bcrypt password hashing; secrets excluded from responses and logs
- Per-caller rate limiting (authenticated by `userId`, public by IP)
- Strict login limiter to deter credential stuffing
- RBAC middleware (`requireRole`, `requirePermission`)
- Ownership checks in the service layer on every mutating operation
- Structured logger that redacts secrets and PII
- Dev seed data for roles and permissions (`configs/seed.js`) bootstrapped in development mode

**API Quality**

- Versioned, machine-readable OpenAPI specification as the integration contract
- Flat error model with stable codes and trace references
- Fail-fast behavior on dependency failures (no silent retries)
- CORS with environment-driven origin allowlist and credentials

**Data**

- MongoDB via Mongoose for application data
- Native MongoDB driver for read-only `sample_mflix` access (movies endpoint)
- Pagination on list endpoints
- Indexes declared at the repository layer
- N+1 queries audited and prevented on post and movie list endpoints; population is batched

**Testing**

- Vitest unit tests against in-memory repositories
- Integration tests against `mongodb-memory-server` + Supertest (auth, RBAC, ownership, CORS, errors, architecture)
- Performance tests for pagination and rate limiting
- End-to-end Newman (Postman collection) tests against the live server

---

## Architecture

### Layered model

```
HTTP Request
    │
    ▼
routes ──► middleware (auth, RBAC, rate limit, validation, CORS)
    │
    ▼
controllers ──► thin: parse input, call service, return response envelope
    │
    ▼
services ──► business rules; depend only on repository interfaces
    │
    ▼
repositories ──► persistence boundary; Mongoose today, anything tomorrow
    │
    ▼
models / Redis / native MongoDB driver
```

### Dependency rules

- **Controllers** never import Mongoose models or talk to Redis directly.
- **Services** depend only on repository **interfaces**, not on Mongoose.
- **Repositories** isolate persistence and own indexes and query batching.
- **Middleware** handles cross-cutting concerns (auth, RBAC, rate limit, CORS, validation, error mapping).
- **Models** are pure schemas; no service logic.

The result: you can swap Mongoose for SQL, replace Redis with another store, or move from Express to another framework without rewriting business rules.

See [`backend/src/docs/extension-pattern.md`](backend/src/docs/extension-pattern.md) for the full step-by-step guide.

---

## Tech Stack

| Concern                      | Choice                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Runtime                      | Node.js ≥ 20 with ES modules (`"type": "module"`)                             |
| HTTP framework               | Express 5                                                                     |
| Application database         | MongoDB via Mongoose 9 (app data)                                             |
| External database access     | Native MongoDB driver (read-only `sample_mflix` movies)                       |
| Cache / rate-limit store     | Redis via ioredis                                                             |
| Rate limiting                | `express-rate-limit` + `rate-limit-redis` (per-caller keys: `userId` or IP)   |
| Authentication               | `jsonwebtoken` (access + refresh), HTTP-only cookies                          |
| Password hashing             | `bcrypt`                                                                      |
| Request validation           | Zod schemas at the controller boundary                                        |
| Logging                      | Custom structured logger (`src/utils/logger.js`)                              |
| Configuration                | Centralized env access (`src/configs/config.js`) — no scattered `process.env` |
| Testing — unit & integration | Vitest + Supertest + `mongodb-memory-server`                                  |
| Testing — performance        | Vitest (pagination throughput, rate-limit fairness)                           |
| Testing — end-to-end         | Newman running Postman collections (`backend/postman/`)                       |

---

## Folder Structure

```
backend/
├── src/
│   ├── app.js                      Express app wiring
│   ├── index.js                    Server entrypoint
│   ├── configs/
│   │   ├── config.js               Centralized env access
│   │   ├── constants.js            Rate-limit & token constants
│   │   ├── cors.js                 Environment-driven origin allowlist
│   │   ├── database.js             Mongoose + native MongoDB connections
│   │   ├── redis.js                ioredis singleton
│   │   └── seed.js                 Dev seed for roles & permissions
│   ├── controller/
│   │   ├── auth.controller.js
│   │   ├── error.controller.js
│   │   ├── movie.controller.js
│   │   ├── post.controller.js
│   │   ├── refresh_token.controller.js
│   │   └── user.controller.js
│   ├── docs/
│   │   └── extension-pattern.md    How to add a new resource
│   ├── middleware/
│   │   ├── auth.middleware.js      JWT verify + blacklist + user attach
│   │   ├── authlimiter.middleware.js  Strict login limiter
│   │   ├── cors.middleware.js
│   │   ├── error.middleware.js     Fail-fast + envelope shaping
│   │   ├── ratelimiter.middleware.js   Global API limiter
│   │   ├── role.middleware.js      RBAC (requireRole / requirePermission)
│   │   └── validate.middleware.js  Zod validation
│   ├── models/
│   │   ├── permission.model.js
│   │   ├── post.model.js
│   │   ├── refresh-token.model.js
│   │   ├── role.model.js
│   │   └── user.model.js
│   ├── repositories/
│   │   ├── interfaces/             Pure contracts
│   │   │   ├── permission.repository.js
│   │   │   ├── post.repository.js
│   │   │   ├── refresh.repository.js
│   │   │   ├── role.repository.js
│   │   │   └── user.repository.js
│   │   └── implementations/
│   │       ├── memory/             In-memory implementations (tests)
│   │       └── mongoose/           Production implementations
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── movie.routes.js
│   │   └── post.routes.js
│   ├── service/
│   │   ├── error.service.js
│   │   ├── post.service.js
│   │   └── user.service.js
│   ├── utils/
│   │   ├── errors.js               Stable error codes & envelope
│   │   ├── generateToken.js        JWT access + refresh
│   │   ├── logger.js               Structured logger
│   │   └── response.js             JSON envelope helper
│   └── validators/
│       ├── auth.validator.js
│       ├── post.validator.js
│       └── user.validator.js
├── tests/
│   ├── helpers/                    Shared test utilities
│   ├── unit/                       Pure unit tests
│   ├── integration/                API + DB integration
│   ├── performance/                Pagination & rate-limit perf
│   ├── e2e/                        End-to-end flows
│   ├── global-setup.js
│   └── smoke.test.js
├── postman/                        Newman collections for e2e
├── vitest.config.js
├── package.json
└── .env                            (not committed)
```

---

## API Surface

All routes are prefixed with `/api/v1`.

### Auth

| Method   | Path            | Description              |
| -------- | --------------- | ------------------------ |
| `POST`   | `/auth/`        | Register a new user      |
| `POST`   | `/auth/login`   | Login (rate-limited)     |
| `POST`   | `/auth/logout`  | Invalidate refresh token |
| `POST`   | `/auth/refresh` | Rotate refresh token     |
| `DELETE` | `/auth/me`      | Delete own account       |

### Posts (authenticated)

| Method   | Path         | Description     |
| -------- | ------------ | --------------- |
| `POST`   | `/posts`     | Create a post   |
| `GET`    | `/posts/me`  | List own posts  |
| `GET`    | `/posts`     | List all posts  |
| `PATCH`  | `/posts/:id` | Update own post |
| `DELETE` | `/posts/:id` | Delete own post |

### Shows (authenticated)

| Method | Path                            | Description                                 |
| ------ | ------------------------------- | ------------------------------------------- |
| `GET`  | `/shows/movies?page=1&limit=20` | Paginated movies (read-only `sample_mflix`) |

The full contract — parameters, schemas, security schemes, error responses, and CORS — is published in `specs/001-secure-clean-arch/contracts/openapi.yaml`.

---

## Authentication, Authorization & Ownership

**Authentication** is JWT with two tokens:

- **Access token** — short-lived (default 5m), HTTP-only cookie, validated on every protected request.
- **Refresh token** — longer-lived (default 15m), HTTP-only cookie, rotated on every refresh. Old refresh tokens are added to a Redis blacklist with TTL = remaining lifetime, so a stolen token has bounded reuse.

**Authorization** is RBAC:

- `Role` is a named collection of `Permission` codes (e.g. `posts:create`, `posts:delete`).
- Permissions and roles are stored in the database and seeded on boot in development.
- Middleware: `requireRole("admin")`, `requirePermission("posts:delete")`.
- Adding a new role or permission does not require touching endpoint code.

**Ownership** is enforced in the service layer:

- A user can only `PATCH` or `DELETE` their own posts.
- A deleted user's tokens become inert because the auth middleware re-resolves the user on every request.
- A revoked role or missing permission is re-evaluated per request — no cached authorization.

---

## Rate Limiting

Rate limits are enforced per caller using `express-rate-limit` with a Redis store. Defaults are overridable via environment variables.

| Scope                      | Default      | Window | Key      |
| -------------------------- | ------------ | ------ | -------- |
| Global API (authenticated) | 200 requests | 15 min | `userId` |
| Login (`POST /auth/login`) | 5 requests   | 5 min  | IP       |

When a caller exceeds their limit, the API returns `429` with a `RATE_LIMITED` error code. Limiter state is shared across processes because the store is Redis, so the system stays correct behind a load balancer.

---

## Error Model

All error responses use a **flat envelope** with three fields:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request was invalid",
  "traceId": "8f4e1c6a-..."
}
```

Stable codes (defined in `src/utils/errors.js`):

| Code                  | HTTP | Meaning                                  |
| --------------------- | ---- | ---------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Request body or params failed validation |
| `UNAUTHORIZED`        | 401  | Authentication required                  |
| `INVALID_CREDENTIALS` | 401  | Bad email or password                    |
| `FORBIDDEN`           | 403  | Permission denied                        |
| `ROLE_DENIED`         | 403  | Required role or permission missing      |
| `OWNERSHIP_REQUIRED`  | 403  | Caller is not the resource owner         |
| `NOT_FOUND`           | 404  | Resource does not exist                  |
| `CONFLICT`            | 409  | State conflict (e.g. duplicate)          |
| `RATE_LIMITED`        | 429  | Rate limit exceeded                      |
| `DEPENDENCY_FAILURE`  | 503  | External dependency is unavailable       |
| `INTERNAL_ERROR`      | 500  | Unexpected error                         |

There is **no category field, no retry guidance, no HTTP-text duplication**. Consumers look up the stable code in the contract and decide their own retry policy. When a dependency (MongoDB, Redis) fails, the API returns `DEPENDENCY_FAILURE` immediately — it does not retry or fall back at the application layer.

---

## CORS & API Contract

**CORS** is configured via environment variables (no hardcoded origins):

```
CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
CORS_CREDENTIALS=true
```

Credentials are enabled and preflight (`OPTIONS`) is handled correctly, so browser clients can complete the full auth flow from any configured origin.

**Contract** — `specs/001-secure-clean-arch/contracts/openapi.yaml` — describes every endpoint, every parameter, every response schema, every security scheme, and every documented error. It is the source of truth for integration. The implementation is checked against it.

---

## Repository Pattern & Persistence Swap

Services never import Mongoose. They import a repository interface and depend on the methods declared there. Two implementations live alongside it:

- `repositories/implementations/mongoose/` — production
- `repositories/implementations/memory/` — tests

To swap persistence (e.g. Mongoose → Prisma, Mongoose → SQL), implement the same interface and change the import in the service. Controllers, routes, middleware, and tests do not change.

---

## Testing Strategy

| Layer       | Tooling                                            | Scope                                                               |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Unit        | Vitest                                             | Services against in-memory repositories; pure functions; validators |
| Integration | Vitest + Supertest + mongodb-memory-server         | API + DB: auth, RBAC, ownership, errors, CORS, architecture         |
| Performance | Vitest                                             | Pagination throughput, rate limiter fairness                        |
| End-to-end  | Newman (Postman collections in `backend/postman/`) | Full request/response cycles against the live server                |

Commands:

```bash
# Unit + integration + performance
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# End-to-end (Postman collections)
npm run e2e
```

Coverage targets are tracked by the test suite itself; the full suite must pass before any change is merged.

---

## Environment Variables

Create `backend/.env`:

```ini
# Server
PORT=1430
NODE_ENV=development

# Database
MONGODB_URI="your_mongodb_connection_string"

# Redis
REDIS_DB_URI="your_redis_connection_string"

# JWT
JWT_AUTH_KEY="replace_with_long_random_string"
JWT_REFRESH_KEY="replace_with_long_random_string"
JWT_ACCESS_EXPIRES_IN="5m"
JWT_REFRESH_EXPIRES_IN="15m"

# Rate limiting (optional overrides)
API_RATE_WINDOW_MS=900000
API_RATE_LIMIT=200
LOGIN_RATE_WINDOW_MS=300000
LOGIN_RATE_LIMIT=5

# CORS (comma-separated; required)
CORS_ALLOWED_ORIGINS="http://localhost:3000,https://app.example.com"
CORS_CREDENTIALS=true
```

See `backend/README` and the inline comments in `src/configs/config.js` for the canonical list.

---

## Running Locally

```bash
# 1. Install
cd backend
npm install

# 2. Configure
cp .env.example .env   # then edit values

# 3. Start (watch mode)
npm run dev            # nodemon
# or
npm run dev-watch      # node --watch

# 4. Verify
npm test
npm run e2e
```

The server expects local Redis at startup; it will retry connection if Redis is temporarily unavailable.

---

## Adding a New Resource

Follow the documented pattern in [`backend/src/docs/extension-pattern.md`](backend/src/docs/extension-pattern.md). The short version:

1. **Model** — `src/models/widget.model.js`
2. **Repository interface** — `src/repositories/interfaces/widget.repository.js`
3. **Mongoose implementation** — `src/repositories/implementations/mongoose/widget.repository.js`
4. **In-memory implementation** — `src/repositories/implementations/memory/widget.repository.js`
5. **Validator** — `src/validators/widget.validator.js`
6. **Service** — `src/service/widget.service.js`
7. **Controller** — `src/controller/widget.controller.js`
8. **Routes** — `src/routes/widget.routes.js`
9. **Permissions & seed** — add codes to `configs/seed.js`; gate with `requirePermission(...)`
10. **Contract** — add paths to `specs/001-secure-clean-arch/contracts/openapi.yaml`

No existing file is modified.

---

## Performance Targets

Measured and enforced by `tests/performance/`:

- **p95 < 950 ms** for authenticated requests under 1000 concurrent consumers.
- Rate limiting is per-caller; one abusive source cannot monopolize capacity.
- No N+1 queries on list endpoints; population is batched at the repository layer.
- Pagination is enforced at the service boundary.

---

## License

This is a **portfolio project — read & study only**.

You may read and study the code for learning purposes. You may **not** copy, reuse, redistribute, claim as your own, or use in production.

See [`license.md`](license.md) for full terms.

## Author

**Mohamed Hazeem**

- Email: a.mohamedhazeem@gmail.com
- GitHub: [@mohamedhazeem](https://github.com/mohamedhazeem)
