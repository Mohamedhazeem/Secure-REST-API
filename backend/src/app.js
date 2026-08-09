import express from "express";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import {postRouter} from "./routes/post.routes.js";
import cookieParser  from "cookie-parser";
import { apiLimiter } from "./middleware/ratelimiter.middleware.js";
import { authMiddleWare } from "./middleware/auth.middleware.js";
import { movieRouter } from "./routes/movie.routes.js";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./controller/error.controller.js";
import { correlationMiddleware } from "./middleware/correlation.middleware.js";
import { metricsMiddleware } from "./utils/metrics.js";
import { liveness, readiness } from "./controller/health.controller.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(corsMiddleware);
app.use(correlationMiddleware);
app.use(metricsMiddleware);

app.get("/api/v1/health", liveness);
app.get("/api/v1/health/ready", readiness);

app.use("/api/v1/auth", authRouter, userRouter);
app.use("/api/v1/posts",authMiddleWare, apiLimiter, postRouter);
app.use("/api/v1/shows",authMiddleWare, apiLimiter, movieRouter);

app.use(notFoundHandler);
app.use(errorHandler);
