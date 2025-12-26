import { Router } from "express";
import { registerUser,loginUser,logoutUser, deleteUser } from "../controller/userController.js";
import {authMiddleWare} from "../middleware/authMiddleware.js"
export const userRouter = Router();

userRouter.post("/", registerUser);

userRouter.post("/login", loginUser);
userRouter.post("/logout", authMiddleWare, logoutUser);

userRouter.delete("/me", authMiddleWare, deleteUser);