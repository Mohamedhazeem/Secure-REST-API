import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";

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

describe("Rate limiting performance (US5)", () => {
    it("enforces per-user rate limits without affecting other users (isolation test)", async () => {
        const userA = unique("usera");
        const userB = unique("userb");
        const emailA = `${userA}@example.com`;
        const emailB = `${userB}@example.com`;

        const cookieA = await registerAndLogin(userA, emailA);
        const cookieB = await registerAndLogin(userB, emailB);
        await grantPermissions(emailA, ["posts:read"]);
        await grantPermissions(emailB, ["posts:read"]);

        const requestsPerUser = 20;

        const makeRequests = async (cookie) => {
            const latencies = [];
            for (let i = 0; i < requestsPerUser; i++) {
                const start = performance.now();
                const res = await request(app)
                    .get("/api/v1/posts/me?page=1&limit=10")
                    .set("Cookie", cookie);
                const elapsed = performance.now() - start;
                latencies.push(elapsed);
                expect(res.status).toBeOneOf([200, 429]);
            }
            return latencies;
        };

        const [latenciesA, latenciesB] = await Promise.all([
            makeRequests(cookieA),
            makeRequests(cookieB),
        ]);

        const p95A = measureP95(latenciesA);
        const p95B = measureP95(latenciesB);

        console.log(`User A p95: ${p95A.toFixed(2)}ms, User B p95: ${p95B.toFixed(2)}ms`);

        const successA = latenciesA.length;
        const successB = latenciesB.length;

        expect(successA).toBe(requestsPerUser);
        expect(successB).toBe(requestsPerUser);
        expect(p95A).toBeLessThan(P95_THRESHOLD_MS);
        expect(p95B).toBeLessThan(P95_THRESHOLD_MS);
    });

    it("returns 429 for a single abusive user while others remain unaffected", async () => {
        const victim = unique("victim");
        const abuser = unique("abuser");
        const victimEmail = `${victim}@example.com`;
        const abuserEmail = `${abuser}@example.com`;

        const victimCookie = await registerAndLogin(victim, victimEmail);
        const abuserCookie = await registerAndLogin(abuser, abuserEmail);
        await grantPermissions(victimEmail, ["posts:read"]);
        await grantPermissions(abuserEmail, ["posts:read"]);

        const burstCount = 1100;

        const abuserLatencies = [];
        let abuser429Count = 0;
        for (let i = 0; i < burstCount; i++) {
            const start = performance.now();
            const res = await request(app)
                .get("/api/v1/posts/me?page=1&limit=10")
                .set("Cookie", abuserCookie);
            const elapsed = performance.now() - start;
            abuserLatencies.push(elapsed);
            if (res.status === 429) abuser429Count++;
        }

        const victimLatencies = [];
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            const res = await request(app)
                .get("/api/v1/posts/me?page=1&limit=10")
                .set("Cookie", victimCookie);
            const elapsed = performance.now() - start;
            victimLatencies.push(elapsed);
            expect(res.status).toBe(200);
        }

        const victimP95 = measureP95(victimLatencies);
        console.log(`Abuser 429s: ${abuser429Count}, Victim p95: ${victimP95.toFixed(2)}ms`);

        expect(abuser429Count).toBeGreaterThan(0);
        expect(victimP95).toBeLessThan(P95_THRESHOLD_MS);
    }, 60000);

    it("processes requests within p95 threshold under moderate concurrent load", async () => {
        const username = unique("load");
        const email = `${username}@example.com`;
        const cookie = await registerAndLogin(username, email);
        await grantPermissions(email, ["posts:read"]);

        const concurrent = 30;
        const requests = Array.from({ length: concurrent }, () => {
            const start = performance.now();
            return request(app)
                .get("/api/v1/posts/me?page=1&limit=10")
                .set("Cookie", cookie)
                .then((res) => {
                    const elapsed = performance.now() - start;
                    expect(res.status).toBeOneOf([200, 429]);
                    return elapsed;
                });
        });

        const latencies = await Promise.all(requests);
        const p95 = measureP95(latencies);
        console.log(`Moderate concurrent load p95: ${p95.toFixed(2)}ms (threshold: ${P95_THRESHOLD_MS}ms)`);
        expect(p95).toBeLessThan(P95_THRESHOLD_MS);
    });
});
