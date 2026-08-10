import Notification from "../../../models/notification.model.js";

export default class NotificationRepository {
    /**
     * Insert a notification unless one already exists for the same
     * `dedupeKey`. The unique index makes the check-and-insert atomic, so
     * concurrent deliveries of a retried job converge on one row
     * (Decision 6, SC-017).
     * @param {Object} data - The notification payload including `dedupeKey`.
     * @returns {Promise<Object>} { notification, created }.
     */
    async createIfAbsent(data) {
        const existing = await Notification.findOne({ dedupeKey: data.dedupeKey }).lean().exec();
        if (existing) {
            return { notification: existing, created: false };
        }
        try {
            const created = await Notification.create(data);
            return { notification: created.toObject(), created: true };
        } catch (error) {
            if (error?.code === 11000) {
                const raced = await Notification.findOne({ dedupeKey: data.dedupeKey }).lean().exec();
                if (raced) return { notification: raced, created: false };
            }
            throw error;
        }
    }

    /**
     * Find a notification by its identifier.
     * @param {string} id - The notification's ObjectId.
     * @returns {Promise<Object|null>} The notification, or null if absent.
     */
    async findById(id) {
        return Notification.findById(id).lean().exec();
    }

    /**
     * List a recipient's notifications in reverse chronological order.
     *
     * Complexity: O(limit) per page over the
     * { recipientId, createdAt, _id } index plus an O(n) countDocuments on
     * the same filtered index. The `_id` tiebreaker keeps ordering stable
     * for notifications created within the same millisecond.
     * @param {string} recipientId - The owning user's ObjectId.
     * @param {Object} [pagination] - { page = 1, limit = 20 }.
     * @returns {Promise<Object>} { data, page, limit, total }.
     */
    async findManyByRecipient(recipientId, pagination) {
        const { page = 1, limit = 20 } = pagination || {};
        const filter = { recipientId };
        const data = await Notification.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
        const total = await Notification.countDocuments(filter).exec();
        return { data, page, limit, total };
    }

    /**
     * Mark a notification read. The recipient is part of the filter, so
     * ownership is enforced by the same atomic write - a foreign caller
     * matches nothing and receives null.
     * @param {string} id - The notification's ObjectId.
     * @param {string} recipientId - The owning user's ObjectId.
     * @returns {Promise<Object|null>} The updated notification, or null.
     */
    async markRead(id, recipientId) {
        return Notification.findOneAndUpdate(
            { _id: id, recipientId },
            { $set: { read: true } },
            { returnDocument: "after" }
        )
            .lean()
            .exec();
    }
}
