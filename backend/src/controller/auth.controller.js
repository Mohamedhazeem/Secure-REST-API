import jwt from "jsonwebtoken";
import { ACCESS_TOKEN, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN, REFRESH_TOKEN_MAX_AGE } from "../configs/constants.js";
import { redisClient } from "../configs/redis.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/generateToken.js";
import { config } from "../configs/config.js";

import { createError } from "../utils/errors.js";

export const createAuthSession = async (res, user) => {
    if (!user || !user._id) throw createError("UNAUTHORIZED", "User not found", 401);

    const access_token = generateAccessToken({ sub: user._id });
    const refresh_token = generateRefreshToken({ sub: user._id, jti: crypto.randomUUID() });

    await redisClient.set(`auth:refresh:${user._id}`, refresh_token, "EX", REFRESH_TOKEN_MAX_AGE);

    res.cookie(ACCESS_TOKEN, access_token, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.nodeEnv === "production",
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie(REFRESH_TOKEN, refresh_token, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.nodeEnv === "production",
        maxAge: REFRESH_TOKEN_MAX_AGE,
    });
};

export const blacklistRefreshToken = async (jti, ttlSeconds) => {
    if (!jti) return;
    await redisClient.set(`auth:refresh:blacklist:${jti}`, "true", "EX", ttlSeconds);
};

export const isRefreshTokenBlacklisted = async (jti) => {
    if (!jti) return false;
    const val = await redisClient.get(`auth:refresh:blacklist:${jti}`);
    return val !== null;
};

export const blacklistAccessToken = async (token) => {
    if (!token) return;
    try {
        const decoded = jwt.decode(token);
        const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
        if (ttl > 0) {
            await redisClient.set(`auth:blacklist:${token}`, "true", "EX", ttl);
        }
    } catch {
        // ignore undecodable tokens
    }
};

export const blacklistRefreshTokenOnLogout = async (refreshToken) => {
    if (!refreshToken) return;
    try {
        const decoded = verifyRefreshToken(refreshToken);
        const ttl = Math.max(1, Math.floor((decoded.exp || Date.now() / 1000 + 900) - Date.now() / 1000));
        await redisClient.set(`auth:refresh:blacklist:${decoded.jti}`, "true", "EX", ttl);
    } catch {
        // ignore invalid refresh tokens on logout
    }
};
