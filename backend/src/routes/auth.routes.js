import { Router } from "express";
import { registerUser,loginUser,logoutUser, deleteUser } from "../controller/user.controller.js";
import {authMiddleWare} from "../middleware/auth.middleware.js"
import { authLimiter } from "../middleware/authlimiter.middleware.js";
import { movieController } from "../controller/movie.controller.js";
import { refreshTokenController } from "../controller/refresh_token.controller.js";
export const authRouter = Router();

authRouter.post("/",authLimiter, registerUser);

authRouter.post("/login", authLimiter, loginUser);
authRouter.post("/logout", authMiddleWare, logoutUser);

authRouter.delete("/me", authMiddleWare, deleteUser);

authRouter.post("/refresh", authLimiter, refreshTokenController);