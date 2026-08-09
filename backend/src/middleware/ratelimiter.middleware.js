import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import RedisStore  from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { API_REQUEST_LIMIT, API_RATE_LIMIT } from "../configs/constants.js";
import { createError, toErrorResponse } from "../utils/errors.js";

const store = process.env.NODE_ENV === "test"
    ? new MemoryStore()
    : new RedisStore ({
        sendCommand: (...args)=> redisClient.call(...args)
    });

/**
 * Global API rate limiter.
 *
 * Complexity: O(1) per request - Redis INCR + EXPIRE is constant time.
 * Keyed by authenticated user ID (per-consumer fairness) or IP (public endpoints).
 * No single source can monopolize capacity because limits are per-key.
 */
export const apiLimiter = rateLimit({
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
    windowMs: API_REQUEST_LIMIT,
    limit: API_RATE_LIMIT,
    standardHeaders: true,
    store,
    message: "Rate limit exceeded for this client"
})