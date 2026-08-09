import { getCorrelationId } from "../middleware/correlation.middleware.js";
import { logger } from "../utils/logger.js";

/**
 * Audit logging service (FR-030).
 *
 * Persists security-relevant events: authentication, authorization
 * failures, token reuse, and resource mutations. The persistence writer
 * is injected (repository-backed, wired at app composition in T066) so the
 * service stays persistence-agnostic per Constitution V. Every entry is
 * correlated to its request via the correlation ID (FR-031/SC-016).
 *
 * Complexity: O(1) per record - single write through the injected writer.
 */
export const createAuditService = (writer) => {
    const record = async (event) => {
        const entry = {
            ...event,
            correlationId: event.correlationId ?? getCorrelationId(),
            timestamp: new Date().toISOString(),
        };

        if (!writer) {
            logger.warn("audit.record.skipped", { action: event.action, reason: "no writer configured" });
            return;
        }

        try {
            await writer.write(entry);
        } catch (error) {
            logger.error("audit.record.failed", { action: event.action, error: error.message });
        }
    };

    return { record };
};

let writer = null;

export const setAuditWriter = (w) => {
    writer = w;
};

export const auditService = {
    record: async (event) => createAuditService(writer).record(event),
};
