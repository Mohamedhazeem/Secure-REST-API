import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.stubEnv("LOGIN_RATE_LIMIT", "5");

const { app } = await import("../../src/app.js");

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertFlatEnvelope = (body, code, status) => {
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.traceId).toMatch(UUID_RE);
    expect(body.statusCode).toBeUndefined();
    expect(body.category).toBeUndefined();
    expect(body.retryable).toBeUndefined();
};

const bruteForceLogin = (email, password) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

describe("rate limiting brute-force protection (US6, T060)", () => {
    it("allows LOGIN_RATE_LIMIT attempts then rejects the next with 429 RATE_LIMITED", async () => {
        const email = `${unique("brute")}@example.com`;

        for (let attempt = 1; attempt <= 5; attempt++) {
            const res = await bruteForceLogin(email, "wrong-password");
            expect(res.status).toBe(401);
            assertFlatEnvelope(res.body, "INVALID_CREDENTIALS", 401);
        }

        const blocked = await bruteForceLogin(email, "wrong-password");
        expect(blocked.status).toBe(429);
        assertFlatEnvelope(blocked.body, "RATE_LIMITED", 429);
    });

    it("keeps rejecting with a stable RATE_LIMITED envelope while the window is exhausted", async () => {
        const email = `${unique("brute")}@example.com`;

        for (let attempt = 1; attempt <= 5; attempt++) {
            await bruteForceLogin(email, "wrong-password");
        }
        for (let attempt = 1; attempt <= 3; attempt++) {
            const res = await bruteForceLogin(email, "wrong-password");
            expect(res.status).toBe(429);
            assertFlatEnvelope(res.body, "RATE_LIMITED", 429);
        }
    });

    it("rejects the login before credential validation, so brute force cannot probe passwords", async () => {
        const email = `${unique("brute")}@example.com`;

        for (let attempt = 1; attempt <= 5; attempt++) {
            await bruteForceLogin(email, "wrong-password");
        }
        const res = await bruteForceLogin(email, "wrong-password");
        expect(res.status).toBe(429);
        expect(res.body.code).toBe("RATE_LIMITED");
        expect(res.body.message).toMatch(/rate limit/i);
    });
});
