import Session from "../../../models/session.model.js";

export default class SessionRepository {
    /**
     * Create a new session document.
     * @param {Object} data - Session data.
     * @returns {Promise<Object>} The created session document.
     */
    async create(data) {
        const session = new Session(data);
        return session.save();
    }

    /**
     * Find a session by its unique identifier (refresh token jti claim).
     * @param {string} id - The session's unique identifier.
     * @returns {Promise<Object|null>} The session document, or null if not found.
     */
    async findById(id) {
        return Session.findById(id).lean().exec();
    }

    /**
     * Find all non-revoked sessions for a user.
     * @param {string} userId - The owning user's ObjectId.
     * @returns {Promise<Object[]>} Active session documents.
     */
    async findActiveByUserId(userId) {
        return Session.find({ userId, revokedAt: null }).lean().exec();
    }

    /**
     * Atomically rotate a session's refresh token (compare-and-set on the
     * current hash) so two concurrent refreshes cannot both succeed.
     * @param {Object} criteria - { id, currentHash }.
     * @param {Object} data - { refreshTokenHash, expiresAt, lastActiveAt }.
     * @returns {Promise<Object|null>} The rotated session, or null when the
     * current hash no longer matches (token was already rotated).
     */
    async rotateIfCurrent({ id, currentHash }, data) {
        return Session.findOneAndUpdate(
            { _id: id, refreshTokenHash: currentHash },
            { $set: data },
            { returnDocument: "after" }
        )
            .lean()
            .exec();
    }

    /**
     * Revoke a session by setting its revokedAt timestamp.
     * @param {string} id - The session's unique identifier.
     * @returns {Promise<Object|null>} The updated session document, or null if not found.
     */
    async revoke(id) {
        return Session.findByIdAndUpdate(id, { revokedAt: new Date() }, { returnDocument: "after" })
            .lean()
            .exec();
    }

    /**
     * Atomically revoke every non-revoked session for a user.
     * @param {string} userId - The owning user's ObjectId.
     * @returns {Promise<Object>} { matchedIds, modifiedCount } — matchedIds
     * are the sessions the caller must mark revoked in Redis.
     */
    async revokeAllByUser(userId) {
        const sessions = await Session.find({ userId, revokedAt: null }, { _id: 1 }).lean().exec();
        const matchedIds = sessions.map((s) => s._id);
        if (matchedIds.length === 0) return { matchedIds, modifiedCount: 0 };
        const result = await Session.updateMany(
            { _id: { $in: matchedIds }, revokedAt: null },
            { $set: { revokedAt: new Date() } }
        ).exec();
        return { matchedIds, modifiedCount: result.modifiedCount ?? 0 };
    }

    /**
     * Revoke every non-revoked session idle past the cutoff.
     * @param {Date} idleBefore - Cutoff timestamp for lastActiveAt.
     * @returns {Promise<Object>} { matchedIds, modifiedCount } — matchedIds
     * are the sessions the caller must mark revoked in Redis.
     */
    async sweepInactive({ idleBefore }) {
        const sessions = await Session.find(
            { revokedAt: null, lastActiveAt: { $lt: idleBefore } },
            { _id: 1 }
        )
            .lean()
            .exec();
        const matchedIds = sessions.map((s) => s._id);
        if (matchedIds.length === 0) return { matchedIds, modifiedCount: 0 };
        const result = await Session.updateMany(
            { _id: { $in: matchedIds }, revokedAt: null },
            { $set: { revokedAt: new Date() } }
        ).exec();
        return { matchedIds, modifiedCount: result.modifiedCount ?? 0 };
    }

    /**
     * Permanently remove revoked sessions expired before the cutoff.
     * @param {Date} cutoff - Expiration cutoff timestamp.
     * @returns {Promise<number>} Number of sessions deleted.
     */
    async deleteExpired({ cutoff }) {
        const result = await Session.deleteMany({
            revokedAt: { $ne: null },
            expiresAt: { $lt: cutoff },
        }).exec();
        return result.deletedCount ?? 0;
    }
}
