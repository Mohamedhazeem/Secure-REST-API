# Data Model: Secure Clean Architecture Refactor

**Feature**: 001-secure-clean-arch
**Date**: 2026-08-08

## Entities

### User

Represents an authenticated caller. Existing entity extended with role associations.

| Field       | Type              | Constraints                          | Notes                                                          |
| ----------- | ----------------- | ------------------------------------ | -------------------------------------------------------------- |
| `_id`       | ObjectId          | required, unique                     | Mongoose default                                               |
| `username`  | string            | required, unique, min 3, max 30      | Alphanumeric and underscores                                   |
| `email`     | string            | required, unique, valid email format | Lowercased before storage                                      |
| `password`  | string            | required, min 8                      | Hashed with bcrypt before storage; never returned in responses |
| `roles`     | array of ObjectId | required, references `Role`          | At least one role assigned at registration                     |
| `createdAt` | Date              | required                             | Set on creation                                                |
| `updatedAt` | Date              | required                             | Updated on modification                                        |
| `deletedAt` | Date              | optional                             | Soft-delete marker                                             |

**State transitions**:

- `active` → `deleted` when the user deletes their account
- Soft-deleted users cannot authenticate; existing tokens are invalidated on next refresh

**Indexes**:

- `username` (unique)
- `email` (unique)

---

### Post

Represents a user-owned resource. Existing entity preserved.

| Field         | Type     | Constraints                 | Notes                                     |
| ------------- | -------- | --------------------------- | ----------------------------------------- |
| `_id`         | ObjectId | required, unique            | Mongoose default                          |
| `name`        | string   | required, max 100           | Title of the post                         |
| `description` | string   | optional, max 1000          | Body text                                 |
| `age`         | number   | optional, min 0, max 150    | Numeric field for portfolio demonstration |
| `author`      | ObjectId | required, references `User` | Owner of the post                         |
| `createdAt`   | Date     | required                    | Set on creation                           |
| `updatedAt`   | Date     | required                    | Updated on modification                   |

**State transitions**: None beyond creation and modification.

**Indexes**:

- `author` (ownership queries)
- Compound index on `author` + `createdAt` for paginated own-posts queries

---

### Role

Represents a named collection of permissions. New entity introduced for RBAC.

| Field         | Type              | Constraints                       | Notes                                                        |
| ------------- | ----------------- | --------------------------------- | ------------------------------------------------------------ |
| `_id`         | ObjectId          | required, unique                  | Mongoose default                                             |
| `name`        | string            | required, unique, max 50          | Human-readable role name, e.g., `user`, `admin`              |
| `permissions` | array of ObjectId | required, references `Permission` | Empty array means no permissions beyond authenticated access |
| `createdAt`   | Date              | required                          | Set on creation                                              |
| `updatedAt`   | Date              | required                          | Updated on modification                                      |

**State transitions**: Roles are immutable after creation in v1; updates require migration scripts.

**Indexes**:

- `name` (unique)

---

### Permission

Represents a specific access right. New entity introduced for RBAC.

| Field         | Type     | Constraints               | Notes                                                                                                                    |
| ------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `_id`         | ObjectId | required, unique          | Mongoose default                                                                                                         |
| `code`        | string   | required, unique, max 100 | Stable permission code, e.g., `posts:create`, `posts:read`, `posts:update`, `posts:delete`, `users:read`, `users:delete` |
| `description` | string   | optional, max 200         | Human-readable explanation                                                                                               |
| `createdAt`   | Date     | required                  | Set on creation                                                                                                          |

**State transitions**: Permissions are immutable after creation in v1; additions require migration scripts.

**Indexes**:

- `code` (unique)

---

### RefreshToken

Represents a refresh token issued to a user. Existing concept made explicit.

| Field       | Type     | Constraints                 | Notes                     |
| ----------- | -------- | --------------------------- | ------------------------- |
| `_id`       | ObjectId | required, unique            | Mongoose default          |
| `tokenId`   | string   | required, unique            | JWT `jti` claim value     |
| `userId`    | ObjectId | required, references `User` | Owner of the token        |
| `expiresAt` | Date     | required                    | Matches JWT expiration    |
| `revokedAt` | Date     | optional                    | Set on logout or rotation |
| `createdAt` | Date     | required                    | Set on issuance           |

**State transitions**:

- `active` → `revoked` when user logs out or token is rotated
- Revoked tokens are checked against Redis blacklist before acceptance

**Indexes**:

- `tokenId` (unique)
- `userId` (lookup during refresh)
- `expiresAt` (TTL cleanup)

---

## Relationships

```
User ──┐
       ├── belongs to many ── Role
Role ──┤
       └── has many ── Permission

User ── has many ── Post
User ── has many ── RefreshToken
```

- A `User` can have multiple `Role`s.
- A `Role` can have multiple `Permission`s.
- A `User` owns many `Post`s.
- A `User` can have many active `RefreshToken`s (multi-session support).

---

## Validation Rules

- All string fields reject leading/trailing whitespace where meaningful (`username`, `email`, `role.name`, `permission.code`).
- `email` is stored lowercased; uniqueness is case-insensitive.
- `password` is hashed with bcrypt cost factor 10+ before persistence; the raw value never touches the database layer.
- `roles` on `User` must reference existing `Role` documents.
- `permissions` on `Role` must reference existing `Permission` documents.
- `author` on `Post` must reference an existing active `User`.

---

## Seed Data (Development Only)

Initial roles and permissions are seeded on first boot in development:

- Role: `user` with permissions `posts:read`, `posts:create`
- Role: `admin` with all permissions
- Permission codes follow the pattern `<resource>:<action>` where resource is `posts`, `users`, and action is `create`, `read`, `update`, `delete`
