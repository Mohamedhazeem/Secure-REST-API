import { Router } from "express";
import { createPost,getPosts,deletePost, updatePost, getAllPosts } from "../controller/postController.js";

export const postRouter = Router();

postRouter.post("/", createPost);    

postRouter.get("/", getAllPosts);
postRouter.get("/me", getPosts);  

postRouter.patch("/:id", updatePost); 

postRouter.delete("/:id", deletePost);
