import { Router } from "express";
import { registerUser,loginUser,logoutUser, deleteUser } from "../controller/userController.js";
import {authMiddleWare} from "../middleware/authMiddleware.js"
import { loginLimiter } from "../middleware/authLimiter.js";
import { movieController } from "../controller/movieController.js";
export const userRouter = Router();

userRouter.post("/",loginLimiter, registerUser);

userRouter.post("/login", loginLimiter, loginUser);
userRouter.post("/logout", authMiddleWare, logoutUser);

userRouter.delete("/me", authMiddleWare, deleteUser);
