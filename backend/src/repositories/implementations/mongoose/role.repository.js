import Role from "../../../models/role.model.js";

export default class RoleRepository {
    /**
     * Find a role by its ObjectId.
     * @param {string} id - The role's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The role document, or null if not found.
     */
    async findById(id) {
        return Role.findById(id).lean().exec();
    }

    /**
     * Find a single role by its unique name.
     * @param {string} name - The role name (e.g. "user", "admin").
     * @returns {Promise<Object|null>} The matching role document, or null if not found.
     */
    async findOne(name) {
        return Role.findOne({ name }).lean().exec();
    }

    /**
     * Create a new role.
     * @param {Object} data - The role data to persist.
     * @returns {Promise<Object>} The created role document.
     */
    async create(data) {
        const role = new Role(data);
        return role.save();
    }

    /**
     * Insert or update a role keyed by its unique name.
     * @param {string} name - The role name (e.g. "user", "admin").
     * @param {Object} data - The role data to persist.
     * @returns {Promise<Object>} The upserted role document.
     */
    async upsert(name, data) {
        return Role.findOneAndUpdate({ name }, data, { upsert: true, returnDocument: "after" }).exec();
    }

    /**
     * Find all roles, optionally filtered by criteria.
     * @param {Object} [filter={}] - Mongoose query filter.
     * @returns {Promise<Object[]>} An array of role documents.
     */
    async findMany(filter = {}) {
        return Role.find(filter).lean().exec();
    }
}
