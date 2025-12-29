import { Router } from "express";
import { registerUser,loginUser,logoutUser, deleteUser } from "../controller/user.controller.js";
import {authMiddleWare} from "../middleware/auth.middleware.js"
import { loginLimiter } from "../middleware/authlimiter.middleware.js";
import { movieController } from "../controller/movie.controller.js";
export const userRouter = Router();

userRouter.post("/",loginLimiter, registerUser);

userRouter.post("/login", loginLimiter, loginUser);
userRouter.post("/logout", authMiddleWare, logoutUser);

userRouter.delete("/me", authMiddleWare, deleteUser);
