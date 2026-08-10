import NotificationRepository from "../repositories/interfaces/notification.repository.js";
import UserRepository from "../repositories/interfaces/user.repository.js";
import { notificationJobSchema } from "../validators/notification.validator.js";
import { createError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();

const MAX_PAGE_SIZE = 50;

/**
 * Human-readable action text per event category (FR-039). Clients render
 * "<actorName> <action>" without a second API call.
 */
const ACTIONS = Object.freeze({
    follow: "started following you",
    comment: "commented on your post",
    like: "liked your post",
});

const DEFAULT_SUMMARIES = Object.freeze({
    follow: "New follower",
    comment: "New comment",
    like: "New like",
});

const defaultDeepLink = (job) =>
    job.type === "follow" ? `/users/${job.actorId}` : `/posts/${job.resourceId}`;

/**
 * Deliver one notification job (US5, FR-027/FR-039).
 *
 * Called by the notification worker, never by a request handler: the
 * triggering mutation is already committed, so delivery is a separate
 * unit of work. The job is validated at this boundary because it arrives
 * from a queue rather than from a validated HTTP request (Constitution IX).
 *
 * Idempotency: persistence is keyed by `dedupeKey`, so a job replayed by
 * the at-least-once queue converges on exactly one notification
 * (Decision 6, SC-017).
 *
 * Complexity: O(1) - one actor lookup plus one keyed upsert.
 *
 * @param {Object} job - { type, recipientId, actorId, resourceId, dedupeKey, targetSummary?, deepLink? }.
 * @returns {Promise<Object>} { notification, created }.
 */
export const deliverNotification = async (job) => {
    const parsed = notificationJobSchema.safeParse(job);
    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "job"}: ${issue.message}`)
            .join("; ");
        throw createError("VALIDATION_ERROR", `Invalid notification job: ${details}`, 400);
    }

    const data = parsed.data;

    // Self-directed interactions are not notified: a user acting on their
    // own content already knows about it.
    if (data.recipientId === data.actorId) {
        return { notification: null, created: false };
    }

    const [actor, recipient] = await Promise.all([
        userRepository.findById(data.actorId),
        userRepository.findById(data.recipientId),
    ]);

    if (!actor) {
        throw createError("NOT_FOUND", "Notification actor no longer exists", 404);
    }
    // A deleted recipient is a terminal, non-retryable outcome: the job is
    // dropped rather than retried forever (FR-038).
    if (!recipient) {
        logger.info("notification.recipient.missing", { type: data.type });
        return { notification: null, created: false };
    }

    return notificationRepository.createIfAbsent({
        recipientId: data.recipientId,
        actorId: data.actorId,
        type: data.type,
        actorName: actor.username,
        action: ACTIONS[data.type],
        targetSummary: data.targetSummary ?? DEFAULT_SUMMARIES[data.type],
        deepLink: data.deepLink ?? defaultDeepLink(data),
        resourceId: data.resourceId,
        dedupeKey: data.dedupeKey,
    });
};

/**
 * List the caller's notifications, newest first (spec US5 acceptance 4).
 *
 * The page size is clamped so a client cannot request an unbounded scan
 * (Constitution III).
 * @param {string} recipientId - The authenticated user's ObjectId.
 * @param {Object} [pagination] - { page, limit }.
 * @returns {Promise<Object>} { data, page, limit, total }.
 */
export const listNotifications = (recipientId, { page = 1, limit = 20 } = {}) =>
    notificationRepository.findManyByRecipient(recipientId, {
        page: Math.max(parseInt(page, 10) || 1, 1),
        limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), MAX_PAGE_SIZE),
    });

/**
 * Mark one of the caller's notifications as read.
 *
 * Ownership is enforced inside the atomic update: a notification belonging
 * to another user is indistinguishable from a missing one, so the response
 * never discloses the existence of foreign resources.
 * @param {string} id - The notification's ObjectId.
 * @param {string} recipientId - The authenticated user's ObjectId.
 * @returns {Promise<Object>} The updated notification.
 */
export const markNotificationRead = async (id, recipientId) => {
    const updated = await notificationRepository.markRead(id, recipientId);
    if (!updated) {
        throw createError("NOT_FOUND", "Notification not found", 404);
    }
    return updated;
};

