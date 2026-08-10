import { logger } from "../utils/logger.js";

/**
 * Notification queue facade (US4/T052-T053, FR-027).
 *
 * Follow and like services dispatch notification jobs here when a social
 * interaction occurs. The durable BullMQ queue and worker land in US5
 * (T082, SC-017); until then publishing is best-effort and idempotent:
 * an unavailable queue never fails the triggering request, matching the
 * fail-fast error model (the mutation itself is the source of truth).
 */
let publisher = null;

export const setNotificationPublisher = (fn) => {
    publisher = fn;
};

export const notificationQueue = {
    async publish(job) {
        if (!publisher) {
            logger.warn("notification.queue.skipped", { type: job.type, reason: "no publisher configured" });
            return;
        }
        try {
            await publisher(job);
        } catch (error) {
            logger.error("notification.queue.failed", { type: job.type, error: error.message });
        }
    },
};
