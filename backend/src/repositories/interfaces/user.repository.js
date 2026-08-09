import mongoose from "mongoose";

/**
 * @typedef {Object} UserFilter
 * @property {string} [username]
 * @property {string} [email]
 * @property {ObjectId} [deletedAt]
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1]
 * @property {number} [limit=10]
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Object[]} data
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 */

/**
 * Repository interface for User entities.
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class UserRepositoryInterface {
    /**
     * Retrieve a user by their unique identifier.
     * @param {string} id - The user's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The user document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve a single user matching the provided filter.
     * @param {UserFilter} filter - Filter criteria (e.g. { username }, { email }).
     * @returns {Promise<Object|null>} The matching user document, or null if not found.
     */
    async findOne(filter) {}

    /**
     * Persist a new user.
     * @param {Object} data - The user data to persist.
     * @returns {Promise<Object>} The created user document.
     */
    async create(data) {}

    /**
     * Update an existing user.
     * @param {string} id - The user's unique identifier.
     * @param {Object} data - Partial fields to update.
     * @returns {Promise<Object|null>} The updated user document, or null if not found.
     */
    async update(id, data) {}

    /**
     * Soft-delete a user by marking deletedAt.
     * @param {string} id - The user's unique identifier.
     * @returns {Promise<Object|null>} The updated user document, or null if not found.
     */
    async delete(id) {}

    /**
     * Retrieve users matching an optional filter, with pagination.
     * @param {UserFilter} [filter={}] - Filter criteria.
     * @param {PaginationOptions} [pagination] - Pagination options.
     * @returns {Promise<PaginatedResult>} Paginated result set.
     */
    async findMany(filter = {}, pagination) {}

    /**
     * Retrieve a user by their email address.
     * Excludes soft-deleted users.
     * @param {string} email - The user's email address.
     * @returns {Promise<Object|null>} The matching user document, or null if not found.
     */
    async findByEmail(email) {}
}
