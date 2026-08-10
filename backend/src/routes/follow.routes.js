import { Router } from "express";
import { followUser, unfollowUser } from "../controller/follow.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { followSchema } from "../validators/follow.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

export const followRouter = Router();

followRouter.post("/:id/follow", validate(followSchema), requirePermission("follows:create"), followUser);
followRouter.delete("/:id/unfollow", requirePermission("follows:delete"), unfollowUser);
