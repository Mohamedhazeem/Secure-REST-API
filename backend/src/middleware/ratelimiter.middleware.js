import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import RedisStore  from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { API_REQUEST_LIMIT, API_RATE_LIMIT, SOCIAL_API_REQUEST_LIMIT, SOCIAL_RATE_LIMIT } from "../configs/constants.js";
import { createError, toErrorResponse } from "../utils/errors.js";

/**
 * Build a fresh store per limiter. express-rate-limit forbids sharing one
 * store across multiple limiters (ERR_ERL_STORE_REUSE): a shared store merges
 * hit counters under the same key namespace, so two limiters' quotas would
 * interfere. Each limiter gets its own isolated store instance.
 */
const createStore = () =>
    process.env.NODE_ENV === "test"
        ? new MemoryStore()
        : new RedisStore ({
            sendCommand: (...args)=> redisClient.call(...args)
        });

/**
 * Build an express-rate-limit limiter with the project's standard keying,
 * envelope-shaped 429 handler, and its own isolated store.
 *
 * Complexity: O(1) per request - Redis INCR + EXPIRE is constant time.
 * Keyed by authenticated user ID (per-consumer fairness) or IP (public
 * endpoints). No single source can monopolize capacity because limits are
 * per-key.
 */
const createRateLimiter = ({ windowMs, limit }) =>
    rateLimit({
        keyGenerator: (req)=> {
            if(req.user && req.user._id)
                 return `user:${req.user._id.toString()}`
            else 
                return `ip:${ipKeyGenerator(req.ip)}`},
        handler: (_req, res, _next, options) => {
            const err = createError("RATE_LIMITED", options.message, options.statusCode);
            const response = toErrorResponse(err);
            res.status(err.statusCode).json(response);
        },
        windowMs,
        limit,
        standardHeaders: true,
        store: createStore(),
        message: "Rate limit exceeded for this client"
    });

/**
 * Global API rate limiter.
 */
export const apiLimiter = createRateLimiter({
    windowMs: API_REQUEST_LIMIT,
    limit: API_RATE_LIMIT,
});

/**
 * Social mutation rate limiter (US6, T064).
 *
 * Stricter than the global limiter and applied to follow/like write
 * endpoints, which are the primary social-spam vectors.
 */
export const socialMutationLimiter = createRateLimiter({
    windowMs: SOCIAL_API_REQUEST_LIMIT,
    limit: SOCIAL_RATE_LIMIT,
});
