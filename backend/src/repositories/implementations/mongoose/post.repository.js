import mongoose from "mongoose";
import Post from "../../../models/post.model.js";

export default class PostRepository {
    /**
     * Find a post by its ObjectId.
     * @param {string} id - The post's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The post document, or null if not found.
     */
    async findById(id) {
        return Post.findById(id).lean().exec();
    }

    /**
     * Find a single post matching the given filter criteria.
     * @param {Object} filter - Mongoose query filter (e.g. { author: userId }).
     * @returns {Promise<Object|null>} The matching post document, or null if not found.
     */
    async findOne(filter) {
        return Post.findOne(filter).lean().exec();
    }

    /**
     * Create a new post.
     * @param {Object} data - The post data to persist.
     * @returns {Promise<Object>} The created post document.
     */
    async create(data) {
        const post = new Post(data);
        return post.save();
    }

    /**
     * Update an existing post by id.
     * @param {string} id - The post's MongoDB ObjectId.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated post document, or null if not found.
     */
    async update(id, data) {
        return Post.findByIdAndUpdate(id, data, { new: true }).lean().exec();
    }

    /**
     * Permanently delete a post by id.
     * @param {string} id - The post's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The deleted post document, or null if not found.
     */
    async deleteById(id) {
        return Post.findByIdAndDelete(id).lean().exec();
    }

    /**
     * Find posts matching an optional filter with pagination.
     *
     * Complexity: O(n) where n = limit (page size), due to skip+limit scan.
     * countDocuments is O(n) on the filtered index; for unfiltered queries
     * estimatedDocumentCount() is O(1) but cannot be used here because a filter may apply.
     * Populate uses a single batched $in query (not N+1) since Mongoose 6+.
     * @param {Object} [filter={}] - Mongoose query filter.
     * @param {Object} [pagination] - Pagination options.
     * @param {number} [pagination.page=1] - Page number (1-indexed).
     * @param {number} [pagination.limit=10] - Items per page.
     * @returns {Promise<Object>} An object with { data, page, limit, total }.
     */
    async findMany(filter = {}, pagination) {
        const { page = 1, limit = 10 } = pagination || {};
        const data = await Post.find(filter)
            .populate("author", "username email")
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
        const total = await Post.countDocuments(filter).exec();
        return { data, page, limit, total };
    }

    /**
     * Reassign authorship of every post by one author to another user.
     * @param {string} fromAuthorId - The deleted user's ObjectId.
     * @param {string} toAuthorId - The "[deleted]" placeholder's ObjectId.
     * @returns {Promise<number>} Number of posts updated.
     */
    async reassignAuthor(fromAuthorId, toAuthorId) {
        const result = await Post.updateMany(
            { author: fromAuthorId },
            { $set: { author: toAuthorId } }
        ).exec();
        return result.modifiedCount ?? 0;
    }
}
