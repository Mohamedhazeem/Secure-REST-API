import { Router } from "express";
import { registerUser,loginUser,logoutUser, deleteUser } from "../controller/user.controller.js";
import {authMiddleWare} from "../middleware/auth.middleware.js"
import { authLimiter } from "../middleware/authlimiter.middleware.js";
import { refreshTokenController } from "../controller/refresh_token.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
export const authRouter = Router();

authRouter.post("/", authLimiter, validate(registerSchema), registerUser);

authRouter.post("/login", authLimiter, validate(loginSchema), loginUser);
authRouter.post("/logout", authMiddleWare, logoutUser);

authRouter.delete("/me", authMiddleWare, deleteUser);

authRouter.post("/refresh", authLimiter, refreshTokenController);
