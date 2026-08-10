import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";

const unique = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`;

const registerAndLogin = async (username, email, password = "password123") => {
    await request(app).post("/api/v1/auth").send({ username, email, password });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return login.headers["set-cookie"];
};

describe("RBAC and security", () => {
    it("allows a user with posts:create to create a post", async () => {
        const username = unique("alice");
        const email = `${username}@example.com`;
        const cookie = await registerAndLogin(username, email);
        const res = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", cookie)
            .send({ content: "Hello world" });
        expect(res.status).toBe(201);
        expect(res.body.post).toBeDefined();
    });

    it("rejects an unauthenticated post creation with 401", async () => {
        const res = await request(app).post("/api/v1/posts").send({ content: "x" });
        expect(res.status).toBe(401);
    });

    it("denies post creation to a user lacking posts:create (ROLE_DENIED)", async () => {
        const limited = await Role.create({ name: unique("limited"), permissions: [] });
        const username = unique("bob");
        const email = `${username}@example.com`;
        await request(app).post("/api/v1/auth").send({ username, email, password: "password123" });
        await User.findOneAndUpdate({ email: email.toLowerCase() }, { roles: [limited._id] });
        const login = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookie = login.headers["set-cookie"];
        const res = await request(app).post("/api/v1/posts").set("Cookie", cookie).send({ content: "x", visibility: "private" });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ROLE_DENIED");
    });

    it("enforces ownership on delete (OWNERSHIP_REQUIRED)", async () => {
        const owner = unique("owner");
        const ownerEmail = `${owner}@example.com`;
        const ownerCookie = await registerAndLogin(owner, ownerEmail);
        const created = await request(app).post("/api/v1/posts").set("Cookie", ownerCookie).send({ content: "mine" });
        const postId = created.body.post._id;

        const delPerm = await Permission.findOneAndUpdate(
            { code: "posts:delete" },
            { code: "posts:delete", description: "delete" },
            { upsert: true, returnDocument: "after" }
        );
        const attackerRole = await Role.create({ name: unique("attacker"), permissions: [delPerm._id] });
        const attacker = unique("attacker");
        const attackerEmail = `${attacker}@example.com`;
        await request(app).post("/api/v1/auth").send({ username: attacker, email: attackerEmail, password: "password123" });
        await User.findOneAndUpdate({ email: attackerEmail.toLowerCase() }, { roles: [attackerRole._id] });
        const atkLogin = await request(app).post("/api/v1/auth/login").send({ email: attackerEmail, password: "password123" });
        const atkCookie = atkLogin.headers["set-cookie"];
        const res = await request(app).delete(`/api/v1/posts/${postId}`).set("Cookie", atkCookie);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("OWNERSHIP_REQUIRED");
    });
});
