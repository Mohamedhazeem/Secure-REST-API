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
export default class PostRepositoryInterface {
    /**
     * Retrieve a post by its unique identifier.
     * @param {string} id - The post's MongoDB ObjectId.
     * @returns {Promise<Object|null>} The post document, or null if not found.
     */
    async findById(id) {}

    /**
     * Retrieve a single post matching the provided filter.
     * @param {PostFilter} filter - Filter criteria (e.g. { author }, { visibility }).
     * @returns {Promise<Object|null>} The matching post document, or null if not found.
     */
    async findOne(filter) {}

    /**
     * Persist a new post.
     * @param {Object} data - The post data to persist (content, author, visibility).
     * @returns {Promise<Object>} The created post document.
     */
    async create(data) {}

    /**
     * Atomically update a post only if its version still matches the
     * version the caller read (compare-and-set optimistic locking,
     * FR-029). On success the version counter is incremented by one.
     * @param {Object} criteria - { id, expectedVersion }.
     * @param {Object} data - Fields to update (content, visibility).
     * @returns {Promise<Object|null>} The updated post with the new version,
     * or null when the version no longer matches (conflict).
     */
    async updateIfCurrent({ id, expectedVersion }, data) {}

    /**
     * Permanently delete a post by id.
     * @param {string} id - The post's unique identifier.
     * @returns {Promise<Object|null>} The deleted post document, or null if not found.
     */
    async deleteById(id) {}

    /**
     * Retrieve posts matching an optional filter, with pagination.
     * @param {PostFilter} [filter={}] - Filter criteria.
     * @param {PaginationOptions} [pagination] - Pagination options.
     * @returns {Promise<PaginatedResult>} Paginated result set.
     */
    async findMany(filter = {}, pagination) {}

    /**
     * Reassign authorship of every post by one author to another user
     * (account deletion anonymization, FR-038).
     * @param {string} fromAuthorId - The deleted user's ObjectId.
     * @param {string} toAuthorId - The "[deleted]" placeholder's ObjectId.
     * @returns {Promise<number>} Number of posts updated.
     */
    async reassignAuthor(fromAuthorId, toAuthorId) {}

    /**
     * Retrieve posts matching a filter using deterministic cursor pagination
     * (feed, FR-026): ordered by createdAt descending with an _id tiebreaker,
     * resuming after `after` (the last seen { createdAt, id }). New inserts
     * during pagination never duplicate or skip already-visible posts.
     * @param {PostFilter} filter - Filter criteria.
     * @param {Object} [options] - { limit, after } where after = { createdAt, id }.
     * @returns {Promise<Object>} { data, nextCursor, hasNextPage }.
     */
    async findManyCursor(filter, options) {}
}
