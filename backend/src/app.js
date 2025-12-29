import express from "express";
import { userRouter } from "./routes/user.routes.js";
import {postRouter} from "./routes/post.routes.js";
import cookieParser  from "cookie-parser";
import { apiLimiter } from "./middleware/ratelimiter.middleware.js";
import { authMiddleWare } from "./middleware/auth.middleware.js";
import { movieRouter } from "./routes/movie.routes.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts",authMiddleWare, apiLimiter, postRouter);
app.use("/api/v1/shows",authMiddleWare, apiLimiter, movieRouter);