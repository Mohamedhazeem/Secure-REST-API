# Tasks: Secure Clean Architecture Refactor

**Input**: Design documents from `specs/001-secure-clean-arch/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/openapi.yaml, quickstart.md
**Tests**: Included where constitution mandates verification; existing vitest/supertest/mongodb-memory-server stack is reused.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure

- [ ] T001 Create directory structure for repositories, validators, and docs per plan.md
- [ ] T002 [P] Create vitest configuration with test environment setup in `backend/vitest.config.js`
- [ ] T003 [P] Create test helper utilities in `backend/tests/helpers/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create user repository interface in `backend/src/repositories/interfaces/user.repository.js`
- [ ] T005 [P] Create post repository interface in `backend/src/repositories/interfaces/post.repository.js`
- [ ] T006 [P] Create role repository interface in `backend/src/repositories/interfaces/role.repository.js`
- [ ] T007 [P] Create permission repository interface in `backend/src/repositories/interfaces/permission.repository.js`
- [ ] T008 [P] Create refresh repository interface in `backend/src/repositories/interfaces/refresh.repository.js`
- [ ] T009 [P] Implement mongoose user repository in `backend/src/repositories/implementations/mongoose/user.repository.js`
- [ ] T010 [P] Implement mongoose post repository in `backend/src/repositories/implementations/mongoose/post.repository.js`
- [ ] T011 [P] Implement mongoose role repository in `backend/src/repositories/implementations/mongoose/role.repository.js`
- [ ] T012 [P] Implement mongoose permission repository in `backend/src/repositories/implementations/mongoose/permission.repository.js`
- [ ] T013 [P] Implement mongoose refresh repository in `backend/src/repositories/implementations/mongoose/refresh.repository.js`
- [ ] T014 [P] Implement memory user repository for tests in `backend/src/repositories/implementations/memory/user.repository.js`
- [ ] T015 [P] Implement memory post repository for tests in `backend/src/repositories/implementations/memory/post.repository.js`
- [ ] T016 [P] Implement memory role repository for tests in `backend/src/repositories/implementations/memory/role.repository.js`
- [ ] T017 Create stable error codes utility in `backend/src/utils/errors.js`
- [ ] T018 [P] Create structured logger utility in `backend/src/utils/logger.js`
- [ ] T019 Centralize environment variable reads in `backend/src/configs/config.js`
- [ ] T020 Update database connection to support test environment in `backend/src/configs/database.js`
- [ ] T021 [P] Create user validator in `backend/src/validators/user.validator.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - API consumers can discover and integrate endpoints using a complete contract (Priority: P1) 🎯 MVP

**Goal**: Publish a machine-readable OpenAPI contract and enable CORS so browser-based clients can integrate without source-code access.

**Independent Test**: A developer with no prior knowledge of the codebase can build a working client by reading only `specs/001-secure-clean-arch/contracts/openapi.yaml`. All requests succeed and cross-origin requests from allowed origins are accepted.

### Tests for User Story 1

- [ ] T022 [P] [US1] Add CORS integration tests in `backend/tests/integration/cors.test.js`

### Implementation for User Story 1

- [ ] T023 [US1] Validate and update OpenAPI contract in `specs/001-secure-clean-arch/contracts/openapi.yaml`
- [ ] T024 [P] [US1] Create CORS config in `backend/src/configs/cors.js`
- [ ] T025 [P] [US1] Create CORS middleware in `backend/src/middleware/cors.middleware.js`
- [ ] T026 [US1] Wire CORS middleware and preflight handling in `backend/src/app.js`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - The system resists common attack vectors without disrupting legitimate traffic (Priority: P2)

**Goal**: Implement RBAC, ownership checks, rate limiting, token blacklist, and fail-fast dependency handling so the API passes a security audit without disrupting legitimate users.

**Independent Test**: Run automated security scans and manual tests. All OWASP Top 10 risks have mitigations, and no legitimate user is blocked during normal operation.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Create Role model in `backend/src/models/role.model.js`
- [ ] T028 [P] [US2] Create Permission model in `backend/src/models/permission.model.js`
- [ ] T029 [P] [US2] Create RefreshToken model in `backend/src/models/refresh_token.model.js`
- [ ] T030 [US2] Implement role enforcement middleware in `backend/src/middleware/role.middleware.js`
- [ ] T031 [US2] Add development seed data for roles and permissions in `backend/src/configs/seed.js`, triggered on server boot in development mode
- [ ] T032 [US2] Add ownership checks in post service layer in `backend/src/service/post.service.js`
- [ ] T033 [US2] Implement refresh token blacklist with Redis TTL in `backend/src/service/auth.service.js`
- [ ] T034 [US2] Implement fail-fast error handling for external dependency failures in `backend/src/middleware/error.middleware.js`
- [ ] T035 [US2] Update rate limiter configuration in `backend/src/configs/constants.js` with separate limits for login and authenticated requests, and increase authenticated user limit
- [ ] T036 [US2] Add RBAC and security integration tests in `backend/tests/integration/rbac.test.js`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - New features can be added by following a documented pattern without modifying existing code (Priority: P2)

**Goal**: Refactor existing endpoints to use repository interfaces and document the extension pattern so new resources can be added by creating new files only.

**Independent Test**: Add a new resource type by implementing only new files in the prescribed pattern. Existing endpoints continue to pass all tests and serve traffic unchanged.

### Implementation for User Story 3

- [ ] T037 [P] [US3] Refactor User model to remove infrastructure imports and ensure pure domain representation in `backend/src/models/user.model.js`
- [ ] T038 [P] [US3] Refactor Post model to remove infrastructure imports and ensure pure domain representation in `backend/src/models/post.model.js`
- [ ] T039 [US3] Refactor auth service to use repository interfaces in `backend/src/service/auth.service.js`
- [ ] T040 [US3] Extract post service from controller in `backend/src/service/post.service.js`
- [ ] T041 [US3] Refactor post controller to use post service in `backend/src/controller/post.controller.js`
- [ ] T042 [P] [US3] Create user service in `backend/src/service/user.service.js`
- [ ] T043 [P] [US3] Create user controller in `backend/src/controller/user.controller.js`
- [ ] T044 [P] [US3] Create user routes in `backend/src/routes/user.routes.js`
- [ ] T045 [P] [US3] Extract auth controller logic from user.controller.js into `backend/src/controller/auth.controller.js`
- [ ] T046 [US3] Document extension pattern in `backend/src/docs/extension-pattern.md`
- [ ] T047 [US3] Add clean architecture integration tests in `backend/tests/integration/architecture.test.js`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Errors provide actionable information to help consumers fix integration issues (Priority: P3)

**Goal**: Standardize all error responses into a flat envelope with stable codes, human-readable messages, and trace references, with no retry guidance or category fields.

**Independent Test**: Trigger each documented error condition and verify the response contains `code`, `message`, and `traceId` only. Confirm consumers can determine corrective action from the response alone.

### Implementation for User Story 4

- [ ] T048 [US4] Create error factory with stable codes in `backend/src/utils/errors.js`
- [ ] T049 [P] [US4] Implement error handling middleware in `backend/src/middleware/error.middleware.js`
- [ ] T050 [P] [US4] Implement error service in `backend/src/service/error.service.js`
- [ ] T051 [P] [US4] Implement error controller in `backend/src/controller/error.controller.js`
- [ ] T052 [US4] Standardize all controllers to throw domain errors instead of sending responses directly
- [ ] T053 [US4] Add error handling integration tests in `backend/tests/integration/errors.test.js`

**Checkpoint**: All error responses across the API follow the flat stable-code model

---

## Phase 7: User Story 5 - The API maintains responsive performance under load from many concurrent consumers (Priority: P3)

**Goal**: Verify sub-second p95 latency under 1000 concurrent authenticated requests and confirm rate limiting applies per-consumer without monopolizing capacity.

**Independent Test**: Simulate 1000 concurrent authenticated requests and measure p95 response time. Confirm that rate limiting applies per-consumer and that no single source can monopolize capacity.

### Tests for User Story 5

- [ ] T054 [P] [US5] Add performance tests for pagination in `backend/tests/performance/pagination.test.js`
- [ ] T055 [P] [US5] Add performance tests for rate limiting in `backend/tests/performance/rate-limit.test.js`

### Implementation for User Story 5

- [ ] T056 [US5] Document Big-O complexity for hot paths in code comments
- [ ] T057 [US5] Verify no N+1 queries in post and movie endpoints by inspecting query plans and ensuring all population is batched

**Checkpoint**: Performance targets met and documented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation, and cleanup across all user stories

- [ ] T058 [P] Run full test suite and fix failures
- [ ] T059 [P] Validate OpenAPI spec matches live implementation
- [ ] T060 [P] Update README with architecture overview and test commands
- [ ] T061 Run quickstart.md validation scenarios
- [ ] T062 Final security review and secret cleanup
- [ ] T063 [P] Add e2e tests for auth, refresh, and ownership flows in `backend/tests/e2e/`
- [ ] T064 [P] Update spec.md SC-005 with exact p95 latency threshold of 950ms in `specs/001-secure-clean-arch/spec.md`
- [ ] T065 [P] Standardize JSON envelope across all responses in `backend/src/utils/response.js`
- [ ] T066 Audit and remove scattered `process.env` reads in `backend/src/` after central config is created

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on repository interfaces from Phase 2
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Independently testable

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before integration tests

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 2

```bash
# Launch all models for User Story 2 together:
Task: "Create Role model in backend/src/models/role.model.js"
Task: "Create Permission model in backend/src/models/permission.model.js"
Task: "Create RefreshToken model in backend/src/models/refresh_token.model.js"

# Launch repository interfaces for Foundational phase together:
Task: "Create user repository interface in backend/src/repositories/interfaces/user.repository.js"
Task: "Create post repository interface in backend/src/repositories/interfaces/post.repository.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
   - Developer E: User Story 5
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Existing directory conventions (singular `controller/`, `service/`) are preserved
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
