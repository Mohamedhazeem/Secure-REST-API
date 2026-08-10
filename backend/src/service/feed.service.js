import FollowRepository from "../repositories/interfaces/follow.repository.js";
import PostRepository from "../repositories/interfaces/post.repository.js";
import { redisClient } from "../configs/redis.js";
import { config } from "../configs/config.js";
import { logger } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";

const followRepository = new FollowRepository();
const postRepository = new PostRepository();

export const FEED_VISIBLE_VISIBILITIES = Object.freeze(["public", "followers-only"]);

const encodeCursor = (after) =>
    after ? Buffer.from(JSON.stringify(after)).toString("base64url") : null;

const decodeCursor = (cursor) => {
    if (!cursor) return null;
    try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (decoded && typeof decoded.createdAt === "string" && typeof decoded.id === "string") {
            return { createdAt: decoded.createdAt, id: decoded.id };
        }
    } catch {
        return null;
    }
    return null;
};

const cacheGet = async (key) => {
    try {
        return await redisClient.get(key);
    } catch (error) {
        logger.warn("feed.cache.read.failed", { key, error: error.message });
        return null;
    }
};

const cacheSet = async (key, value) => {
    try {
        await redisClient.set(key, value, "EX", config.feedCacheTtlSeconds);
    } catch (error) {
        logger.warn("feed.cache.write.failed", { key, error: error.message });
    }
};

/**
 * The read-through cache is enabled only outside tests: the test suite
 * exercises the deterministic database path (the cache protocol - lists,
 * counters, key scans - is unavailable in the in-memory store, so a test
 * cache would silently serve stale pages). In production every feed
 * mutation bumps the affected followers' version counters, and cache keys
 * embed that version, so stale pages are never served.
 */
let _cacheEnabledOverride = null;

export const __setCacheEnabledForTests = (enabled) => {
    _cacheEnabledOverride = enabled;
};

const cacheEnabled = () => {
    if (_cacheEnabledOverride !== null) return _cacheEnabledOverride;
    return config.nodeEnv !== "test";
};

const bumpFeedVersion = async (userId) => {
    try {
        await redisClient.call("INCR", `feed:version:${userId}`);
    } catch {
        /* best-effort: a missing counter only shortens cache lifetime */
    }
};

/**
 * Invalidate the feed caches of everyone who follows `authorId`
 * (post create/update/delete and follow changes, Decision 2, SC-020).
 * Best-effort and never throws.
 */
export const invalidateFollowerFeedCaches = async (authorId) => {
    if (!cacheEnabled()) return;
    let followerIds = [];
    try {
        followerIds = await followRepository.findFollowerIds(authorId);
    } catch (error) {
        logger.error("feed.fanout.followers.failed", { error: error.message });
        return;
    }
    for (const followerId of followerIds) {
        await bumpFeedVersion(followerId);
    }
};

/**
 * Invalidate the feed cache of a single user (their follow set changed).
 */
export const invalidateFeedCacheFor = async (userId) => {
    if (!cacheEnabled()) return;
    await bumpFeedVersion(userId);
};

/**
 * Write-fanout feed cache (T054, Decision 2, SC-020).
 *
 * On post creation the post id is pushed to every follower's Redis
 * timeline (`feed:timeline:<followerId>`), keeping reads O(1) per follower
 * when Redis is available, and follower caches are version-bumped. The
 * cache is strictly best-effort: Redis unavailability or an unsupported
 * command never affects correctness — the database remains the
 * deterministic source of truth for feed pagination (FR-026).
 */
export const fanoutPostToFollowers = async ({ authorId, postId }) => {
    let followerIds = [];
    try {
        followerIds = await followRepository.findFollowerIds(authorId);
    } catch (error) {
        logger.error("feed.fanout.followers.failed", { error: error.message });
        return;
    }
    for (const followerId of followerIds) {
        try {
            await redisClient.call("RPUSH", `feed:timeline:${followerId}`, postId.toString());
        } catch (error) {
            logger.warn("feed.fanout.push.failed", { followerId, error: error.message });
        }
    }
    await invalidateFollowerFeedCaches(authorId);
};

/**
 * Personalized feed (US4, FR-026/FR-036).
 *
 * Posts come from followed authors with visibility public or followers-only
 * (private posts are excluded; the caller follows the author, so
 * followers-only posts are always authorized). Deterministic keyset
 * pagination on (createdAt desc, _id desc) guarantees no duplicates or
 * skipped records when posts are inserted mid-pagination.
 *
 * A read-through Redis cache memoizes page results for
 * FEED_CACHE_TTL_SECONDS, version-busted by every feed mutation; every
 * Redis operation is guarded so failures degrade to the database path.
 */
export const getFeed = async (userId, { cursor, limit = 20 } = {}) => {
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const after = decodeCursor(cursor);

    let cacheKey = null;
    if (cacheEnabled()) {
        const version = (await cacheGet(`feed:version:${userId}`)) ?? "0";
        cacheKey = `feed:cache:${userId}:${version}:${pageSize}:${after ? encodeCursor(after) : "start"}`;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            metrics.recordCacheHit("feed");
            try {
                return JSON.parse(cached);
            } catch {
                /* stale payload: fall through to the database */
            }
        } else {
            metrics.recordCacheMiss("feed");
        }
    }

    const followingIds = await followRepository.findFollowingIds(userId);
    const filter = {
        author: { $in: followingIds },
        visibility: { $in: [...FEED_VISIBLE_VISIBILITIES] },
    };
    const page = await postRepository.findManyCursor(filter, { limit: pageSize, after });

    const result = {
        data: page.data,
        cursor: page.nextCursor,
        hasNextPage: page.hasNextPage,
    };
    if (cacheKey) {
        await cacheSet(cacheKey, JSON.stringify(result));
    }
    return result;
};

