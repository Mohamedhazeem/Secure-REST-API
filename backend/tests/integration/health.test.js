import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/app.js";
import { redisClient } from "../../src/configs/redis.js";
import { config } from "../../src/configs/config.js";

const DEFAULT_HEALTH_TIMEOUT_MS = config.healthTimeoutMs;

const snapshotDependencyStatus = (body) => ({
    status: body.status,
    mongodb: body.dependencies.mongodb.status,
    redis: body.dependencies.redis.status,
});

afterEach(() => {
    vi.restoreAllMocks();
    config.healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS;
    for (const key of ["db", "readyState"]) {
        if (Object.getOwnPropertyDescriptor(mongoose.connection, key)) {
            delete mongoose.connection[key];
        }
    }
});

describe("health endpoints (US6, T059)", () => {
    it("liveness reports ok with uptime and ISO timestamp", async () => {
        const res = await request(app).get("/api/v1/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(typeof res.body.uptime).toBe("number");
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it("readiness returns ready when mongodb and redis are both up", async () => {
        const res = await request(app).get("/api/v1/health/ready");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ready");
        expect(res.body.dependencies.mongodb.status).toBe("up");
        expect(res.body.dependencies.redis.status).toBe("up");
        expect(res.body.dependencies.mongodb.error).toBeUndefined();
        expect(res.body.dependencies.redis.error).toBeUndefined();
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it("readiness reports redis down as degraded when redis fails", async () => {
        vi.spyOn(redisClient, "ping").mockRejectedValue(new Error("Redis connection refused"));
        const res = await request(app).get("/api/v1/health/ready");
        expect(res.status).toBe(503);
        expect(snapshotDependencyStatus(res.body)).toEqual({
            status: "degraded",
            mongodb: "up",
            redis: "down",
        });
        expect(res.body.dependencies.redis.error).toBeTruthy();
    });

    it("readiness returns degraded within HEALTH_TIMEOUT_MS when redis hangs", async () => {
        vi.spyOn(redisClient, "ping").mockImplementation(() => new Promise(() => {}));
        config.healthTimeoutMs = 300;

        const startedAt = Date.now();
        const res = await request(app).get("/api/v1/health/ready");
        const elapsed = Date.now() - startedAt;

        expect(res.status).toBe(503);
        expect(snapshotDependencyStatus(res.body)).toEqual({
            status: "degraded",
            mongodb: "up",
            redis: "down",
        });
        expect(elapsed).toBeGreaterThanOrEqual(250);
        expect(elapsed).toBeLessThan(config.healthTimeoutMs * 5);
    });

    it("readiness recovers automatically once redis is restored", async () => {
        const down = vi.spyOn(redisClient, "ping").mockRejectedValue(new Error("Redis connection refused"));
        const degraded = await request(app).get("/api/v1/health/ready");
        expect(degraded.status).toBe(503);
        down.mockRestore();

        const recovered = await request(app).get("/api/v1/health/ready");
        expect(recovered.status).toBe(200);
        expect(recovered.body.status).toBe("ready");
        expect(recovered.body.dependencies.redis.status).toBe("up");
    });

    it("readiness reports mongodb down within HEALTH_TIMEOUT_MS when the database is unresponsive", async () => {
        Object.defineProperty(mongoose.connection, "db", {
            value: {
                admin: () => ({ ping: () => new Promise(() => {}) }),
            },
            configurable: true,
        });
        config.healthTimeoutMs = 300;

        const startedAt = Date.now();
        const res = await request(app).get("/api/v1/health/ready");
        const elapsed = Date.now() - startedAt;

        expect(res.status).toBe(503);
        expect(snapshotDependencyStatus(res.body)).toEqual({
            status: "degraded",
            mongodb: "down",
            redis: "up",
        });
        expect(res.body.dependencies.mongodb.error).toBeTruthy();
        expect(elapsed).toBeGreaterThanOrEqual(250);
        expect(elapsed).toBeLessThan(config.healthTimeoutMs * 5);
    });

    it("readiness reports mongodb down when the connection is not established", async () => {
        Object.defineProperty(mongoose.connection, "readyState", { value: 0, configurable: true });
        const res = await request(app).get("/api/v1/health/ready");
        expect(res.status).toBe(503);
        expect(snapshotDependencyStatus(res.body)).toEqual({
            status: "degraded",
            mongodb: "down",
            redis: "up",
        });
        expect(res.body.dependencies.mongodb.error).toBeTruthy();
    });

    it("readiness recovers automatically once mongodb is responsive again", async () => {
        Object.defineProperty(mongoose.connection, "readyState", { value: 0, configurable: true });
        const degraded = await request(app).get("/api/v1/health/ready");
        expect(degraded.status).toBe(503);
        delete mongoose.connection.readyState;

        const recovered = await request(app).get("/api/v1/health/ready");
        expect(recovered.status).toBe(200);
        expect(recovered.body.status).toBe("ready");
        expect(recovered.body.dependencies.mongodb.status).toBe("up");
    });
});
