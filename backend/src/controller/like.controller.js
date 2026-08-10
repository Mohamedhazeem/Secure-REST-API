import * as likeService from "../service/like.service.js";
import { sendSuccess } from "../utils/response.js";

export const likePost = async (req, res, next) => {
    try {
        const like = await likeService.likePost({
            userId: req.user._id,
            postId: req.params.id,
            idempotencyKey: req.body.idempotencyKey,
        });
        return sendSuccess(res, 201, { like });
    } catch (err) {
        next(err);
    }
};

export const unlikePost = async (req, res, next) => {
    try {
        await likeService.unlikePost({ userId: req.user._id, postId: req.params.id });
        return sendSuccess(res, 204);
    } catch (err) {
        next(err);
    }
};

export const isPostLiked = async (req, res, next) => {
    try {
        const status = await likeService.isPostLiked({ userId: req.user._id, postId: req.params.id });
        return sendSuccess(res, 200, status);
    } catch (err) {
        next(err);
    }
};
