import { Router } from "express";
import { likePost, unlikePost, isPostLiked } from "../controller/like.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { likeCreateSchema } from "../validators/like.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

export const likeRouter = Router();

likeRouter.post("/:id/likes", validate(likeCreateSchema), requirePermission("likes:create"), likePost);
likeRouter.delete("/:id/likes", requirePermission("likes:delete"), unlikePost);
likeRouter.get("/:id/likes/me", requirePermission("likes:read"), isPostLiked);
