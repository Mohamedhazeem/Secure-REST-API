import { Router } from "express";
import { movieController } from "../controller/movieController.js";
import { authMiddleWare } from "../middleware/authMiddleware.js";

export const movieRouter = Router();

movieRouter.get("/movies", movieController);