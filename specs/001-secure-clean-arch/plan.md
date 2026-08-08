# Implementation Plan: Secure Clean Architecture Refactor

**Branch**: `001-secure-clean-arch` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-secure-clean-arch/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Refactor the existing Express/Mongoose backend into a clean layered architecture with explicit repository interfaces, role-based authorization, CORS support, OpenAPI contract generation, structured error handling, and a full multi-level test suite. The public API surface and status codes are preserved; all changes are internal restructuring plus new cross-cutting concerns.

## Technical Context

**Language/Version**: Node.js >= 20 (current runtime 26), ES modules (`"type": "module"`)

**Primary Dependencies**: Express 5.x, Mongoose, jsonwebtoken, bcrypt, ioredis, express-rate-limit, zod, vitest

**Storage**: MongoDB via Mongoose (app data) + native MongoDB driver (read-only sample_mflix); Redis via ioredis (rate limiting and token blacklist)

**Testing**: vitest (unit/integration), supertest (HTTP layer), mongodb-memory-server (test database), newman (existing e2e Postman collections)

**Target Platform**: Node.js server, Linux-hosted backend service

**Project Type**: Backend-only web service

**Performance Goals**: Sub-second p95 latency for authenticated requests; 99.9% availability; fair rate limiting per user/IP

**Constraints**: Preserve existing `/api/v1` routes and HTTP status codes; no UI; secrets only in `backend/.env`; no scattered `process.env` reads

**Scale/Scope**: Portfolio API supporting multiple independent client applications; extensible resource pattern for future endpoints

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                             | Status | Notes                                                                                                                                                     |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Clean Architecture                 | PASS   | Plan introduces repository interfaces, moves Mongoose/Redis/Express coupling to infrastructure layer, and keeps controllers thin.                         |
| II. SOLID                             | PASS   | Controllers delegate to services; repositories abstract persistence; new resources follow extension pattern; dependencies injected via configs.           |
| III. Performance & Big-O              | PASS   | Pagination already present; rate limiting already Redis-backed; plan adds complexity documentation and eliminates N+1 via populated/batched queries.      |
| IV. Multi-App Consumability           | PASS   | OpenAPI spec added; CORS support added; JSON envelope standardized; versioning preserved under `/api/v1`.                                                 |
| V. Swappable Persistence              | PASS   | Repository interfaces introduced; business logic imports only interfaces; swapping to in-memory fakes for tests requires only test configuration changes. |
| VI. Testability & Multi-Level Testing | PASS   | Vitest + supertest + mongodb-memory-server established; unit, integration, performance, and e2e test levels mandated.                                     |
| Security & Production                 | PASS   | Zod validation middleware added; role-based auth added; CORS with allowlist; fail-fast error handling; secrets centralized in configs.                    |
| Development Workflow                  | PASS   | Extension pattern documented; `node --check` and clean boot remain minimum gates; test script added.                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/001-secure-clean-arch/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── app.js                      # Express app setup + CORS
│   ├── index.js                    # Server entrypoint
│   ├── configs/
│   │   ├── constants.js
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── cors.js                 # NEW: CORS origin allowlist config
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── authlimiter.middleware.js
│   │   ├── ratelimiter.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── error.middleware.js     # NEW: structured error handler
│   │   └── role.middleware.js      # NEW: role/permission enforcement
│   ├── models/
│   │   ├── user.model.js
│   │   ├── post.model.js
│   │   └── role.model.js           # NEW: RBAC role model
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── post.routes.js
│   │   ├── movie.routes.js
│   │   └── user.routes.js          # NEW: user management routes
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── post.controller.js
│   │   ├── movie.controller.js
│   │   ├── refresh_token.controller.js
│   │   ├── user.controller.js      # NEW
│   │   └── error.controller.js     # NEW: centralized error responses
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── user.service.js         # NEW
│   │   └── error.service.js        # NEW: error classification + logging
│   ├── repositories/               # NEW: data-access interfaces
│   │   ├── interfaces/
│   │   │   ├── user.repository.js
│   │   │   ├── post.repository.js
│   │   │   ├── role.repository.js
│   │   │   └── refresh.repository.js
│   │   └── implementations/
│   │       ├── mongoose/
│   │       │   ├── user.repository.js
│   │       │   ├── post.repository.js
│   │       │   ├── role.repository.js
│   │       │   └── refresh.repository.js
│   │       └── memory/             # For tests
│   │           ├── user.repository.js
│   │           ├── post.repository.js
│   │           └── role.repository.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── post.validator.js
│   │   └── user.validator.js       # NEW
│   └── utils/
│       ├── generateToken.js
│       ├── errors.js               # NEW: stable error codes
│       └── logger.js               # NEW: structured logging
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── performance/
│   └── e2e/
└── package.json
```

**Structure Decision**: Adopt the existing backend-only layout. Add new directories for repositories, role model, error middleware/service, and structured logging. Preserve all existing route paths and HTTP status codes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                             | Why Needed                                                                                  | Simpler Alternative Rejected Because                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Repository interfaces add boilerplate | Business logic must not import Mongoose/Redis/Express directly (Constitution I and V)       | Direct model usage would violate clean-architecture layering and prevent testability with fakes |
| Role model introduces new entity      | RBAC is required by FR-014-FR-016 and clarified scope                                       | Simple boolean flags would not support customizable/extensible permissions                      |
| Error middleware layer                | Flat stable-code error model and fail-fast dependency failures require centralized handling | Ad-hoc error responses in controllers would duplicate logic and risk leaking internals          |
