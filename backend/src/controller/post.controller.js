import * as postService from "../service/post.service.js";
import { sendSuccess } from "../utils/response.js";

export const createPost = async (req, res, next) => {
    try {
        const post = await postService.createPost({ ...req.body, authorId: req.user._id });
        return sendSuccess(res, 201, { post });
    } catch (err) {
        next(err);
    }
};

/**
 * List all posts with pagination.
 * Complexity: O(limit) per page + O(n) countDocuments scan.
 * See post.repository.findMany for full breakdown.
 */
export const getAllPosts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const result = await postService.listAllPosts({ page, limit });
        return sendSuccess(res, 200, result);
    } catch (err) {
        next(err);
    }
};

/**
 * List authenticated user's own posts with pagination.
 * Complexity: O(limit) per page + O(n) countDocuments on author index.
 */
export const getPosts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const result = await postService.listMyPosts(req.user._id, { page, limit });
        return sendSuccess(res, 200, result);
    } catch (err) {
        next(err);
    }
};

export const updatePost = async (req, res, next) => {
    try {
        const post = await postService.updatePost(req.params.id, req.user._id, req.body);
        return sendSuccess(res, 200, { post });
    } catch (err) {
        next(err);
    }
};

export const deletePost = async (req, res, next) => {
    try {
        await postService.deletePost(req.params.id, req.user._id);
        return sendSuccess(res, 204);
    } catch (err) {
        next(err);
    }
};
