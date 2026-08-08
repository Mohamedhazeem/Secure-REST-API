# Quickstart: Secure Clean Architecture Refactor

**Feature**: 001-secure-clean-arch
**Date**: 2026-08-08

## Prerequisites

- Node.js >= 20
- MongoDB connection URI (`MONGODB_URI`)
- Redis URI (`REDIS_DB_URI`)
- Environment variables set in `backend/.env`:
  - `JWT_AUTH_KEY`
  - `JWT_REFRESH_KEY`
  - `JWT_ACCESS_EXPIRES_IN` (e.g., `5m`)
  - `JWT_REFRESH_EXPIRES_IN` (e.g., `15m`)
  - `ALLOWED_ORIGINS` (comma-separated list of trusted origins for CORS)

## Setup

```bash
cd backend
npm install
```

## Validation Scenarios

### 1. Server Boot

**Command**: `npm start`

**Expected outcome**: Server starts without errors, connects to MongoDB and Redis, and listens on the configured port.

---

### 2. Unit Tests

**Command**: `npm test`

**Expected outcome**: All unit tests pass. Coverage report is generated if `npm run test:coverage` is used.

---

### 3. Integration Tests

**Command**: `npm test -- --grep integration`

**Expected outcome**: Repository implementations pass against `mongodb-memory-server`. Middleware flows (auth, validation, rate limiting, CORS, role checks) behave as specified.

---

### 4. End-to-End Tests

**Command**: `npm run e2e`

**Expected outcome**: Postman collections complete successfully:

- Register → login → access protected endpoint → refresh token → logout
- Create post → update own post → delete own post
- Attempt to update/delete another user's post returns 403
- Access protected endpoint without token returns 401

---

### 5. OpenAPI Contract Validation

**Command**: Manual review or CI validation step

**Expected outcome**: `specs/001-secure-clean-arch/contracts/openapi.yaml` accurately describes every public endpoint. Request/response schemas match actual API behavior. Error responses include `code`, `message`, and `traceId`.

---

### 6. CORS Validation

**Command**: Send cross-origin request from a browser or `curl` with `Origin` header set to an allowed origin

**Expected outcome**:

- Response includes `Access-Control-Allow-Origin` matching the request origin
- `Access-Control-Allow-Credentials: true` is present
- Preflight `OPTIONS` request returns `200` with correct `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`
- Request from a non-allowed origin receives no CORS headers

---

### 7. Rate Limiting Validation

**Command**: Send rapid repeated requests to a protected endpoint

**Expected outcome**:

- Requests within the limit succeed
- Requests exceeding the limit return `429 Too Many Requests`
- Rate limit resets after the configured window
- Authenticated requests are keyed by user `_id`, public requests by IP

---

### 8. Error Handling Validation

**Command**: Trigger validation, auth, and dependency-failure errors

**Expected outcome**:

- All error responses contain `code`, `message`, and `traceId`
- No stack traces or internal details are exposed
- Error codes are stable and documented in the OpenAPI spec

---

## References

- [spec.md](./spec.md) — Feature specification
- [data-model.md](./data-model.md) — Entity definitions and relationships
- [openapi.yaml](./contracts/openapi.yaml) — API contract
- [research.md](./research.md) — Technical decisions and rationale
