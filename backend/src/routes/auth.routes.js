import { Router } from "express";
import { authLimiter } from "../middleware/authlimiter.middleware.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";
import { refreshTokenController } from "../controller/refresh_token.controller.js";
import { listSessions, revokeSession } from "../controller/auth.controller.js";

export const authRouter = Router();

authRouter.get("/sessions", authMiddleWare, listSessions);
authRouter.delete("/sessions/:id", authMiddleWare, revokeSession);
authRouter.post("/refresh", authLimiter, refreshTokenController);
