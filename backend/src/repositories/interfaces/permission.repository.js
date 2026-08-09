import mongoose from "mongoose";

/**
 * Repository interface for Permission entities.
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class PermissionRepositoryInterface {
    /**
     * Retrieve a permission by its unique identifier.
     * @param {string} id - The permission's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The permission document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve a single permission by its unique code.
     * @param {string} code - The permission code (e.g. "posts:create").
     * @returns {Promise<Object|null>} The matching permission document, or null if not found.
     */
    async findOne(code) {}

    /**
     * Persist a new permission.
     * @param {Object} data - The permission data to persist.
     * @returns {Promise<Object>} The created permission document.
     */
    async create(data) {}

    /**
     * Insert or update a permission keyed by its unique code.
     * @param {string} code - The permission code (e.g. "posts:create").
     * @param {Object} data - The permission data to persist.
     * @returns {Promise<Object>} The upserted permission document.
     */
    async upsert(code, data) {}

    /**
     * Retrieve all permissions matching an optional filter.
     * @param {Object} [filter={}] - Filter criteria.
     * @returns {Promise<Object[]>} An array of permission documents.
     */
    async findMany(filter = {}) {}
}
