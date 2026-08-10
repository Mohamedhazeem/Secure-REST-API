import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";
import UserRepository from "../../src/repositories/implementations/mongoose/user.repository.js";

afterEach(() => {
    vi.restoreAllMocks();
});

const unique = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`;

const registerAndLogin = async (username, email, password = "password123") => {
    await request(app).post("/api/v1/auth").send({ username, email, password });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return login.headers["set-cookie"];
};

const grantPermissions = async (email, codes) => {
    const perms = [];
    for (const code of codes) {
        const p = await Permission.findOneAndUpdate(
            { code },
            { code, description: code },
            { upsert: true, returnDocument: "after" }
        );
        perms.push(p._id);
    }
    const role = await Role.create({ name: unique("role"), permissions: perms });
    await User.findOneAndUpdate({ email: email.toLowerCase() }, { roles: [role._id] });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertFlatEnvelope = (body, code, status) => {
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.traceId).toMatch(UUID_RE);
    expect(body.statusCode).toBeUndefined();
    expect(body.category).toBeUndefined();
    expect(body.retryable).toBeUndefined();
    expect(body.retryAfter).toBeUndefined();
};

describe("Error response envelope (US4)", () => {
    it("returns a flat envelope with code, message, traceId on validation failure", async () => {
        const res = await request(app)
            .post("/api/v1/auth")
            .send({ username: "ab", email: "not-an-email", password: "short" });

        expect(res.status).toBe(400);
        assertFlatEnvelope(res.body, "VALIDATION_ERROR", 400);
        expect(res.body.message).toMatch(/Validation failed/);
    });

    it("returns INVALID_CREDENTIALS with a flat envelope on wrong password", async () => {
        const username = unique("login");
        const email = `${username}@example.com`;
        await request(app).post("/api/v1/auth").send({ username, email, password: "password123" });

        const res = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password: "wrong-password" });

        expect(res.status).toBe(401);
        assertFlatEnvelope(res.body, "INVALID_CREDENTIALS", 401);
    });

    it("returns UNAUTHORIZED for a missing access token", async () => {
        const res = await request(app).post("/api/v1/posts").send({ content: "x" });
        expect(res.status).toBe(401);
        assertFlatEnvelope(res.body, "UNAUTHORIZED", 401);
    });

    it("returns ROLE_DENIED for a user lacking the required permission", async () => {
        const username = unique("denied");
        const email = `${username}@example.com`;
        const cookie = await registerAndLogin(username, email);

        const res = await request(app)
            .patch("/api/v1/posts/64b2c4d3e4b0c2a5f8e9d000")
            .set("Cookie", cookie)
            .send({ content: "x", version: 0 });

        expect(res.status).toBe(403);
        assertFlatEnvelope(res.body, "ROLE_DENIED", 403);
    });

    it("returns NOT_FOUND for an unknown route", async () => {
        const res = await request(app).get("/api/v1/does-not-exist");
        expect(res.status).toBe(404);
        assertFlatEnvelope(res.body, "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND when updating a non-existent post", async () => {
        const username = unique("owner");
        const email = `${username}@example.com`;
        const cookie = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:update"]);

        const res = await request(app)
            .patch(`/api/v1/posts/64b2c4d3e4b0c2a5f8e9d000`)
            .set("Cookie", cookie)
            .send({ content: "renamed", version: 0 });

        expect(res.status).toBe(404);
        assertFlatEnvelope(res.body, "NOT_FOUND", 404);
    });

    it("returns OWNERSHIP_REQUIRED when modifying another user's post", async () => {
        const owner = unique("owner");
        const ownerEmail = `${owner}@example.com`;
        const ownerCookie = await registerAndLogin(owner, ownerEmail);
        const created = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", ownerCookie)
            .send({ content: "mine" });
        const postId = created.body.post._id;

        const attacker = unique("attacker");
        const attackerEmail = `${attacker}@example.com`;
        const atkCookie = await registerAndLogin(attacker, attackerEmail);
        await grantPermissions(attackerEmail, ["posts:read", "posts:delete"]);

        const res = await request(app)
            .delete(`/api/v1/posts/${postId}`)
            .set("Cookie", atkCookie);

        expect(res.status).toBe(403);
        assertFlatEnvelope(res.body, "OWNERSHIP_REQUIRED", 403);
    });

    it("propagates a unique traceId that support can correlate to logs", async () => {
        const res = await request(app).get("/api/v1/does-not-exist");
        expect(res.body.traceId).toMatch(UUID_RE);
        expect(res.body.traceId.length).toBe(36);
    });

    it("maps dependency failures to a structured 503 DEPENDENCY_FAILURE (FR-017)", async () => {
        vi.spyOn(UserRepository.prototype, "findByEmail").mockRejectedValue(new Error("Redis connection refused"));
        try {
            const res = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: "missing@example.com", password: "password123" });

            expect(res.status).toBe(503);
            assertFlatEnvelope(res.body, "DEPENDENCY_FAILURE", 503);
        } finally {
            vi.restoreAllMocks();
        }
    });
});
