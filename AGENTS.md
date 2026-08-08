# AGENTS.md

## Project Overview

A secure, production-style REST API portfolio project built with Node.js, Express, and MongoDB. It demonstrates JWT authentication with HTTP-only cookies, token refresh/rotation, ownership-based authorization, Redis-backed rate limiting, pagination, and clean layered architecture. Backend-only by design — no UI.

## Tech Stack

- **Node.js** (>= 20, currently 26) with ES Modules (`"type": "module"`)
- **Express** 5.x
- **MongoDB** via Mongoose (app data) + native MongoDB driver (read-only `sample_mflix`)
- **Redis** via ioredis (rate limiting store)
- **JWT** auth with `jsonwebtoken`, access tokens stored in HTTP-only cookies
- **express-rate-limit** + **rate-limit-redis** for rate limiting

## Commands

All commands run from `backend/`:

- `npm install` — install dependencies
- `npm run dev` — start with nodemon watch
- `npm run dev-watch` — start with native node `--watch`
- `npm start` — start server
- There is no lint, typecheck, or test setup. Verify changes with `node --check <file>` and by booting the server.

## Environment Variables

Copy to `backend/.env` (see `README.md` for full list):

- `MONGODB_URI` — MongoDB cloud URI (main app database)
- `REDIS_DB_URI` — Redis URI
- `PORT` — server port (default 1430)
- `NODE_ENV` — `production` or `development`
- `JWT_AUTH_KEY` — access token signing secret
- `JWT_REFRESH_KEY` — refresh token signing secret
- `JWT_ACCESS_EXPIRES_IN` — e.g. `5m`
- `JWT_REFRESH_EXPIRES_IN` — e.g. `15m`

Note: the app also reads `sample_mflix` from the same MongoDB cluster for the movies endpoint. The server expects local Redis at startup but will retry if unavailable.

## Architecture

```
backend/src/
├── app.js                 — Express app setup
├── index.js               — server entrypoint
├── configs/
│   ├── constants.js       — rate limit window constants
│   ├── database.js        — Mongoose + native MongoDB connections
│   └── redis.js           — ioredis client (singleton)
├── controller/            — request handlers
│   ├── auth.controller.js
│   ├── post.controller.js
│   ├── movie.controller.js
│   ├── refresh_token.controller.js
│   └── user.controller.js
├── middleware/
│   ├── auth.middleware.js         — JWT verify + blacklist check + user attach
│   ├── authlimiter.middleware.js  — strict login endpoint limiter
│   └── ratelimiter.middleware.js  — global API limiter
├── models/
│   ├── user.model.js      — username, email, password (hashed)
│   └── post.model.js      — name, description, age, author (ref: User)
├── routes/                — auth, post, movie route definitions
├── service/
│   └── auth.service.js    — auth/business logic
└── utils/
    └── generateToken.js   — JWT access/refresh generation
```

## Key Conventions

- ES modules (`import`/`export`) everywhere; default exports for middleware/store instances, named exports elsewhere.
- Controllers stay thin; logic lives in `service/`.
- Sensitive fields (e.g. password) are excluded from `populate()` results and responses.
- Rate limiters use `sendCommand: (...args) => redisClient.call(...args)` with `rate-limit-redis`; do not pass the redis client directly.
- Request identification: authenticated requests key rate limits by user `_id`, public endpoints by IP (`ipKeyGenerator`).
- Routes are prefixed under `/api/v1`.
- Passwords hashed with bcrypt before storage; never log secrets or tokens.
- The project README documents endpoints; Postman collections live in `backend/postmon/`.

## API Endpoints (summary)

- `POST /api/v1/auth/` — register
- `POST /api/v1/auth/login` — login
- `POST /api/v1/auth/logout` — logout
- `POST /api/v1/auth/refresh` — refresh JWT
- `DELETE /api/v1/auth/me` — delete own account
- `POST /api/v1/posts` — create post (auth)
- `GET /api/v1/posts/me` — own posts (auth)
- `GET /api/v1/posts` — all posts
- `PATCH /api/v1/posts/:id` — update own post
- `DELETE /api/v1/posts/:id` — delete own post
- `GET /api/v1/shows/movies?page=1&limit=20` — paginated movies (read-only sample_mflix)

## Security Notes

- Tokens are HTTP-only cookies — never expose them to client JS.
- Ownership checks: users may only update/delete their own posts.
- Refresh tokens rotate and are validated against a blacklist in `auth.middleware.js`.
- Rate limits: global API limiter and stricter login limiter to prevent brute-force.
