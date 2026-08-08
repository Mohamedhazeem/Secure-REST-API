import { Router } from "express";
import { createPost,getPosts,deletePost, updatePost, getAllPosts } from "../controller/post.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createPostSchema, updatePostSchema } from "../validators/post.validator.js";

export const postRouter = Router();

postRouter.post("/", validate(createPostSchema), createPost);

postRouter.get("/", getAllPosts);
postRouter.get("/me", getPosts);

postRouter.patch("/:id", validate(updatePostSchema), updatePost);

postRouter.delete("/:id", deletePost);
