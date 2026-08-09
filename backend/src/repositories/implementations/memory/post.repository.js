export default class PostRepository {
    /**
     * Find a post by its id.
     * @param {string} id - The post's unique identifier.
     * @returns {Promise<Object|null>} The post object, or null if not found.
     */
    async findById(id) {
        return this._posts.get(id) ? { ...this._posts.get(id) } : null;
    }

    /**
     * Find a single post matching the given filter criteria.
     * Supported filter keys: author, name.
     * @param {Object} filter - Filter criteria (e.g. { author: userId }).
     * @returns {Promise<Object|null>} The matching post object, or null if not found.
     */
    async findOne(filter) {
        for (const post of this._posts.values()) {
            const match = Object.entries(filter).every(([key, value]) => post[key] === value);
            if (match) return { ...post };
        }
        return null;
    }

    /**
     * Create a new post with auto-generated id and timestamps.
     * @param {Object} data - The post data to persist.
     * @returns {Promise<Object>} The created post object.
     */
    async create(data) {
        const now = new Date().toISOString();
        const post = { ...data, _id: this._generateId(), createdAt: now, updatedAt: now };
        this._posts.set(post._id, post);
        return { ...post };
    }

    /**
     * Update an existing post by id.
     * @param {string} id - The post's unique identifier.
     * @param {Object} data - Fields to update.
     * @returns {Promise<Object|null>} The updated post object, or null if not found.
     */
    async update(id, data) {
        const existing = this._posts.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data, _id: existing._id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        this._posts.set(id, updated);
        return { ...updated };
    }

    /**
     * Permanently delete a post by id.
     * @param {string} id - The post's unique identifier.
     * @returns {Promise<Object|null>} The deleted post object, or null if not found.
     */
    async deleteById(id) {
        const existing = this._posts.get(id);
        if (!existing) return null;
        this._posts.delete(id);
        return { ...existing };
    }

    /**
     * Find posts matching an optional filter with pagination.
     * @param {Object} [filter={}] - Filter criteria.
     * @param {Object} [pagination] - Pagination options.
     * @param {number} [pagination.page=1] - Page number (1-indexed).
     * @param {number} [pagination.limit=10] - Items per page.
     * @returns {Promise<Object>} An object with { data, page, limit, total }.
     */
    async findMany(filter = {}, pagination) {
        const { page = 1, limit = 10 } = pagination || {};
        let all = Array.from(this._posts.values());
        if (filter.author) all = all.filter((p) => p.author === filter.author);
        if (filter.name) all = all.filter((p) => p.name === filter.name);
        const total = all.length;
        const start = (page - 1) * limit;
        const data = all.slice(start, start + limit).map((p) => ({ ...p }));
        return { data, page, limit, total };
    }

    _generateId() {
        return `post_${crypto.randomUUID().replace(/-/g, "")}`;
    }

    constructor() {
        this._posts = new Map();
    }
}
