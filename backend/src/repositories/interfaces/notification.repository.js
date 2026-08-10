/**
 * Repository interface for Notification entities (US5, FR-027).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class NotificationRepositoryInterface {
    /**
     * Persist a notification unless one with the same `dedupeKey` already
     * exists. This is the effectively-once guarantee for an at-least-once
     * queue (Decision 6): a replayed job must not create a second row.
     * @param {Object} data - The notification payload including `dedupeKey`.
     * @returns {Promise<Object>} { notification, created }.
     */
    async createIfAbsent(data) {}

    /**
     * Find a notification by its identifier.
     * @param {string} id - The notification's ObjectId.
     * @returns {Promise<Object|null>} The notification, or null if absent.
     */
    async findById(id) {}

    /**
     * List a recipient's notifications in reverse chronological order.
     * @param {string} recipientId - The owning user's ObjectId.
     * @param {Object} [pagination] - { page, limit }.
     * @returns {Promise<Object>} { data, page, limit, total }.
     */
    async findManyByRecipient(recipientId, pagination) {}

    /**
     * Mark a notification as read for its owner. Scoping the update by
     * recipient makes ownership enforcement atomic with the write.
     * @param {string} id - The notification's ObjectId.
     * @param {string} recipientId - The owning user's ObjectId.
     * @returns {Promise<Object|null>} The updated notification, or null when
     * it does not exist or belongs to another user.
     */
    async markRead(id, recipientId) {}
}
