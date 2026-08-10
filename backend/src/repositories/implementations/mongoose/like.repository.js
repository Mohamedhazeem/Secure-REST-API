import Like from "../../../models/like.model.js";

export default class LikeRepository {
    /**
     * Create a like. The compound unique index on { userId, postId } rejects
     * duplicates atomically (FR-037); the duplicate-key error (code 11000)
     * is mapped to CONFLICT by the service layer.
     * @param {Object} data - { userId, postId }.
     * @returns {Promise<Object>} The created like document.
     */
    async create(data) {
        return Like.create(data);
    }

    /**
     * Remove a like by user and post.
     * @param {string} userId - The liking user's ObjectId.
     * @param {string} postId - The liked post's ObjectId.
     * @returns {Promise<Object|null>} The removed document, or null if absent.
     */
    async remove(userId, postId) {
        return Like.findOneAndDelete({ userId, postId }).lean().exec();
    }

    /**
     * Check whether a user has liked a post.
     * @param {string} userId - The liking user's ObjectId.
     * @param {string} postId - The liked post's ObjectId.
     * @returns {Promise<boolean>} True when the like exists.
     */
    async isLiked(userId, postId) {
        const doc = await Like.findOne({ userId, postId }).select("_id").lean().exec();
        return Boolean(doc);
    }
}
