import mongoose from "mongoose";
import { config } from "../configs/config.js";
import { redisClient } from "../configs/redis.js";

const checkRedis = async () => {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), config.healthTimeoutMs);
    });
    try {
        await Promise.race([redisClient.ping(), timeout]);
        return { status: "up" };
    } catch (error) {
        return { status: "down", error: "unreachable" };
    } finally {
        clearTimeout(timer);
    }
};

const checkMongo = async () => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    if (mongoose.connection.readyState !== 1) {
        return { status: "down", error: states[mongoose.connection.readyState] ?? "unknown" };
    }

    const db = mongoose.connection.db;
    if (!db) {
        // Transient window during connection establishment: the driver
        // reports connected but the native Db handle is not yet assigned.
        // The ready state is authoritative here.
        return { status: "up" };
    }

    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), config.healthTimeoutMs);
    });
    try {
        await Promise.race([db.admin().ping(), timeout]);
        return { status: "up" };
    } catch {
        return { status: "down", error: "unreachable" };
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Liveness endpoint - the process is alive and serving requests.
 * Complexity: O(1).
 */
export const liveness = (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
};

/**
 * Readiness endpoint - reports dependency status (FR-032, SC-018).
 * Returns 200 when all critical dependencies are up, 503 otherwise.
 * Each probe is bounded by HEALTH_TIMEOUT_MS (SC-018: degraded status
 * within five seconds of a dependency failure).
 * Complexity: O(1) ping + one connection state read, in parallel.
 */
export const readiness = async (req, res) => {
    const [mongo, redis] = await Promise.all([checkMongo(), checkRedis()]);

    const dependencies = { mongodb: mongo, redis };
    const ready = mongo.status === "up" && redis.status === "up";

    res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "degraded",
        dependencies,
        timestamp: new Date().toISOString(),
    });
};
