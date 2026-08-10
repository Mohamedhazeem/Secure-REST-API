import Comment from "../../../models/comment.model.js";

export default class CommentRepository {
    /**
     * Create a comment. When an `idempotencyKey` is supplied, the partial
     * unique index on { authorId, idempotencyKey } rejects a replay
     * atomically; the duplicate-key error (code 11000) is resolved by the
     * service into the originally created comment (FR-028).
     * @param {Object} data - { postId, authorId, content, parentCommentId, idempotencyKey }.
     * @returns {Promise<Object>} The created comment document.
     */
    async create(data) {
        const comment = await Comment.create(data);
        return comment.toObject();
    }

    /**
     * Find a comment by its identifier.
     * @param {string} id - The comment's ObjectId.
     * @returns {Promise<Object|null>} The comment document, or null if absent.
     */
    async findById(id) {
        return Comment.findById(id).lean().exec();
    }

    /**
     * Look up a previously created comment by author and idempotency key.
     * @param {string} authorId - The comment author's ObjectId.
     * @param {string} idempotencyKey - The client-supplied replay key.
     * @returns {Promise<Object|null>} The existing comment, or null if absent.
     */
    async findByIdempotencyKey(authorId, idempotencyKey) {
        return Comment.findOne({ authorId, idempotencyKey }).lean().exec();
    }

    /**
     * List a post's comments newest-first with pagination.
     *
     * Complexity: O(limit) per page over the { postId, createdAt } index
     * plus an O(n) countDocuments on the same filtered index.
     * @param {string} postId - The parent post's ObjectId.
     * @param {Object} [pagination] - { page = 1, limit = 20 }.
     * @returns {Promise<Object>} { data, page, limit, total }.
     */
    async findManyByPost(postId, pagination) {
        const { page = 1, limit = 20 } = pagination || {};
        const filter = { postId };
        const data = await Comment.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
        const total = await Comment.countDocuments(filter).exec();
        return { data, page, limit, total };
    }

    /**
     * Atomically update a comment only if its version matches
     * (compare-and-set optimistic locking, Constitution XI). The version
     * filter and `$inc` make the check-and-increment a single atomic
     * operation, so two concurrent writers holding the same version cannot
     * both succeed.
     * @param {Object} criteria - { id, expectedVersion }.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated comment, or null on a
     * version mismatch.
     */
    async updateIfCurrent({ id, expectedVersion }, data) {
        return Comment.findOneAndUpdate(
            { _id: id, version: expectedVersion },
            { $set: data, $inc: { version: 1 } },
            { returnDocument: "after" }
        )
            .lean()
            .exec();
    }
}
