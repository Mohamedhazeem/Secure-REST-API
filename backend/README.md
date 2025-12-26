# 🚀 Secure REST API – Node.js, Express & MongoDB

## A secure, production-style REST API built with Node.js, Express, MongoDB, and JWT authentication. This project demonstrates authentication, authorization, ownership-based access control, and clean backend architecture.

⚠️ This is a backend-only project. No UI is included by design.

📌 -- Features

🔐 JWT Authentication (stored in HTTP-only cookies)

👤 User & Post relationship using MongoDB references

🛡️ Authorization & Ownership checks

🧾 CRUD operations for posts

🔄 Populate user data safely (excluding passwords)

🧱 Clean & scalable folder structure

🧪 Ready for Swagger / Postman documentation

🛠️ -- Tech Stack

Backend: Node.js, Express.js

Database: MongoDB, Mongoose

Authentication: JWT, HTTP-only Cookies

Security: Middleware-based route protection

Tools: Postman / Swagger (optional)

## 📂 Folder Structure

```text
src/
├── controllers/
│   ├── authController.js
│   └── postController.js
│
├── models/
│   ├── userModel.js
│   └── postModel.js
│
├── routes/
│   ├── authRoutes.js
│   └── postRoutes.js
│
├── middlewares/
│   └── authMiddleware.js
│
├── config/
│   └── constant.js
│
|postmon/
│   └── Auth_collection.json
|   └── Posts_collection.json
|
├── app.js
└── server.js
```

## 🔐 Authentication Flow (JWT + Cookies)

User logs in

Server generates JWT

JWT stored in HTTP-only cookie

Cookie sent automatically with requests

Middleware:

Verifies JWT

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

## 🔑 Authorization Logic

Only authenticated users can create posts

Users can:

View their own and other people posts

Update only their own posts

Delete only their own posts

Admin logic can be added easily later

## 📡 API Endpoints

**Auth Routes**

Method Endpoint & Description

POST /api/v1/users/ (Register new user)

POST /api/v1/users/login (Login user)

POST /api/v1/users/logout (Logout user)

DELETE /api/v1/users/me (Delete user itself if they want)

**Post Routes (Protected)**

Method Endpoint Description

POST /api/v1/posts (Create new post)

GET /api/v1/posts/me (Get logged-in user posts)

GET /api/v1/posts (Get all posts (public/admin))

PATCH /api/v1/posts/:id (Update own post)

DELETE /api/v1/posts/:id (Delete own post)

## How to Run Locally

1️⃣ Clone Repository
git clone https://github.com/mohamedhazeem/secure-rest-api.git
`cd secure-rest-api`

2️⃣ Install Dependencies
`npm install`

3️⃣ Create .env File

`PORT=5000`

`MONGO_URI=your_mongodb_connection`

`JWT_SECRET_KEY=your_secret_key`

`JWT_EXPIRES_IN=token expire time (i set 3 minutes (3m))`

4️⃣ Create constant.js

`export const AUTH_TOKEN = "Your token name"`

5️⃣ Start Server

`npm run dev`

6️⃣ Use postman colletion to test API

```

```
