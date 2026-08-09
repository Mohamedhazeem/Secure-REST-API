import { redisClient } from "../configs/redis.js";
import { verifyRefreshToken } from "../utils/generateToken.js";
import { isRefreshTokenBlacklisted, blacklistRefreshToken, createAuthSession } from "../controller/auth.controller.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

export const refreshTokenController = async (req, res, next) => {
    const token = req.cookies.refresh_token;
    if (!token) return next(createError("UNAUTHORIZED", "Refresh token is missing", 401));

    try {
        const payload = verifyRefreshToken(token);

        if (await isRefreshTokenBlacklisted(payload.jti)) {
            return next(createError("FORBIDDEN", "Refresh token has been revoked", 403));
        }

        const stored = await redisClient.get(`auth:refresh:${payload.sub}`);
        if (stored == null) return next(createError("UNAUTHORIZED", "Refresh token is invalid", 401));
        if (stored !== token) {
            await redisClient.del(`auth:refresh:${payload.sub}`);
            return next(createError("FORBIDDEN", "Refresh token has been revoked", 403));
        }

        const ttl = Math.max(1, Math.floor((payload.exp || Date.now() / 1000 + 900) - Date.now() / 1000));
        await blacklistRefreshToken(payload.jti, ttl);

        await createAuthSession(res, { _id: payload.sub });

        return sendSuccess(res, 200, { message: "Token refreshed" });
    } catch {
        return next(createError("FORBIDDEN", "Refresh token is invalid", 403));
    }
};
