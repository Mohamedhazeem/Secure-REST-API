import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { LOGIN_API_REQUEST_LIMIT } from "../configs/constants.js";

const store = process.env.NODE_ENV === "test"
  ? new MemoryStore()
  : new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  });

export const authLimiter = rateLimit({
  keyGenerator: (req)=> `ip:${ipKeyGenerator(req.ip)}`,
  store,
  standardHeaders: true,  
  windowMs: LOGIN_API_REQUEST_LIMIT,
  limit: 5,
  message: "Too many requests. Please try again later."
});
