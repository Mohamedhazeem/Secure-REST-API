# Implementation Plan: API Console

**Branch**: `003-api-console` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-api-console/spec.md`

## Summary

Add a minimal, single-page API Console served by the existing Express backend at `/console`. The console renders the published OpenAPI contract using an existing interactive documentation renderer (Scalar), allowing reviewers to browse endpoints, inspect schemas, authenticate via the real TrustFeed cookie-based session, execute requests, and view formatted responses. No frontend framework, build step, or separate application is introduced. The OpenAPI contract remains the single source of truth; the console derives all documentation from it at runtime.

## Technical Context

**Language/Version**: Node.js (ES Modules), Express 5

**Primary Dependencies**: Scalar (interactive OpenAPI renderer, loaded via CDN or bundled static asset)

**Storage**: N/A for the console feature itself; continues to use existing MongoDB + Redis for API operations

**Testing**: Vitest + Supertest for backend route/contract smoke tests

**Target Platform**: Node.js server (existing Express backend)

**Project Type**: Web service with embedded developer documentation surface

**Performance Goals**: Console page load under 2 seconds on local dev; zero runtime impact on API latency

**Constraints**: No React/Vue/Next.js or SPA framework; no build step for console assets; minimal file count; no changes to existing API semantics

**Scale/Scope**: Single-page developer console covering all documented TrustFeed endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | Console is a thin presentation layer; no changes to services, repositories, or models |
| II. SOLID & SRP | PASS | Console has one responsibility: render interactive docs; served via a single route/file |
| III. Performance & Big-O | PASS | Static asset serving; no additional DB queries or algorithmic changes |
| IV. Multi-App Consumability | PASS | Console does not modify the API contract or add client-specific behavior |
| V. Swappable Persistence | PASS | No persistence changes |
| VI. Testability | PASS | Lightweight smoke tests for console route and contract loading |
| VII. Contract-First | PASS | Console derives from existing OpenAPI contract; no duplicated definitions |
| VIII. No Speculative Infrastructure | PASS | Uses existing Express static serving; no new services, queues, or caches |
| IX. Explicit Failure Semantics | PASS | Console surfaces actual backend error responses unchanged |
| X. Observability | PASS | No impact on backend observability; console is read-only from backend perspective |
| XI. Concurrency Awareness | PASS | No mutation paths added |

**Exception noted**: Constitution Article "Security & Production Standards" states "No UI: backend-only by design". The API Console is a controlled exception: it is a developer documentation/testing surface served from the backend, not a consumer-facing product UI. It does not introduce client-side business logic, separate auth architecture, or weaken existing security controls. This is consistent with the project's portfolio/demo goals.

## Constitution Re-Check (Post-Design)

*Re-evaluated after Phase 1 design artifacts complete.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | Console is a thin presentation layer; no changes to services, repositories, or models |
| II. SOLID & SRP | PASS | Console has one responsibility: render interactive docs; served via a single route/file |
| III. Performance & Big-O | PASS | Static asset serving; no additional DB queries or algorithmic changes |
| IV. Multi-App Consumability | PASS | Console does not modify the API contract or add client-specific behavior |
| V. Swappable Persistence | PASS | No persistence changes |
| VI. Testability | PASS | Lightweight smoke tests for console route and contract loading |
| VII. Contract-First | PASS | Console derives from existing OpenAPI contract; no duplicated definitions |
| VIII. No Speculative Infrastructure | PASS | Uses existing Express static serving; no new services, queues, or caches |
| IX. Explicit Failure Semantics | PASS | Console surfaces actual backend error responses unchanged |
| X. Observability | PASS | No impact on backend observability; console is read-only from backend perspective |
| XI. Concurrency Awareness | PASS | No mutation paths added |

Post-design review confirms no new violations. The exception for "No UI" remains valid: the console is a documentation surface served from the existing backend, not a standalone frontend application.

## Project Structure

### Documentation (this feature)

```text
specs/003-api-console/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI improvements)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/src/
├── app.js                        # Add /console route + /console/openapi.json route
├── docs/
│   ├── openapi/
│   │   └── openapi.yaml          # Existing published contract (may be enhanced)
│   └── console.html              # Single-page console (Scalar-based)
└── configs/
    └── cors.js                   # May need console origin allowance
```

**Structure Decision**: Single static HTML file (`console.html`) served by Express at `/console`, plus a JSON serialization route for the multi-file OpenAPI contract at `/console/openapi.json`. No new directories, frameworks, or build tools.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification. The "No UI" principle is addressed by the exception noted above; the console is a documentation layer, not a product UI.
