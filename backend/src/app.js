import express from "express";
import { userRouter } from "./routes/userRoutes.js";
import {postRouter} from "./routes/postRoutes.js";
import cookieParser  from "cookie-parser";
export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts",postRouter)