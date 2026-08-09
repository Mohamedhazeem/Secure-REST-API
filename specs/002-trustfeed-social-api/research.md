# Research: TrustFeed Social API

**Feature**: TrustFeed Social API  
**Branch**: `002-trustfeed-social-api`  
**Date**: 2026-08-09

## Overview

This document resolves open questions from the TrustFeed brief and records the design decisions that shape the implementation plan. All decisions are documented with rationale and alternatives considered.

---

## Decision 1: Idempotency Key Location

**Question**: Should the idempotency key be sent as an `Idempotency-Key` header or as a field in the request body?

**Decision**: Header `Idempotency-Key` for all mutating requests.

**Rationale**: 
- REST-standard placement; works uniformly across POST, PATCH, and DELETE without polluting request bodies.
- Allows middleware to intercept and deduplicate before validation or business logic executes.
- Aligns with common API gateway and client library support for idempotency keys.

**Alternatives considered**:
- Body field: More explicit but requires per-endpoint schema changes and bypasses middleware-based deduplication.
- Auto-generated key: Useful for webhook retries but does not address client-initiated duplicate submissions, which is the primary use case.

---

## Decision 2: Feed Fanout Strategy

**Question**: Write fanout (post created → push to all followers) vs. read fanout (aggregate on read).

**Decision**: Write fanout with a documented threshold for migration.

**Rationale**:
- For the expected social graph depth (< 1k followers per user), write fanout keeps reads O(1) per follower and simplifies pagination.
- Feed timeline can be maintained in a Redis-backed store; write cost is bounded by follower count.
- The threshold for switching to read fanout is documented in the spec: if average followers per user exceeds 5,000, the system should re-evaluate.

**Alternatives considered**:
- Read fanout: Avoids write amplification but makes pagination and ranking more complex; deferred until graph depth justifies it.

---

## Decision 3: Notification Delivery and Profile Unread Count

**Question**: Should the API return `notification.unreadCount` in the user profile?

**Decision**: Yes. Include `unreadNotificationCount` in the user profile response.

**Rationale**:
- Inexpensive to compute (counter or cached aggregation).
- Common UX pattern; clients need this to render badge counts without an extra request.
- Does not require real-time push; the count is updated when notifications are created or marked read.

**Alternatives considered**:
- Separate endpoint only: Adds client complexity for a cheap piece of data.
- Real-time push via WebSocket: Deferred to Phase 2 per non-goals.

---

## Decision 4: ABAC Granularity

**Question**: Field-level ABAC (hide `bio` if private) vs. endpoint-level only.

**Decision**: Endpoint-level ABAC for MVP; document field-level as future.

**Rationale**:
- Endpoint-level policies (e.g., `profilePublic` flag controlling who can view a profile) cover the MVP use cases.
- Field-level hiding adds serialization complexity and is better addressed at the contract/serialization layer in a future iteration.
- The centralized authorizer service is designed to support field-level policies when needed.

**Alternatives considered**:
- Field-level ABAC now: Premature; MVP does not require hiding individual fields within a viewable profile.

---

## Decision 5: Cursor Encoding

**Question**: Opaque cursor (base64 of `{ lastId, createdAt }`) vs. simple `createdAt` + `id`.

**Decision**: Opaque cursor encoded as base64 of a JSON object containing `{ id, createdAt }`.

**Rationale**:
- Opaque cursors allow the server to change pagination internals without breaking clients.
- Encodes both identity and sort timestamp, preventing ambiguity when items share timestamps.
- Base64 is standard for cursor-based pagination in production APIs.

**Alternatives considered**:
- Simple `createdAt` + `id` in query params: Easier to debug but couples clients to internal sort fields and makes migration harder.

---

## Decision 6: Async Processing Guarantees

**Question**: What guarantees does the system provide for async jobs (notifications, feed fanout, audit logs)?

**Decision**: At-least-once delivery with idempotent processing and bounded retry.

**Rationale**:
- BullMQ workers retry failed jobs with exponential backoff up to a per-queue maximum.
- Jobs carry a deterministic `jobId` (hash of type + resourceId + recipientId) and are deduplicated via a Redis processed-set.
- After max retries, jobs move to a dead-letter queue (DLQ) for manual inspection and replay.
- This provides durability without requiring exactly-once semantics, which would require distributed transactions.

**Alternatives considered**:
- Exactly-once via outbox pattern: Adds database schema complexity and is not required for the portfolio scope.
- Fire-and-forget: Loses durability; rejected because audit logs and notifications must not be silently dropped.

---

## Decision 7: Graceful Shutdown Time Bounds

**Question**: What are the time bounds for in-flight request and job completion during shutdown?

**Decision**: 10 seconds for in-flight HTTP requests, 30 seconds for in-flight background jobs.

**Rationale**:
- 10s is sufficient for most API operations while keeping deployment cycles fast.
- 30s allows BullMQ workers to complete or re-queue jobs without abrupt termination.
- These bounds are configurable in production via environment variables.

**Alternatives considered**:
- Immediate shutdown: Risks data loss and partial writes.
- Unlimited wait: Risks hung deployments.

---

## Decision 8: Rate Limiting Fail-Open vs. Fail-Closed

**Question**: When Redis is unavailable, should rate limiting fail open (allow requests) or fail closed (deny all)?

**Decision**: Fail open for the global API limiter; fail closed for session-dependent operations.

**Rationale**:
- Failing open on the global limiter prevents Redis outages from causing self-DDoS.
- Session operations (refresh, logout, session listing) require Redis and must fail closed because they cannot function without the session store.
- Auth endpoint rate limiting uses an in-memory or Redis store; if Redis is down, the stricter login limiter degrades to a local in-memory limiter to preserve brute-force protection.

**Alternatives considered**:
- Fail closed everywhere: Prevents abuse during Redis outages but risks total unavailability.
- Fail open everywhere: Risks credential stuffing during Redis outages.

---

## Decision 9: Existing Files to Retire

**Question**: Which existing files are test-only scaffolding and should be removed as part of TrustFeed?

**Decision**: Retire files under `backend/src/repositories/implementations/memory/`, `backend/tests/unit/`, `backend/coverage/`, and any `probe-run.txt` artifacts.

**Rationale**:
- The user explicitly stated old files are for testing purposes only and TrustFeed is the real project.
- In-memory repository implementations are replaced by a unified test strategy using mongodb-memory-server and real store behavior.
- Coverage reports and probe artifacts are build outputs, not source.

**Alternatives considered**:
- Keep memory implementations: Adds maintenance burden and contradicts the "real project" directive.

---

## Decision 10: Authorization Configuration Model

**Question**: Should roles and permissions be hardcoded, configurable via file, or managed through an admin API?

**Decision**: Fully configurable roles and permissions via admin API at runtime.

**Rationale**:
- Satisfies FR-014, FR-015, FR-016, and FR-023 without code changes.
- Enables ABAC extension without redeployment.
- Operators can adapt access policies to changing requirements.

**Alternatives considered**:
- Hardcoded roles: Inflexible and requires code changes for policy updates.
- File-based configuration: Requires restart to apply changes and is error-prone.

---

## Decision 11: Idempotency Key Retention

**Question**: How long should the system retain idempotency keys?

**Decision**: 7 days.

**Rationale**:
- Balances duplicate detection for typical retry behavior with reasonable storage costs.
- 24 hours is too short for manual retries; 30 days creates unnecessary storage burden.

**Alternatives considered**:
- 24 hours: Too short for manual retries.
- 30 days: Unnecessary storage burden for a social API.

---

## Decision 12: Post Visibility Levels

**Question**: What visibility settings should posts support?

**Decision**: Public, followers-only, and private.

**Rationale**:
- Standard social API pattern enabling discoverability, social graph respect, and user control.
- Maps cleanly to ABAC and keeps feed filter simple.

**Alternatives considered**:
- Public only: No user control.
- Public and private only: Missing followers-only granularity.

---

## Decision 13: Likes as First-Class Resource

**Question**: Should likes be a first-class resource or ephemeral events?

**Decision**: First-class Like resource with create, delete, and list operations.

**Rationale**:
- Enables like counts, unlike operations, and queryable like status.
- Aligns with Comments and Follows as persistent entities.

**Alternatives considered**:
- Ephemeral events only: Prevents like counts and reliable unlike operations.

---

## Decision 14: Account Deletion Behavior

**Question**: What happens to authored content and relationships when a user deletes their account?

**Decision**: Anonymize and preserve content with "[deleted]" attribution.

**Rationale**:
- Preserves conversation context and feed stability.
- Removes personal data to satisfy privacy expectations.

**Alternatives considered**:
- Hard delete: Breaks threads and orphaned references.
- Full preservation: Violates privacy expectations.

---

## Decision 15: Notification Payload

**Question**: What fields should a notification payload contain?

**Decision**: Actor, action, target summary, and deep link.

**Rationale**:
- Minimal viable payload for client rendering without additional API calls.
- Provides context and navigation without embedding full resources.

**Alternatives considered**:
- Only actor and action: Insufficient context for client rendering.
- Full embedded resource: Bloats payload and duplicates data.

---

## Summary of Open Questions Resolved

All open questions from the TrustFeed brief are resolved above. No unresolved or conflicting behavioral decisions remain that require `/speckit.clarify`.
