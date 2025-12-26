import { Router } from "express";
import { createPost,getPosts,deletePost, updatePost, getAllPosts } from "../controller/postController.js";
import { authMiddleWare } from "../middleware/authMiddleware.js";

export const postRouter = Router();

postRouter.post("/", authMiddleWare, createPost);    

postRouter.get("/", authMiddleWare, getAllPosts);
postRouter.get("/me", authMiddleWare, getPosts);  

postRouter.patch("/:id", authMiddleWare, updatePost); 

postRouter.delete("/:id", authMiddleWare, deletePost);
