import { Router } from "express";
import { createPost,getPosts,deletePost, updatePost, getAllPosts, getFeed } from "../controller/post.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createPostSchema, updatePostSchema } from "../validators/post.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

export const postRouter = Router();

postRouter.post("/", validate(createPostSchema), requirePermission("posts:create"), createPost);

postRouter.get("/", requirePermission("posts:read"), getAllPosts);
postRouter.get("/me", requirePermission("posts:read"), getPosts);

postRouter.patch("/:id", validate(updatePostSchema), requirePermission("posts:update"), updatePost);
postRouter.delete("/:id", requirePermission("posts:delete"), deletePost);

/**
 * Personalized feed routes (US4, T057): GET /api/v1/feed with opaque
 * cursor pagination. Kept in post.routes.js per the task breakdown; the
 * feed is a projection over posts authored by followed users.
 */
export const feedRouter = Router();

feedRouter.get("/", requirePermission("feed:read"), getFeed);
