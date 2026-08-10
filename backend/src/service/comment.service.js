import CommentRepository from "../repositories/interfaces/comment.repository.js";
import PostRepository from "../repositories/interfaces/post.repository.js";
import { auditService } from "./audit.service.js";
import { isFollowing } from "./follow.service.js";
import { notificationQueue } from "./notification.queue.js";
import { createError } from "../utils/errors.js";

const commentRepository = new CommentRepository();
const postRepository = new PostRepository();

const SUMMARY_LENGTH = 140;
const MAX_PAGE_SIZE = 50;

const isDuplicateKey = (error) => error?.code === 11000;

const recordAudit = (action, actorId, resourceId) =>
    auditService.record({
        action,
        actorId,
        resourceType: "Comment",
        resourceId,
        severity: "info",
    });

/**
 * Visibility gate for a post the caller wants to read or comment on
 * (FR-036). A post the caller may not see is reported as missing rather
 * than forbidden, so the API never discloses that it exists.
 */
const assertPostVisible = async (postId, callerId) => {
    const post = await postRepository.findById(postId);
    const denied = () => createError("NOT_FOUND", "Post not found", 404);
    if (!post) throw denied();

    const isAuthor = post.author.toString() === callerId.toString();
    if (post.visibility === "public" || isAuthor) return post;
    if (post.visibility === "followers-only" && (await isFollowing(callerId, post.author))) return post;

    throw denied();
};

const summarize = (content) => content.trim().slice(0, SUMMARY_LENGTH);

/**
 * Create a comment on a post (US5, FR-024/FR-028).
 *
 * Concurrency: a comment is an atomic append. When the client supplies an
 * `idempotencyKey`, the partial unique index on { authorId, idempotencyKey }
 * decides the race - the loser's duplicate-key error resolves to the
 * comment the winner created, so a retried submission can never produce two
 * comments (Constitution XI). `version` starts at 0 and is the
 * compare-and-set counter for subsequent mutations.
 *
 * The post author is notified asynchronously; the notification carries a
 * stable `dedupeKey` derived from the comment id, so a replayed request and
 * a retried queue job both collapse to a single notification (FR-027).
 *
 * Complexity: O(1) - post lookup, optional replay lookup, single insert.
 *
 * @param {Object} input - { postId, authorId, content, parentCommentId, idempotencyKey }.
 * @returns {Promise<Object>} { comment, created } where `created` is false
 * for an idempotent replay.
 */
export const createComment = async ({ postId, authorId, content, parentCommentId, idempotencyKey }) => {
    const post = await assertPostVisible(postId, authorId);

    if (parentCommentId) {
        const parent = await commentRepository.findById(parentCommentId);
        if (!parent || parent.postId.toString() !== postId.toString()) {
            throw createError("VALIDATION_ERROR", "parentCommentId must reference a comment on this post", 400);
        }
    }

    if (idempotencyKey) {
        const replay = await commentRepository.findByIdempotencyKey(authorId, idempotencyKey);
        if (replay) return { comment: replay, created: false };
    }

    let comment;
    try {
        comment = await commentRepository.create({
            postId,
            authorId,
            content,
            parentCommentId: parentCommentId ?? null,
            idempotencyKey: idempotencyKey ?? null,
        });
    } catch (error) {
        if (isDuplicateKey(error) && idempotencyKey) {
            const raced = await commentRepository.findByIdempotencyKey(authorId, idempotencyKey);
            if (raced) return { comment: raced, created: false };
        }
        throw error;
    }

    await recordAudit("comment.create", authorId, comment._id.toString());
    await notificationQueue.publish({
        type: "comment",
        recipientId: post.author.toString(),
        actorId: authorId.toString(),
        resourceId: comment._id.toString(),
        dedupeKey: `comment:${comment._id}`,
        targetSummary: summarize(comment.content),
        deepLink: `/posts/${postId}/comments/${comment._id}`,
    });

    return { comment, created: true };
};

/**
 * List a post's comments, newest first (FR-024).
 *
 * The page size is clamped so a client cannot request an unbounded scan
 * (Constitution III).
 * @param {Object} input - { postId, callerId, page, limit }.
 * @returns {Promise<Object>} { data, page, limit, total }.
 */
export const listComments = async ({ postId, callerId, page = 1, limit = 20 }) => {
    await assertPostVisible(postId, callerId);
    return commentRepository.findManyByPost(postId, {
        page: Math.max(parseInt(page, 10) || 1, 1),
        limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), MAX_PAGE_SIZE),
    });
};

