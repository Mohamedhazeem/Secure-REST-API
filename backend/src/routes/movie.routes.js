import { Router } from "express";
import { movieController } from "../controller/movie.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";

export const movieRouter = Router();

movieRouter.get("/movies", movieController);