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
   Implement the interface against the Mongoose model. Add indexes here; keep queries batched (no N+1).

4. **In-memory implementation (tests)** — `src/repositories/implementations/memory/widget.repository.js`
   Mirror the interface for unit tests. Not used in production.

5. **Validator** — `src/validators/widget.validator.js`
   Zod schemas (`createWidgetSchema`, `updateWidgetSchema`).

6. **Service** — `src/service/widget.service.js`
   Import the concrete Mongoose repository, instantiate it, implement business rules, throw domain errors from `utils/errors.js`.

7. **Controller** — `src/controller/widget.controller.js`
   Thin handlers: validate via middleware, call the service, return `201/200/204`. Delegate auth/session concerns to `auth.controller.js`.

8. **Routes** — `src/routes/widget.routes.js`
   Wire `validate(...)`, `requirePermission(...)`, and the controller. Mount under `/api/v1/widgets` in `app.js` with `authMiddleWare` + `apiLimiter`.

9. **Permissions & seed** — add codes (e.g. `widgets:create`) to `configs/seed.js` and reference them from `role.middleware.js` via `requirePermission("widgets:create")`.

10. **Contract** — add the paths to `specs/001-secure-clean-arch/contracts/openapi.yaml`.

## Swapping persistence

Because services depend only on the repository **interface**, you can switch the Mongoose implementation for another (SQL, HTTP, in-memory) by changing the import in the service (or via dependency injection). No controller or route changes are required.
