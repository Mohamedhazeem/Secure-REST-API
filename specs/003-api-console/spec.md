# Feature Specification: API Console

**Feature Branch**: `003-api-console`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Add a minimal TrustFeed API Console to the completed TrustFeed backend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover TrustFeed and browse the API (Priority: P1)

A reviewer opens the console URL, reads a concise introduction explaining what TrustFeed demonstrates, and browses all available endpoints grouped by domain (Auth, Posts, Comments, Follows, Likes, Feed, Notifications, Admin, Health).

**Why this priority**: This is the entry point. Without discoverability, the rest of the console is inaccessible.

**Independent Test**: Open the console URL and verify the introduction and endpoint list render without any API calls.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** a reviewer opens the console URL, **Then** they see a concise introduction explaining TrustFeed's engineering capabilities.
2. **Given** the console is loaded, **When** the reviewer scans the endpoint list, **Then** endpoints are grouped by domain and each shows its method, path, and authentication requirement.

---

### User Story 2 - Execute unauthenticated endpoints (Priority: P1)

A reviewer selects an unauthenticated endpoint (e.g., health check), inspects its parameters and response schema, executes the request, and views the formatted JSON response with status code and headers.

**Why this priority**: Unauthenticated endpoints provide immediate value with zero setup, validating the console works.

**Independent Test**: Execute `GET /health` from the console and verify the response is formatted and visible.

**Acceptance Scenarios**:

1. **Given** the console is loaded, **When** the reviewer selects `GET /health` and clicks execute, **Then** the request is sent to the backend and the response is displayed.
2. **Given** a response is displayed, **When** the reviewer inspects it, **Then** they see the HTTP status, response headers, and formatted JSON body.

---

### User Story 3 - Authenticate and exercise protected endpoints (Priority: P1)

A reviewer uses the console to register or log in, obtains an authenticated session, and then executes protected endpoints (e.g., create a post, list posts, follow a user).

**Why this priority**: The core value of the console is interacting with the real authenticated API.

**Independent Test**: Register a user via the console, then create a post and verify the response.

**Acceptance Scenarios**:

1. **Given** the reviewer is unauthenticated, **When** they submit registration credentials via the console, **Then** they receive a success response and the console stores the session cookies.
2. **Given** the reviewer is authenticated, **When** they execute `POST /posts`, **Then** the request includes the session and the response is displayed.
3. **Given** the reviewer has an active session, **When** they execute a protected endpoint without valid credentials, **Then** the error response is displayed with status, error code, message, and trace ID.

---

### User Story 4 - Manage authentication lifecycle (Priority: P2)

A reviewer refreshes their access token, revokes a session, and logs out, understanding each step in the authentication workflow.

**Why this priority**: Session management is a key TrustFeed capability that evaluators should observe.

**Independent Test**: Log in, refresh the token, list sessions, revoke a session, and logout. Verify each action's response.

**Acceptance Scenarios**:

1. **Given** the reviewer has an active session, **When** they execute the refresh endpoint, **Then** a new access token is obtained and the console updates its session state.
2. **Given** the reviewer is authenticated, **When** they list sessions, **Then** active sessions are displayed.
3. **Given** the reviewer is authenticated, **When** they revoke a session and then try to use it, **Then** subsequent requests fail with an authentication error.

---

### User Story 5 - Explore advanced API behaviors (Priority: P2)

A reviewer tests advanced behaviors such as idempotency (replaying with the same `Idempotency-Key`), optimistic concurrency (`If-Match` with version), pagination cursors, and observes rate-limit responses.

**Why this priority**: These behaviors demonstrate production-grade backend engineering that differentiates TrustFeed.

**Independent Test**: Create a post with an `Idempotency-Key`, replay the same request, and verify the second response matches the first. Update a post with `If-Match` and verify version behavior.

**Acceptance Scenarios**:

1. **Given** the reviewer is authenticated, **When** they execute `POST /posts` with an `Idempotency-Key` header, **Then** the request succeeds.
2. **Given** the reviewer has a post with version `1`, **When** they execute `PATCH /posts/:id` with `If-Match: 1`, **Then** the update succeeds and returns version `2`.
3. **Given** the reviewer has a post with version `1`, **When** they execute `PATCH /posts/:id` with `If-Match: 2`, **Then** the request fails with a concurrency error.
4. **Given** the reviewer executes many requests in a short window, **When** they exceed the rate limit, **Then** the response shows `429` with a `RATE_LIMITED` error code.

---

### User Story 6 - Inspect health and readiness (Priority: P3)

A reviewer executes `GET /health` and `GET /health/ready` to verify backend health and dependency status.

**Why this priority**: Health endpoints are operational basics but lower priority than core API exploration.

**Independent Test**: Execute both health endpoints and verify the readiness probe reports dependency status.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** the reviewer executes `GET /health`, **Then** they see a healthy response.
2. **Given** the backend is running, **When** the reviewer executes `GET /health/ready`, **Then** they see dependency status for MongoDB and Redis.

---

### Edge Cases

- What happens when the backend is unreachable? The console must show a connection error without crashing.
- What happens when authentication cookies are blocked by the browser? The console must indicate the session is unavailable.
- What happens when a reviewer executes a request without required parameters? The console must show the validation error response from the backend.
- What happens when the OpenAPI contract is updated? The console must reflect the new contract without manual endpoint definition changes.

## Clarifications

### Session 2026-08-10

- Q: Where should the API Console be served from on the backend? → A: `/console`
- Q: How should the console obtain the OpenAPI contract at runtime? → A: Fetch from `/console/openapi.json`
- Q: Should the console page itself require authentication to view, or be publicly accessible? → A: Publicly accessible

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The console MUST display an introductory section explaining TrustFeed's engineering capabilities (secure session lifecycle, RBAC/ABAC, idempotency, concurrency control, Redis infrastructure, async processing, failure handling, observability, OpenAPI discipline, production testing).
- **FR-002**: The console MUST list all documented API endpoints grouped by domain (Auth, Posts, Comments, Follows, Likes, Feed, Notifications, Admin, Health).
- **FR-003**: Each endpoint entry MUST show its HTTP method, path, description, and whether authentication is required.
- **FR-004**: The console MUST display request parameters, request body schema, and response schemas derived from the OpenAPI contract.
- **FR-005**: The console MUST allow executing API requests against the running TrustFeed backend.
- **FR-006**: The console MUST display formatted JSON responses with HTTP status code and relevant response headers.
- **FR-007**: The console MUST display error responses showing HTTP status, TrustFeed error code, message, and trace/request identifier.
- **FR-008**: The console MUST support the full authentication workflow: register, login, refresh token, logout.
- **FR-009**: The console MUST maintain authenticated session state (cookies) to call protected endpoints.
- **FR-010**: The console MUST clearly indicate which endpoints require authentication and which are public.
- **FR-011**: The console MUST expose advanced request metadata fields: `Idempotency-Key`, `If-Match` (version), pagination cursors (`cursor`, `limit`), and rate-limit response information.
- **FR-012**: The console MUST derive its endpoint definitions, schemas, and security requirements from the OpenAPI contract served at `/console/openapi.json`.
- **FR-013**: The console MUST be served as a single page from the backend at `/console`.
- **FR-014**: The console MUST NOT modify existing backend API semantics, authentication flows, or security models.
- **FR-015**: The console MUST be responsive and suitable for demonstration on common screen sizes.
- **FR-016**: The console MUST support CORS for cross-origin API requests from its served origin.
- **FR-017**: The console MUST NOT duplicate endpoint definitions, request validation, or authorization logic client-side.

### Key Entities

- **Console Session**: Local browser state holding HTTP-only cookies issued by the TrustFeed backend.
- **API Request**: An HTTP request composed of method, path, query parameters, headers, and optional body, executed through the console.
- **API Response**: The HTTP response returned by the backend, including status code, headers, and body, formatted for display in the console.
- **Endpoint**: A documented API operation defined in the OpenAPI contract, including path, method, security requirements, parameters, request body, and responses.
- **Request Metadata**: Optional headers or parameters required by specific endpoints (Idempotency-Key, If-Match, cursor, limit).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can open the console URL, read the introduction, and locate an endpoint within 60 seconds.
- **SC-002**: A reviewer can complete the full authentication flow (register or login, call a protected endpoint, logout) within 3 minutes without external tools.
- **SC-003**: All endpoints defined in the OpenAPI contract are browsable from the console.
- **SC-004**: Request and response schemas shown in the console match the OpenAPI contract.
- **SC-005**: Error responses display HTTP status, TrustFeed error code, message, and trace/request identifier.
- **SC-006**: The console renders correctly on desktop and tablet screen sizes.
- **SC-007**: No existing backend API behavior is modified or weakened for console convenience.
- **SC-008**: The console implementation is contained within minimal, isolated files that do not interfere with existing backend modules.

## Assumptions

- The reviewer has access to a running TrustFeed backend instance.
- The backend's CORS configuration allows the console's origin.
- The OpenAPI contract is available at `/console/openapi.json` as a static file served by the backend.
- The console is a static single-page application served by Express and makes API requests to the same origin.
- HTTP-only cookies are automatically included in cross-origin requests when credentials mode is enabled.
- The console is intended for demonstration and testing, not for production use by end users.
