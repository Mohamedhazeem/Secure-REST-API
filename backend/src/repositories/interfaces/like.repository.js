/**
 * Repository interface for Like entities (US4, FR-037).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class LikeRepositoryInterface {
    /**
     * Persist a like. A user may like a given post at most once:
     * implementations must surface a duplicate-key error that the service
     * maps to CONFLICT.
     * @param {Object} data - { userId, postId }.
     * @returns {Promise<Object>} The created like document.
     */
    async create(data) {}

    /**
     * Remove a like by user and post.
     * @param {string} userId - The liking user's ObjectId.
     * @param {string} postId - The liked post's ObjectId.
     * @returns {Promise<Object|null>} The removed document, or null if absent.
     */
    async remove(userId, postId) {}

    /**
     * Check whether a user has liked a post.
     * @param {string} userId - The liking user's ObjectId.
     * @param {string} postId - The liked post's ObjectId.
     * @returns {Promise<boolean>} True when the like exists.
     */
    async isLiked(userId, postId) {}
}
