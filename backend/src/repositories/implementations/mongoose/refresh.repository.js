import RefreshToken from "../../../models/refresh-token.model.js";

export default class RefreshTokenRepository {
    /**
     * Find a refresh token by its MongoDB ObjectId.
     * @param {string} id - The refresh token's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The refresh token document, or null if not found.
     */
    async findById(id) {
        return RefreshToken.findById(id).lean().exec();
    }

    /**
     * Find a refresh token by its unique tokenId (jti claim).
     * @param {string} tokenId - The JWT jti claim value.
     * @returns {Promise<Object|null>} The matching refresh token document, or null if not found.
     */
    async findOne(tokenId) {
        return RefreshToken.findOne({ tokenId }).lean().exec();
    }

    /**
     * Create a new refresh token record.
     * @param {Object} data - The refresh token data to persist.
     * @returns {Promise<Object>} The created refresh token document.
     */
    async create(data) {
        const token = new RefreshToken(data);
        return token.save();
    }

    /**
     * Revoke a refresh token by setting its revokedAt timestamp.
     * @param {string} id - The refresh token's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The updated refresh token document, or null if not found.
     */
    async revoke(id) {
        return RefreshToken.findByIdAndUpdate(id, { revokedAt: new Date() }, { new: true }).lean().exec();
    }

    /**
     * Find all non-revoked refresh tokens for a given user.
     * @param {string} userId - The user's MongoDB ObjectId.
     * @returns {Promise<Object[]>} An array of active refresh token documents.
     */
    async findActiveByUserId(userId) {
        return RefreshToken.find({ userId, revokedAt: { $exists: false } }).lean().exec();
    }
}
