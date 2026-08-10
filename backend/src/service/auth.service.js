import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/generateToken.js";
import { redisClient } from "../configs/redis.js";
import { REFRESH_TOKEN_MAX_AGE } from "../configs/constants.js";
import { createError } from "../utils/errors.js";
import { auditService } from "./audit.service.js";
import UserRepository from "../repositories/implementations/mongoose/user.repository.js";
import {
    hashToken,
    issueSession,
    findSessionByTokenId,
    rotateSession,
    revokeAllSessions,
    revokeSession,
} from "./session.service.js";

const userRepository = new UserRepository();

const legacyRefreshKey = (userId) => `auth:refresh:${userId}`;

/**
 * Issue a fresh access + refresh token pair for a new session (US2, FR-020).
 *
 * Every session gets its own id; the access token carries it in the `sid`
 * claim and the refresh token in the `jti` claim, binding both tokens to a
 * single, independently revocable session.
 */
export const issueAuthSession = async ({ userId, ipAddress, userAgent, acceptLanguage }) => {
    const sessionId = new mongoose.Types.ObjectId();
    const accessToken = generateAccessToken({ sub: userId, sid: sessionId.toString() });
    const refreshToken = generateRefreshToken({
        sub: userId,
        jti: sessionId.toString(),
        nonce: crypto.randomUUID(),
    });

    await issueSession({ sessionId, userId, refreshToken, ipAddress, userAgent, acceptLanguage });

    return { accessToken, refreshToken };
};

const revokeAllForReuse = async (userId, sessionId) => {
    await revokeAllSessions({ userId });
    try {
        await auditService.record({
            action: "token.reuse_detected",
            actorId: userId?.toString() ?? null,
            resourceType: "Session",
            resourceId: sessionId?.toString() ?? null,
            severity: "critical",
        });
    } catch {
        // The audit write must never mask the AUTH_REUSE_DETECTED response.
    }
};

/**
 * Migrate a refresh token issued by the pre-session store (US1: plaintext
 * in Redis under `auth:refresh:<userId>`) into a first-class Session
 * document. One-shot: the Redis entry is deleted after migration so the
 * old token can no longer be presented.
 */
const migrateLegacyRefreshToken = async (refreshToken, payload) => {
    const stored = await redisClient.get(legacyRefreshKey(payload.sub));
    if (stored == null) return null;

    if (stored !== refreshToken) {
        await redisClient.del(legacyRefreshKey(payload.sub));
        throw createError("FORBIDDEN", "Refresh token has been revoked", 403);
    }

    await redisClient.del(legacyRefreshKey(payload.sub));
    const sessionId = new mongoose.Types.ObjectId();
    const accessToken = generateAccessToken({ sub: payload.sub, sid: sessionId.toString() });
    const nextRefreshToken = generateRefreshToken({
        sub: payload.sub,
        jti: sessionId.toString(),
        nonce: crypto.randomUUID(),
    });
    await issueSession({
        sessionId,
        userId: payload.sub,
        refreshToken: nextRefreshToken,
        ipAddress: null,
        userAgent: null,
        acceptLanguage: null,
    });
    return { accessToken, refreshToken: nextRefreshToken };
};

/**
 * Rotate a refresh token (FR-008) and detect reuse (FR-021, T028).
 *
 * Reuse detection: a session stores only the hash of its current refresh
 * token. Presenting a token whose hash no longer matches means the token
 * was used after rotation — stolen or raced. Either way every session for
 * the user is revoked and an audit entry is emitted, then an explicit
 * AUTH_REUSE_DETECTED error is returned.
 *
 * A failed compare-and-set is NOT reuse: the presented token matched the
 * session state this request read, so a concurrent legitimate refresh
 * rotated it first. That request is rejected without revoking anything,
 * which keeps two parallel refreshes from nuking every session.
 */
export const refreshSession = async ({ refreshToken }) => {
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw createError("UNAUTHORIZED", "Refresh token is invalid", 401);
    }
    if (!payload?.jti) {
        throw createError("UNAUTHORIZED", "Refresh token is invalid", 401);
    }

    const session = await findSessionByTokenId(payload.jti);
    if (!session) {
        const migrated = await migrateLegacyRefreshToken(refreshToken, payload);
        if (migrated) return migrated;
        throw createError("UNAUTHORIZED", "Refresh token is invalid", 401);
    }
    if (session.revokedAt) {
        throw createError("FORBIDDEN", "Refresh token has been revoked", 403);
    }

    const sessionId = session._id.toString();

    const user = await userRepository.findById(session.userId);
    if (!user) {
        await revokeSession({ sessionId, userId: session.userId });
        throw createError("UNAUTHORIZED", "User no longer exists", 401);
    }

    const presentedHash = hashToken(refreshToken);

    if (session.refreshTokenHash !== presentedHash) {
        await revokeAllForReuse(session.userId, sessionId);
        throw createError(
            "AUTH_REUSE_DETECTED",
            "Refresh token reuse detected; all sessions have been revoked",
            401
        );
    }

    const accessToken = generateAccessToken({ sub: session.userId, sid: sessionId });
    const nextRefreshToken = generateRefreshToken({
        sub: session.userId,
        jti: sessionId,
        nonce: crypto.randomUUID(),
    });

    const rotated = await rotateSession({
        sessionId,
        previousTokenHash: presentedHash,
        nextRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
    });

    if (!rotated) {
        throw createError("UNAUTHORIZED", "Refresh token was already rotated", 401);
    }

    return { accessToken, refreshToken: nextRefreshToken };
};

/**
 * Blacklist an access token until its natural expiry (logout).
 */
export const blacklistAccessToken = async (token) => {
    if (!token) return;
    try {
        const decoded = jwt.decode(token);
        const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
        if (ttl > 0) {
            await redisClient.set(`auth:blacklist:${token}`, "true", "EX", ttl);
        }
    } catch {
        // Ignore undecodable tokens.
    }
};
