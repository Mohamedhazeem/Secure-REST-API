import { Router } from "express";
import { listNotifications, markNotificationRead } from "../controller/notification.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { markNotificationReadSchema } from "../validators/notification.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

/**
 * Notification routes (US5, T084). Mounted under `/api/v1/notifications`;
 * every operation is scoped to the authenticated recipient.
 */
export const notificationRouter = Router();

notificationRouter.get("/", requirePermission("notifications:read"), listNotifications);
notificationRouter.patch(
    "/:id/read",
    validate(markNotificationReadSchema),
    requirePermission("notifications:update"),
    markNotificationRead
);
