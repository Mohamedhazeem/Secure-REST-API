import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

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

const createPost = (cookies, body) =>
    request(app).post("/api/v1/posts").set("Cookie", cookies).send(body);

describe("post CRUD and ownership (US3, T033)", () => {
    it("creates a post attributed to the caller with public visibility and version 0", async () => {
        const username = unique("crud");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);

        const created = await createPost(cookies, { content: "Hello TrustFeed" });
        expect(created.status).toBe(201);
        expect(created.body.post).toBeDefined();
        expect(created.body.post.content).toBe("Hello TrustFeed");
        expect(created.body.post.visibility).toBe("public");
        expect(created.body.post.version).toBe(0);

        const me = await request(app).get("/api/v1/posts/me").set("Cookie", cookies);
        expect(me.status).toBe(200);
        expect(me.body.data.some((p) => p._id === created.body.post._id)).toBe(true);

        const all = await request(app).get("/api/v1/posts").set("Cookie", cookies);
        expect(all.status).toBe(200);
        expect(all.body.data.some((p) => p._id === created.body.post._id)).toBe(true);
    });

    it("updates own post with the expected version and increments it", async () => {
        const username = unique("upd");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create", "posts:update"]);

        const created = await createPost(cookies, { content: "before" });
        const id = created.body.post._id;

        const updated = await request(app)
            .patch(`/api/v1/posts/${id}`)
            .set("Cookie", cookies)
            .send({ content: "after", version: 0 });
        expect(updated.status).toBe(200);
        expect(updated.body.post.content).toBe("after");
        expect(updated.body.post.version).toBe(1);
    });

    it("returns 409 CONFLICT when updating with a stale version", async () => {
        const username = unique("stale");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create", "posts:update"]);

        const created = await createPost(cookies, { content: "original" });
        const id = created.body.post._id;

        await request(app).patch(`/api/v1/posts/${id}`).set("Cookie", cookies).send({ content: "v1", version: 0 });
        const stale = await request(app)
            .patch(`/api/v1/posts/${id}`)
            .set("Cookie", cookies)
            .send({ content: "stale write", version: 0 });

        expect(stale.status).toBe(409);
        expect(stale.body.code).toBe("CONFLICT");
    });

    it("deletes own post and it disappears from listings", async () => {
        const username = unique("del");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create", "posts:delete"]);

        const created = await createPost(cookies, { content: "delete me" });
        const id = created.body.post._id;

        const deleted = await request(app).delete(`/api/v1/posts/${id}`).set("Cookie", cookies);
        expect(deleted.status).toBe(204);

        const me = await request(app).get("/api/v1/posts/me").set("Cookie", cookies);
        expect(me.body.data.some((p) => p._id === id)).toBe(false);
    });

    it("denies updating or deleting another user's post (OWNERSHIP_REQUIRED)", async () => {
        const owner = unique("owner");
        const ownerEmail = `${owner}@example.com`;
        const ownerCookies = await registerAndLogin(owner, ownerEmail);
        const created = await createPost(ownerCookies, { content: "not yours" });
        const postId = created.body.post._id;

        const attacker = unique("atk");
        const attackerEmail = `${attacker}@example.com`;
        const atkCookies = await registerAndLogin(attacker, attackerEmail);
        await grantPermissions(attackerEmail, ["posts:update", "posts:delete"]);

        const patch = await request(app)
            .patch(`/api/v1/posts/${postId}`)
            .set("Cookie", atkCookies)
            .send({ content: "hijacked", version: 0 });
        expect(patch.status).toBe(403);
        expect(patch.body.code).toBe("OWNERSHIP_REQUIRED");

        const del = await request(app).delete(`/api/v1/posts/${postId}`).set("Cookie", atkCookies);
        expect(del.status).toBe(403);
        expect(del.body.code).toBe("OWNERSHIP_REQUIRED");
    });

    it("enforces visibility: private posts are hidden from other users", async () => {
        const alice = unique("alice");
        const aliceEmail = `${alice}@example.com`;
        const aliceCookies = await registerAndLogin(alice, aliceEmail);
        const privatePost = await createPost(aliceCookies, {
            content: "secret",
            visibility: "private",
        });
        expect(privatePost.status).toBe(201);
        expect(privatePost.body.post.visibility).toBe("private");

        const bob = unique("bob");
        const bobEmail = `${bob}@example.com`;
        const bobCookies = await registerAndLogin(bob, bobEmail);

        const all = await request(app).get("/api/v1/posts").set("Cookie", bobCookies);
        expect(all.body.data.some((p) => p._id === privatePost.body.post._id)).toBe(false);

        const aliceMe = await request(app).get("/api/v1/posts/me").set("Cookie", aliceCookies);
        expect(aliceMe.body.data.some((p) => p._id === privatePost.body.post._id)).toBe(true);
    });

    it("returns 404 for updates to a non-existent post", async () => {
        const username = unique("miss");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create", "posts:update"]);

        const res = await request(app)
            .patch("/api/v1/posts/64b2c4d3e4b0c2a5f8e9d000")
            .set("Cookie", cookies)
            .send({ content: "ghost", version: 0 });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
    });

    it("rejects invalid visibility values with 400", async () => {
        const username = unique("vis");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);

        const res = await createPost(cookies, { content: "x", visibility: "nobody" });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
    });
});

describe("concurrent post updates (US3, T034)", () => {
    it("exactly one of two simultaneous updates succeeds, the other gets 409", async () => {
        const username = unique("race");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create", "posts:update"]);

        const created = await createPost(cookies, { content: "original" });
        const id = created.body.post._id;

        const [first, second] = await Promise.all([
            request(app).patch(`/api/v1/posts/${id}`).set("Cookie", cookies).send({ content: "one", version: 0 }),
            request(app).patch(`/api/v1/posts/${id}`).set("Cookie", cookies).send({ content: "two", version: 0 }),
        ]);

        const statuses = [first.status, second.status].sort();
        expect(statuses).toEqual([200, 409]);

        const conflict = first.status === 409 ? first : second;
        expect(conflict.body.code).toBe("CONFLICT");

        const winner = first.status === 200 ? first : second;
        expect(winner.body.post.version).toBe(1);
    });
});
