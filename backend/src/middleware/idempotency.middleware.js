import { createError } from "../utils/errors.js";
import { redisClient } from "../configs/redis.js";
import { config } from "../configs/config.js";

const IDEMPOTENT_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const IDEMPOTENCY_TTL_SECONDS = config.idempotencyTtlDays * 24 * 60 * 60;

const PENDING = "pending";

const isStoredResponse = (value) => {
    if (!value || value === PENDING) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

/**
 * Idempotency middleware (FR-028).
 *
 * Deduplicates mutating requests carrying an `Idempotency-Key` header
 * (Decision 1). Keys are retained for 7 days (Decision 11) then expire.
 *
 * Flow: claim the key with SET NX; execute the request; persist the
 * response envelope. A repeated request replays the stored envelope.
 * A concurrent duplicate (claim exists, response not yet stored) receives
 * an explicit conflict.
 *
 * Complexity: O(1) per request - two constant-time Redis operations
 * (SET NX + SET on finish, or GET on replay).
 */
export const idempotencyMiddleware = async (req, res, next) => {
    if (!IDEMPOTENT_METHODS.has(req.method)) return next();

    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey.length > 255) return next();

    const identity = req.user?._id ? String(req.user._id) : req.ip;
    const storeKey = `idem:${identity}:${idempotencyKey}`;

    try {
        const existing = await redisClient.get(storeKey);
        const replay = isStoredResponse(existing);
        if (replay) {
            if (replay.kind === "send") {
                res.status(replay.statusCode).send(replay.body);
            } else {
                res.status(replay.statusCode).json(replay.body);
            }
            return;
        }

        const claimed = await redisClient.set(storeKey, PENDING, "EX", IDEMPOTENCY_TTL_SECONDS, "NX");
        if (claimed === null) {
            return next(createError("IDEMPOTENCY_CONFLICT", "Another request with this idempotency key is in progress", 409));
        }

        let captured = null;
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            captured = { statusCode: res.statusCode, body, kind: "json" };
            return originalJson(body);
        };
        const originalSend = res.send.bind(res);
        res.send = (body) => {
            if (!captured) captured = { statusCode: res.statusCode, body, kind: "send" };
            return originalSend(body);
        };
        const originalEnd = res.end.bind(res);
        res.end = (body, encoding, cb) => {
            if (!captured) {
                captured = { statusCode: res.statusCode, body, kind: "send" };
            }
            return originalEnd(body, encoding, cb);
        };

        res.once("finish", async () => {
            try {
                if (!captured) {
                    await redisClient.del(storeKey);
                    return;
                }
                await redisClient.set(storeKey, JSON.stringify(captured), "EX", IDEMPOTENCY_TTL_SECONDS);
            } catch (error) {
                // Persisting the response must not fail the already-delivered reply.
                console.error("idempotency.response.store.failed", error.message);
            }
        });

        return next();
    } catch (error) {
        // Fail open: the deduplication guarantee is best-effort. When the
        // store is unavailable the request proceeds without dedup instead
        // of failing with 503.
        console.warn("idempotency.store.unavailable", error.message);
        return next();
    }
};
