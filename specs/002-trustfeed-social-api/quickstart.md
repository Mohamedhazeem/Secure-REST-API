# Quickstart: TrustFeed Social API

**Feature**: TrustFeed Social API  
**Branch**: `002-trustfeed-social-api`  
**Date**: 2026-08-09

## Prerequisites

- Node.js >= 20
- MongoDB instance (local or cloud)
- Redis instance (local or cloud)
- Environment variables configured in `backend/.env`

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with database, Redis, and JWT secrets
```

## Validation Commands

```bash
# Boot the server
npm run dev

# In another terminal: run integration tests
npm test

# Validate OpenAPI contract
npm run contract:lint

# End-to-end smoke tests
npm run e2e
```

## Expected Outcomes

- Server boots cleanly and listens on the configured port.
- `/health/live` returns `200`.
- `/health/ready` returns `200` when MongoDB, Redis, and BullMQ are reachable.
- Contract validation passes against the OpenAPI specification in `contracts/`.
- Integration tests cover auth lifecycle, session management, post CRUD, comments, follows, likes, feed pagination, notifications, idempotency, optimistic locking, and failure modes.
- All tests pass before merge.

## Key Validation Scenarios

1. **Auth lifecycle**: Register → login → view sessions → refresh → logout → reuse detection triggers global revocation.
2. **Social graph**: Follow → feed contains followed user's posts → unfollow → feed no longer contains new posts.
3. **Likes**: Like a post → unlike returns 204 → duplicate like returns 409.
4. **Comments**: Create comment with idempotency key → duplicate request returns same comment without duplication.
4. **Concurrency**: Two concurrent updates to the same post → one succeeds, one returns `409`.
5. **Failure**: Stop MongoDB → API returns structured `DEPENDENCY_FAILURY` error; stop Redis → rate limiting degrades gracefully.

## References

- Contract: `specs/002-trustfeed-social-api/contracts/openapi.yaml`
- Data model: `specs/002-trustfeed-social-api/data-model.md`
- Research decisions: `specs/002-trustfeed-social-api/research.md`
