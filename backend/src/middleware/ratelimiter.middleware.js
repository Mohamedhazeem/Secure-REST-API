import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import RedisStore  from "rate-limit-redis";
import {redisClient} from "../configs/redis.js";
import { API_REQUEST_LIMIT } from "../configs/constants.js";

const store = process.env.NODE_ENV === "test"
    ? new MemoryStore()
    : new RedisStore ({
        sendCommand: (...args)=> redisClient.call(...args)
    });

export const apiLimiter = rateLimit({
    keyGenerator: (req)=> {
        if(req.user && req.user._id)
             return `user:${req.user._id.toString()}`
        else 
            return `ip:${ipKeyGenerator(req.ip)}`},
    handler: (_req,res, _next,options)=> res.status(options.statusCode).send(options.message),
    windowMs: API_REQUEST_LIMIT,
    limit: 5,
    standardHeaders: true,    
    store,
    message: "Too many requests. Please try again later."
})