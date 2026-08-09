import mongoose from "mongoose";
import User from "../../../models/user.model.js";

export default class UserRepository {
    /**
     * Find a user by their ObjectId.
     * @param {string} id - The user's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The user document, or null if not found.
     */
    async findById(id) {
        return User.findById(id).lean().exec();
    }

    /**
     * Find a single user matching the given filter criteria.
     * @param {Object} filter - Mongoose query filter (e.g. { username }, { email }).
     * @returns {Promise<Object|null>} The matching user document, or null if not found.
     */
    async findOne(filter) {
        return User.findOne(filter).lean().exec();
    }

    /**
     * Create a new user.
     * @param {Object} data - The user data to persist.
     * @returns {Promise<Object>} The created user document.
     */
    async create(data) {
        const user = new User(data);
        return user.save();
    }

    /**
     * Update an existing user by id.
     * @param {string} id - The user's MongoDB ObjectId.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated user document, or null if not found.
     */
    async update(id, data) {
        return User.findByIdAndUpdate(id, data, { new: true }).lean().exec();
    }

    /**
     * Soft-delete a user by setting deletedAt to now.
     * @param {string} id - The user's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The updated user document, or null if not found.
     */
    async delete(id) {
        return User.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }).lean().exec();
    }

    /**
     * Find users matching an optional filter with pagination.
     * Excludes soft-deleted users by default.
     * @param {Object} [filter={}] - Mongoose query filter.
     * @param {Object} [pagination] - Pagination options.
     * @param {number} [pagination.page=1] - Page number (1-indexed).
     * @param {number} [pagination.limit=10] - Items per page.
     * @returns {Promise<Object>} An object with { data, page, limit, total }.
     */
    async findMany(filter = {}, pagination) {
        const { page = 1, limit = 10 } = pagination || {};
        const query = User.find(filter).lean();
        const data = await query.skip((page - 1) * limit).limit(limit).exec();
        const total = await User.countDocuments(filter).exec();
        return { data, page, limit, total };
    }

    /**
     * Find a user by email address.
     * Excludes soft-deleted users.
     * @param {string} email - The user's email address.
     * @returns {Promise<Object|null>} The matching user document, or null if not found.
     */
    async findByEmail(email) {
        return User.findOne({ email, deletedAt: { $exists: false } }).lean().exec();
    }
}
