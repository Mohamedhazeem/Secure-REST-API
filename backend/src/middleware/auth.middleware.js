import { ACCESS_TOKEN } from "../configs/constants.js"
import User from "../models/user.model.js"
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../utils/generateToken.js";
import { redisClient } from "../configs/redis.js";
import { createError } from "../utils/errors.js";

/**
 * Authentication middleware.
 *
 * Complexity: O(1) per request - one Redis GET (blacklist check) + one Mongoose findById
 * with populate. The populate uses batched $in queries (Mongoose 6+), so there is no
 * N+1 issue when loading roles and permissions.
 */
export const authMiddleWare = async(req,res,next) =>{

    const token = req.cookies[ACCESS_TOKEN];
    if (!token)
        return next(createError("UNAUTHORIZED", "Authentication token is missing", 401));

    const blacklisted = await redisClient.get(`auth:blacklist:${token}`);
    if (blacklisted)
        return next(createError("UNAUTHORIZED", "Token has been revoked", 401));

    try {

        const decoded = verifyAccessToken(token);

        const user =  await User.findById(decoded.sub)
            .select("-password")
            .populate({ path: "roles", populate: { path: "permissions" } });
        if(!user){
            return next(createError("UNAUTHORIZED", "User not found", 401));
        }

        const permissions = (user.roles || []).flatMap((role) =>
            (role.permissions || []).map((p) => p.code)
        );
        req.user = user;
        req.user.permissions = permissions;
        next();
    } catch (error) {
        return next(createError("UNAUTHORIZED", "Invalid or expired token", 401));
    }

}