import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { app } from "./app.js";
import { config } from "./configs/config.js";
import { redisClient } from "./configs/redis.js";
import { seedRolesAndPermissions } from "./configs/seed.js";
import { ensureIndexes } from "./configs/database.js";
import { assertContract, CONTRACT_PUBLISHED } from "./docs/contract-check.js";
import { sweepInactiveSessions } from "./service/session.service.js";
import { logger } from "./utils/logger.js";
import { startNotificationWorker, stopNotificationWorker } from "./workers/notification.worker.js";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let server = null;
let sweepTimer = null;
let shuttingDown = false;

const startServer = async () => {
    try {
        if (process.env.NODE_ENV !== "production") {
            assertContract({ app, contractDir: CONTRACT_PUBLISHED });
        }

        if (process.env.NODE_ENV !== "test") {
            try {
                await seedRolesAndPermissions();
            } catch (err) {
                console.error("🛑 Failed to seed roles and permissions:", err);
                process.exit(1);
            }

            // Build unique/query indexes explicitly. In production autoIndex
            // is off, so without this step the dedupe and idempotency
            // guarantees (notification dedupeKey, comment idempotency) would
            // silently never be enforced.
            try {
                await ensureIndexes();
            } catch (err) {
                console.error("🛑 Failed to build database indexes:", err);
                process.exit(1);
            }
        }

        const PORT = process.env.PORT || 3333;

        server = app.listen(PORT, () => {
            console.log(`🚀 Express server running on port ${PORT}`);
        });

        server.on("error", (error) => {
            console.error("🛑 Server error:", error);
            process.exit(1);
        });

        if (process.env.NODE_ENV !== "test") {
            // Durable notification delivery (US5, T082). A queue backend that
            // cannot be reached is reported explicitly and delivery degrades
            // to the in-process runner with the same retry/dead-letter rules.
            await startNotificationWorker();

            sweepTimer = setInterval(() => {
                sweepInactiveSessions().catch((error) =>
                    console.error("🛑 Session sweep failed:", error)
                );
            }, SWEEP_INTERVAL_MS);
            sweepTimer.unref?.();
        }
    } catch (error) {
        console.error(`🛑 Server startup failed: ${error}`);
        process.exit(1);
    }
};

/**
 * Close background jobs with a bounded grace period (Decision 7: 30s).
 * Closes the BullMQ notification worker and queue so in-flight jobs finish
 * or return to the queue instead of being lost (US5, T082).
 * @returns {Promise<void>}
 */
const closeBackgroundJobs = async () => {
    try {
        await stopNotificationWorker();
    } catch (error) {
        logger.error("shutdown.notification_worker.failed", { error: error.message });
    }
};

/**
 * Graceful shutdown (FR-034, SC-019, Decision 7).
 *
 * Stops accepting new connections, lets in-flight HTTP requests finish
 * within GRACEFUL_SHUTDOWN_HTTP_TIMEOUT_MS (default 10s), then gives
 * background jobs GRACEFUL_SHUTDOWN_JOBS_TIMEOUT_MS (default 30s) before
 * closing Mongo and Redis cleanly. Idempotent: a second signal during
 * shutdown is ignored.
 */
export const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("shutdown.started", { signal });

    if (sweepTimer) clearInterval(sweepTimer);

    if (server) {
        const httpBound = config.gracefulShutdownHttpTimeoutMs;
        const closed = new Promise((resolve) => server.close(resolve));
        const forced = new Promise((resolve) => {
            const timer = setTimeout(() => {
                logger.error("shutdown.http.timeout", { boundMs: httpBound });
                server.closeAllConnections?.();
                resolve();
            }, httpBound);
            timer.unref?.();
        });
        await Promise.race([closed, forced]);
    }

    const jobsBound = config.gracefulShutdownJobsTimeoutMs;
    await Promise.race([
        closeBackgroundJobs(),
        new Promise((resolve) => setTimeout(resolve, jobsBound).unref?.()),
    ]);

    try {
        await mongoose.disconnect();
    } catch (error) {
        logger.error("shutdown.mongo.failed", { error: error.message });
    }

    if (typeof redisClient.quit === "function") {
        try {
            await redisClient.quit();
        } catch (error) {
            logger.error("shutdown.redis.failed", { error: error.message });
        }
    }

    logger.info("shutdown.complete", { signal });
    process.exit(0);
};

const onSignal = (signal) => {
    shutdown(signal).catch((error) => {
        console.error("🛑 Graceful shutdown failed:", error);
        process.exit(1);
    });
};

process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));

startServer();
