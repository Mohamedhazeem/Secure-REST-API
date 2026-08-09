import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

const CORRELATION_HEADER = "X-Correlation-Id";
const MAX_CORRELATION_LENGTH = 128;

const store = new AsyncLocalStorage();

const sanitizeCorrelationId = (value) => {
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/[\x00-\x1f\x7f]/g, "").trim();
    if (!cleaned || cleaned.length > MAX_CORRELATION_LENGTH) return null;
    return cleaned;
};

/**
 * Correlation ID middleware (FR-031).
 *
 * Accepts an inbound `X-Correlation-Id` or generates one, attaches it to
 * the request and response, and stores it in AsyncLocalStorage so every
 * child operation (services, workers, audit entries) can read it via
 * getCorrelationId().
 *
 * The inbound header is untrusted: control characters are stripped and
 * values longer than 128 chars are rejected in favor of a generated ID.
 *
 * Complexity: O(1) per request - no I/O.
 */
export const correlationMiddleware = (req, res, next) => {
    const correlationId = sanitizeCorrelationId(req.header(CORRELATION_HEADER)) ?? randomUUID();
    req.correlationId = correlationId;
    res.set(CORRELATION_HEADER, correlationId);

    store.run({ correlationId }, next);
};

export const getCorrelationId = () => store.getStore()?.correlationId ?? null;

export const runWithCorrelation = (correlationId, fn) => store.run({ correlationId }, fn);
