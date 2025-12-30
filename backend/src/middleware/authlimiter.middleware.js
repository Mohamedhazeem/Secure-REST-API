import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { LOGIN_API_REQUEST_LIMIT } from "../configs/constants.js";

export const authLimiter = rateLimit({
  keyGenerator: (req)=> `ip:${ipKeyGenerator(req.ip)}`,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  standardHeaders: true,  
  windowMs: LOGIN_API_REQUEST_LIMIT,
  limit: 5,
  message: "Too many requests. Please try again later."
});
