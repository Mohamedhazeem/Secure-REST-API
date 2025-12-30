# 🚀 Secure REST API – Node.js, Express & MongoDB

## A secure, production-style REST API built with Node.js, Express, MongoDB, and JWT authentication. This project demonstrates authentication, authorization, ownership-based access control, rate limiting, jwt token rotation, pagenation and clean backend architecture.

⚠️ This is a backend-only project. No UI is included by design.

## 📌 Features

## 🔐 Authentication & Security

JWT Authentication (stored in HTTP-only cookies)

JWT Token Refresh

Secure login & logout

Protected routes using middleware

Ownership-based authorization

Passwords hashed before storage

## 🛡️ Rate Limiting

Global API rate limiting using Redis

Login-specific rate limiter to prevent brute-force attacks

Distributed-safe rate limiting (Redis-backed)

## 🧩 Database & Architecture

MongoDB with Mongoose for application data

Native MongoDB driver for external/sample databases

Multiple database access from the same MongoDB cluster

Clean separation of concerns (controllers, middleware)

## 📄 Data Management

User ↔ Post relationship using MongoDB references

CRUD operations with authorization checks

Safe `populate()` usage (excluding sensitive fields)

Pagination support for large datasets

Read-only access to MongoDB `sample_mflix` database

## 🛠️ Tech Stack

**Backend:** Node.js, Express.js

**Database:** MongoDB (with Mongoose ORM), Redis (for caching & rate-limiting)

**Authentication & Security:** JWT-based authentication, HTTP-only cookies, middleware route protection

**Rate Limiting:** Express Rate Limit with Redis store

**Tools & Testing:** Postman, VS Code

**Deployment / Environment:** Node.js environment variables, dotenv

## 📂 Folder Structure

```text
src/
├── controllers/
│   ├── auth.controller.js
│   └── post.controller.js
│
├── models/
│   ├── user.model.js
│   └── post.model.js
│
├── routes/
│   ├── auth.routes.js
│   └── post.routes.js
│
├── service
|    ├── auth.service.js
├── middlewares/
│   └── authlimiter.middleware.js
|   └── auth.middleware.js
|   └── ratelimiter.middleware.js
│
├── config/
│   └── constant.js
|   └── database.js
|   └── redis.js
│
|postmon/
│   └── Auth_collection.json
|   └── Posts_collection.json
|   └── Shows_collection.json
├── app.js
└── server.js
```

## 🔐 Authentication Flow (JWT + Cookies)

User logs in

Server generates JWT

JWT stored in HTTP-only cookie

Cookie sent automatically with requests

JWT refresh when invalid

Middleware:

Verifies JWT and backlist

Fetches user from database

Attaches user to req.user

This ensures:

Tokens cannot be accessed via JavaScript

Protected routes are secure

User data is always verified

## 🧩 Data Models

User Model
{
username: String,
email: String,
password: String
}

Post Model
{
name: String,
description: String,
age: Number,
author: ObjectId (ref: "User")
}

Each post belongs to exactly one user.

##🔒 Rate Limiting

To prevent abuse and protect the API, rate limiting has been implemented using **Express Rate Limit** with **Redis** as a store:

- **Global API Limiter**:  
  Limits all authenticated API requests to **50 requests per 15 minutes** per user.
- **Login Endpoint Limiter**:  
  Protects authentication routes with a stricter limit: **15 requests per 15 minutes** per IP address.

- **Key Features**:

  - Works per **user ID** (for authenticated requests) or **IP** (for public endpoints).
  - Returns **HTTP 429 - Too Many Requests** when the limit is exceeded.
  - Automatically resets counts after the defined `windowMs`.
  - Backed by **Redis**, ensuring consistent limits across multiple servers in a distributed setup.

- **Middleware Integration**:  
  Both global and login-specific limiters are applied as **Express middleware** before route handlers.

## 🔑 Authorization Logic

Only authenticated users can create posts

Users can:

View their own and other people posts

Update only their own posts

Delete only their own posts

## 📡 API Endpoints

**Auth Routes**

Method Endpoint & Description

POST /api/v1/auth/ (Register new user)

POST /api/v1/auth/login (Login user)

POST /api/v1/auth/logout (Logout user)

POST /api/v1/auth/refresh (refresh jwt token)

DELETE /api/v1/auth/me (Delete user itself if they want)

**Post Routes (Protected)**

Method Endpoint Description

POST /api/v1/posts (Create new post)

GET /api/v1/posts/me (Get logged-in user posts)

GET /api/v1/posts (Get all posts (public/admin))

PATCH /api/v1/posts/:id (Update own post)

DELETE /api/v1/posts/:id (Delete own post)

**Movie Routes (Protected & Pagenation sample)**

GET /api/v1/shows/movies?page=1&limit=20 (Get logged-in user posts)

## How to Run Locally

1️⃣ Clone Repository
git clone https://github.com/mohamedhazeem/secure-rest-api.git
`cd secure-rest-api`

2️⃣ Install Dependencies
`npm install`

3️⃣ Create .env File

`MONGODB_URI="magodb_cloud uri"`

`REDIS_DB_URI="redis_cloud uri"`

`PORT=1430`

`NODE_ENV=production`

`JWT_AUTH_KEY="auth_key"`

`JWT_REFRESH_KEY="refresh_key"`

`JWT_REFRESH_EXPIRES_IN=15m`

`JWT_ACCESS_EXPIRES_IN=5m`

4️⃣ Start Server

`npm run dev`

5️⃣ Use postman colletion from folder to test API
