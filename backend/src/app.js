import express from "express";
import { userRouter } from "./routes/userRoutes.js";
import {postRouter} from "./routes/postRoutes.js";
import cookieParser  from "cookie-parser";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { authMiddleWare } from "./middleware/authMiddleware.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts",authMiddleWare, apiLimiter, postRouter)