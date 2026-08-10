import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";
import Post from "../../src/models/post.model.js";
import mongoose from "mongoose";

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

const seedPosts = async (count, authorId) => {
    const docs = Array.from({ length: count }, (_, i) => ({
        content: `post content ${i}`,
        author: authorId,
    }));
    await Post.insertMany(docs);
};

const measureP95 = (latencies) => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[idx];
};

describe("Pagination performance (US5)", () => {
    let cookie;
    let userId;

    beforeAll(async () => {
        const username = unique("perf");
        const email = `${username}@example.com`;
        cookie = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read", "posts:create"]);

        const user = await User.findOne({ email: email.toLowerCase() });
        userId = user._id;

        await seedPosts(1000, userId);
    }, 60000);

    afterAll(async () => {
        const ids = await Post.distinct("_id", { author: userId });
        if (ids.length > 0) {
            await Post.deleteMany({ _id: { $in: ids } });
        }
    });

    it("maintains sub-second p95 latency when paginating through 1000 posts (page size 20)", async () => {
        const latencies = [];
        const totalPages = 50;

        for (let page = 1; page <= totalPages; page++) {
            const start = performance.now();
            const res = await request(app)
                .get(`/api/v1/posts/me?page=${page}&limit=20`)
                .set("Cookie", cookie);
            const elapsed = performance.now() - start;

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(20);
            latencies.push(elapsed);
        }

        const p95 = measureP95(latencies);
        console.log(`Pagination p95 latency: ${p95.toFixed(2)}ms (threshold: ${P95_THRESHOLD_MS}ms)`);
        expect(p95).toBeLessThan(P95_THRESHOLD_MS);
    });

    it("returns first page within p95 threshold under concurrent load (20 parallel requests)", async () => {
        const concurrent = 20;
        const requests = Array.from({ length: concurrent }, () => {
            const start = performance.now();
            return request(app)
                .get("/api/v1/posts/me?page=1&limit=20")
                .set("Cookie", cookie)
                .then((res) => {
                    const elapsed = performance.now() - start;
                    expect(res.status).toBe(200);
                    return elapsed;
                });
        });

        const latencies = await Promise.all(requests);
        const p95 = measureP95(latencies);
        console.log(`Concurrent pagination p95 latency: ${p95.toFixed(2)}ms (threshold: ${P95_THRESHOLD_MS}ms)`);
        expect(p95).toBeLessThan(P95_THRESHOLD_MS);
    });

    it("maintains p95 latency for all-posts endpoint across pages", async () => {
        const latencies = [];
        const totalPages = 10;

        for (let page = 1; page <= totalPages; page++) {
            const start = performance.now();
            const res = await request(app)
                .get(`/api/v1/posts?page=${page}&limit=50`)
                .set("Cookie", cookie);
            const elapsed = performance.now() - start;

            expect(res.status).toBe(200);
            latencies.push(elapsed);
        }

        const p95 = measureP95(latencies);
        console.log(`All-posts pagination p95 latency: ${p95.toFixed(2)}ms (threshold: ${P95_THRESHOLD_MS}ms)`);
        expect(p95).toBeLessThan(P95_THRESHOLD_MS);
    });
});
