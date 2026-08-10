# OpenAPI Contract Enhancements

**Feature**: API Console  
**Date**: 2026-08-10

## Purpose

These enhancements are required to make the interactive API Console informative and portfolio-ready. All examples must reflect actual backend behavior.

## Schema Examples

### Request Schemas

- **RegisterRequest**: Add `example` with realistic username, email, and password
- **LoginRequest**: Add `example` with realistic email and password
- **PostCreateRequest**: Add `example` with content and optional visibility
- **PostUpdateRequest**: Add `example` with version and partial content
- **CommentCreateRequest**: Add `example` with content and optional parentCommentId
- **LikeCreateRequest**: Add `example` with idempotencyKey

### Response Schemas

- **User**: Add `example` with _id, username, email
- **RegisterResponse / LoginResponse**: Add `example` with user object and message
- **Post**: Add `example` with _id, content, author, visibility, version, createdAt
- **Comment**: Add `example` with _id, postId, authorId, content, createdAt
- **Like**: Add `example` with _id, userId, postId, createdAt
- **Session**: Add `example` with id, userId, deviceFingerprint, ipAddress, userAgent, createdAt, expiresAt
- **Notification**: Add `example` with _id, recipientId, actorId, actorName, action, targetSummary, type, read, createdAt
- **FeedPage**: Add `example` with data array, cursor, hasNextPage
- **PaginatedPosts / PaginatedComments / PaginatedNotifications**: Add `example` with data, page, limit, total

### Error Responses

- Add `example` to all error response schemas showing realistic `code`, `message`, `traceId`

## Endpoint Enhancements

### Descriptions

- Add `description` to endpoints where currently missing or too terse
- Document authentication requirement in `summary` or `description`
- Document rate-limit behavior where applicable

### Headers

- Ensure `Idempotency-Key` header is documented in `components/headers.yaml` and referenced by endpoints that accept it
- Ensure `If-Match` header is documented and referenced by `PATCH /posts/{id}`
- Ensure `Retry-After` header is documented for rate-limited responses

### Security

- Verify `cookieAuth` and `refreshCookieAuth` are clearly described in `components/security.yaml`
- Add `x-tokenRefresh` extension or description noting that refresh requires the `refresh_token` cookie only

## Implementation Notes

- Enhancements are additive only (examples and descriptions)
- No endpoint paths, request/response shapes, or status codes are changed
- Contract validation (`npm run contract:lint`) must pass after changes
- Published copy (`backend/src/docs/openapi/`) must be regenerated via `npm run contract:sync`
