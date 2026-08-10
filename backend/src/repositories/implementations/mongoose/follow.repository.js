import Follow from "../../../models/follow.model.js";

export default class FollowRepository {
    /**
     * Create a follow relationship. The compound unique index on
     * { followerId, followingId } rejects duplicates atomically (FR-025);
     * the duplicate-key error (code 11000) is mapped to CONFLICT by the
     * service layer.
     * @param {Object} data - { followerId, followingId }.
     * @returns {Promise<Object>} The created follow document.
     */
    async create(data) {
        return Follow.create(data);
    }

    /**
     * Remove a follow relationship.
     * @param {string} followerId - The follower's user ObjectId.
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<Object|null>} The removed document, or null if absent.
     */
    async remove(followerId, followingId) {
        return Follow.findOneAndDelete({ followerId, followingId }).lean().exec();
    }

    /**
     * Check whether a follow relationship exists.
     * @param {string} followerId - The follower's user ObjectId.
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<boolean>} True when the relationship exists.
     */
    async isFollowing(followerId, followingId) {
        const doc = await Follow.findOne({ followerId, followingId }).select("_id").lean().exec();
        return Boolean(doc);
    }

    /**
     * List the user ids a follower follows.
     * @param {string} followerId - The follower's user ObjectId.
     * @returns {Promise<string[]>} Following user ids (ObjectId strings).
     */
    async findFollowingIds(followerId) {
        const docs = await Follow.find({ followerId }).select("followingId").lean().exec();
        return docs.map((doc) => doc.followingId.toString());
    }

    /**
     * List the user ids that follow a user (fanout targets).
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<string[]>} Follower user ids (ObjectId strings).
     */
    async findFollowerIds(followingId) {
        const docs = await Follow.find({ followingId }).select("followerId").lean().exec();
        return docs.map((doc) => doc.followerId.toString());
    }
}
