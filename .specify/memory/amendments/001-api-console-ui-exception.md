# Constitution Amendment 001: API Console UI Exception

**Version Change**: 1.2.0 → 1.2.1
**Amendment Type**: PATCH — Clarification of existing principle scope
**Ratified**: 2026-08-10
**Author**: Feature team — API Console (003-api-console)

## Context

The TrustFeed API Constitution, version 1.2.0, includes the following provision under **Security & Production Standards**:

> No UI: backend-only by design; the API surface is the only product.

During the specification and planning of the API Console feature (`003-api-console`), the project team identified a need to serve a minimal, single-page interactive API documentation surface from the existing Express backend at `/console`. This surface renders the published OpenAPI contract using an existing interactive documentation renderer (Scalar), allowing reviewers to browse endpoints, inspect schemas, authenticate via the real TrustFeed cookie-based session, execute requests, and view formatted responses.

The feature does not introduce a standalone frontend application, build step, or separate deployment target. It is served as a static HTML file from the existing backend and derives all documentation from the OpenAPI contract at runtime.

## Amendment

The following exception is formally recognized for the "No UI" principle:

> **Exception — Developer Documentation Surface**: The prohibition on UI applies to consumer-facing product interfaces and standalone frontend applications. A minimal, single-page developer documentation/testing surface served from the existing backend at `/console`, which derives all content from the OpenAPI contract and does not introduce client-side business logic, separate auth architecture, or weaken existing security controls, is permitted as a controlled exception.

## Scope of Exception

The exception specifically permits:

1. Serving a single static HTML file (`console.html`) from Express at `/console`.
2. Loading an interactive OpenAPI renderer (Scalar) from CDN or bundled static assets.
3. Configuring the renderer to use the browser's cookie store (`credentials: 'include'`) for the real TrustFeed HTTP-only cookie authentication.
4. Deriving all endpoint definitions, schemas, and security requirements from the OpenAPI contract served at `/console/openapi.json`.

The exception does **not** permit:

1. Introducing a frontend framework, build step, or separate application.
2. Duplicating endpoint definitions, request validation, or authorization logic client-side.
3. Modifying existing backend API semantics, authentication flows, or security models.
4. Weakening rate limiting, CORS policy, or any other security control for console convenience.

## Rationale

The API Console is a portfolio/demonstration surface, not a consumer-facing product UI. It serves the same purpose as a published Postman collection or Swagger UI instance: enabling evaluators and reviewers to discover and exercise the API without leaving the browser. All existing security boundaries remain intact; the console is a read-only consumer of the existing API contract.

## Migration Plan

No migration is required. The exception is forward-looking and applies to the `003-api-console` feature and any future developer documentation surfaces that meet the same constraints.

## Compliance Statement

All implementation work under `003-api-console` must verify compliance with this amendment and the existing constitution. The plan (`specs/003-api-console/plan.md`) documents the exception and serves as the feature-level compliance record.
