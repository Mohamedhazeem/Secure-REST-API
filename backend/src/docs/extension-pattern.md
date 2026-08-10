# Extension Pattern (Clean Architecture)

This document explains how to add a **new resource** to the API by creating **only new files**, without modifying existing endpoints or business logic. The goal is that adding `widgets` should not require touching `posts`, `users`, or `auth`.

## Dependency direction (never invert)

```
routes  ──>  controllers  ──>  services  ──>  repositories  ──>  models / external stores
```

- Controllers are **thin**: parse request, call a service, shape the response. They never import Mongoose models or talk to Redis directly.
- Services hold business logic and depend on **repository interfaces**, not on Mongoose.
- Repositories isolate persistence (Mongoose today, anything else tomorrow).
- Cross-cutting concerns (auth, RBAC, rate limit, CORS, validation, error handling) are middleware applied in `app.js` / route files.

## Steps to add a resource `widgets`

1. **Model** — `src/models/widget.model.js`
   Register the schema on the shared default Mongoose connection (`mongoose.model("Widget", widgetSchema)`). Keep the model file free of infrastructure imports; no service logic.

2. **Repository interface** — `src/repositories/interfaces/widget.repository.js`
   Declare the methods the service needs (e.g. `create`, `findById`, `findMany`, `update`, `deleteById`). No implementation.

3. **Mongoose implementation** — `src/repositories/implementations/mongoose/widget.repository.js`
   Implement the interface against the Mongoose model. Add indexes here; keep queries batched (no N+1). In-memory implementations are retired (Research Decision 9): tests use `mongodb-memory-server` for real store behavior.

4. **Validator** — `src/validators/widget.validator.js`
   Zod schemas (`createWidgetSchema`, `updateWidgetSchema`).

5. **Service** — `src/service/widget.service.js`
   Import the concrete Mongoose repository, instantiate it, implement business rules, throw domain errors from `utils/errors.js`.

6. **Controller** — `src/controller/widget.controller.js`
   Thin handlers: validate via middleware, call the service, return `201/200/204`.

7. **Routes** — `src/routes/widget.routes.js`
   Wire `validate(...)`, `requirePermission(...)`, and the controller. Mount under `/api/v1/widgets` in `app.js` with `authMiddleWare` + `apiLimiter`.

8. **Permissions & seed** — add codes (e.g. `widgets:create`) to `configs/seed.js` and reference them via `requirePermission("widgets:create")` in the routes.

9. **Contract** — add the paths to `specs/002-trustfeed-social-api/contracts/` (paths/ plus schemas/responses components), then run `npm run contract:sync` to publish the byte-identical copy under `backend/src/docs/openapi/`. `npm run contract:lint` and `npm run contract:check` gate the merge.

## Social module patterns (follows, likes, comments, notifications, feed)

Resources with cross-user effects follow the same skeleton plus these conventions:

- **Audit logging** — security-relevant events (auth failures, token reuse, resource mutations) are recorded via `auditService.record({ action, actorId, targetType, targetId, metadata, ip, userAgent })` in `src/service/audit.service.js` (FR-030). The writer is injected at app composition (`app.js`), and every entry is correlated via the correlation middleware (FR-031). Audit failures are logged, never thrown.

- **Notification dispatch** — follow/like/comment services publish jobs through the notification queue (`src/service/notification.queue.js`, `notificationQueue.add(...)`) instead of writing notifications directly. The BullMQ worker (`src/workers/notification.worker.js`) applies bounded retries and a dead-letter queue (FR-027, SC-017). Register the dispatcher with `registerNotificationDispatcher()` at app composition; the queue falls back to an in-process runner when the backend is unreachable.

- **Idempotency** — mutating endpoints that must be safe against duplicate delivery (comments, likes, follows) mount `idempotencyMiddleware` on their routes; clients send an `Idempotency-Key` header and duplicates are deduplicated via Redis (FR-028).

- **Rate limiting** — three limiters exist in `src/middleware/ratelimiter.middleware.js` / `authlimiter.middleware.js`:
  - `apiLimiter` — global authenticated endpoints (keyed `user:<id>`; IP for public routes).
  - `socialMutationLimiter` — stricter budget for follow/like write endpoints (social-spam vectors).
  - `authLimiter` — strict per-IP budget on login.
  Add new social write routes under `socialMutationLimiter`, plain reads under `apiLimiter`. New limiters are created with the `createRateLimiter({ windowMs, limit })` factory — do not duplicate the options block.

- **Optimistic locking** — mutable resources (posts, comments) carry a `version`; update paths verify it and return `CONFLICT` on mismatch (Constitution XI).

- **Ownership & ABAC** — mutations verify ownership in the service layer (`OWNERSHIP_REQUIRED`); permission checks live in route middleware (`requirePermission`); attribute-based checks use `requireAttributes(evaluate)`.

## Swapping persistence

Because services depend only on the repository **interface**, you can switch the Mongoose implementation for another (SQL, HTTP, in-memory) by changing the import in the service (or via dependency injection). No controller or route changes are required.
