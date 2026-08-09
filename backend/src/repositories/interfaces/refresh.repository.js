import mongoose from "mongoose";

/**
 * Repository interface for RefreshToken entities.
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class RefreshTokenRepositoryInterface {
    /**
     * Retrieve a refresh token by its MongoDB ObjectId.
     * @param {string} id - The refresh token's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The refresh token document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve a refresh token by its unique tokenId (jti claim value).
     * @param {string} tokenId - The JWT jti claim value.
     * @returns {Promise<Object|null>} The matching refresh token document, or null if not found.
     */
    async findOne(tokenId) {}

    /**
     * Persist a new refresh token record.
     * @param {Object} data - The refresh token data to persist.
     * @returns {Promise<Object>} The created refresh token document.
     */
    async create(data) {}

    /**
     * Revoke a refresh token by setting its revokedAt timestamp.
     * @param {string} id - The refresh token's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The updated refresh token document, or null if not found.
     */
    async revoke(id) {}

    /**
     * Retrieve all active (non-revoked) refresh tokens for a given user.
     * @param {string} userId - The user's MongoDB ObjectId.
     * @returns {Promise<Object[]>} An array of active refresh token documents.
     */
    async findActiveByUserId(userId) {}
}
