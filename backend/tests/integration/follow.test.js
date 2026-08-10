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

describe("follow and feed (US4, T041)", () => {
    const setupAuthorWithPosts = async () => {
        const username = unique("author");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:create", "posts:read"]);
        const ids = [];
        for (const content of ["first post", "second post"]) {
            const res = await request(app).post("/api/v1/posts").set("Cookie", cookies).send({ content });
            expect(res.status).toBe(201);
            ids.push(res.body.post._id);
        }
        return { cookies, email, ids, userId: await userIdByEmail(email) };
    };

    const setupFollower = async () => {
        const username = unique("follower");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["follows:create", "follows:delete", "feed:read"]);
        return { cookies, email, userId: await userIdByEmail(email) };
    };

    it("records a follow and the followed user's posts appear in the feed", async () => {
        const author = await setupAuthorWithPosts();
        const follower = await setupFollower();

        const follow = await request(app)
            .post(`/api/v1/users/${author.userId}/follow`)
            .set("Cookie", follower.cookies);
        expect(follow.status).toBe(201);
        expect(follow.body.follow).toBeDefined();
        expect(follow.body.follow.followerId).toBe(follower.userId);
        expect(follow.body.follow.followingId).toBe(author.userId);

        const feed = await request(app).get("/api/v1/feed").set("Cookie", follower.cookies);
        expect(feed.status).toBe(200);
        expect(feed.body.data).toBeDefined();
        const feedIds = feed.body.data.map((p) => p._id);
        expect(feedIds).toEqual(expect.arrayContaining(author.ids));

        const newer = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", author.cookies)
            .send({ content: "post created after follow" });
        expect(newer.status).toBe(201);

        const feedAfter = await request(app).get("/api/v1/feed").set("Cookie", follower.cookies);
        expect(feedAfter.body.data.map((p) => p._id)).toContain(newer.body.post._id);
    });

    it("unfollow removes the user's posts from the feed", async () => {
        const author = await setupAuthorWithPosts();
        const follower = await setupFollower();

        await request(app).post(`/api/v1/users/${author.userId}/follow`).set("Cookie", follower.cookies);

        const unfollow = await request(app)
            .delete(`/api/v1/users/${author.userId}/unfollow`)
            .set("Cookie", follower.cookies);
        expect(unfollow.status).toBe(200);
        expect(unfollow.body.message).toBeDefined();

        const feed = await request(app).get("/api/v1/feed").set("Cookie", follower.cookies);
        const feedIds = feed.body.data.map((p) => p._id);
        expect(feedIds).not.toEqual(expect.arrayContaining(author.ids));
    });

    it("rejects self-follow with 409 SELF_FOLLOW", async () => {
        const follower = await setupFollower();
        const res = await request(app)
            .post(`/api/v1/users/${follower.userId}/follow`)
            .set("Cookie", follower.cookies);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("SELF_FOLLOW");
    });

    it("rejects a duplicate follow with 409 CONFLICT", async () => {
        const author = await setupAuthorWithPosts();
        const follower = await setupFollower();

        const first = await request(app)
            .post(`/api/v1/users/${author.userId}/follow`)
            .set("Cookie", follower.cookies);
        expect(first.status).toBe(201);

        const second = await request(app)
            .post(`/api/v1/users/${author.userId}/follow`)
            .set("Cookie", follower.cookies);
        expect(second.status).toBe(409);
        expect(second.body.code).toBe("CONFLICT");
    });

    it("returns 404 when following an unknown user", async () => {
        const follower = await setupFollower();
        const res = await request(app)
            .post("/api/v1/users/64b2c4d3e4b0c2a5f8e9d000/follow")
            .set("Cookie", follower.cookies);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 404 when unfollowing a user who is not followed", async () => {
        const author = await setupAuthorWithPosts();
        const follower = await setupFollower();
        const res = await request(app)
            .delete(`/api/v1/users/${author.userId}/unfollow`)
            .set("Cookie", follower.cookies);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 401 without authentication", async () => {
        const res = await request(app).post("/api/v1/users/64b2c4d3e4b0c2a5f8e9d000/follow");
        expect(res.status).toBe(401);
    });

    it("returns 403 when the caller lacks follows:create", async () => {
        const author = await setupAuthorWithPosts();
        const username = unique("noperm");
        const email = `${username}@example.com`;
        const cookies = await registerAndLogin(username, email);
        const res = await request(app)
            .post(`/api/v1/users/${author.userId}/follow`)
            .set("Cookie", cookies);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("ROLE_DENIED");
    });

    it("enforces visibility in the feed: followers-only visible, private hidden (FR-036)", async () => {
        const username = unique("visauthor");
        const email = `${username}@example.com`;
        const authorCookies = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:create", "posts:read"]);
        const authorId = await userIdByEmail(email);

        const followersOnly = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", authorCookies)
            .send({ content: "for followers", visibility: "followers-only" });
        const privatePost = await request(app)
            .post("/api/v1/posts")
            .set("Cookie", authorCookies)
            .send({ content: "secret", visibility: "private" });
        expect(followersOnly.status).toBe(201);
        expect(privatePost.status).toBe(201);

        const follower = await setupFollower();
        await request(app).post(`/api/v1/users/${authorId}/follow`).set("Cookie", follower.cookies);

        const feed = await request(app).get("/api/v1/feed").set("Cookie", follower.cookies);
        const feedIds = feed.body.data.map((p) => p._id);
        expect(feedIds).toContain(followersOnly.body.post._id);
        expect(feedIds).not.toContain(privatePost.body.post._id);

        const stranger = await setupFollower();
        const strangerFeed = await request(app).get("/api/v1/feed").set("Cookie", stranger.cookies);
        expect(strangerFeed.body.data.map((p) => p._id)).not.toContain(followersOnly.body.post._id);
    });
});
