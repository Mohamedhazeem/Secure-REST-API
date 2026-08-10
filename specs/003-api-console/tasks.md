# Tasks: API Console

**Input**: Design documents from `/specs/003-api-console/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Lightweight smoke tests included for console route and contract loading per plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`
- **Tests**: `backend/tests/`
- **Docs**: `specs/003-api-console/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency verification

- [x] T001 Verify Scalar CDN availability and OpenAPI 3.0.3 compatibility for console.html

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add `/console` GET route serving static console.html in backend/src/app.js
- [x] T003 [P] Add `/console/openapi.json` GET route resolving multi-file YAML contract to JSON in backend/src/app.js
- [x] T004 Create backend/src/docs/console.html with Scalar initialization pointing to `/console/openapi.json`
- [x] T005 [P] Add TrustFeed branded introduction and capability overview to backend/src/docs/console.html
- [x] T006 [P] Configure Scalar cookie authentication with `credentials: 'include'` in backend/src/docs/console.html

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Discover TrustFeed and browse the API (Priority: P1) 🎯 MVP

**Goal**: A reviewer opens the console URL, reads a concise introduction explaining what TrustFeed demonstrates, and browses all available endpoints grouped by domain.

**Independent Test**: Open the console URL and verify the introduction and endpoint list render without any API calls.

### Implementation for User Story 1

- [x] T007 [US1] Configure Scalar tag grouping to display endpoints by domain (Auth, Posts, Comments, Follows, Likes, Feed, Notifications, Admin, Health) in backend/src/docs/console.html
- [x] T008 [US1] Verify endpoint entries show HTTP method, path, description, and auth requirement indicators in console.html

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Execute unauthenticated endpoints (Priority: P1)

**Goal**: A reviewer selects an unauthenticated endpoint, inspects its parameters and response schema, executes the request, and views the formatted JSON response with status code and headers.

**Independent Test**: Execute `GET /health` from the console and verify the response is formatted and visible.

### Implementation for User Story 2

- [x] T009 [US2] Verify GET /health executes from console and displays formatted JSON response with status in backend/src/docs/console.html
- [x] T010 [US2] Verify GET /health/ready executes from console and displays MongoDB/Redis dependency status in backend/src/docs/console.html

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Authenticate and exercise protected endpoints (Priority: P1)

**Goal**: A reviewer uses the console to register or log in, obtains an authenticated session, and then executes protected endpoints.

**Independent Test**: Register a user via the console, then create a post and verify the response.

### Implementation for User Story 3

- [x] T011 [US3] Ensure POST /auth/register executes from console, returns 201 with user data, and stores cookies in backend/src/docs/console.html
- [x] T012 [US3] Ensure POST /auth/login executes from console, returns tokens, and stores cookies in backend/src/docs/console.html
- [x] T013 [US3] Ensure POST /posts creates a post using stored cookies after authentication in backend/src/docs/console.html
- [x] T014 [US3] Ensure error responses display HTTP status, TrustFeed error code, message, and trace ID in backend/src/docs/console.html

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Manage authentication lifecycle (Priority: P2)

**Goal**: A reviewer refreshes their access token, revokes a session, and logs out, understanding each step in the authentication workflow.

**Independent Test**: Log in, refresh the token, list sessions, revoke a session, and logout. Verify each action's response.

### Implementation for User Story 4

- [x] T015 [US4] Ensure POST /auth/refresh rotates tokens correctly in console in backend/src/docs/console.html
- [x] T016 [US4] Ensure GET /auth/sessions lists active sessions in console in backend/src/docs/console.html
- [x] T017 [US4] Ensure DELETE /auth/sessions/:id revokes session and blocks subsequent requests in console in backend/src/docs/console.html
- [x] T018 [US4] Ensure POST /auth/logout invalidates session in console in backend/src/docs/console.html

**Checkpoint**: At this point, User Stories 1-4 should all work independently

---

## Phase 7: User Story 5 - Explore advanced API behaviors (Priority: P2)

**Goal**: A reviewer tests advanced behaviors such as idempotency, optimistic concurrency, pagination cursors, and observes rate-limit responses.

**Independent Test**: Create a post with an Idempotency-Key, replay the same request, and verify the second response matches the first.

### Implementation for User Story 5

- [x] T019 [US5] Ensure Idempotency-Key header input works for POST /posts and like endpoints in console in backend/src/docs/console.html
- [x] T020 [US5] Ensure If-Match header input works for PATCH /posts/:id optimistic concurrency in backend/src/docs/console.html
- [x] T021 [US5] Ensure cursor/limit pagination inputs work for feed and list endpoints in backend/src/docs/console.html
- [x] T022 [US5] Ensure rate-limit 429 response displays RATE_LIMITED code and Retry-After header in console in backend/src/docs/console.html

**Checkpoint**: At this point, User Stories 1-5 should all work independently

---

## Phase 8: OpenAPI Contract Enhancements

**Purpose**: Improve the OpenAPI contract with examples and descriptions so the console renders useful request/response examples.

- [x] T023 [P] Add example values to request schemas in specs/002-trustfeed-social-api/contracts/components/schemas.yaml
- [x] T024 [P] Add example values to response schemas in specs/002-trustfeed-social-api/contracts/components/schemas.yaml
- [x] T025 [P] Enhance endpoint descriptions in specs/002-trustfeed-social-api/contracts/paths/*.yaml
- [x] T026 [P] Document Idempotency-Key, If-Match, and Retry-After headers in specs/002-trustfeed-social-api/contracts/components/headers.yaml
- [x] T027 [P] Add error response examples to specs/002-trustfeed-social-api/contracts/components/responses.yaml
- [x] T028 [P] Regenerate published OpenAPI contract via `npm run contract:sync`
- [x] T029 Validate updated contract via `npm run contract:lint`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T030 [P] Add API Console section to README.md with URL, usage instructions, authentication flow, and explanation that OpenAPI remains the source of truth
- [x] T031 [P] Create `backend/tests/integration/console.test.js` with test setup and helpers
- [x] T032 [P] Add smoke test for `/console` route in `backend/tests/integration/console.test.js`
- [x] T033 [P] Add smoke test for `/console/openapi.json` route in `backend/tests/integration/console.test.js`
- [x] T034 Verify `backend/src/docs/console.html` contains no secrets, tokens, or hardcoded credentials
- [x] T035 Run `quickstart.md` validation scenarios and confirm all pass
- [x] T036 [P] Configure Scalar responsive layout options for desktop/tablet screen sizes in backend/src/docs/console.html

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **OpenAPI Enhancements (Phase 8)**: Can proceed in parallel with user stories; must complete before final polish
- **Polish (Phase 9)**: Depends on all desired user stories and contract enhancements being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Depends on US3 for auth context but independently testable
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Depends on US3 for auth context but independently testable

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All OpenAPI enhancement tasks marked [P] can run in parallel
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch in parallel:
Task: "Add /console route in backend/src/app.js"
Task: "Add /console/openapi.json route in backend/src/app.js"
Task: "Add TrustFeed introduction to backend/src/docs/console.html"
Task: "Configure Scalar cookie auth in backend/src/docs/console.html"
```

---

## Parallel Example: OpenAPI Enhancements

```bash
# Launch in parallel:
Task: "Add example values to request schemas in specs/002-trustfeed-social-api/contracts/components/schemas.yaml"
Task: "Add example values to response schemas in specs/002-trustfeed-social-api/contracts/components/schemas.yaml"
Task: "Enhance endpoint descriptions in specs/002-trustfeed-social-api/contracts/paths/*.yaml"
Task: "Document headers in specs/002-trustfeed-social-api/contracts/components/headers.yaml"
Task: "Add error response examples in specs/002-trustfeed-social-api/contracts/components/responses.yaml"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. Complete Phase 5: User Story 3
6. **STOP and VALIDATE**: Test User Stories 1-3 independently
7. Deploy/demo if ready

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
3. Stories complete and integrate independently
4. After P1 stories complete, developers can work on P2 stories in parallel

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
