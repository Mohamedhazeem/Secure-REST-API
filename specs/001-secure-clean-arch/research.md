# Research: Secure Clean Architecture Refactor

**Feature**: 001-secure-clean-arch
**Date**: 2026-08-08
**Status**: Complete

## Overview

This document consolidates research decisions for the clean-architecture refactor. All unknowns from Technical Context have been resolved.

---

## R-01: CORS Strategy

**Decision**: Implement a CORS middleware that reads an environment-driven origin allowlist. The middleware sets `Access-Control-Allow-Origin` to the requesting origin only when it appears in the allowlist. Preflight `OPTIONS` requests are handled with appropriate `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`. `Access-Control-Allow-Credentials: true` is always set because the API uses HTTP-only cookies.

**Rationale**: Wildcard origins are incompatible with credentialed requests. An environment-configured allowlist satisfies the requirement that any operator can host the API while preserving security. Preflight handling ensures browser-based clients can send custom headers and methods required by the API.

**Alternatives considered**:

- `cors` npm package with dynamic origin validation: rejected because the project already centralizes configuration in `configs/`, and a small custom middleware keeps the behavior explicit and auditable.
- Static wildcard with credentials disabled: rejected because it breaks HTTP-only cookie auth for browser clients.

---

## R-02: Role-Based Access Control Data Model

**Decision**: Introduce three Mongoose models: `Role`, `Permission`, and a joining collection on `User`. A `Role` has a name and an array of `Permission` references. A `User` has an array of `Role` references. Authorization middleware evaluates whether the user's roles collectively grant the permission required by the route.

**Rationale**: This matches the clarified requirement for customizable, extensible roles without changing endpoint logic. The joining collection allows a user to have multiple roles and a role to be reused across users. Permission evaluation happens in middleware, keeping controllers thin.

**Alternatives considered**:

- Embedded permission array on User: rejected because role definitions would not be reusable and would require updating every user when permissions change.
- Single role per user: rejected because the clarified requirement explicitly allows multiple roles.

---

## R-03: Repository Interface Pattern

**Decision**: Define repository interfaces as plain objects or classes with methods like `findById`, `findOne`, `create`, `update`, `delete`, and `findMany`. Implementations use Mongoose for production and in-memory arrays for tests. Services depend only on the interface, receiving the implementation via dependency injection from configs.

**Rationale**: This satisfies Constitution principles I, II, and V. Controllers and services never import Mongoose models directly. Swapping persistence for tests requires only changing the injected implementation.

**Alternatives considered**:

- Active record pattern (model methods): rejected because it couples business logic to Mongoose and prevents test doubles.
- Data mapper without interfaces: rejected because without explicit contracts, implementations could drift and break the swap guarantee.

---

## R-04: Structured Error Handling

**Decision**: Add a centralized error-handling middleware at the end of the Express middleware stack. All controllers and services throw domain errors using a factory that produces `{ code, message, traceId }`. The middleware maps these to HTTP status codes and returns the flat error JSON envelope. No error categories or retry guidance are embedded.

**Rationale**: A flat stable-code model matches the clarified requirement and gives consumers full control over retry logic. Centralized handling prevents duplicate error-response logic across controllers and ensures consistent logging.

**Alternatives considered**:

- Per-controller try/catch with local responses: rejected because it duplicates logic, risks inconsistent shapes, and scatters logging.
- Error categories with automatic retry headers: rejected because the spec explicitly chose a flat model with no category classification.

---

## R-05: OpenAPI Contract Generation

**Decision**: Maintain a versioned `openapi.yaml` under `specs/001-secure-clean-arch/contracts/`. The specification is authored as a source of truth. A CI or pre-deploy validation step compares the implementation against the spec. In the future, generation from route metadata can be added, but for v1 the spec is maintained manually to ensure accuracy.

**Rationale**: The clarified requirement limits the contract to the machine-readable file alone. Manual authoring gives full control over examples, schemas, and error responses. Automated generation from code risks drift and incomplete coverage during rapid refactoring.

**Alternatives considered**:

- Code-first generation using `swagger-jsdoc`: rejected because rapid refactoring would cause frequent drift, and manual review is required anyway for accurate examples and security schemes.
- Runtime-generated spec endpoint: rejected because the spec must be a deliverable artifact, not an endpoint.

---

## R-06: Logging Strategy

**Decision**: Add a `logger` utility that writes structured JSON logs for security-relevant events (auth success/failure, rate-limit hits, permission denials, external dependency failures). Logs include trace IDs from error responses but never include secrets, tokens, or raw passwords.

**Rationale**: Constitution requirement FR-007 mandates security logging without exposing secrets. Structured JSON logs enable parsing by log aggregators and support the trace-reference workflow in SC-009.

**Alternatives considered**:

- Console.log with string interpolation: rejected because it is unstructured, hard to parse, and risks accidental secret leakage.
- Third-party logging service: rejected because the API must remain deployable anywhere without external dependencies.

---

## R-07: Testing Strategy

**Decision**: Use vitest for unit and integration tests, supertest against an ephemeral Express app for middleware/controller tests, mongodb-memory-server for repository integration tests, and newman + a dedicated test script for e2e tests. Test files live alongside source files or under `tests/` by layer.

**Rationale**: Constitution principle VI mandates four test levels. The existing `devDependencies` already include vitest, supertest, mongodb-memory-server, and newman, so no new tooling is required. The test script must pass before merge.

**Alternatives considered**:

- Separate test runner per layer: rejected because it adds maintenance burden without clear benefit.
- Manual Postman-only e2e: rejected because it cannot be enforced as a merge gate.

---

## R-08: Refresh Token Blacklist

**Decision**: Store revoked refresh token identifiers in Redis with TTL matching the token's remaining lifespan. The auth middleware checks Redis before accepting a refresh token. On logout, both access and refresh tokens are invalidated.

**Rationale**: The existing code already uses Redis for rate limiting. Extending Redis to store blacklisted refresh tokens reuses existing infrastructure and avoids a new database collection.

**Alternatives considered**:

- MongoDB collection for blacklist: rejected because Redis TTL provides automatic expiry, reducing stale entries and storage growth.
- In-memory blacklist: rejected because it does not survive server restarts and does not work across multiple instances.

---

## R-09: Rate Limiting Key Strategy

**Decision**: Authenticated requests key rate limits by authenticated user `_id`. Public endpoints key by IP using Express's `req.ip`. Rate limit configuration values come from `configs/constants.js` and are environment-overridable.

**Rationale**: The existing implementation already uses this strategy. The refactor preserves it while moving rate-limit configuration into the centralized configs module.

**Alternatives considered**:

- Single global rate limit: rejected because it allows one abusive user to consume capacity meant for all users.
- Per-route custom limits without central config: rejected because it scatters tuning values and makes adjustment error-prone.
