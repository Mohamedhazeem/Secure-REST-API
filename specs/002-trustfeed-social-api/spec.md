# Feature Specification: TrustFeed Social API

**Feature Branch**: `002-trustfeed-social-api`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create the complete TrustFeed specification by evolving the existing Secure REST API. My old files are testing purpose not real one. so this trust feed is real project. once going to plan or task we need to remove unrelated files and folder to trustfeed from the project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A developer can build a client from a complete, versioned API contract (Priority: P1)

A developer building a client application can read the published machine-readable API specification and implement a working integration without accessing source code. The specification accurately describes every available endpoint, required parameters, response shapes, error conditions, and cross-origin requirements. Browser-based applications can call the API from configured allowed origins without being blocked by the browser.

**Why this priority**: A stable, discoverable contract is the foundation for multi-app consumability. Without it, every consumer must reverse-engineer the API, which creates support burden and integration bugs.

**Independent Test**: A developer with no prior knowledge of the codebase can build a working client by reading only the published contract. All requests succeed and errors are diagnosable from the contract alone.

**Acceptance Scenarios**:

1. **Given** the machine-readable API specification is published, **When** a developer reads it, **Then** they can identify every available endpoint, required headers, and expected response shapes, including cross-origin requirements
2. **Given** the machine-readable API specification is published, **When** a consumer sends a request matching the specification, **Then** the actual response matches the documented schema
3. **Given** a browser-based application is loaded from an allowed origin, **When** it sends a cross-origin request to the API, **Then** the browser permits the request and the API responds successfully

---

### User Story 2 - A user can register, authenticate, and manage sessions securely (Priority: P1)

A person can create an account, log in, and receive tokens that let them call protected endpoints. They can view and revoke active sessions across their devices, and log out from a specific session. If a refresh token is stolen and reused, the system detects it and revokes all sessions for that user.

**Why this priority**: Authentication and session security are the prerequisite for every other social feature. A user must be able to trust that stolen credentials cannot be replayed indefinitely.

**Independent Test**: A user completes the full auth lifecycle — register, login, view sessions, refresh, logout — and a stolen refresh token triggers global revocation.

**Acceptance Scenarios**:

1. **Given** a user has registered, **When** they log in with valid credentials, **Then** they receive access and refresh tokens and an active session is created
2. **Given** a user has an active session, **When** they list their sessions, **Then** they see all active sessions with device and location context
3. **Given** a user has multiple sessions, **When** they revoke one session, **Then** only that session is invalidated and the others remain active
4. **Given** a user has multiple sessions, **When** they revoke all sessions, **Then** every session is invalidated and all access tokens become unusable
5. **Given** a refresh token has already been used, **When** it is presented again, **Then** the system detects reuse, revokes all sessions for that user, and returns an explicit error

---

### User Story 3 - A user can create, update, and delete their own posts (Priority: P2)

An authenticated user can create text posts, edit their own posts, and delete their own posts. The system prevents lost updates when two clients edit the same post concurrently.

**Why this priority**: Post authorship and ownership are the core content primitives of a social system. They must be reliable and conflict-free before building comments and follows.

**Independent Test**: A user creates a post, updates it, and deletes it. Two simultaneous updates to the same post result in exactly one success and one explicit conflict.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they create a post, **Then** the post is stored and attributed to them
2. **Given** a user authored a post, **When** they update it, **Then** the post content changes and the authorship remains correct
3. **Given** a user did not author a post, **When** they attempt to update or delete it, **Then** the request is denied with an explicit authorization error
4. **Given** two clients submit concurrent updates to the same post, **When** both requests complete, **Then** exactly one succeeds and the other receives a conflict response

---

### User Story 4 - A user can follow other users and view a personalized feed (Priority: P2)

A user can follow and unfollow other users. The system maintains a personalized feed of posts from followed users, delivered via deterministic cursor pagination without duplicates or skipped records.

**Why this priority**: Follow relationships and the personalized feed are the defining features of a social API. They create the graph that powers notifications and engagement.

**Independent Test**: A user follows another user who has posted content, then retrieves their feed and sees the new posts in chronological order with no duplicates or gaps.

**Acceptance Scenarios**:

1. **Given** two users exist, **When** one follows the other, **Then** the follow relationship is recorded and the followed user's posts appear in the follower's feed
2. **Given** a user follows another user, **When** they unfollow, **Then** the follow relationship is removed and future posts no longer appear in their feed
3. **Given** a user has a feed with many posts, **When** they paginate through it using cursors, **Then** each page returns the correct next set of posts with no duplicates or skipped records
4. **Given** a user tries to follow themselves, **When** the request is submitted, **Then** it is rejected with an explicit error

---

### User Story 5 - A user can comment on posts and receive notifications (Priority: P3)

An authenticated user can add comments to posts. When someone comments on their post, follows them, or interacts with their content, they receive a notification. Notifications are delivered reliably even when the system is under load.

**Why this priority**: Comments and notifications complete the social loop, but the feed and authorship primitives are more fundamental.

**Independent Test**: A user comments on another user's post and the post author receives a notification. Duplicate comment requests produce the same comment without duplication.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they submit a comment on a post, **Then** the comment is recorded and attributed to them
2. **Given** a user comments on another user's post, **When** the comment is created, **Then** the post author receives a notification
3. **Given** a user submits a comment with a previously used idempotency key, **When** the system processes it, **Then** the same comment is returned without creating a duplicate
4. **Given** a user has notifications, **When** they list their notifications, **Then** they receive them in reverse chronological order

---

### User Story 6 - The system resists common attack vectors and exposes operational health (Priority: P2)

A security auditor can verify that the API implements defense-in-depth against brute-force authentication, injection, token theft, and abuse. The system exposes health endpoints that report dependency status and carries a correlation identifier on every request.

**Why this priority**: A portfolio API that fails security review cannot be demonstrated to enterprise clients. Health endpoints are required for production operation and observability.

**Independent Test**: Run automated security scans and manual penetration tests against the API. All identified risks in the OWASP Top 10 have mitigations, and health endpoints correctly report dependency status.

**Acceptance Scenarios**:

1. **Given** a source sends rapid repeated login attempts, **When** the threshold is exceeded, **Then** subsequent attempts are delayed without affecting other users
2. **Given** a caller provides a forged or expired authentication token, **When** the request reaches the API, **Then** it is rejected before any business logic executes
3. **Given** a caller attempts to modify a resource owned by another user, **When** the operation is attempted, **Then** the request is denied with an authorization error
4. **Given** a dependency is unavailable, **When** a health check is performed, **Then** the readiness endpoint reports degraded status without crashing
5. **Given** a request is processed, **When** the response is returned, **Then** it includes a correlation identifier that links the request to logs and audit entries

---

### Edge Cases

- What happens when a user's account is deleted while they have active sessions?
- How does the system behave when the token blacklist store is temporarily unavailable?
- What occurs when two users attempt to follow each other simultaneously?
- How are partial failures handled when a post is created but the feed-fanout notification cannot be delivered?
- What happens when a user updates a post that has already been deleted by another operation?
- How does the system handle a caller whose role or permissions are revoked mid-session?
- What happens when a downstream dependency fails, and how does the system communicate that failure to the caller?
- How does the flat error model with stable codes support different consumer retry strategies without the API prescribing specific behavior?
- What happens when an idempotency key is reused after its retention window has expired?
- How does cursor pagination behave when new items are inserted into the middle of a paginated collection?

## Clarifications

### Session 2026-08-09

- Q: What user roles and permission model should the system enforce for authorization? → A: Fully configurable roles and permissions via admin API
- Q: How long should the system retain idempotency keys to support duplicate detection? → A: 7 days
- Q: What visibility settings should posts support, and who can see each level? → A: Public, followers-only, and private
- Q: Should likes/reactions be a first-class resource with its own endpoints and data model, or only trigger notifications without persistent storage? → A: First-class Like resource
- Q: When a user deletes their account, what should happen to their authored content and social relationships? → A: Anonymize and preserve content with "[deleted]" attribution
- Q: What fields should a notification payload contain for consumers to act on it without additional API calls? → A: Actor, action, target summary, and deep link

## Requirements _(mandatory)_

### Evolution Matrix

| Category          | Existing functionality to preserve                                                                         | Existing functionality to strengthen                                                | New TrustFeed functionality                                                                                                   | Existing functionality to retire                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Auth              | JWT access + refresh tokens, HTTP-only cookies, bcrypt password hashing, per-caller rate limiting          | Token rotation with reuse detection, session listing and revocation, device binding | Multiple concurrent sessions, global revocation on reuse, session metadata (device, IP, user agent)                           | None                                                                    |
| Authorization     | Role-based access control with configurable roles and permissions, ownership checks on mutating operations | Resource-level and attribute-level authorization policies evaluated per request     | Attribute-based access control for profile visibility and resource policies, centralized authorizer service                   | None                                                                    |
| Posts             | Post creation, listing, update, and deletion with author attribution                                       | Optimistic locking to prevent lost updates, idempotency on all mutating endpoints   | None                                                                                                                          | None                                                                    |
| Social            | None                                                                                                       | None                                                                                | Comments on posts, follow/unollow relationships, cursor-paginated personalized feed, asynchronous notifications               | None                                                                    |
| Observability     | Structured logging, correlation identifiers, health endpoints                                              | Distributed trace context propagated across request lifecycle                       | Request-scoped correlation IDs in all logs, metrics for critical paths, dependency status reporting                           | None                                                                    |
| Async processing  | None                                                                                                       | None                                                                                | Asynchronous background workers for notifications, feed fanout, and audit logging with bounded retry and dead-letter handling | None                                                                    |
| Audit             | None                                                                                                       | None                                                                                | Tamper-evident audit logging for security-relevant events with trace correlation                                              | None                                                                    |
| Data model        | User, post, role, permission, and refresh token entities                                                   | None                                                                                | Comment, follow, like, notification, and session entities                                                                           | None                                                                    |
| API contract      | Versioned OpenAPI specification as source of truth                                                         | Contract validation enforced in CI                                                  | Expanded contract covering new social endpoints                                                                               | None                                                                    |
| Testing           | Integration, performance, and end-to-end tests                                                             | Security and concurrency test coverage                                              | Contract tests, failure-mode tests, idempotency tests, cursor-pagination stability tests                                      | None                                                                    |
| Project structure | Clean layered architecture with repository pattern, swappable persistence                                  | None                                                                                | Modular feature organization, documented extension pattern for new resources                                                  | Legacy test-only files and unused scaffold from initial portfolio build |

---

### Functional Requirements

- **FR-001**: System MUST expose a complete, versioned, machine-readable API specification for every public endpoint, including request parameters, response schemas, and error conditions.
- **FR-002**: System MUST verify caller identity before allowing access to any protected resource or operation.
- **FR-003**: System MUST enforce rate limits per caller identity with predictable behavior and fair distribution of capacity.
- **FR-004**: System MUST return structured error responses containing a stable error code, human-readable message, and unique trace reference for every failure.
- **FR-005**: System MUST isolate business rules from transport, persistence, and external service implementations so that each can change independently.
- **FR-006**: System MUST validate all incoming data against explicit schemas before any business logic executes.
- **FR-007**: System MUST log security-relevant events without exposing secrets, tokens, or personally identifiable values.
- **FR-008**: System MUST rotate authentication tokens on refresh so that a stolen token has limited exposure.
- **FR-009**: System MUST enforce ownership checks on every operation that modifies or deletes a user-owned resource.
- **FR-010**: System MUST provide automated verification for every architectural layer through unit, integration, and end-to-end tests.
- **FR-011**: System MUST hash all sensitive credentials before storage and never expose them through API responses.
- **FR-012**: System MUST reject requests with malformed or oversized payloads before they reach business logic.
- **FR-013**: System MUST expire inactive authentication sessions after a configurable duration.
- **FR-014**: System MUST assign each authenticated caller to one or more roles, and evaluate permissions based on those roles before allowing protected operations.
- **FR-015**: System MUST allow role definitions and their associated permissions to be configured without changing business logic code.
- **FR-016**: System MUST deny access when a caller lacks a permission required by the requested operation, and return a structured authorization error.
- **FR-017**: System MUST return an explicit structured error immediately when an external dependency fails, without attempting automatic retries or fallbacks at the API layer.
- **FR-018**: System MUST use a flat error model containing only a stable error code, human-readable message, and trace reference, with no embedded retry guidance or category classification.
- **FR-019**: System MUST support cross-origin requests from browser-based client applications by returning appropriate cross-origin headers for configured allowed origins, with credentials enabled and preflight requests handled correctly.
- **FR-020**: System MUST support multiple concurrent authentication sessions per user, each independently revocable.
- **FR-021**: System MUST detect reuse of a refresh token and revoke all sessions for the affected user.
- **FR-022**: System MUST attach session metadata — including device fingerprint, IP address, and user agent — to each authentication session.
- **FR-023**: System MUST enforce attribute-level authorization policies in addition to role-based and ownership checks for sensitive resource operations.
- **FR-024**: System MUST allow users to create, retrieve, and delete comments on posts.
- **FR-025**: System MUST allow users to follow and unfollow other users, with atomic enforcement to prevent duplicate follow records.
- **FR-026**: System MUST provide a cursor-paginated feed of posts from followed users, with deterministic ordering and no duplicate or skipped records across pages.
- **FR-027**: System MUST deliver notifications asynchronously for follow, comment, and like events, with bounded retry and dead-letter handling.
- **FR-028**: System MUST accept an idempotency key on every mutating endpoint and return the same response for repeated submissions of the same key. Idempotency records MUST be retained for 7 days, after which the key expires and subsequent submissions create new resources.
- **FR-029**: System MUST use optimistic concurrency control on all mutating operations that modify existing resources, returning a conflict when a version mismatch is detected.
- **FR-030**: System MUST persist an audit record for every security-relevant event, including authentication, authorization failures, token reuse, and resource mutations.
- **FR-031**: System MUST propagate a correlation identifier across every request, including child operations, logs, and audit entries.
- **FR-032**: System MUST expose health endpoints that report liveness and readiness, with readiness checks covering all critical external dependencies.
- **FR-033**: System MUST export metrics for every critical path, including request duration, error rates, authentication outcomes, and queue processing status.
- **FR-034**: System MUST handle graceful shutdown by stopping acceptance of new requests, allowing in-flight operations to complete, and closing external connections cleanly.
- **FR-035**: System MUST support the documented extension pattern so that new resources can be added without modifying existing endpoint, service, or business-rule code.
- **FR-036**: System MUST enforce post visibility rules: public posts are viewable by anyone, followers-only posts are viewable only by the author's followers, and private posts are viewable only by the author. Feed generation MUST exclude posts the caller is not authorized to view.
- **FR-037**: System MUST expose Like as a first-class resource with create, delete, and list operations. A user can like or unlike a post, and the system MUST enforce uniqueness per user-post pair.
- **FR-038**: System MUST anonymize content and relationships when a user deletes their account. Authored posts and comments MUST be retained with attribution replaced by "[deleted]". Follow relationships MUST be removed. Likes MUST be anonymized or removed. The user's authentication credentials and personal data MUST be permanently deleted.
- **FR-039**: System MUST include actor, action, target summary, and deep link in every notification payload so clients can render the notification without additional API calls.

### Authorization Model

The system exposes an admin API for managing roles and permissions at runtime. Operators can create, update, and delete role definitions and their associated permission sets through this API. Business logic does not hardcode any role or permission; every authorization decision queries the configured policy store. This satisfies FR-014, FR-015, FR-016, and FR-023, and enables the ABAC extension without code changes.

### Key Entities

- **User**: An authenticated identity with a username, email, hashed password, display name, bio, privacy preferences, account status, and assigned roles. A user can author posts, comments, and follow relationships. When a user deletes their account, authored posts and comments are retained with "[deleted]" attribution, follow relationships are removed, likes are anonymized or removed, and all personal data and credentials are permanently deleted.
- **Post**: A content record authored by a user, with text content, visibility setting, and optimistic-lock version. Posts support three visibility levels: public (anyone can view), followers-only (only followers can view), and private (only the author can view). Posts are the primary feed unit.
- **Comment**: A response to a post, authored by a user, with optional parent-comment threading. Comments are atomic appends under a post.
- **Follow**: A directed relationship between two users, recording that one user follows the other. Follows are unique per follower-following pair.
- **Like**: A first-class record of a user's positive reaction to a post. Likes are unique per user-post pair and are queryable so clients can display counts and whether the current user has liked a post.
- **Notification**: An asynchronous event delivered to a user indicating a follow, comment, like, or other social interaction. The notification payload includes the acting user, the action type, a summary of the target resource, and a deep link for client navigation. Notifications are read/unread and ordered by creation time.
- **Session**: An active authentication session tied to a refresh token, with device fingerprint, IP address, user agent, creation time, and expiration time. Sessions are individually revocable.
- **Audit Log Entry**: An immutable record of a security-relevant event, capturing the acting user, action, resource type, resource identifier, IP address, user agent, correlation identifier, severity, and timestamp.
- **API Contract**: The published, versioned, machine-readable specification of every endpoint, its inputs, outputs, and error conditions. It is the sole source of truth for integration.
- **Error Response**: A structured output containing a stable error code, human-readable description, and unique trace reference. The response schema includes no retry guidance; consumers decide retry behavior independently.
- **Feed Page**: A deterministic slice of a user's personalized post timeline, identified by an opaque cursor and ordered by creation time.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: API consumers can discover and integrate endpoints using only the published machine-readable specification file, with no need to access source code or contact the backend team.
- **SC-002**: A developer can add a new endpoint following the documented pattern in under one development day, with zero modifications to existing code.
- **SC-003**: The API resists brute-force, injection, and token-theft attacks, with zero service disruption to legitimate users during normal operation.
- **SC-004**: 95% of client integration errors are diagnosable from the error response body alone, without access to server logs or support channels.
- **SC-005**: The system maintains sub-second p95 response times for authenticated requests under 1000 concurrent users, specifically below 950ms, and achieves 99.9% availability during normal operating conditions.
- **SC-006**: Every architectural layer has automated test coverage for its contracts, and the full test suite passes before any change is merged.
- **SC-007**: The published machine-readable API specification accurately reflects the live API, with no drift detected between specification and implementation.
- **SC-008**: New roles and permission sets can be introduced and applied without modifying existing endpoint implementations.
- **SC-009**: When an external dependency fails, the system returns an explicit structured error immediately without retries or fallbacks, and the failure is observable in logs.
- **SC-010**: Browser-based client applications from configured allowed origins can complete the full authentication and authorization flow without CORS errors.
- **SC-011**: A user can view and revoke all active sessions across their devices within three clicks.
- **SC-012**: Token reuse is detected and all sessions are revoked within one second of the reuse event.
- **SC-013**: Cursor pagination returns stable, deterministic results with no duplicate or skipped records across consecutive page requests, even when new items are inserted during pagination.
- **SC-014**: Idempotent requests return identical responses for repeated submissions of the same key, with no duplicate resource creation.
- **SC-015**: Concurrent updates to the same resource result in exactly one success and one conflict, with no lost updates.
- **SC-016**: Audit logs contain every security-relevant event, are tamper-evident, and can be correlated to individual requests via a shared identifier.
- **SC-017**: Background notifications are delivered with at least 99% success rate under normal operating conditions, with failed deliveries routed to a recoverable dead-letter queue.
- **SC-018**: Health readiness endpoints return degraded status within five seconds of a dependency failure and recover automatically when the dependency is restored.
- **SC-019**: The system shuts down gracefully, completing in-flight requests and background jobs within defined time bounds, with no data loss or partial writes.
- **SC-020**: 80% of post reads for hot content are served without hitting the primary data store.

## Assumptions

- Consumers are web, mobile, or service applications that integrate via HTTP and JSON.
- All API traffic operates over encrypted transport in every environment.
- Rate limiting thresholds are tuned for typical application traffic patterns and can be adjusted without code changes.
- Error responses include stable, versioned error codes that consumers can program against.
- The existing public API surface and HTTP status codes are preserved during the evolution.
- Test coverage targets are set by project governance and measured as part of the quality gate.
- Performance targets assume a single-region deployment with standard network latency; cross-region scenarios are out of scope for the initial release.
- Graceful degradation is defined as returning a structured error response within normal latency bounds, not as silent fallback or partial data.
- Retry and fallback logic, if needed, is implemented at the client or infrastructure layer, not within the API application itself.
- Cross-origin access is controlled by an explicit origin allowlist configured by whoever deploys the API in their environment. The allowlist is not hardcoded in the application, so any operator can host the API and permit only the origins they trust.
- The expected user base for the initial release is between one thousand and ten thousand concurrent users. Horizontal scaling architecture is designed but not required for this volume.
- Social graph depth is expected to remain under one thousand followers per user for the initial release. Feed generation strategies may be revisited as the graph grows.
- Notification delivery is asynchronous. Real-time push via WebSocket or similar is deferred to a future phase.
- Media uploads, full-text search, multi-tenancy, and external message brokers are out of scope for the initial release.
