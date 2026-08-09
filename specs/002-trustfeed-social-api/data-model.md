# Data Model: TrustFeed Social API

**Feature**: TrustFeed Social API  
**Branch**: `002-trustfeed-social-api`  
**Date**: 2026-08-09

## Entities

### User

Represents an authenticated identity in the system.

**Fields**:
- `id` — unique identifier
- `username` — unique, lowercase handle
- `email` — unique, lowercase contact address
- `passwordHash` — hashed credential; never exposed via API
- `displayName` — public-facing name
- `bio` — free-text biography
- `avatarUrl` — optional profile image reference
- `privacy` — container for visibility preferences
  - `profilePublic` — whether the profile is visible to non-owners
  - `showFollows` — whether follow relationships are visible
- `status` — account lifecycle state (`active`, `suspended`, `deleted`)
- `roles` — assigned authorizations
- `version` — optimistic lock counter

**Relationships**:
- A user can author many posts.
- A user can author many comments.
- A user can have many follow relationships as follower.
- A user can have many follow relationships as following.
- A user can receive many notifications.
- A user can have many active sessions.

**State transitions**:
- `active` → `suspended` (admin action)
- `active` → `deleted` (user self-service or admin action)
- A deleted user's tokens become inert on next auth check.
- On deletion: authored posts and comments are retained with attribution replaced by "[deleted]"; follow relationships are removed; likes are anonymized or removed; all personal data and credentials are permanently deleted.

---

### Post

Represents a content unit authored by a user.

**Fields**:
- `id` — unique identifier
- `content` — text body
- `authorId` — reference to the owning user
- `visibility` — access control (`public`, `followers-only`, `private`)
- `version` — optimistic lock counter
- `createdAt` — creation timestamp
- `updatedAt` — last modification timestamp

**Relationships**:
- A post belongs to exactly one author (user).
- A post can have many comments.
- A post can appear in many users' feeds.

**Validation rules**:
- `content` must be non-empty and within length bounds.
- `authorId` is assigned by the system from the authenticated context; client-supplied values are rejected.
- `visibility` defaults to `public`; supported values are `public`, `followers-only`, and `private`. Only the author or an authorized moderator can change it. Feed generation MUST exclude posts the caller is not authorized to view.

**State transitions**:
- Created → updated (version increments)
- Updated → deleted

---

### Comment

Represents a response to a post.

**Fields**:
- `id` — unique identifier
- `postId` — reference to the parent post
- `authorId` — reference to the commenting user
- `content` — text body
- `parentCommentId` — optional reference to a parent comment for threading
- `version` — optimistic lock counter
- `createdAt` — creation timestamp

**Relationships**:
- A comment belongs to exactly one post.
- A comment belongs to exactly one author (user).
- A comment may have child comments (threading).

**Validation rules**:
- `postId` must reference an existing post.
- `authorId` is assigned by the system from the authenticated context.
- `content` must be non-empty and within length bounds.

**State transitions**:
- Created → updated (version increments)
- Updated → deleted

---

### Follow

Represents a directed subscription between two users.

**Fields**:
- `id` — unique identifier
- `followerId` — reference to the user who follows
- `followingId` — reference to the user being followed
- `createdAt` — timestamp of the follow action

**Relationships**:
- A follow connects exactly two users.
- A user can follow many other users.
- A user can be followed by many other users.

**Validation rules**:
- `followerId` and `followingId` must reference existing users.
- A user cannot follow themselves; this is rejected with an explicit error.
- Duplicate follow pairs are prevented by a uniqueness constraint.

**State transitions**:
- Created → removed (unfollow)

---

### Like

Represents a user's positive reaction to a post.

**Fields**:
- `id` — unique identifier
- `userId` — reference to the liking user
- `postId` — reference to the liked post
- `createdAt` — timestamp of the like action

**Relationships**:
- A like connects exactly one user and one post.
- A user can like many posts.
- A post can receive many likes.

**Validation rules**:
- `userId` and `postId` must reference existing active users and posts.
- A user cannot like the same post more than once; uniqueness is enforced per user-post pair.

**State transitions**:
- Created → removed (unlike)

---

### Notification

Represents an asynchronous event delivered to a user.

**Fields**:
- `id` — unique identifier
- `recipientId` — reference to the user who receives the notification
- `actorId` — reference to the user who triggered the event
- `type` — event category (`follow`, `comment`, `like`)
- `actorName` — display name or identifier of the acting user for client rendering
- `action` — human-readable description of the event
- `targetSummary` — concise summary of the related resource for inline display
- `deepLink` — URI the client can navigate to for full context
- `resourceId` — reference to the related entity (post, comment, etc.)
- `read` — whether the recipient has viewed the notification
- `createdAt` — event timestamp

**Relationships**:
- A notification belongs to exactly one recipient.
- A notification is triggered by exactly one actor.
- A notification may reference one resource entity.

**Validation rules**:
- `recipientId` and `actorId` must reference existing active users.
- `type` must be a defined notification category.
- `resourceId` must reference an existing entity of the appropriate type for the category.

**State transitions**:
- Created → read

---

### Session

Represents an active authentication session tied to a refresh token.

**Fields**:
- `id` — unique session identifier
- `userId` — reference to the owning user
- `refreshTokenHash` — hashed representation of the current refresh token
- `deviceFingerprint` — hash of client device attributes
- `ipAddress` — IP address from the login request
- `userAgent` — client software identifier
- `createdAt` — session creation timestamp
- `expiresAt` — session expiration timestamp

**Relationships**:
- A session belongs to exactly one user.
- A user can have many concurrent sessions.

**Validation rules**:
- `refreshTokenHash` is computed server-side; never stored or transmitted in plaintext.
- `expiresAt` is bounded by the configured refresh token lifetime plus a small buffer.
- Session metadata is immutable after creation; revocation is a state transition, not an edit.

**State transitions**:
- Active → revoked (by user action, logout, or token reuse detection)

---

### Audit Log Entry

Represents an immutable record of a security-relevant event.

**Fields**:
- `id` — unique identifier
- `actorId` — reference to the acting user, or null for unauthenticated events
- `action` — event category (e.g., `auth.login`, `post.delete`, `token.reuse_detected`)
- `resourceType` — the type of entity affected (e.g., `Post`, `User`)
- `resourceId` — reference to the affected entity, or null
- `ipAddress` — source IP of the request
- `userAgent` — client software identifier
- `metadata` — additional contextual key-value pairs
- `traceId` — correlation identifier linking to the request trace
- `severity` — importance level (`info`, `warning`, `critical`)
- `createdAt` — event timestamp

**Relationships**:
- An audit entry is associated with zero or one actor.
- An audit entry is associated with zero or one resource.

**Validation rules**:
- `action` must be a defined event type.
- `severity` must be one of the allowed values.
- `traceId` must be present for authenticated requests; generated server-side for unauthenticated events.

**State transitions**:
- Created (append-only; no updates or deletes)

---

### Feed Page

Represents a deterministic slice of a user's personalized post timeline.

**Fields**:
- `cursor` — opaque pagination token encoding the last seen item position
- `posts` — ordered list of post summaries for the current page
- `hasNextPage` — whether additional pages exist

**Relationships**:
- A feed page belongs to the requesting user.
- Posts in the page are sourced from users followed by the requesting user.

**Validation rules**:
- Cursor encoding is an opaque base64 string; clients must not inspect or construct cursors manually.
- Ordering is deterministic by creation time, with a stable tiebreaker for identical timestamps.
- New items inserted during pagination do not cause duplicates or skips across pages.

**State transitions**:
- N/A (read-only projection)

---

## Entity Relationship Summary

```
User ────< Post ────< Comment
   │           │
   │           └───< Notification
   │
   ├───< Follow >─── User
   │
   ├───< Like >─── Post
   │
   ├───< Session
   │
   └───< AuditLogEntry
```

---

## Indexing Requirements

*Implementation note: These logical index requirements must be satisfied by the persistence layer.*

- Posts: ordered by author and creation time for user post history.
- Comments: ordered by post and creation time for thread display.
- Follows: unique per follower-following pair; ordered by following for follower lists.
- Notifications: ordered by recipient and creation time for notification feeds.
- Audit logs: ordered by actor and creation time; ordered by action and creation time for security event queries.
- Sessions: ordered by user and expiration time for session management.
