/**
 * Repository interface for Audit Log entries (US6).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class AuditLogRepositoryInterface {
    /**
     * Persist an audit entry (FR-030). Entries are append-only.
     * @param {Object} entry - { actorId, action, targetType, targetId, metadata, ip, userAgent, correlationId }.
     * @returns {Promise<Object>} The created audit log document.
     */
    async write(entry) {}
}
