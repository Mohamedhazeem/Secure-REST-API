import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";

const unique = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`;

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

describe("End-to-end flows (quickstart scenarios)", () => {
    it("register -> login -> access protected -> refresh -> logout", async () => {
        const username = unique("e2e");
        const email = `${username}@example.com`;
        const password = "password123";

        const register = await request(app).post("/api/v1/auth").send({ username, email, password });
        expect(register.status).toBe(201);
        expect(register.body.user).toBeDefined();

        const login = await request(app).post("/api/v1/auth/login").send({ email, password });
        expect(login.status).toBe(200);
        const cookies = login.headers["set-cookie"];
        expect(cookies.join(";")).toMatch(/access_token=/);

        const protectedRes = await request(app).get("/api/v1/posts/me").set("Cookie", cookies);
        expect(protectedRes.status).toBe(200);
        expect(protectedRes.body.data).toEqual([]);

        const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookies);
        expect(refresh.status).toBe(200);

        const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", cookies);
        expect(logout.status).toBe(200);
    });

    it("create -> update -> delete own post flow", async () => {
        const username = unique("owner");
        const email = `${username}@example.com`;
        await request(app).post("/api/v1/auth").send({ username, email, password: "password123" });
        const login = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
        const cookies = login.headers["set-cookie"];
        await grantPermissions(email, ["posts:read", "posts:create", "posts:update", "posts:delete"]);

        const created = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", cookies)
            .send({ content: "First post" });
        expect(created.status).toBe(201);
        const id = created.body.post._id;

        const updated = await request(app)
            .patch(`/api/v1/posts/${id}`)
            .set("Cookie", cookies)
            .send({ content: "Renamed", version: 0 });
        expect(updated.status).toBe(200);
        expect(updated.body.post.content).toBe("Renamed");

        const deleted = await request(app).delete(`/api/v1/posts/${id}`).set("Cookie", cookies);
        expect(deleted.status).toBe(204);
    });

    it("rejects updating/deleting another user's post with 403", async () => {
        const owner = unique("owner");
        const ownerEmail = `${owner}@example.com`;
        await request(app).post("/api/v1/auth").send({ username: owner, email: ownerEmail, password: "password123" });
        const ownerLogin = await request(app).post("/api/v1/auth/login").send({ email: ownerEmail, password: "password123" });
        const ownerCookies = ownerLogin.headers["set-cookie"];

        const created = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", ownerCookies)
            .send({ content: "mine" });
        const postId = created.body.post._id;

        const attacker = unique("attacker");
        const attackerEmail = `${attacker}@example.com`;
        await request(app).post("/api/v1/auth").send({ username: attacker, email: attackerEmail, password: "password123" });
        const atkLogin = await request(app).post("/api/v1/auth/login").send({ email: attackerEmail, password: "password123" });
        const atkCookies = atkLogin.headers["set-cookie"];
        await grantPermissions(attackerEmail, ["posts:read", "posts:delete"]);

        const res = await request(app).delete(`/api/v1/posts/${postId}`).set("Cookie", atkCookies);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("OWNERSHIP_REQUIRED");
    });

    it("returns 401 for a protected endpoint without a token", async () => {
        const res = await request(app).get("/api/v1/posts/me");
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("UNAUTHORIZED");
    });
});
