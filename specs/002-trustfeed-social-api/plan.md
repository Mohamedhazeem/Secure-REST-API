# Implementation Plan: TrustFeed Social API

**Branch**: `002-trustfeed-social-api` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-trustfeed-social-api/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Evolve the existing Secure REST API into the TrustFeed Social API by adding social domain features—comments, follows, cursor-paginated feed, and asynchronous notifications—while strengthening authentication (multi-session management, reuse detection), authorization (ABAC), observability, audit logging, and operational resilience. The public `/api/v1` contract, layered architecture, repository pattern, and flat error model are preserved. Legacy test-only scaffolding and unused files are retired. The implementation remains backend-only, contract-first, and fail-fast.

## Technical Context

**Language/Version**: Node.js >= 20 (current runtime 26), ES modules (`"type": "module"`)

**Primary Dependencies**: Express 5.x, Mongoose 9, jsonwebtoken, bcrypt, ioredis, bullmq, express-rate-limit + rate-limit-redis, zod, vitest

**Storage**: MongoDB via Mongoose (application data) + native MongoDB driver (read-only `sample_mflix`); Redis via ioredis (rate limiting, token blacklist, sessions, cache, idempotency store, queue metadata)

**Testing**: Vitest + Supertest + mongodb-memory-server (integration); Newman/Postman collections (e2e)

**Target Platform**: Node.js server, Linux-hosted backend service

**Project Type**: Backend-only web service

**Performance Goals**: Sub-second p95 for authenticated requests under 1000 concurrent users; 99.9% availability; fair per-caller rate limiting

**Constraints**: Preserve existing `/api/v1` routes and HTTP status codes; no UI; secrets only in `backend/.env`; no scattered `process.env` reads; fail-fast on dependency failures with no automatic retries at the API layer

**Scale/Scope**: Portfolio API supporting multiple independent client applications; 1k–10k concurrent users; extensible resource pattern for future endpoints; social graph depth under 1k followers per user for initial release

**Clarifications Applied**:
- Authorization: roles and permissions are fully configurable at runtime via an admin API; business logic never hardcodes roles or permissions.
- Idempotency: keys are retained for 7 days before expiration.
- Post visibility: public, followers-only, and private; feed generation excludes posts the caller is not authorized to view.
- Likes: first-class resource with create/delete/list operations and uniqueness per user-post pair.
- Account deletion: authored content is anonymized with "[deleted]" attribution; follow relationships are removed; likes are anonymized or removed; personal data and credentials are permanently deleted.
- Notifications: payload includes actor, action, target summary, and deep link.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                             | Status | Notes                                                                                                                                                     |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Clean Architecture                 | PASS   | TrustFeed modules will import through repository interfaces and common modules; no direct Express/Mongoose/Redis coupling in services.                      |
| II. SOLID                             | PASS   | Controllers remain thin; services delegate to repositories; new social modules follow the existing extension pattern.                                      |
| III. Performance & Big-O             | PASS   | Cursor pagination replaces offset pagination; batched queries prevent N+1; optimistic locking prevents lost updates.                                       |
| IV. Multi-App Consumability           | PASS   | Existing `/api/v1` contract is extended, not broken; cookie auth and CORS behavior preserved.                                                              |
| V. Swappable Persistence              | PASS   | New social repositories will implement the same interface pattern; services remain persistence-agnostic.                                                   |
| VI. Testability & Multi-Level Testing | PASS   | New critical paths (auth, ownership, concurrency, failure) will have tests written before implementation; existing test infrastructure is reused.          |
| VII. Contract-First Development       | PASS   | OpenAPI paths for new social endpoints will be added to `backend/src/docs/openapi/` before implementation; contract validation remains in CI.                         |
| VIII. No Speculative Infrastructure   | PASS   | Redis cache, BullMQ queues, and audit logging are justified by concrete feature requirements (feed, notifications, tamper-evident audit).                   |
| IX. Explicit Failure Semantics        | PASS   | Flat error model preserved; dependency failures return structured errors immediately with no hidden retries or fallbacks.                                   |
| X. Observability Mandatory            | PASS   | Correlation IDs, structured logs, metrics, and health checks are extended to new social endpoints.                                                         |
| XI. Concurrency Awareness for Mutations | PASS   | Optimistic locking applied to posts and comments; atomic operations for follows; idempotency keys prevent duplicate writes.                                  |

**Security & Production Standards**: PASS. New endpoints will enforce ownership and RBAC; input validation via Zod; secrets remain in `backend/.env`; no sensitive data in logs or responses.

**Development Workflow**: PASS. New resources will follow the documented extension pattern; existing code is not modified; tests gate merges.

### Post-Design Re-Check (Phase 1)

| Principle                             | Status | Post-Design Notes |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Clean Architecture                 | PASS   | Contracts, data model, and extension pattern preserve layer boundaries. |
| II. SOLID                             | PASS   | New services and repositories follow interface segregation; no controller or service edits existing code. |
| III. Performance & Big-O             | PASS   | Cursor pagination and batched queries are specified; no N+1 in feed or comment paths. |
| IV. Multi-App Consumability           | PASS   | OpenAPI contract expanded; no breaking changes to existing endpoints. |
| V. Swappable Persistence              | PASS   | Repository interfaces defined for all new entities; tests use mongodb-memory-server for real store behavior (memory fakes retired per Research Decision 9). |
| VI. Testability & Multi-Level Testing | PASS   | Critical paths mapped in spec; test strategy covers new failure and concurrency modes. |
| VII. Contract-First Development       | PASS   | OpenAPI contracts created in `contracts/` before implementation; validation remains in CI. |
| VIII. No Speculative Infrastructure   | PASS   | BullMQ, Redis cache, and audit log are all justified by explicit functional requirements. |
| IX. Explicit Failure Semantics        | PASS   | Dependency failure behavior documented in spec and research; flat error model unchanged. |
| X. Observability Mandatory            | PASS   | Correlation IDs and audit requirements extend to new social events. |
| XI. Concurrency Awareness for Mutations | PASS   | Optimistic locking and idempotency specified for all mutating social operations. |

## Project Structure

### Documentation (this feature)

```text
specs/002-trustfeed-social-api/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── openapi.yaml
│   ├── paths/
│   └── components/
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.js                      # Express app wiring
│   ├── index.js                    # Server entrypoint
│   ├── configs/
│   │   ├── config.js               # Centralized env access
│   │   ├── constants.js            # Rate-limit & token constants
│   │   ├── cors.js                 # Environment-driven origin allowlist
│   │   ├── database.js             # Mongoose + native MongoDB connections
│   │   ├── redis.js                # ioredis singleton
│   │   └── seed.js                 # Dev seed for roles & permissions
│   ├── controller/
│   │   ├── auth.controller.js
│   │   ├── error.controller.js
│   │   ├── movie.controller.js
│   │   ├── post.controller.js
│   │   ├── refresh_token.controller.js
│   │   └── user.controller.js
│   ├── docs/
│   │   ├── extension-pattern.md    # How to add a new resource
│   │   └── openapi/                # OpenAPI contract files
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verify + blacklist + user attach
│   │   ├── authlimiter.middleware.js  # Strict login limiter
│   │   ├── cors.middleware.js
│   │   ├── error.middleware.js     # Fail-fast + envelope shaping
│   │   ├── idempotency.middleware.js  # Request deduplication
│   │   ├── ratelimiter.middleware.js   # Global API limiter
│   │   ├── role.middleware.js      # RBAC (requireRole / requirePermission)
│   │   └── validate.middleware.js  # Zod validation
│   ├── models/
│   │   ├── comment.model.js
│   │   ├── follow.model.js
│   │   ├── like.model.js
│   │   ├── notification.model.js
│   │   ├── permission.model.js
│   │   ├── post.model.js
│   │   ├── refresh-token.model.js
│   │   ├── role.model.js
│   │   ├── session.model.js
│   │   └── user.model.js
│   ├── repositories/
│   │   ├── interfaces/             # Pure contracts
│   │   │   ├── comment.repository.js
│   │   │   ├── follow.repository.js
│   │   │   ├── like.repository.js
│   │   │   ├── notification.repository.js
│   │   │   ├── post.repository.js
│   │   │   ├── refresh.repository.js
│   │   │   ├── role.repository.js
│   │   │   ├── session.repository.js
│   │   │   └── user.repository.js
│   │   └── implementations/
│   │       ├── memory/             # In-memory implementations (tests)
│   │       │   ├── comment.repository.js
│   │       │   ├── follow.repository.js
│   │       │   ├── like.repository.js
│   │       │   ├── notification.repository.js
│   │       │   ├── post.repository.js
│   │       │   ├── refresh.repository.js
│   │       │   ├── role.repository.js
│   │       │   ├── session.repository.js
│   │       │   └── user.repository.js
│   │       └── mongoose/           # Production implementations
│   │           ├── comment.repository.js
│   │           ├── follow.repository.js
│   │           ├── like.repository.js
│   │           ├── notification.repository.js
│   │           ├── post.repository.js
│   │           ├── refresh.repository.js
│   │           ├── role.repository.js
│   │           ├── session.repository.js
│   │           └── user.repository.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── comment.routes.js
│   │   ├── follow.routes.js
│   │   ├── like.routes.js
│   │   ├── movie.routes.js
│   │   ├── notification.routes.js
│   │   ├── post.routes.js
│   │   └── user.routes.js
│   ├── service/
│   │   ├── auth.service.js
│   │   ├── comment.service.js
│   │   ├── error.service.js
│   │   ├── feed.service.js
│   │   ├── follow.service.js
│   │   ├── like.service.js
│   │   ├── notification.service.js
│   │   ├── post.service.js
│   │   ├── session.service.js
│   │   └── user.service.js
│   ├── workers/
│   │   └── notification.worker.js   # BullMQ consumer: bounded retry + dead-letter (FR-027, SC-017, Decision 6)
│   ├── utils/
│   │   ├── errors.js               # Stable error codes & envelope
│   │   ├── generateToken.js        # JWT access + refresh
│   │   ├── logger.js               # Structured logger
│   │   └── response.js             # JSON envelope helper
│   └── validators/
│       ├── auth.validator.js
│       ├── comment.validator.js
│       ├── follow.validator.js
│       ├── like.validator.js
│       ├── notification.validator.js
│       ├── post.validator.js
│       └── user.validator.js
├── tests/
│   ├── helpers/                    # Shared test utilities
│   ├── unit/                       # Pure unit tests
│   ├── integration/                # API + DB integration
│   ├── performance/                # Pagination & rate-limit perf
│   ├── e2e/                        # End-to-end flows
│   ├── global-setup.js
│   └── smoke.test.js
├── postman/                        # Newman collections for e2e
├── vitest.config.js
├── package.json
└── .env                            # (not committed)
```

**Structure Decision**: The existing `backend/src/` layered layout is retained. New social modules (comments, follows, likes, feed, notifications) are added following the established extension pattern. Legacy test-only scaffolding is removed. The OpenAPI contract moves from `backend/docs/` to `backend/src/docs/openapi/` to co-locate documentation with source.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. All TrustFeed changes align with existing principles; no complexity justification required.
