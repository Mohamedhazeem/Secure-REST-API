import { Router } from "express";
import { authLimiter } from "../middleware/authlimiter.middleware.js";
import { refreshTokenController } from "../controller/refresh_token.controller.js";

export const authRouter = Router();

authRouter.post("/refresh", authLimiter, refreshTokenController);
