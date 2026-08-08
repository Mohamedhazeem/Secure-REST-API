<!--
  SYNC IMPACT REPORT
  Version change: 1.0.0 → 1.1.0
  Modified principles: none renamed
  Added sections: Core Principle VI. Testability & Multi-Level Testing
  Modified sections: Development Workflow & Quality Gates (test gate expanded
                     from "no test suite yet" to mandated multi-level testing)
  Removed sections: none
  Deferred TODOs: none
-->

# Secure REST API Constitution

## Core Principles

### I. Clean Architecture (Layered Boundaries)
The codebase MUST be organized in inward-pointing layers: presentation (routes,
middleware) → application (controllers, services) → domain (models, business rules)
→ infrastructure (repositories, database clients, Redis, configs). Dependencies
MUST point inward; outer layers may import inner layers, never the reverse. No
circular imports. Domain and application code MUST NOT depend on Express, Mongoose,
the native MongoDB driver, or ioredis directly — such coupling is infrastructure-only.

### II. SOLID & Single Responsibility
Every module MUST have exactly one responsibility. Controllers MUST stay thin and
delegate business logic to services. New behavior MUST be added by extending or
composing modules (Open/Closed), not by editing existing handlers. Persistence and
use-case contracts MUST be defined as small interfaces (Interface Segregation).
Dependencies MUST be injected or passed explicitly — hidden global state is
forbidden. Rationale: SOLID is what makes the codebase safely extensible without
regression.

### III. Performance & Big-O Discipline
Every query and algorithm MUST be complexity-aware. Collection endpoints MUST
paginate; queries MUST use indexes on filter/sort fields; N+1 access patterns are
FORBIDDEN (use batched/populated queries). Hot paths MUST document their time and
space complexity (Big-O) in a code comment. Redis-backed rate limiting and caching
MUST be used where they eliminate repeat work. Rationale: portfolio quality demands
provable scalability, not just working code.

### IV. Multi-App Consumability (API as a Product)
The API MUST remain consumable by many independent applications with zero coupling
to any single client. The public contract MUST be stable and versioned under
/api/v1 with a consistent JSON response envelope, standard HTTP status codes, and
documented endpoints (README + Postman). Cross-origin consumption MUST be handled
explicitly. Authentication MUST stay HTTP-only-cookie based with refresh rotation —
no token exposure to client JavaScript. Rationale: a backend-only portfolio API is
judged by how easily other apps can integrate with it.

### V. Swappable Persistence (Database Abstraction)
Business logic MUST NOT import data-access implementations (Mongoose models, native
driver collections, Redis calls). All reads/writes MUST go through repository
interfaces, with the chosen database injectable per environment. Swapping the
persistence layer (MongoDB ↔ another store, or an in-memory fake for tests) MUST
require changes only in the infrastructure layer and configuration, never in
services or controllers.

### VI. Testability & Multi-Level Testing
Every layer MUST be testable in isolation: repositories swappable with in-memory
fakes, services unit-testable without a network or database, middleware and
controllers testable against an ephemeral test server, and the full HTTP surface
verifiable end-to-end. Four test levels are REQUIRED as the project matures:
unit (services, validators, utils, complexity assertions), integration
(repositories against a real or fake store, middleware flows), performance
(pagination latency, rate-limiter behavior, Big-O regressions on hot paths), and
e2e (register → login → authorized mutation → refresh → ownership denial over real
HTTP with cookies). A dedicated test script MUST exist and pass before merge.
Rationale: the refactor's guarantees (layering, swapping, performance) are only
credible if each one is proven by a test.

## Security & Production Standards

- Input validation: ALL request bodies/params/queries MUST pass Zod schemas via the
  validate middleware before reaching handlers.
- Authentication: access tokens in HTTP-only cookies; refresh tokens MUST rotate and
  be validated against the blacklist; logout MUST invalidate both.
- Authorization: ownership checks MUST run on every mutation (update/delete own
  resources only).
- Passwords MUST be hashed with bcrypt before storage; sensitive fields MUST never
  appear in responses or populate() results.
- Rate limiting: global API limiter (per user) and strict login limiter (per IP),
  both Redis-backed, MUST remain in front of all endpoints.
- Secrets MUST live only in backend/.env, never in code, logs, or commits.
- No UI: backend-only by design; the API surface is the only product.

## Development Workflow & Quality Gates

- ES Modules ("type": "module") everywhere; default exports only for middleware and
  store singletons, named exports elsewhere.
- Logic lives in service/ (application layer); controllers stay thin; repositories
  abstract all data access.
- Environment variables MUST be read only through the configs/ module, validated at
  startup — no scattered process.env reads.
- Testing: a test runner and fixture helpers MUST be established as part of the
  refactor. Unit and integration tests are REQUIRED for every new or modified
  module; performance tests cover hot paths; e2e tests cover auth, refresh, and
  ownership flows. Until the suite exists, every change MUST at minimum pass
  `node --check <file>` and a clean server boot.
- New resources MUST follow the documented extension pattern (route → validator →
  middleware → controller → service → repository → model) with no deviation.
- Refactoring proceeds in small, reversible steps that preserve the public API and
  status codes; each step must boot cleanly before the next.

## Governance

This Constitution supersedes ad-hoc conventions (including earlier AGENTS.md layout
notes where they conflict). Amendments require documentation of the change, approval,
and a migration plan; the version follows SemVer: MAJOR for removed or redefined
principles, MINOR for new principles or materially expanded guidance, PATCH for
clarifications. Every PR and code review MUST verify compliance with this
Constitution. Runtime development guidance lives in AGENTS.md and MUST be kept in
sync with this document.

**Version**: 1.1.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-08
