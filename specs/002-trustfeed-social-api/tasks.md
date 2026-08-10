# Tasks: TrustFeed Social API

**Input**: Design documents from `specs/002-trustfeed-social-api/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: REQUIRED per Constitution Principle VI — tests for auth flows, ownership checks, and failure modes MUST be written before the feature code they satisfy. Each user story below includes test tasks in a "Tests" subsection placed before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- All paths are relative to repository root under `backend/src/`
- Tests live under `backend/tests/` (unit, integration, e2e, performance, helpers)
- Background workers live under `backend/src/workers/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, cleanup of legacy scaffolding, and structure validation.

- [X] T001 Remove legacy memory repository implementations under `backend/src/repositories/implementations/memory/`
- [X] T002 Remove legacy unit test scaffolding under `backend/tests/unit/` and coverage artifacts
- [X] T003 Validate existing project structure matches the implementation plan layout

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Add idempotency middleware in `backend/src/middleware/idempotency.middleware.js` with Redis key TTL = 7 days per FR-028
- [X] T005 [P] Add correlation ID middleware in `backend/src/middleware/correlation.middleware.js`
- [X] T006 [P] Add audit logging service in `backend/src/service/audit.service.js` exposing `record(event)`; consumed by auth (token reuse), follow (T052), like (T053), comment (T080), and post (T038) services to persist security-relevant events (FR-030)
- [X] T007 [P] Add error codes for social features in `backend/src/utils/errors.js` (names: `AUTH_REUSE_DETECTED`, `FORBIDDEN`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `SELF_FOLLOW`, `VALIDATION_ERROR`, `DEPENDENCY_FAILURE`, `RATE_LIMITED`)
- [X] T008 [P] Add health check endpoints (liveness + readiness) in `backend/src/controller/health.controller.js`
- [X] T009 [P] Update `backend/src/configs/config.js` with new env vars: `BULLMQ_URL`, `FEED_CACHE_TTL_SECONDS`, `SESSION_IDLE_TTL_SECONDS`, `IDEMPOTENCY_TTL_DAYS=7`, `HEALTH_TIMEOUT_MS`
- [X] T010 [P] Update `backend/src/middleware/auth.middleware.js` for multi-session and token reuse detection
- [X] T011 [P] Update `backend/src/middleware/role.middleware.js` for runtime-configurable ABAC
- [X] T012 [P] Add structured logger integration with secret-redaction rules in `backend/src/utils/logger.js`
- [X] T013 [P] Add metrics collection (single source) in `backend/src/utils/metrics.js`
- [X] T014 [P] Add test infrastructure: `backend/vitest.config.js`, `backend/tests/global-setup.js` using mongodb-memory-server, and `backend/tests/helpers/` fixtures per Constitution VI

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Complete API Contract (Priority: P1)

**Goal**: Ensure the published machine-readable API specification is complete and accurate for every public endpoint.

**Independent Test**: A developer reads the contract and can identify every available endpoint, required headers, expected response shapes, and cross-origin requirements without accessing source code.

### Tests for User Story 1

- [X] T015 [P] [US1] Contract test asserting every path in `specs/002-trustfeed-social-api/contracts/openapi.yaml` has a matching implementation route in `backend/src/app.js`

### Implementation for User Story 1

- [X] T016 [P] [US1] Validate all existing endpoints are documented in `specs/002-trustfeed-social-api/contracts/openapi.yaml`
- [X] T017 [P] [US1] Add CORS, security scheme, and error schema documentation to `specs/002-trustfeed-social-api/contracts/components/`
- [X] T018 [P] [US1] Add response schema definitions to `specs/002-trustfeed-social-api/contracts/components/responses.yaml`
- [X] T019 [US1] Publish contract path in `backend/src/docs/openapi/` and wire contract validation into startup

**Checkpoint**: At this point, the published contract accurately describes every endpoint.

---

## Phase 4: User Story 2 - Register, Authenticate, and Manage Sessions (Priority: P1)

**Goal**: Users can register, log in, view and revoke sessions, and the system detects refresh token reuse. Account deletion anonymizes content and removes relationships.

**Independent Test**: A user completes the full auth lifecycle — register, login, view sessions, refresh, logout — and a stolen refresh token triggers global revocation.

### Tests for User Story 2

- [X] T020 [P] [US2] Integration test: auth lifecycle register→login→list sessions→refresh→logout in `backend/tests/integration/auth.test.js`
- [X] T021 [P] [US2] Integration test: reused refresh token triggers global revocation in `backend/tests/integration/auth.test.js`
- [X] T022 [P] [US2] Integration test: session revocation (single + all) in `backend/tests/integration/session.test.js`

### Implementation for User Story 2

- [X] T023 [P] [US2] Create Session model in `backend/src/models/session.model.js`
- [X] T024 [P] [US2] Create Session repository interface in `backend/src/repositories/interfaces/session.repository.js`
- [X] T025 [P] [US2] Create Session mongoose implementation in `backend/src/repositories/implementations/mongoose/session.repository.js`
- [X] T026 [P] [US2] Create Session validator in `backend/src/validators/session.validator.js`
- [X] T027 [US2] Update auth service for multi-session creation and metadata storage in `backend/src/service/auth.service.js`
- [X] T028 [US2] Implement token reuse detection and global revocation, and emit an audit entry in `backend/src/service/auth.service.js` (FR-030)
- [X] T029 [US2] Create session routes in `backend/src/routes/auth.routes.js`
- [X] T030 [US2] Wire session endpoints to controller and middleware in `backend/src/controller/auth.controller.js`
- [X] T031 [US2] Implement account deletion in `backend/src/service/user.service.js`: anonymize posts & comments (attribution → "[deleted]"), remove likes & follows, permanently delete credentials and personal data (FR-038)
- [X] T032 [US2] Add inactive-session expiry/cleanup sweep (honors `SESSION_IDLE_TTL_SECONDS`) in `backend/src/service/session.service.js` (FR-013)

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently.

---

## Phase 5: User Story 3 - Create, Update, and Delete Own Posts (Priority: P2)

**Goal**: Authenticated users can create, edit, and delete their own posts with optimistic locking and visibility control.

**Independent Test**: A user creates a post, updates it, and deletes it. Two simultaneous updates to the same post result in exactly one success and one explicit conflict.

### Tests for User Story 3

- [X] T033 [P] [US3] Integration test: post CRUD + ownership denial in `backend/tests/integration/post.test.js`
- [X] T034 [P] [US3] Concurrency test: two simultaneous updates → one 200, one 409 in `backend/tests/integration/post.test.js`

### Implementation for User Story 3

- [X] T035 [P] [US3] Update Post model with visibility enum and optimistic lock version in `backend/src/models/post.model.js`
- [X] T036 [P] [US3] Update Post repository interface for visibility filters and version checks in `backend/src/repositories/interfaces/post.repository.js`
- [X] T037 [P] [US3] Update Post mongoose implementation for visibility queries and optimistic locking in `backend/src/repositories/implementations/mongoose/post.repository.js`
- [X] T038 [US3] Update Post service for visibility enforcement and optimistic locking, and emit audit entries on create/update/delete in `backend/src/service/post.service.js` (FR-030)
- [X] T039 [P] [US3] Create Post validator for visibility and content constraints in `backend/src/validators/post.validator.js`
- [X] T040 [US3] Update Post controller to return 409 on version mismatch in `backend/src/controller/post.controller.js`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 6: User Story 4 - Follow Users and View Personalized Feed (Priority: P2)

**Goal**: Users can follow and unfollow other users, like posts, and view a cursor-paginated feed of followed users' posts via a Redis-backed write-fanout cache.

**Independent Test**: A user follows another user who has posted content, then retrieves their feed and sees the new posts in chronological order with no duplicates or gaps.

### Tests for User Story 4

- [ ] T041 [P] [US4] Integration test: follow→feed contains posts, unfollow excludes in `backend/tests/integration/follow.test.js`
- [ ] T042 [P] [US4] Integration test: like uniqueness, duplicate returns 409 in `backend/tests/integration/like.test.js`
- [ ] T043 [P] [US4] Performance test: cursor pagination no dup/skip under mid-pagination inserts in `backend/tests/performance/feed.test.js`

### Implementation for User Story 4

- [ ] T044 [P] [US4] Create Follow model in `backend/src/models/follow.model.js`
- [ ] T045 [P] [US4] Create Like model in `backend/src/models/like.model.js`
- [ ] T046 [P] [US4] Create Follow repository interface in `backend/src/repositories/interfaces/follow.repository.js`
- [ ] T047 [P] [US4] Create Like repository interface in `backend/src/repositories/interfaces/like.repository.js`
- [ ] T048 [P] [US4] Create Follow mongoose implementation in `backend/src/repositories/implementations/mongoose/follow.repository.js`
- [ ] T049 [P] [US4] Create Like mongoose implementation in `backend/src/repositories/implementations/mongoose/like.repository.js`
- [ ] T050 [P] [US4] Create Follow validator in `backend/src/validators/follow.validator.js`
- [ ] T051 [P] [US4] Create Like validator in `backend/src/validators/like.validator.js`
- [ ] T052 [US4] Create Follow service with atomic follow/unfollow and dispatch a follow notification via the notification queue in `backend/src/service/follow.service.js` (FR-027)
- [ ] T053 [US4] Create Like service with uniqueness enforcement and dispatch a like notification via the notification queue in `backend/src/service/like.service.js` (FR-027)
- [ ] T054 [US4] Create Feed service with cursor pagination, visibility filtering, and Redis write-fanout cache in `backend/src/service/feed.service.js` (Decision 2, SC-020)
- [ ] T055 [P] [US4] Create Follow routes in `backend/src/routes/follow.routes.js`
- [ ] T056 [P] [US4] Create Like routes in `backend/src/routes/like.routes.js`
- [ ] T057 [US4] Create Feed routes in `backend/src/routes/post.routes.js`
- [ ] T058 [US4] Wire follow, like, and feed controllers in `backend/src/controller/follow.controller.js`, `backend/src/controller/like.controller.js`, and `backend/src/controller/post.controller.js`

**Checkpoint**: At this point, User Stories 1, 2, 3, and 4 should all work independently.

---

## Phase 7: User Story 6 - Security, Observability, and Health (Priority: P2)

**Goal**: The API resists common attack vectors, exposes operational health endpoints with correlation identifiers, and shuts down gracefully.

**Independent Test**: Run automated security scans and manual penetration tests. All identified risks in the OWASP Top 10 have mitigations, and health endpoints correctly report dependency status.

### Tests for User Story 6

- [ ] T059 [P] [US6] Integration test: health readiness reflects dependency failure within `HEALTH_TIMEOUT_MS` in `backend/tests/integration/health.test.js`
- [ ] T060 [P] [US6] Integration test: rate-limit brute-force protection in `backend/tests/integration/ratelimit.test.js`

### Implementation for User Story 6

- [ ] T061 [P] [US6] Create Audit Log model in `backend/src/models/audit-log.model.js`
- [ ] T062 [P] [US6] Create Audit Log repository interface in `backend/src/repositories/interfaces/audit-log.repository.js`
- [ ] T063 [P] [US6] Create Audit Log mongoose implementation in `backend/src/repositories/implementations/mongoose/audit-log.repository.js`
- [ ] T064 [US6] Implement rate limiting for new social endpoints in `backend/src/middleware/ratelimiter.middleware.js`
- [ ] T065 [US6] Add dependency readiness checks in `backend/src/controller/health.controller.js`
- [ ] T066 [US6] Wire correlation ID and audit logging into request lifecycle orchestration in `backend/src/app.js` (middleware added in T005/T006; this task performs app-level composition only)
- [ ] T067 [US6] Add CORS origin allowlist enforcement in `backend/src/middleware/cors.middleware.js`
- [ ] T068 [US6] Add explicit structured dependency-failure error path in `backend/src/middleware/error.middleware.js` (FR-017, Principle IX)
- [ ] T069 [US6] Implement graceful shutdown handlers (SIGTERM/SIGINT) in `backend/src/index.js` with 10s in-flight HTTP / 30s background-job bounds (FR-034, SC-019, Decision 7)

**Checkpoint**: At this point, User Stories 1 through 4 and 6 should all work independently.

---

## Phase 8: User Story 5 - Comments and Notifications (Priority: P3)

**Goal**: Users can comment on posts and receive asynchronous notifications for social interactions via a BullMQ worker with bounded retry and dead-letter handling.

**Independent Test**: A user comments on another user's post and the post author receives a notification. Duplicate comment requests produce the same comment without duplication.

### Tests for User Story 5

- [ ] T070 [P] [US5] Integration test: comment, follow, and like events each create a notification for the target user in `backend/tests/integration/notification.test.js` (FR-027)
- [ ] T071 [P] [US5] Integration test: repeated comment/follow/like events (same idempotency key) produce exactly one notification each, no duplicates in `backend/tests/integration/notification.test.js` (FR-027)

### Implementation for User Story 5

- [ ] T072 [P] [US5] Create Comment model in `backend/src/models/comment.model.js`
- [ ] T073 [P] [US5] Create Notification model in `backend/src/models/notification.model.js`
- [ ] T074 [P] [US5] Create Comment repository interface in `backend/src/repositories/interfaces/comment.repository.js`
- [ ] T075 [P] [US5] Create Notification repository interface in `backend/src/repositories/interfaces/notification.repository.js`
- [ ] T076 [P] [US5] Create Comment mongoose implementation in `backend/src/repositories/implementations/mongoose/comment.repository.js`
- [ ] T077 [P] [US5] Create Notification mongoose implementation in `backend/src/repositories/implementations/mongoose/notification.repository.js`
- [ ] T078 [P] [US5] Create Comment validator in `backend/src/validators/comment.validator.js`
- [ ] T079 [P] [US5] Create Notification validator in `backend/src/validators/notification.validator.js`
- [ ] T080 [US5] Create Comment service with optimistic locking and emit an audit entry on create in `backend/src/service/comment.service.js` (FR-030)
- [ ] T081 [US5] Create Notification service in `backend/src/service/notification.service.js`
- [ ] T082 [US5] Create notification queue and worker with bounded retry + dead-letter queue in `backend/src/workers/notification.worker.js` (FR-027, SC-017, Decision 6)
- [ ] T083 [P] [US5] Create Comment routes in `backend/src/routes/comment.routes.js`
- [ ] T084 [P] [US5] Create Notification routes in `backend/src/routes/notification.routes.js`
- [ ] T085 [US5] Wire comment and notification controllers in `backend/src/controller/comment.controller.js` and `backend/src/controller/notification.controller.js`
- [ ] T086 [US5] Wire comment and notification routes into `backend/src/app.js`
- [ ] T087 [US5] Seed default roles and permissions via `backend/src/configs/seed.js` for the runtime-configurable ABAC admin API (FR-015)

**Checkpoint**: At this point, all user stories should be independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, validation, and cleanup across all user stories.

- [ ] T088 [P] Update `backend/src/app.js` to register all new routes, middleware, and error handlers
- [ ] T089 [P] Run contract validation against `specs/002-trustfeed-social-api/contracts/openapi.yaml`
- [ ] T090 [P] Execute quickstart validation scenarios from `specs/002-trustfeed-social-api/quickstart.md`
- [ ] T091 Remove any remaining legacy scaffolding and unused imports
- [ ] T092 Update `backend/src/docs/extension-pattern.md` with new social module patterns
- [ ] T093 Verify server boots cleanly and all health endpoints return expected status
- [ ] T094 [P] Run full test suite (unit/integration/e2e/performance) via `npm test` and ensure it passes before merge (Constitution VI)
- [ ] T095 [P] Add p95 latency load test under 1000 concurrent users asserting p95 < 950ms in `backend/tests/performance/load.test.js` (SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 - Contract validation
- **Phase 4 (US2)**: Depends on Phase 2 - Auth and sessions
- **Phase 5 (US3)**: Depends on Phase 2 - Posts
- **Phase 6 (US4)**: Depends on Phase 2 - Follows, likes, feed
- **Phase 7 (US6)**: Depends on Phase 2 - Security and observability
- **Phase 8 (US5)**: Depends on Phase 2 - Comments and notifications
- **Phase 9 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories
- **US2 (P1)**: No dependencies on other stories
- **US3 (P2)**: No dependencies on other stories
- **US4 (P2)**: No dependencies on other stories
- **US6 (P2)**: No dependencies on other stories
- **US5 (P3)**: No dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution VI)
- Models before services
- Services before endpoints
- Endpoints before wiring into app

### Parallel Opportunities

- Phase 1: All 3 setup tasks can run in parallel
- Phase 2: All 11 foundational tasks can run in parallel
- US1: Tests + 4 implementation tasks can run in parallel
- US2: 3 test tasks + 4 model/repo/validator tasks can run in parallel
- US3: 2 test tasks + 4 model/repo/validator tasks can run in parallel
- US4: 3 test tasks + 8 model/repo/validator/route tasks can run in parallel
- US6: 2 test tasks + 6 model/repo/controller tasks can run in parallel
- US5: 2 test tasks + 8 model/repo/validator/route tasks can run in parallel
- Phase 9: 4 of 7 tasks can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch all test tasks for User Story 2 together:
Task: "Integration test: auth lifecycle register→login→list sessions→refresh→logout"
Task: "Integration test: reused refresh token triggers global revocation"
Task: "Integration test: session revocation (single + all)"

# Launch all model/repository/validator tasks for User Story 2 together:
Task: "Create Session model in backend/src/models/session.model.js"
Task: "Create Session repository interface in backend/src/repositories/interfaces/session.repository.js"
Task: "Create Session mongoose implementation in backend/src/repositories/implementations/mongoose/session.repository.js"
Task: "Create Session validator in backend/src/validators/session.validator.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (including contract test T015)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 6 → Test independently → Deploy/Demo
7. Add User Story 5 → Test independently → Deploy/Demo
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
   - Developer E: User Story 6
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are REQUIRED per Constitution Principle VI and MUST be written before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
