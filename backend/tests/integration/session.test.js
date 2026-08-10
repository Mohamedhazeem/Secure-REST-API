import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/app.js";
import Session from "../../src/models/session.model.js";
import { sweepInactiveSessions } from "../../src/service/session.service.js";
import { unique, cookieString, cookieValue, sessionIdOf } from "../helpers/index.js";

const setupUser = async () => {
    const username = unique("ses");
    const email = `${username}@example.com`;
    await request(app).post("/api/v1/auth").send({ username, email, password: "password123" });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
    return { username, email, cookies: login.headers["set-cookie"] };
};

describe("session revocation (US2, T022)", () => {
    it("revokes a single session without affecting other sessions", async () => {
        const { email } = await setupUser();

        const loginA = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookiesA = loginA.headers["set-cookie"];
        const refreshA = cookieValue(cookiesA, "refresh_token");
        const sessionA = sessionIdOf(refreshA);

        const loginB = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookiesB = loginB.headers["set-cookie"];
        const refreshB = cookieValue(cookiesB, "refresh_token");

        const sessions = await request(app).get("/api/v1/auth/sessions").set("Cookie", cookieString(cookiesB));
        expect(sessions.status).toBe(200);
        expect(sessions.body.data.length).toBe(4);
        const target = sessions.body.data.find((s) => s.id === sessionA);
        expect(target).toBeDefined();

        const revoke = await request(app)
            .delete(`/api/v1/auth/sessions/${target.id}`)
            .set("Cookie", cookieString(cookiesB));
        expect(revoke.status).toBe(200);

        const revokedRefresh = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshA}`);
        expect(revokedRefresh.status).toBe(403);

        const activeRefresh = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshB}`);
        expect(activeRefresh.status).toBe(200);

        const after = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Cookie", cookieString(activeRefresh.headers["set-cookie"]));
        expect(after.status).toBe(200);
        expect(after.body.data.map((s) => s.id)).not.toContain(target.id);
        expect(after.body.data.length).toBe(3);
    });

    it("rejects unknown or invalid session targets with 404/400", async () => {
        const { cookies } = await setupUser();
        const randomId = new mongoose.Types.ObjectId().toString();

        const unknown = await request(app)
            .delete(`/api/v1/auth/sessions/${randomId}`)
            .set("Cookie", cookieString(cookies));
        expect(unknown.status).toBe(404);

        const invalid = await request(app)
            .delete("/api/v1/auth/sessions/not-a-valid-id")
            .set("Cookie", cookieString(cookies));
        expect(invalid.status).toBe(400);
        expect(invalid.body.code).toBe("VALIDATION_ERROR");
    });

    it("revokes all sessions on reuse and invalidates every access and refresh token", async () => {
        const { email } = await setupUser();

        const loginA = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookiesA = loginA.headers["set-cookie"];
        const refreshA = cookieValue(cookiesA, "refresh_token");

        const loginB = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookiesB = loginB.headers["set-cookie"];
        const refreshB = cookieValue(cookiesB, "refresh_token");

        const rotated = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", cookieString(cookiesA));
        expect(rotated.status).toBe(200);

        const reuse = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshA}`);
        expect(reuse.status).toBe(401);
        expect(reuse.body.code).toBe("AUTH_REUSE_DETECTED");

        const accessA = await request(app).get("/api/v1/auth/sessions").set("Cookie", cookieString(cookiesA));
        expect(accessA.status).toBe(401);
        const accessB = await request(app).get("/api/v1/auth/sessions").set("Cookie", cookieString(cookiesB));
        expect(accessB.status).toBe(401);

        const refreshReuse = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshA}`);
        expect(refreshReuse.status).toBe(403);

        const refreshOther = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refreshB}`);
        expect(refreshOther.status).toBe(403);
    });

    it("sweeps inactive sessions past the idle TTL (T032)", async () => {
        const { cookies } = await setupUser();
        const refresh = cookieValue(cookies, "refresh_token");
        const sessionId = sessionIdOf(refresh);

        await Session.updateOne({ _id: sessionId }, { lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

        const result = await sweepInactiveSessions();
        expect(result.revoked).toBeGreaterThanOrEqual(1);

        const revokedRefresh = await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", `refresh_token=${refresh}`);
        expect(revokedRefresh.status).toBe(403);
    });
});
