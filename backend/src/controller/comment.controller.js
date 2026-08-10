import * as commentService from "../service/comment.service.js";
import { commentPostIdSchema } from "../validators/comment.validator.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

const parsePostId = (req) => {
    const parsed = commentPostIdSchema.safeParse(req.params.id);
    if (!parsed.success) throw createError("VALIDATION_ERROR", "Invalid post id", 400);
    return parsed.data;
};

/**
 * Project a stored comment onto the contract's `Comment` schema
 * (components/schemas.yaml). Internal fields - the replay key and the
 * optimistic lock counter - stay out of the public payload.
 */
const present = (comment) => ({
    _id: comment._id,
    postId: comment.postId,
    authorId: comment.authorId,
    content: comment.content,
    parentCommentId: comment.parentCommentId ?? null,
    createdAt: comment.createdAt,
});

export const createComment = async (req, res, next) => {
    try {
        const { comment, created } = await commentService.createComment({
            postId: parsePostId(req),
            authorId: req.user._id,
            content: req.body.content,
            parentCommentId: req.body.parentCommentId,
            idempotencyKey: req.body.idempotencyKey,
        });
        // Contract (paths/comments.yaml): a replayed idempotency key returns
        // the original comment under 409 instead of creating a duplicate.
        return sendSuccess(res, created ? 201 : 409, present(comment));
    } catch (err) {
        next(err);
    }
};

/**
 * List a post's comments with pagination.
 * Complexity: O(limit) per page + O(n) countDocuments on the post index.
 */
export const listComments = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const result = await commentService.listComments({
            postId: parsePostId(req),
            callerId: req.user._id,
            page,
            limit,
        });
        return sendSuccess(res, 200, { ...result, data: result.data.map(present) });
    } catch (err) {
        next(err);
    }
};
