import AuditLog from "../../../models/audit-log.model.js";

export default class AuditLogRepository {
    /**
     * Persist an audit entry (FR-030). Append-only: entries are never
     * updated or deleted after creation.
     * @param {Object} entry - Audit event data.
     * @returns {Promise<Object>} The created audit log document.
     */
    async write(entry) {
        return AuditLog.create(entry);
    }
}
