import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { getFeed, invalidateFeedCacheFor, __setCacheEnabledForTests } from "../../src/service/feed.service.js";
import { metrics } from "../../src/utils/metrics.js";
import { redisClient } from "../../src/configs/redis.js";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";
import Post from "../../src/models/post.model.js";
import Follow from "../../src/models/follow.model.js";

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

describe("Feed cache hit rate (SC-020)", () => {
    let followerCookies;
    let followerId;
    let authorId;

    beforeAll(async () => {
        metrics.reset();
        __setCacheEnabledForTests(true);

        const authorUser = unique("cacheauthor");
        const authorEmail = `${authorUser}@example.com`;
        const authorCookies = await registerAndLogin(authorUser, authorEmail);
        await grantPermissions(authorEmail, ["posts:create", "posts:read"]);

        const authorDoc = await User.findOne({ email: authorEmail.toLowerCase() });
        authorId = authorDoc._id;

        const followerUser = unique("cachefollower");
        const followerEmail = `${followerUser}@example.com`;
        followerCookies = await registerAndLogin(followerUser, followerEmail);
        await grantPermissions(followerEmail, ["follows:create", "follows:read", "feed:read"]);

        const followerDoc = await User.findOne({ email: followerEmail.toLowerCase() });
        followerId = followerDoc._id;

        await request(app)
            .post(`/api/v1/users/${authorId.toString()}/follow`)
            .set("Cookie", followerCookies);

        const docs = Array.from({ length: 20 }, (_, i) => ({
            content: `cache post ${i}`,
            author: authorId,
        }));
        await Post.insertMany(docs);
    }, 60000);

    afterAll(async () => {
        __setCacheEnabledForTests(null);
        await Post.deleteMany({ author: authorId });
        await Follow.deleteMany({ followerId });
    });

    it("achieves at least 80% cache hit rate for repeated feed reads", async () => {
        const first = await getFeed(followerId.toString(), { limit: 10 });
        expect(first.data.length).toBeGreaterThan(0);

        const pages = 5;
        for (let i = 0; i < pages; i++) {
            await getFeed(followerId.toString(), {
                cursor: i === 0 ? undefined : first.nextCursor,
                limit: 10,
            });
        }

        const snapshot = metrics.snapshot();
        const hits = snapshot.counters["feed.cache.hit:feed"] ?? 0;
        const misses = snapshot.counters["feed.cache.miss:feed"] ?? 0;
        const total = hits + misses;

        const hitRate = total > 0 ? hits / total : 0;
        console.log(`Feed cache hit rate: ${(hitRate * 100).toFixed(2)}% (hits=${hits}, misses=${misses})`);

        expect(total).toBeGreaterThan(0);
        expect(hitRate).toBeGreaterThanOrEqual(0.8);
    });
});
