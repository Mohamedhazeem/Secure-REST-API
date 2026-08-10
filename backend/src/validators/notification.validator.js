import { z } from "zod";
import { NOTIFICATION_TYPES } from "../models/notification.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid identifier");

/**
 * Marking a notification read carries no request body (contract
 * `notifications.yaml`). The strict empty schema rejects unexpected
 * payload fields while allowing the conventional empty or absent body.
 */
export const markNotificationReadSchema = z.object({}).strict().optional();

/**
 * The `:id` path parameter of the mark-read route. Validating it in the
 * controller keeps a malformed identifier an explicit 400 instead of a cast
 * failure surfacing as an internal error.
 */
export const notificationIdSchema = objectId;

/**
 * Notification job payload (FR-027).
 *
 * Jobs arrive from the queue rather than from an HTTP client, so they are
 * validated at the service boundary before persistence: a malformed job is
 * rejected explicitly instead of poisoning the notification feed
 * (Constitution IX).
 */
export const notificationJobSchema = z.object({
    type: z.enum(NOTIFICATION_TYPES),
    recipientId: objectId,
    actorId: objectId,
    resourceId: objectId,
    dedupeKey: z.string().trim().min(1).max(255),
    targetSummary: z.string().trim().min(1).max(200).optional(),
    deepLink: z.string().trim().min(1).optional(),
});
