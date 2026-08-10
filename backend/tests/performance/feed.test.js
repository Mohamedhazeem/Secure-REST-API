import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";
import Post from "../../src/models/post.model.js";

const unique = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`;

const P95_THRESHOLD_MS = 950;

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

const measureP95 = (latencies) => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[idx];
};

describe("Feed cursor pagination (US4, T043)", () => {
    let followerCookies;
    let authorId;
    let originalIds;

    beforeAll(async () => {
        const authorUser = unique("feedauthor");
        const authorEmail = `${authorUser}@example.com`;
        const authorCookies = await registerAndLogin(authorUser, authorEmail);
        await grantPermissions(authorEmail, ["posts:create", "posts:read"]);

        const authorDoc = await User.findOne({ email: authorEmail.toLowerCase() });
        authorId = authorDoc._id;

        const followerUser = unique("feedfollower");
        const followerEmail = `${followerUser}@example.com`;
        followerCookies = await registerAndLogin(followerUser, followerEmail);
        await grantPermissions(followerEmail, ["follows:create", "follows:delete", "feed:read"]);

        const follow = await request(app)
            .post(`/api/v1/users/${authorId.toString()}/follow`)
            .set("Cookie", followerCookies);
        expect(follow.status).toBe(201);

        const docs = Array.from({ length: 45 }, (_, i) => ({
            content: `feed post ${i}`,
            author: authorId,
        }));
        const inserted = await Post.insertMany(docs);
        originalIds = inserted.map((p) => p._id.toString());
    }, 60000);

    afterAll(async () => {
        await Post.deleteMany({ author: authorId });
    });

    it("paginates without duplicates or skipped posts while new posts are inserted mid-pagination", async () => {
        const collected = [];
        let cursor;
        let pages = 0;
        let hasNextPage = true;
        let inserted = false;

        while (hasNextPage) {
            pages += 1;
            const url = `/api/v1/feed?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
            const res = await request(app).get(url).set("Cookie", followerCookies);
            expect(res.status).toBe(200);
            expect(res.body.hasNextPage).toBeDefined();
            for (const post of res.body.data) {
                collected.push({ id: post._id, createdAt: post.createdAt });
            }
            cursor = res.body.cursor;
            hasNextPage = res.body.hasNextPage;

            if (pages === 2 && !inserted) {
                const fresh = Array.from({ length: 5 }, (_, i) => ({
                    content: `inserted mid-pagination ${i}`,
                    author: authorId,
                }));
                await Post.insertMany(fresh);
                inserted = true;
            }
            if (pages > 50) break;
        }

        expect(pages).toBeGreaterThanOrEqual(5);

        const collectedIds = collected.map((p) => p.id);
        expect(new Set(collectedIds).size).toBe(collectedIds.length);

        for (const id of originalIds) {
            expect(collectedIds).toContain(id);
        }

        const originalsSeen = collectedIds.filter((id) => originalIds.includes(id));
        expect(originalsSeen).toHaveLength(originalIds.length);

        for (let i = 1; i < collected.length; i++) {
            const prev = new Date(collected[i - 1].createdAt).getTime();
            const cur = new Date(collected[i].createdAt).getTime();
            expect(prev).toBeGreaterThanOrEqual(cur);
        }
    });

    it("maintains sub-second p95 latency when paginating the feed (page size 20)", async () => {
        const latencies = [];
        let cursor;
        for (let page = 0; page < 10; page++) {
            const url = `/api/v1/feed?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
            const start = performance.now();
            const res = await request(app).get(url).set("Cookie", followerCookies);
            const elapsed = performance.now() - start;

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
            latencies.push(elapsed);
            cursor = res.body.cursor;
            if (!res.body.hasNextPage) break;
        }

        const p95 = measureP95(latencies);
        console.log(`Feed pagination p95 latency: ${p95.toFixed(2)}ms (threshold: ${P95_THRESHOLD_MS}ms)`);
        expect(p95).toBeLessThan(P95_THRESHOLD_MS);
    });
});
