# Quickstart: API Console

**Feature**: API Console  
**Date**: 2026-08-10

## Prerequisites

- Node.js >= 20
- MongoDB running (local or cloud)
- Redis running (local or cloud)
- TrustFeed backend dependencies installed (`cd backend && npm install`)
- Backend `.env` configured

## Setup

1. Ensure the backend starts cleanly:
   ```bash
   cd backend
   npm start
   ```

2. Open the API Console:
   ```
   http://localhost:1430/console
   ```

3. Open the OpenAPI contract JSON:
   ```
   http://localhost:1430/console/openapi.json
   ```

## Validation Scenarios

### Scenario 1: Console Loads

- **Action**: Navigate to `/console`
- **Expected**: Page renders with TrustFeed introduction and endpoint list
- **Pass**: Introduction text visible; endpoint groups visible (Auth, Posts, Comments, Follows, Likes, Feed, Notifications, Admin, Health)

### Scenario 2: OpenAPI Contract Loads

- **Action**: Navigate to `/console/openapi.json`
- **Expected**: Valid JSON OpenAPI 3.0.3 document
- **Pass**: Document contains `openapi`, `info`, `paths`, and `components` keys

### Scenario 3: Execute Public Endpoint

- **Action**: In the console, expand `GET /health` and click "Execute"
- **Expected**: Response shows `200` with JSON body
- **Pass**: Response body contains `status: "healthy"` or equivalent

### Scenario 4: Execute Protected Endpoint Without Auth

- **Action**: In the console, expand `POST /posts` and click "Execute" without logging in
- **Expected**: Response shows `401` with TrustFeed error envelope
- **Pass**: Response contains `code: "UNAUTHORIZED"`, `message`, and `traceId`

### Scenario 5: Authenticate and Execute Protected Endpoint

- **Action**: Expand `POST /auth/register`, fill in credentials, execute. Then execute `POST /posts`.
- **Expected**: Register returns `201` with user data and sets cookies. Post creation returns `201` with post data.
- **Pass**: Cookies are stored by browser; subsequent requests include them automatically

### Scenario 6: Error Response Display

- **Action**: Execute an endpoint that returns an error (e.g., `POST /auth/login` with wrong password)
- **Expected**: Response shows HTTP status, TrustFeed `code`, `message`, and `traceId`
- **Pass**: All three fields visible in formatted JSON

### Scenario 7: Advanced Behavior

- **Action**: Execute `POST /posts` with `Idempotency-Key` header twice
- **Expected**: First request returns `201`; second request returns same response
- **Pass**: No duplicate post created; responses match

### Scenario 8: CORS Preflight

- **Action**: Send `OPTIONS /api/v1/posts` from an allowed origin with `Origin` header
- **Expected**: `204` with CORS headers
- **Pass**: `Access-Control-Allow-Origin` echoes the request origin

## Troubleshooting

- **Console page 404**: Ensure Express route is added to `app.js`
- **OpenAPI JSON 404**: Ensure `/console/openapi.json` route is added
- **401 on protected endpoints**: Ensure cookies are being sent; check `credentials: 'include'` in console fetch config
- **CORS errors**: Ensure console origin is in `ALLOWED_ORIGINS` or served from same origin
- **Contract mismatch**: Run `npm run contract:sync` after contract changes
