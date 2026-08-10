import { formatError } from "../service/error.service.js";

/**
 * Central error handler - fail-fast envelope shaping (FR-017, Principle IX).
 *
 * Dependency failures (Mongoose errors, connection refused, Redis
 * unavailability) are classified to a structured DEPENDENCY_FAILURE (503)
 * by classifyError in error.service.js, so external failures never surface
 * as INTERNAL_ERROR.
 */
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const envelope = formatError(err, req);

    res.status(envelope.statusCode).json({
        code: envelope.code,
        message: envelope.message,
        traceId: envelope.traceId,
    });
};
