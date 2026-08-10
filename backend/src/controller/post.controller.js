import * as postService from "../service/post.service.js";
import { getFeed as getPersonalizedFeed } from "../service/feed.service.js";
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
 * List posts visible to the caller with pagination (FR-036).
 * Complexity: O(limit) per page + O(n) countDocuments scan.
 * See post.repository.findMany for full breakdown.
 */
export const getAllPosts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const result = await postService.listAllPosts(req.user._id, { page, limit });
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
        const version = req.body.version ?? req.header("If-Match");
        const post = await postService.updatePost(req.params.id, req.user._id, { ...req.body, version });
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

/**
 * Cursor-paginated personalized feed of followed users' posts (US4,
 * FR-026/FR-036). The cursor is opaque; ordering is deterministic by
 * creation time with an id tiebreaker.
 */
export const getFeed = async (req, res, next) => {
    try {
        const feed = await getPersonalizedFeed(req.user._id, {
            cursor: req.query.cursor,
            limit: req.query.limit,
        });
        return sendSuccess(res, 200, feed);
    } catch (err) {
        next(err);
    }
};
