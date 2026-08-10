import PostRepository from "../repositories/interfaces/post.repository.js";
import LikeRepository from "../repositories/interfaces/like.repository.js";
import { auditService } from "./audit.service.js";
import { notificationQueue } from "./notification.queue.js";
import { createError } from "../utils/errors.js";

const postRepository = new PostRepository();
const likeRepository = new LikeRepository();

const isDuplicateKey = (error) => error?.code === 11000;

const recordAudit = (action, actorId, resourceId) =>
    auditService.record({
        action,
        actorId,
        resourceType: "Post",
        resourceId,
        severity: "info",
    });

/**
 * Like a post (US4, FR-037).
 *
 * Uniqueness per user-post pair is enforced atomically by the
 * { userId, postId } index: concurrent duplicates cannot both succeed
 * (Constitution XI). The post author receives a like notification (FR-027).
 */
export const likePost = async ({ userId, postId, idempotencyKey }) => {
    const post = await postRepository.findById(postId);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }

    let like;
    try {
        like = await likeRepository.create({ userId, postId, idempotencyKey: idempotencyKey ?? null });
    } catch (error) {
        if (isDuplicateKey(error)) {
            throw createError("CONFLICT", "Already liked this post", 409);
        }
        throw error;
    }

    await recordAudit("like.create", userId, postId);
    await notificationQueue.publish({
        type: "like",
        recipientId: post.author.toString(),
        actorId: userId.toString(),
        resourceId: postId.toString(),
        dedupeKey: `like:${like._id}`,
        targetSummary: post.content.trim().slice(0, 140),
    });
    return like;
};

export const unlikePost = async ({ userId, postId }) => {
    const removed = await likeRepository.remove(userId, postId);
    if (!removed) {
        throw createError("NOT_FOUND", "Not liked", 404);
    }
    await recordAudit("like.delete", userId, postId);
    return removed;
};

/**
 * Check whether the caller liked a post (GET /posts/{id}/likes/me).
 * The post must exist, otherwise 404 per contract.
 */
export const isPostLiked = async ({ userId, postId }) => {
    const post = await postRepository.findById(postId);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }
    return { liked: await likeRepository.isLiked(userId, postId) };
};

