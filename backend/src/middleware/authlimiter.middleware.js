import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { LOGIN_API_REQUEST_LIMIT, LOGIN_RATE_LIMIT } from "../configs/constants.js";
import { createError, toErrorResponse } from "../utils/errors.js";

const store = process.env.NODE_ENV === "test"
  ? new MemoryStore()
  : new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  });

/**
 * Authentication endpoint rate limiter (stricter than global).
 *
 * Complexity: O(1) per request - Redis INCR + EXPIRE is constant time.
 * Keyed by IP to prevent brute-force login attempts.
 */
export const authLimiter = rateLimit({
  keyGenerator: (req)=> `ip:${ipKeyGenerator(req.ip)}`,
  store,
  standardHeaders: true,  
  windowMs: LOGIN_API_REQUEST_LIMIT,
  limit: LOGIN_RATE_LIMIT,
  handler: (_req, res, _next, options) => {
    const err = createError("RATE_LIMITED", options.message, options.statusCode);
    const response = toErrorResponse(err);
    res.status(err.statusCode).json(response);
  },
  message: "Rate limit exceeded for this client"
});
