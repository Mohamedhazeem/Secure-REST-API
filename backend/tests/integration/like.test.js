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

const userIdByEmail = async (email) => {
    const user = await User.findOne({ email: email.toLowerCase() });
    return user._id.toString();
};

describe("like and unlike (US4, T042)", () => {
    const setupAuthorWithPost = async () => {
        const username = unique("author");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:create", "posts:read"]);
        const created = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", cookies)
            .send({ content: "likable post" });
        expect(created.status).toBe(201);
        return { cookies, email, postId: created.body.post._id, userId: await userIdByEmail(email) };
    };

    const setupLiker = async () => {
        const username = unique("liker");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["likes:create", "likes:delete", "likes:read"]);
        return { cookies, email, userId: await userIdByEmail(email) };
    };

    it("likes a post (201) and the like status reflects it", async () => {
        const author = await setupAuthorWithPost();
        const liker = await setupLiker();

        const like = await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies)
            .send({ idempotencyKey: unique("like") });
        expect(like.status).toBe(201);
        expect(like.body.like).toBeDefined();
        expect(like.body.like.userId).toBe(liker.userId);
        expect(like.body.like.postId).toBe(author.postId);

        const status = await request(app)
            .get(`/api/v1/posts/${author.postId}/likes/me`)
            .set("Cookie", liker.cookies);
        expect(status.status).toBe(200);
        expect(status.body.liked).toBe(true);
    });

    it("rejects a duplicate like with 409 CONFLICT", async () => {
        const author = await setupAuthorWithPost();
        const liker = await setupLiker();

        const first = await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies)
            .send({ idempotencyKey: unique("like") });
        expect(first.status).toBe(201);

        const second = await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies)
            .send({ idempotencyKey: unique("like") });
        expect(second.status).toBe(409);
        expect(second.body.code).toBe("CONFLICT");
    });

    it("unlikes a post (204) and the like status flips to false", async () => {
        const author = await setupAuthorWithPost();
        const liker = await setupLiker();

        await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies)
            .send({ idempotencyKey: unique("like") });

        const unlike = await request(app)
            .delete(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies);
        expect(unlike.status).toBe(204);

        const status = await request(app)
            .get(`/api/v1/posts/${author.postId}/likes/me`)
            .set("Cookie", liker.cookies);
        expect(status.body.liked).toBe(false);
    });

    it("returns 404 when liking an unknown post", async () => {
        const liker = await setupLiker();
        const res = await request(app)
            .post("/api/v1/posts/64b2c4d3e4b0c2a5f8e9d000/likes")
            .set("Cookie", liker.cookies)
            .send({ idempotencyKey: unique("like") });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
        const res = await request(app).post("/api/v1/posts/64b2c4d3e4b0c2a5f8e9d000/likes");
        expect(res.status).toBe(401);
    });

    it("returns 403 when the caller lacks likes:create", async () => {
        const author = await setupAuthorWithPost();
        const username = unique("noperm");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        const res = await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", cookies)
            .send({ idempotencyKey: unique("like") });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ROLE_DENIED");
    });

    it("rejects a like without idempotencyKey with 400", async () => {
        const author = await setupAuthorWithPost();
        const liker = await setupLiker();
        const res = await request(app)
            .post(`/api/v1/posts/${author.postId}/likes`)
            .set("Cookie", liker.cookies)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
    });
});
