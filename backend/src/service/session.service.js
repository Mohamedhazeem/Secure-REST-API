import SessionRepository from "../repositories/implementations/mongoose/session.repository.js";
import { redisClient } from "../configs/redis.js";
import { config } from "../configs/config.js";
import { ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from "../configs/constants.js";
import { verifyRefreshToken } from "../utils/generateToken.js";
import { createError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";
import crypto from "crypto";

const sessionRepository = new SessionRepository();

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const REVOCATION_TTL_SECONDS = Math.max(
    1,
    Math.ceil((Number.isFinite(ACCESS_TOKEN_MAX_AGE) ? ACCESS_TOKEN_MAX_AGE : 0) / 1000)
);

const markSessionRevoked = (sessionId) =>
    redisClient.set(`session:revoked:${sessionId}`, "true", "EX", REVOCATION_TTL_SECONDS);

const markSessionsRevoked = async (sessionIds) => {
    await Promise.all(
        sessionIds.map((id) =>
            markSessionRevoked(id).catch((error) => {
                logger.warn("session.revoke.marker.failed", { sessionId: id, error: error.message });
            })
        )
    );
};

const toSessionView = (session) => ({
    id: session._id.toString(),
    userId: session.userId.toString(),
    deviceFingerprint: session.deviceFingerprint,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
});

/**
 * Persist a new session bound to a refresh token (FR-022).
 * The refresh token is stored only as a SHA-256 hash; the device
 * fingerprint is a hash of client attributes (user agent, language).
 */
export const issueSession = async ({ sessionId, userId, refreshToken, ipAddress, userAgent, acceptLanguage }) => {
    return sessionRepository.create({
        _id: sessionId,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        deviceFingerprint: hashToken(`${userAgent ?? ""}|${acceptLanguage ?? ""}`),
        ipAddress,
        userAgent,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
    });
};

export const findSessionByTokenId = async (tokenId) => {
    if (!tokenId || !mongoose.isValidObjectId(tokenId)) return null;
    return sessionRepository.findById(tokenId);
};

/**
 * Atomically rotate the refresh token bound to a session. Returns null
 * when the presented hash no longer matches (concurrent rotation or
 * reuse); the caller decides the consequence.
 */
export const rotateSession = async ({ sessionId, previousTokenHash, nextRefreshToken, expiresAt }) => {
    return sessionRepository.rotateIfCurrent(
        { id: sessionId, currentHash: previousTokenHash },
        {
            refreshTokenHash: hashToken(nextRefreshToken),
            expiresAt,
            lastActiveAt: new Date(),
        }
    );
};

/**
 * List the caller's active (non-revoked, non-expired) sessions.
 * Expired sessions are hidden; they can no longer refresh because the
 * JWT itself has lapsed, and the idle sweep retires them from storage.
 */
export const listSessions = async (userId) => {
    const sessions = await sessionRepository.findActiveByUserId(userId);
    const now = Date.now();
    return sessions
        .filter((session) => new Date(session.expiresAt).getTime() > now)
        .map(toSessionView);
};

/**
 * Revoke a single session. Unknown or foreign sessions surface as 404;
 * already-revoked sessions are idempotent successes.
 */
export const revokeSession = async ({ sessionId, userId }) => {
    const session = await sessionRepository.findById(sessionId);
    if (!session || session.userId.toString() !== userId.toString()) {
        throw createError("NOT_FOUND", "Session not found", 404);
    }
    if (session.revokedAt) return session;

    await sessionRepository.revoke(sessionId);
    await markSessionRevoked(sessionId);
    return session;
};

/**
 * Revoke every active session for a user (global revocation on reuse,
 * account deletion). Each revoked session gets a Redis marker so the
 * auth middleware rejects its access tokens immediately (FR-021).
 */
export const revokeAllSessions = async ({ userId }) => {
    const { matchedIds } = await sessionRepository.revokeAllByUser(userId);
    await markSessionsRevoked(matchedIds);
    return matchedIds.length;
};

/**
 * Revoke the session identified by a refresh token (logout). Invalid or
 * already-revoked tokens are ignored — nothing to revoke.
 */
export const revokeSessionByRefreshToken = async (refreshToken) => {
    if (!refreshToken) return;
    try {
        const payload = verifyRefreshToken(refreshToken);
        if (!payload?.jti) return;
        const session = await sessionRepository.findById(payload.jti);
        if (!session || session.revokedAt) return;
        await sessionRepository.revoke(session._id);
        await markSessionRevoked(session._id);
    } catch {
        // Invalid refresh token on logout: nothing to revoke.
    }
};

/**
 * Inactive-session expiry/cleanup sweep (FR-013, T032).
 *
 * Revokes sessions that have been idle longer than SESSION_IDLE_TTL_SECONDS
 * and permanently removes revoked sessions whose expiration has passed the
 * same horizon. Callers schedule this periodically (see index.js).
 */
export const sweepInactiveSessions = async () => {
    const horizonMs = config.sessionIdleTtlSeconds * 1000;
    const idleBefore = new Date(Date.now() - horizonMs);
    const { matchedIds } = await sessionRepository.sweepInactive({ idleBefore });
    await markSessionsRevoked(matchedIds);
    const deleted = await sessionRepository.deleteExpired({ cutoff: idleBefore });
    return { revoked: matchedIds.length, deleted };
};
