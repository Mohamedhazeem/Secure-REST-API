import * as notificationService from "../service/notification.service.js";
import { notificationIdSchema } from "../validators/notification.validator.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

/**
 * Project a stored notification onto the contract's `Notification` schema
 * (components/schemas.yaml). The delivery `dedupeKey` is an internal
 * idempotency detail and is never exposed.
 */
const present = (notification) => ({
    _id: notification._id,
    recipientId: notification.recipientId,
    actorId: notification.actorId,
    actorName: notification.actorName,
    action: notification.action,
    targetSummary: notification.targetSummary,
    deepLink: notification.deepLink,
    type: notification.type,
    resourceId: notification.resourceId,
    read: notification.read,
    createdAt: notification.createdAt,
});

/**
 * List the caller's notifications, newest first.
 * Complexity: O(limit) per page + O(n) countDocuments on the recipient index.
 */
export const listNotifications = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const result = await notificationService.listNotifications(req.user._id, { page, limit });
        return sendSuccess(res, 200, { ...result, data: result.data.map(present) });
    } catch (err) {
        next(err);
    }
};

export const markNotificationRead = async (req, res, next) => {
    try {
        const parsed = notificationIdSchema.safeParse(req.params.id);
        if (!parsed.success) {
            return next(createError("VALIDATION_ERROR", "Invalid notification id", 400));
        }
        const notification = await notificationService.markNotificationRead(parsed.data, req.user._id);
        return sendSuccess(res, 200, present(notification));
    } catch (err) {
        next(err);
    }
};
