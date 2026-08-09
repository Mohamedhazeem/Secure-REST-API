import { Router } from "express";
import { registerUser, loginUser, logoutUser, deleteUser } from "../controller/user.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/authlimiter.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

export const userRouter = Router();

userRouter.post("/", authLimiter, validate(registerSchema), registerUser);
userRouter.post("/login", authLimiter, validate(loginSchema), loginUser);
userRouter.post("/logout", authMiddleWare, logoutUser);
userRouter.delete("/me", authMiddleWare, deleteUser);
