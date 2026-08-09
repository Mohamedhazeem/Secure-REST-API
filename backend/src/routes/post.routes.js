import { Router } from "express";
import { createPost,getPosts,deletePost, updatePost, getAllPosts } from "../controller/post.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createPostSchema, updatePostSchema } from "../validators/post.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

export const postRouter = Router();

postRouter.post("/", validate(createPostSchema), requirePermission("posts:create"), createPost);

postRouter.get("/", requirePermission("posts:read"), getAllPosts);
postRouter.get("/me", requirePermission("posts:read"), getPosts);

postRouter.patch("/:id", validate(updatePostSchema), requirePermission("posts:update"), updatePost);
postRouter.delete("/:id", requirePermission("posts:delete"), deletePost);
