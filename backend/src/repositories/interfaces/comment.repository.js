/**
 * Repository interface for Comment entities (US5, FR-024).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class CommentRepositoryInterface {
    /**
     * Persist a comment. When `idempotencyKey` is present the implementation
     * must reject a second insert for the same author and key with a
     * duplicate-key error so the service can replay the original comment.
     * @param {Object} data - { postId, authorId, content, parentCommentId, idempotencyKey }.
     * @returns {Promise<Object>} The created comment document.
     */
    async create(data) {}

    /**
     * Find a comment by its identifier.
     * @param {string} id - The comment's ObjectId.
     * @returns {Promise<Object|null>} The comment document, or null if absent.
     */
    async findById(id) {}

    /**
     * Look up a previously created comment by author and idempotency key.
     * @param {string} authorId - The comment author's ObjectId.
     * @param {string} idempotencyKey - The client-supplied replay key.
     * @returns {Promise<Object|null>} The existing comment, or null if absent.
     */
    async findByIdempotencyKey(authorId, idempotencyKey) {}

    /**
     * List comments of a post, newest first, with pagination.
     * @param {string} postId - The parent post's ObjectId.
     * @param {Object} [pagination] - { page, limit }.
     * @returns {Promise<Object>} { data, page, limit, total }.
     */
    async findManyByPost(postId, pagination) {}

    /**
     * Atomically update a comment only if its version matches
     * (compare-and-set optimistic locking).
     * @param {Object} criteria - { id, expectedVersion }.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated comment with an incremented
     * version, or null when the version no longer matches.
     */
    async updateIfCurrent(criteria, data) {}
}
