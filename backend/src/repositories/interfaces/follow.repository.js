/**
 * Repository interface for Follow entities (US4, FR-025).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class FollowRepositoryInterface {
    /**
     * Persist a follow relationship. Duplicate pairs MUST NOT be created:
     * implementations must surface a duplicate-key error that the service
     * maps to CONFLICT.
     * @param {Object} data - { followerId, followingId }.
     * @returns {Promise<Object>} The created follow document.
     */
    async create(data) {}

    /**
     * Remove a follow relationship.
     * @param {string} followerId - The follower's user ObjectId.
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<Object|null>} The removed document, or null if absent.
     */
    async remove(followerId, followingId) {}

    /**
     * Check whether a follow relationship exists.
     * @param {string} followerId - The follower's user ObjectId.
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<boolean>} True when the relationship exists.
     */
    async isFollowing(followerId, followingId) {}

    /**
     * List the user ids a follower follows.
     * @param {string} followerId - The follower's user ObjectId.
     * @returns {Promise<string[]>} Following user ids (ObjectId strings).
     */
    async findFollowingIds(followerId) {}

    /**
     * List the user ids that follow a user (fanout targets).
     * @param {string} followingId - The followed user's ObjectId.
     * @returns {Promise<string[]>} Follower user ids (ObjectId strings).
     */
    async findFollowerIds(followingId) {}
}
