import mongoose from "mongoose";

/**
 * Repository interface for Role entities.
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export default class RoleRepositoryInterface {
    /**
     * Retrieve a role by its unique identifier.
     * @param {string} id - The role's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The role document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve a single role by its unique name.
     * @param {string} name - The role name (e.g. "user", "admin").
     * @returns {Promise<Object|null>} The matching role document, or null if not found.
     */
    async findOne(name) {}

    /**
     * Persist a new role.
     * @param {Object} data - The role data to persist.
     * @returns {Promise<Object>} The created role document.
     */
    async create(data) {}

    /**
     * Insert or update a role keyed by its unique name.
     * @param {string} name - The role name (e.g. "user", "admin").
     * @param {Object} data - The role data to persist.
     * @returns {Promise<Object>} The upserted role document.
     */
    async upsert(name, data) {}

    /**
     * Retrieve all roles matching an optional filter.
     * @param {Object} [filter={}] - Filter criteria.
     * @returns {Promise<Object[]>} An array of role documents.
     */
    async findMany(filter = {}) {}
}
