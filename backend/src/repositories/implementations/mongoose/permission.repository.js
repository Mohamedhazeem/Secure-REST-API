import Permission from "../../../models/permission.model.js";

export default class PermissionRepository {
    /**
     * Find a permission by its ObjectId.
     * @param {string} id - The permission's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The permission document, or null if not found.
     */
    async findById(id) {
        return Permission.findById(id).lean().exec();
    }

    /**
     * Find a single permission by its unique code.
     * @param {string} code - The permission code (e.g. "posts:create").
     * @returns {Promise<Object|null>} The matching permission document, or null if not found.
     */
    async findOne(code) {
        return Permission.findOne({ code }).lean().exec();
    }

    /**
     * Create a new permission.
     * @param {Object} data - The permission data to persist.
     * @returns {Promise<Object>} The created permission document.
     */
    async create(data) {
        const permission = new Permission(data);
        return permission.save();
    }

    /**
     * Insert or update a permission keyed by its unique code.
     * @param {string} code - The permission code (e.g. "posts:create").
     * @param {Object} data - The permission data to persist.
     * @returns {Promise<Object>} The upserted permission document.
     */
    async upsert(code, data) {
        return Permission.findOneAndUpdate({ code }, data, { upsert: true, returnDocument: "after" }).exec();
    }

    /**
     * Find all permissions, optionally filtered by criteria.
     * @param {Object} [filter={}] - Mongoose query filter.
     * @returns {Promise<Object[]>} An array of permission documents.
     */
    async findMany(filter = {}) {
        return Permission.find(filter).lean().exec();
    }
}
