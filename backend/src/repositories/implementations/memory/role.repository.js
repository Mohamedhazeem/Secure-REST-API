export default class RoleRepository {
    /**
     * Find a role by its id.
     * @param {string} id - The role's unique identifier.
     * @returns {Promise<Object|null>} The role object, or null if not found.
     */
    async findById(id) {
        return this._roles.get(id) ? { ...this._roles.get(id) } : null;
    }

    /**
     * Find a single role by its unique name.
     * @param {string} name - The role name (e.g. "user", "admin").
     * @returns {Promise<Object|null>} The matching role object, or null if not found.
     */
    async findOne(name) {
        for (const role of this._roles.values()) {
            if (role.name === name) return { ...role };
        }
        return null;
    }

    /**
     * Create a new role with auto-generated id and timestamps.
     * @param {Object} data - The role data to persist.
     * @returns {Promise<Object>} The created role object.
     */
    async create(data) {
        const now = new Date().toISOString();
        const role = { ...data, _id: this._generateId(), createdAt: now, updatedAt: now };
        this._roles.set(role._id, role);
        return { ...role };
    }

    /**
     * Find all roles matching an optional filter.
     * @param {Object} [filter={}] - Filter criteria.
     * @returns {Promise<Object[]>} An array of role objects.
     */
    async findMany(filter = {}) {
        let all = Array.from(this._roles.values());
        if (filter.name) all = all.filter((r) => r.name === filter.name);
        return all.map((r) => ({ ...r }));
    }

    _generateId() {
        return `role_${crypto.randomUUID().replace(/-/g, "")}`;
    }

    constructor() {
        this._roles = new Map();
    }
}
