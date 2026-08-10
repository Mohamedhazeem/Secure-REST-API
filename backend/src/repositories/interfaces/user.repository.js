
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
export { default } from "../implementations/mongoose/user.repository.js";

