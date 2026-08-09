import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import { createError, isDomainError, isDependencyError } from "../utils/errors.js";

export const classifyError = (err) => {
    if (isDomainError(err)) {
        return { code: err.code, message: err.message, statusCode: err.statusCode };
    }
    if (isDependencyError(err)) {
        return createError("DEPENDENCY_FAILURE", undefined, 503);
    }
    return createError("INTERNAL_ERROR", undefined, 500);
};

export const formatError = (err, req) => {
    const classified = classifyError(err);
    const traceId = randomUUID();

    logger.error("request_failed", {
        code: classified.code,
        statusCode: classified.statusCode,
        method: req?.method,
        path: req?.originalUrl,
        traceId,
        detail: err?.message,
        stack: err?.stack,
    });

    return { ...classified, traceId };
};
