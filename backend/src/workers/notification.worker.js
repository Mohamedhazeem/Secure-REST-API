import { config } from "../configs/config.js";
import { deliverNotification } from "../service/notification.service.js";
import { setNotificationPublisher } from "../service/notification.queue.js";
import { isDomainError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const NOTIFICATION_QUEUE = "notifications";
export const NOTIFICATION_DLQ = "notifications-dlq";

/** Bounded retry budget per job before dead-lettering (Decision 6, SC-017). */
export const MAX_ATTEMPTS = 5;
/** Base delay for exponential backoff between attempts. */
export const BACKOFF_DELAY_MS = 1000;
/** Upper bound on retained in-process dead letters, so a broken dependency cannot exhaust memory. */
const DEAD_LETTER_CAPACITY = 100;
/**
 * Inline fallback retry delay. The inline runner executes in the HTTP request
 * path (no durable queue), so it must not block the caller for the multi-second
 * exponential backoff the durable BullMQ queue uses. A short fixed delay bounds
 * the worst-case inline blocking to ~100ms (Decision 6, SC-017).
 */
const INLINE_RETRY_DELAY_MS = 25;

let queue = null;
let worker = null;
let deadLetterQueue = null;
let connection = null;

const deadLetters = [];

/**
 * Inspect dead-lettered jobs retained by the in-process fallback runner.
 * The durable dead-letter queue is authoritative when a queue backend is
 * running; this view covers the degraded mode (SC-017).
 * @returns {Array<Object>} A copy of the retained dead letters.
 */
export const getDeadLetters = () => [...deadLetters];

/** Clear the in-process dead-letter buffer (operational recovery, tests). */
export const clearDeadLetters = () => {
    deadLetters.length = 0;
};

/**
 * A client-side domain error (validation, missing actor, forbidden) is
 * terminal: retrying an identical job cannot change the outcome, so it is
 * dead-lettered immediately instead of burning the retry budget. Everything
 * else (dependency failures, timeouts) is retryable.
 */
const isRetryable = (error) => !(isDomainError(error) && error.statusCode < 500);

const recordDeadLetter = async (job, error) => {
    const entry = {
        job,
        error: error?.message ?? "unknown error",
        failedAt: new Date().toISOString(),
    };
    logger.error("notification.job.dead_lettered", { type: job?.type, error: entry.error });
    if (deadLetterQueue) {
        try {
            // jobId = dedupeKey makes repeated dead-letter writes for the same
            // job overwrite one another instead of piling up (fix: DLQ
            // multi-insert on non-retryable failures).
            await deadLetterQueue.add("dead-letter", entry, {
                jobId: job?.dedupeKey ?? job?.id,
                removeOnComplete: false,
            });
            return;
        } catch (dlqError) {
            logger.error("notification.dlq.write.failed", { error: dlqError.message });
        }
    }
    deadLetters.push(entry);
    if (deadLetters.length > DEAD_LETTER_CAPACITY) deadLetters.shift();
};

/**
 * The unit of work executed for one notification job. Exported so both the
 * BullMQ worker and the in-process fallback run identical logic.
 * @param {Object} job - The notification job payload.
 * @returns {Promise<Object>} { notification, created }.
 */
export const processNotificationJob = (job) => deliverNotification(job);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * In-process fallback runner used when no queue backend is available
 * (tests, or a queue that failed to start). It preserves the queue's
 * delivery contract - bounded retry with exponential backoff, then
 * dead-letter - so behaviour does not silently change with the backend.
 */
const runInline = async (job) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            return await processNotificationJob(job);
        } catch (error) {
            lastError = error;
            if (!isRetryable(error)) break;
            logger.warn("notification.job.retry", {
                type: job?.type,
                attempt,
                error: error.message,
            });
            // Short, bounded delay only: this runs inside the request path.
            if (attempt < MAX_ATTEMPTS) await sleep(INLINE_RETRY_DELAY_MS);
        }
    }
    await recordDeadLetter(job, lastError);
    return { notification: null, created: false, deadLettered: true };
};

/**
 * Publish a notification job (FR-027).
 *
 * With a queue backend the job is enqueued with `jobId = dedupeKey`, which
 * BullMQ uses to drop duplicate submissions, and retried with exponential
 * backoff up to MAX_ATTEMPTS. Without a backend the job runs inline under
 * the same retry and dead-letter rules.
 *
 * Complexity: O(1) per job.
 * @param {Object} job - { type, recipientId, actorId, resourceId, dedupeKey, ... }.
 */
export const dispatchNotification = async (job) => {
    if (!queue) return runInline(job);
    return queue.add(job.type, job, {
        jobId: job.dedupeKey,
        attempts: MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: BACKOFF_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: false,
    });
};

/**
 * Route every social event dispatched by the follow, like, and comment
 * services through this worker (composition step, called from app.js).
 */
export const registerNotificationDispatcher = () => {
    setNotificationPublisher(dispatchNotification);
};

/**
 * Start the durable BullMQ queue and worker (T082, Decision 6).
 *
 * Failure to reach the queue backend is reported explicitly and the
 * dispatcher degrades to the inline runner: notifications are still
 * delivered with bounded retry and dead-lettering, just synchronously.
 * @returns {Promise<Object>} { mode: "queue" | "inline" }.
 */
export const startNotificationWorker = async () => {
    if (queue) return { mode: "queue" };
    try {
        const [{ Queue, Worker }, { default: IORedis }] = await Promise.all([
            import("bullmq"),
            import("ioredis"),
        ]);

        connection = new IORedis(config.bullmqUrl, { maxRetriesPerRequest: null });
        queue = new Queue(NOTIFICATION_QUEUE, { connection });
        deadLetterQueue = new Queue(NOTIFICATION_DLQ, { connection });
        worker = new Worker(NOTIFICATION_QUEUE, (job) => processNotificationJob(job.data), { connection });

        worker.on("failed", async (job, error) => {
            if (!job) return;
            const exhausted = job.attemptsMade >= (job.opts?.attempts ?? MAX_ATTEMPTS);
            const retryable = isRetryable(error);
            if (exhausted || !retryable) {
                await recordDeadLetter(job.data, error);
                // A terminal (non-retryable) error would otherwise be retried
                // up to MAX_ATTEMPTS, re-emitting 'failed' and writing a dead
                // letter on every attempt. Remove it so the dead letter is
                // recorded exactly once.
                if (!retryable) {
                    await job.remove().catch((removeError) =>
                        logger.error("notification.job.remove.failed", { error: removeError.message })
                    );
                }
            }
        });
        worker.on("error", (error) => {
            logger.error("notification.worker.error", { error: error.message });
            // The durable queue/worker is no longer usable. Reset state so
            // dispatchNotification degrades to the inline runner (which still
            // retries bounded and dead-letters) instead of silently dropping
            // jobs into a dead connection.
            queue = null;
            worker = null;
            deadLetterQueue = null;
            connection = null;
        });

        logger.info("notification.worker.started", { queue: NOTIFICATION_QUEUE, attempts: MAX_ATTEMPTS });
        return { mode: "queue" };
    } catch (error) {
        queue = null;
        deadLetterQueue = null;
        worker = null;
        connection = null;
        logger.error("notification.worker.start.failed", { error: error.message });
        return { mode: "inline" };
    }
};

/**
 * Close the queue, worker, and their Redis connection so in-flight jobs
 * finish and the process can exit cleanly (graceful shutdown).
 */
export const stopNotificationWorker = async () => {
    await worker?.close();
    await queue?.close();
    await deadLetterQueue?.close();
    await connection?.quit();
    worker = null;
    queue = null;
    deadLetterQueue = null;
    connection = null;
};
