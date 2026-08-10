import UserRepository from "../repositories/interfaces/user.repository.js";
import FollowRepository from "../repositories/interfaces/follow.repository.js";
import { auditService } from "./audit.service.js";
import { notificationQueue } from "./notification.queue.js";
import { invalidateFeedCacheFor } from "./feed.service.js";
import { createError } from "../utils/errors.js";

const userRepository = new UserRepository();
const followRepository = new FollowRepository();

const isDuplicateKey = (error) => error?.code === 11000;

const recordAudit = (action, actorId, resourceId) =>
    auditService.record({
        action,
        actorId,
        resourceType: "User",
        resourceId,
        severity: "info",
    });

/**
 * Follow a user (US4, FR-025).
 *
 * Uniqueness is enforced atomically by the { followerId, followingId }
 * index: two concurrent follow attempts cannot both succeed, and the
 * loser maps the duplicate-key error to CONFLICT (Constitution XI).
 * A follow notification is dispatched to the followed user (FR-027).
 */
export const followUser = async ({ followerId, followingId }) => {
    if (followerId.toString() === followingId.toString()) {
        throw createError("SELF_FOLLOW", "You cannot follow yourself", 409);
    }

    const target = await userRepository.findById(followingId);
    if (!target) {
        throw createError("NOT_FOUND", "User not found", 404);
    }

    let follow;
    try {
        follow = await followRepository.create({ followerId, followingId });
    } catch (error) {
        if (isDuplicateKey(error)) {
            throw createError("CONFLICT", "Already following this user", 409);
        }
        throw error;
    }

    await recordAudit("follow.create", followerId, followingId);
    await invalidateFeedCacheFor(followerId);
    await notificationQueue.publish({
        type: "follow",
        recipientId: followingId.toString(),
        actorId: followerId.toString(),
        resourceId: follow._id.toString(),
        dedupeKey: `follow:${follow._id}`,
    });
    return follow;
};

export const unfollowUser = async ({ followerId, followingId }) => {
    const removed = await followRepository.remove(followerId, followingId);
    if (!removed) {
        throw createError("NOT_FOUND", "Not following this user", 404);
    }
    await recordAudit("follow.delete", followerId, followingId);
    await invalidateFeedCacheFor(followerId);
    return removed;
};

export const isFollowing = (followerId, followingId) =>
    followRepository.isFollowing(followerId, followingId);

