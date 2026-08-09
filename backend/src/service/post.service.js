import PostRepository from "../repositories/implementations/mongoose/post.repository.js";
import { createError } from "../utils/errors.js";

const postRepository = new PostRepository();

export const createPost = async ({ name, description, age, authorId }) => {
    return postRepository.create({ name, description, age, author: authorId });
};

export const listAllPosts = async ({ page = 1, limit = 20 } = {}) => {
    return postRepository.findMany({}, { page, limit });
};

export const listMyPosts = async (authorId, { page = 1, limit = 20 } = {}) => {
    return postRepository.findMany({ author: authorId }, { page, limit });
};

export const updatePost = async (id, authorId, updates) => {
    const post = await postRepository.findById(id);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }
    if (post.author.toString() !== authorId.toString()) {
        throw createError("OWNERSHIP_REQUIRED", "You can only modify your own posts", 403);
    }
    return postRepository.update(id, updates);
};

export const deletePost = async (id, authorId) => {
    const post = await postRepository.findById(id);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }
    if (post.author.toString() !== authorId.toString()) {
        throw createError("OWNERSHIP_REQUIRED", "You can only delete your own posts", 403);
    }
    return postRepository.deleteById(id);
};
