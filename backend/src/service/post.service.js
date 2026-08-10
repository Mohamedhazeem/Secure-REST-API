import PostRepository from "../repositories/interfaces/post.repository.js";
import { auditService } from "./audit.service.js";
import { fanoutPostToFollowers, invalidateFollowerFeedCaches } from "./feed.service.js";
import { createError } from "../utils/errors.js";

const postRepository = new PostRepository();

const recordAudit = (action, actorId, resourceId) =>
    auditService.record({
        action,
        actorId,
        resourceType: "Post",
        resourceId,
        severity: "info",
    });

export const createPost = async ({ content, visibility = "public", authorId }) => {
    const post = await postRepository.create({ content, visibility, author: authorId });
    await recordAudit("post.create", authorId, post._id.toString());
    await fanoutPostToFollowers({ authorId, postId: post._id });
    return post;
};

/**
 * List posts the caller may view: public posts plus the caller's own
 * (FR-036). Followers-only posts become visible to followers once the
 * follow repository lands (US4); until then only the author sees them.
 */
export const listAllPosts = async (callerId, { page = 1, limit = 20 } = {}) => {
    const filter = { $or: [{ visibility: "public" }, { author: callerId }] };
    return postRepository.findMany(filter, { page, limit });
};

export const listMyPosts = async (authorId, { page = 1, limit = 20 } = {}) => {
    return postRepository.findMany({ author: authorId }, { page, limit });
};

export const updatePost = async (id, authorId, { content, visibility, version }) => {
    const post = await postRepository.findById(id);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }
    if (post.author.toString() !== authorId.toString()) {
        throw createError("OWNERSHIP_REQUIRED", "You can only modify your own posts", 403);
    }
    const updated = await postRepository.updateIfCurrent(
        { id, expectedVersion: version },
        { ...(content !== undefined && { content }), ...(visibility !== undefined && { visibility }) }
    );
    if (!updated) {
        throw createError("CONFLICT", "Post was modified by another request; refresh and retry", 409);
    }
    await recordAudit("post.update", authorId, updated._id.toString());
    await invalidateFollowerFeedCaches(authorId);
    return updated;
};

export const deletePost = async (id, authorId) => {
    const post = await postRepository.findById(id);
    if (!post) {
        throw createError("NOT_FOUND", "Post not found", 404);
    }
    if (post.author.toString() !== authorId.toString()) {
        throw createError("OWNERSHIP_REQUIRED", "You can only delete your own posts", 403);
    }
    await postRepository.deleteById(id);
    await recordAudit("post.delete", authorId, post._id.toString());
    await invalidateFollowerFeedCaches(authorId);
    return { id };
};

