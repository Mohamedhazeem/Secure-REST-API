import { dirname, join } from "path";
import { fileURLToPath } from "url";
import express from "express";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import {postRouter, feedRouter} from "./routes/post.routes.js";
import { followRouter } from "./routes/follow.routes.js";
import { likeRouter } from "./routes/like.routes.js";
import { commentRouter } from "./routes/comment.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import cookieParser  from "cookie-parser";
import { apiLimiter, socialMutationLimiter } from "./middleware/ratelimiter.middleware.js";
import { authMiddleWare } from "./middleware/auth.middleware.js";

import { corsMiddleware } from "./middleware/cors.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./controller/error.controller.js";
import { correlationMiddleware } from "./middleware/correlation.middleware.js";
import { metricsMiddleware } from "./utils/metrics.js";
import { liveness, readiness } from "./controller/health.controller.js";
import { setAuditWriter } from "./service/audit.service.js";
import AuditLogRepository from "./repositories/interfaces/audit-log.repository.js";
import { registerNotificationDispatcher } from "./workers/notification.worker.js";
import { resolveOpenApiContract } from "./docs/resolve-openapi.js";
import "./configs/database.js";
import { API_VERSION } from "./configs/constants.js";

export const app = express();

// ES modules do not provide `__dirname`; resolve it from the module URL so the
// console asset path is correct under `node src/index.js` (US2, T009/T010).
const moduleDir = dirname(fileURLToPath(import.meta.url));

// App-level composition (US6, T066): audit events (FR-030) are persisted
// through the AuditLog repository; every entry is correlated via the
// correlation middleware installed below (FR-031).
const auditLogRepository = new AuditLogRepository();
setAuditWriter({ write: (entry) => auditLogRepository.write(entry) });

// Social events (follow, like, comment) publish notification jobs through
// the notification worker (US5, T082/T086, FR-027). Registering the
// dispatcher here keeps the services decoupled from the queue backend.
registerNotificationDispatcher();

app.use(express.json());
app.use(cookieParser());
app.use(corsMiddleware);
app.use(correlationMiddleware);
app.use(metricsMiddleware);

app.get(`${API_VERSION}/health`, liveness);
app.get(`${API_VERSION}/health/ready`, readiness);

app.use(`${API_VERSION}/auth`, authRouter, userRouter);
app.use(`${API_VERSION}/posts`, authMiddleWare, apiLimiter, postRouter, commentRouter, likeRouter);
app.use(`${API_VERSION}/users`, authMiddleWare, socialMutationLimiter, followRouter);
app.use(`${API_VERSION}/feed`, authMiddleWare, apiLimiter, feedRouter);
app.use(`${API_VERSION}/notifications`, authMiddleWare, apiLimiter, notificationRouter);
app.use(`${API_VERSION}/admin`, authMiddleWare, adminRouter);

app.get("/console/openapi.json", (req, res) => {
  try {
    const doc = resolveOpenApiContract();
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(doc, null, 2));
  } catch (error) {
    res.status(503).json({
      code: "DEPENDENCY_FAILURE",
      message: "Failed to resolve OpenAPI contract",
      traceId: req.traceId,
    });
  }
});

app.get("/", (req, res) => res.redirect(302, "/console"));

app.get("/console", (req, res) => {
  res.sendFile(join(moduleDir, "docs", "console.html"));
});

app.get("/console.css", (req, res) => {
  res.sendFile(join(moduleDir, "docs", "console.css"));
});

app.use(notFoundHandler);
app.use(errorHandler);



