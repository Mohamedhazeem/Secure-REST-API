/**
 * Repository interface for Session entities (US2).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class SessionRepositoryInterface {
    /**
     * Persist a new session.
     * @param {Object} data - Session data (userId, refreshTokenHash, deviceFingerprint, ipAddress, userAgent, expiresAt).
     * @returns {Promise<Object>} The created session document.
     */
    async create(data) {}

    /**
     * Retrieve a session by its unique identifier (the refresh token jti claim).
     * @param {string} id - The session's unique identifier.
     * @returns {Promise<Object|null>} The session document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve all non-revoked sessions for a user.
     * @param {string} userId - The owning user's ObjectId.
     * @returns {Promise<Object[]>} Active session documents.
     */
    async findActiveByUserId(userId) {}

    /**
     * Atomically rotate a session's refresh token only if the presented
     * hash is still the current one (compare-and-set). Returns null when
     * the session was already rotated — the caller treats that as reuse.
     * @param {Object} criteria - { id, currentHash }.
     * @param {Object} data - { refreshTokenHash, expiresAt, lastActiveAt }.
     * @returns {Promise<Object|null>} The rotated session, or null on conflict.
     */
    async rotateIfCurrent(criteria, data) {}

    /**
     * Revoke a session by setting its revokedAt timestamp.
     * @param {string} id - The session's unique identifier.
     * @returns {Promise<Object|null>} The updated session document, or null if not found.
     */
    async revoke(id) {}

    /**
     * Atomically revoke every non-revoked session for a user.
     * @param {string} userId - The owning user's ObjectId.
     * @returns {Promise<Object>} { matchedIds, modifiedCount } — matchedIds
     * are the sessions the caller must mark revoked in Redis.
     */
    async revokeAllByUser(userId) {}

    /**
     * Revoke every non-revoked session that has been idle past idleBefore.
     * @param {Date} idleBefore - Cutoff timestamp for lastActiveAt.
     * @returns {Promise<Object>} { matchedIds, modifiedCount } — matchedIds
     * are the sessions the caller must mark revoked in Redis.
     */
    async sweepInactive({ idleBefore }) {}

    /**
     * Permanently remove revoked sessions whose expiration is before cutoff.
     * @param {Date} cutoff - Expiration cutoff timestamp.
     * @returns {Promise<number>} Number of sessions deleted.
     */
    async deleteExpired({ cutoff }) {}
}
