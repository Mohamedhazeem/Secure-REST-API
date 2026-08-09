export default class UserRepository {
    /**
     * Find a user by their id.
     * @param {string} id - The user's unique identifier.
     * @returns {Promise<Object|null>} The user object, or null if not found.
     */
    async findById(id) {
        for (const user of this._users.values()) {
            if (user._id === id) return { ...user };
        }
        return null;
    }

    /**
     * Find a single user matching the given filter criteria.
     * Supported filter keys: username, email.
     * @param {Object} filter - Filter criteria (e.g. { username: "alice" }).
     * @returns {Promise<Object|null>} The matching user object, or null if not found.
     */
    async findOne(filter) {
        for (const user of this._users.values()) {
            const match = Object.entries(filter).every(([key, value]) => user[key] === value);
            if (match) return { ...user };
        }
        return null;
    }

    /**
     * Create a new user with auto-generated id and timestamps.
     * @param {Object} data - The user data to persist.
     * @returns {Promise<Object>} The created user object.
     */
    async create(data) {
        const now = new Date().toISOString();
        const user = { ...data, _id: this._generateId(), createdAt: now, updatedAt: now };
        this._users.set(user._id, user);
        return { ...user };
    }

    /**
     * Update an existing user by id.
     * @param {string} id - The user's unique identifier.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated user object, or null if not found.
     */
    async update(id, data) {
        const existing = this._users.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data, _id: existing._id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        this._users.set(id, updated);
        return { ...updated };
    }

    /**
     * Soft-delete a user by setting deletedAt.
     * @param {string} id - The user's unique identifier.
     * @returns {Promise<Object|null>} The updated user object, or null if not found.
     */
    async delete(id) {
        const existing = this._users.get(id);
        if (!existing) return null;
        const updated = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        this._users.set(id, updated);
        return { ...updated };
    }

    /**
     * Find users matching an optional filter with pagination.
     * Skips soft-deleted users unless explicitly filtered.
     * @param {Object} [filter={}] - Filter criteria.
     * @param {Object} [pagination] - Pagination options.
     * @param {number} [pagination.page=1] - Page number (1-indexed).
     * @param {number} [pagination.limit=10] - Items per page.
     * @returns {Promise<Object>} An object with { data, page, limit, total }.
     */
    async findMany(filter = {}, pagination) {
        const { page = 1, limit = 10 } = pagination || {};
        let all = Array.from(this._users.values());
        if (filter._id) all = all.filter((u) => u._id === filter._id);
        if (filter.username) all = all.filter((u) => u.username === filter.username);
        if (filter.email) all = all.filter((u) => u.email === filter.email);
        if (filter.deletedAt) all = all.filter((u) => u.deletedAt !== undefined);
        const total = all.length;
        const start = (page - 1) * limit;
        const data = all.slice(start, start + limit).map((u) => ({ ...u }));
        return { data, page, limit, total };
    }

    /**
     * Find a user by email address.
     * @param {string} email - The user's email address.
     * @returns {Promise<Object|null>} The matching user object, or null if not found.
     */
    async findByEmail(email) {
        for (const user of this._users.values()) {
            if (user.email === email && !user.deletedAt) return { ...user };
        }
        return null;
    }

    _generateId() {
        return `user_${crypto.randomUUID().replace(/-/g, "")}`;
    }

    constructor() {
        this._users = new Map();
    }
}
