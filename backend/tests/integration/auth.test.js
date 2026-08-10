import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import { app } from "../../src/app.js";
import Session from "../../src/models/session.model.js";
import SessionRepository from "../../src/repositories/implementations/mongoose/session.repository.js";
import { redisClient } from "../../src/configs/redis.js";
import { refreshSession } from "../../src/service/auth.service.js";
import { hashToken } from "../../src/service/session.service.js";
import { generateRefreshToken } from "../../src/utils/generateToken.js";
import { unique, cookieString, cookieValue, sessionIdOf } from "../helpers/index.js";

afterEach(() => {
    vi.restoreAllMocks();
});

const registerUser = (username, email, password = "password123") =>
    request(app).post("/api/v1/auth").send({ username, email, password });

const loginUser = (email, password = "password123") =>
    request(app).post("/api/v1/auth/login").send({ email, password });

describe("auth lifecycle (US2, T020)", () => {
    it("completes register → login → list sessions → refresh → logout", async () => {
        const username = unique("life");
        const email = `${username}@example.com`;

        const register = await registerUser(username, email);
        expect(register.status).toBe(201);
        expect(register.headers["set-cookie"]).toBeDefined();

        const login = await loginUser(email);
        expect(login.status).toBe(200);
        const loginCookies = login.headers["set-cookie"];
        expect(cookieValue(loginCookies, "access_token")).toBeTruthy();
        expect(cookieValue(loginCookies, "refresh_token")).toBeTruthy();

        const sessions = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Cookie", cookieString(loginCookies));
        expect(sessions.status).toBe(200);
        expect(Array.isArray(sessions.body.data)).toBe(true);
        expect(sessions.body.total).toBe(sessions.body.data.length);
        expect(sessions.body.data.length).toBeGreaterThanOrEqual(1);
        for (const session of sessions.body.data) {
            expect(session.id).toBeTruthy();
            expect(session.userId).toBeTruthy();
            expect(session.ipAddress).toBeDefined();
            expect(session.userAgent).toBeDefined();
            expect(session.deviceFingerprint).toBeTruthy();
            expect(session.createdAt).toBeTruthy();
            expect(session.expiresAt).toBeTruthy();
        }

        const refresh = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", cookieString(loginCookies));
        expect(refresh.status).toBe(200);
        const refreshedCookies = refresh.headers["set-cookie"];
        expect(cookieValue(refreshedCookies, "access_token")).toBeTruthy();
        expect(cookieValue(refreshedCookies, "refresh_token")).toBeTruthy();

        const logout = await request(app)
            .post("/api/v1/auth/logout")
            .set("Cookie", cookieString(refreshedCookies));
        expect(logout.status).toBe(200);
        expect(logout.body.message).toBeTruthy();

        const afterLogout = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Cookie", cookieString(refreshedCookies));
        expect(afterLogout.status).toBe(401);
    });
});

describe("refresh token reuse (US2, T021)", () => {
    it("detects reuse of a rotated refresh token and revokes all sessions", async () => {
        const username = unique("reuse");
        const email = `${username}@example.com`;
        await registerUser(username, email);

        const login = await loginUser(email);
        const firstCookies = login.headers["set-cookie"];
        const firstRefresh = cookieValue(firstCookies, "refresh_token");
        const sessionId = sessionIdOf(firstRefresh);

        const refresh = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", cookieString(firstCookies));
        expect(refresh.status).toBe(200);
        const secondCookies = refresh.headers["set-cookie"];
        expect(sessionIdOf(cookieValue(secondCookies, "refresh_token"))).toBe(sessionId);

        const reuse = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${firstRefresh}`);
        expect(reuse.status).toBe(401);
        expect(reuse.body.code).toBe("AUTH_REUSE_DETECTED");

        const afterReuse = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", cookieString(secondCookies));
        expect(afterReuse.status).toBe(403);

        const sessionsAfter = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Cookie", cookieString(secondCookies));
        expect(sessionsAfter.status).toBe(401);
    });
});

describe("concurrent refresh race (review fix)", () => {
    it("rejects the losing refresh without revoking every session", async () => {
        const username = unique("race");
        const email = `${username}@example.com`;
        await registerUser(username, email);
        const loginA = await loginUser(email);
        const refreshA = cookieValue(loginA.headers["set-cookie"], "refresh_token");
        const sessionA = sessionIdOf(refreshA);
        const loginB = await loginUser(email);
        const refreshB = cookieValue(loginB.headers["set-cookie"], "refresh_token");

        const spy = vi.spyOn(SessionRepository.prototype, "rotateIfCurrent").mockResolvedValueOnce(null);

        await expect(refreshSession({ refreshToken: refreshA })).rejects.toMatchObject({
            code: "UNAUTHORIZED",
        });

        spy.mockRestore();

        const session = await Session.findById(sessionA);
        expect(session).not.toBeNull();
        expect(session.revokedAt).toBeNull();

        const other = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshB}`);
        expect(other.status).toBe(200);
    });
});

describe("legacy refresh token migration (review fix)", () => {
    it("migrates a pre-session Redis-stored refresh token into a Session, one-shot", async () => {
        const username = unique("migr");
        const email = `${username}@example.com`;
        await registerUser(username, email);
        const login = await loginUser(email);
        const userId = jwt.decode(cookieValue(login.headers["set-cookie"], "access_token")).sub;

        const legacyToken = generateRefreshToken({ sub: userId, jti: crypto.randomUUID() });
        await redisClient.set(`auth:refresh:${userId}`, legacyToken, "EX", 900);

        const migrated = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${legacyToken}`);
        expect(migrated.status).toBe(200);
        expect(migrated.body.message).toBe("Token refreshed");

        expect(await redisClient.get(`auth:refresh:${userId}`)).toBeNull();

        const newRefresh = cookieValue(migrated.headers["set-cookie"], "refresh_token");
        const session = await Session.findOne({ refreshTokenHash: hashToken(newRefresh) });
        expect(session).not.toBeNull();
        expect(session.userId.toString()).toBe(userId);

        const replay = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${legacyToken}`);
        expect(replay.status).toBe(401);
    });

    it("revokes a mismatching legacy token (pre-session reuse semantics)", async () => {
        const username = unique("migr2");
        const email = `${username}@example.com`;
        await registerUser(username, email);
        const login = await loginUser(email);
        const userId = jwt.decode(cookieValue(login.headers["set-cookie"], "access_token")).sub;

        await redisClient.set(
            `auth:refresh:${userId}`,
            generateRefreshToken({ sub: userId, jti: crypto.randomUUID() }),
            "EX",
            900
        );
        const stale = generateRefreshToken({ sub: userId, jti: crypto.randomUUID() });

        const attempt = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${stale}`);
        expect(attempt.status).toBe(403);
        expect(await redisClient.get(`auth:refresh:${userId}`)).toBeNull();
    });
});

describe("refresh after account deletion (review fix)", () => {
    it("rejects an orphaned session's refresh and revokes the session", async () => {
        const username = unique("orphan");
        const email = `${username}@example.com`;
        await registerUser(username, email);
        const login = await loginUser(email);
        const cookies = login.headers["set-cookie"];
        const userId = jwt.decode(cookieValue(cookies, "access_token")).sub;

        const del = await request(app).delete("/api/v1/auth/me").set("Cookie", cookieString(cookies));
        expect(del.status).toBe(200);

        const orphanJti = new mongoose.Types.ObjectId().toString();
        const orphanToken = generateRefreshToken({ sub: userId, jti: orphanJti, nonce: crypto.randomUUID() });
        await Session.create({
            _id: orphanJti,
            userId,
            refreshTokenHash: hashToken(orphanToken),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        const after = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${orphanToken}`);
        expect(after.status).toBe(401);

        const orphan = await Session.findById(orphanJti);
        expect(orphan.revokedAt).not.toBeNull();
    });
});
