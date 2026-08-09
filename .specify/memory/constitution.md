<!--
  SYNC IMPACT REPORT
  Version change: 1.1.0 → 1.2.0
  Modified principles: I. Clean Architecture (Layered Boundaries) — strengthened business-logic independence language; VI. Testability & Multi-Level Testing — added test-before-implement mandate
  Added principles: VII. Contract-First Development, VIII. No Speculative Infrastructure, IX. Explicit Failure Semantics, X. Observability Mandatory, XI. Concurrency Awareness for Mutations
  Modified sections: Security & Production Standards — added security-by-design mandate and explicit no-secrets-in-logs rule
  Removed sections: none
  Deferred TODOs: none
-->

# TrustFeed API Constitution

## Core Principles

### I. Clean Architecture (Layered Boundaries)
The codebase MUST be organized in inward-pointing layers: presentation (routes,
middleware) → application (controllers, services) → domain (models, business rules)
→ infrastructure (repositories, database clients, Redis, configs). Dependencies
MUST point inward; outer layers may import inner layers, never the reverse. No
circular imports. Domain and application code MUST NOT depend on Express, Mongoose,
the native MongoDB driver, or ioredis directly — such coupling is infrastructure-only.
Business logic MUST remain independent of infrastructure.

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
Test critical behavior before implementation: tests for auth flows, ownership
checks, and failure modes MUST be written before the feature code that satisfies
them. Rationale: the refactor's guarantees (layering, swapping, performance) are
only credible if each one is proven by a test.

### VII. Contract-First Development
The OpenAPI specification MUST be the source of truth and MUST be written before
implementation begins. Every endpoint's request/response schema, status codes, and
error envelope MUST be defined in the contract first. Implementation MUST match the
contract; the contract MUST NOT be derived from working code. Contract validation
MUST run in CI and MUST gate merges. Rationale: a contract-first API prevents drift
between documentation and behavior and lets consumers integrate against a stable
specification.

### VIII. No Speculative Infrastructure
Infrastructure MUST be added only when a proven requirement exists. Caching layers,
additional queues, new database indexes, and external services MUST be justified by
demonstrated need (profiling data, load measurements, or concrete feature
requirements). YAGNI applies: an unused cache is complexity without benefit.
Rationale: speculative infrastructure obscures real bottlenecks and increases
operational surface area without delivering value.

### IX. Explicit Failure Semantics
Every failure path MUST have an explicit, documented outcome. Retries MUST be
bounded and explicit; silent fallbacks and hidden retries are FORBIDDEN.
Dependencies that fail MUST produce a structured error response immediately — the
application MUST NOT retry incoming requests or fall back to degraded behavior
without an explicit, documented policy. Error codes MUST be stable and
machine-readable. Rationale: consumers must be able to reason about failure modes
without reading source code.

### X. Observability Mandatory
Every request MUST carry a correlation ID. Structured logs MUST include trace IDs,
user context, and duration. Metrics MUST be exported for every critical path. Health
endpoints MUST report dependency status. Observability MUST be designed into the
system, not bolted on after implementation. Rationale: production incidents are only
diagnosable if the system exposes its internal state.

### XI. Concurrency Awareness for Mutations
All mutating operations MUST account for concurrent access. Optimistic locking MUST
be used where conflicts are possible. Atomic database operations MUST be preferred
over read-modify-write cycles. Race conditions in mutation paths are defects, not
edge cases. Rationale: social APIs have high write concurrency; lost updates and
duplicate writes are user-visible data corruption.

## Security & Production Standards

Security by design is non-negotiable. Every feature MUST be evaluated for security
implications before implementation. Threat modeling MUST precede feature work for
auth, authorization, and data-access paths.

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
- No secrets in logs: the structured logger MUST redact passwords, tokens, cookies,
  authorization headers, and any field whose name suggests sensitivity. Redaction
  rules MUST be verified in log-related tests.
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

**Version**: 1.2.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-09
