/**
 * @typedef {Object} PostFilter
 * @property {string} [author] - The author's user ObjectId.
 * @property {string} [visibility] - Visibility level ("public", "followers-only", "private").
 * @property {Object} [$or] - Raw disjunction (e.g. visibility ∪ author visibility rule).
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
 * Repository interface for Post entities.
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export { default } from "../implementations/mongoose/post.repository.js";
