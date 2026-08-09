import { randomUUID } from "crypto";

export const ERROR_CODES = {
    VALIDATION_ERROR: { statusCode: 400, message: "The request was invalid" },
    UNAUTHORIZED: { statusCode: 401, message: "Authentication is required" },
    INVALID_CREDENTIALS: { statusCode: 401, message: "Invalid email or password" },
    AUTH_REUSE_DETECTED: { statusCode: 401, message: "Refresh token reuse detected; all sessions have been revoked" },
    FORBIDDEN: { statusCode: 403, message: "You do not have permission to perform this action" },
    ROLE_DENIED: { statusCode: 403, message: "You lack a required role or permission" },
    OWNERSHIP_REQUIRED: { statusCode: 403, message: "You can only modify resources you own" },
    NOT_FOUND: { statusCode: 404, message: "The requested resource was not found" },
    CONFLICT: { statusCode: 409, message: "The request conflicts with the current state" },
    IDEMPOTENCY_CONFLICT: { statusCode: 409, message: "A request with this idempotency key is already being processed" },
    SELF_FOLLOW: { statusCode: 409, message: "You cannot follow yourself" },
    RATE_LIMITED: { statusCode: 429, message: "Rate limit exceeded for this client" },
    DEPENDENCY_FAILURE: { statusCode: 503, message: "An external dependency is unavailable" },
    INTERNAL_ERROR: { statusCode: 500, message: "An unexpected error occurred" },
};

export const createError = (code, message, statusCode) => {
    const known = ERROR_CODES[code];
    return {
        code,
        message: message || known?.message || ERROR_CODES.INTERNAL_ERROR.message,
        statusCode: statusCode ?? known?.statusCode ?? 500,
    };
};

export const isDomainError = (err) =>
    Boolean(err && typeof err === "object" && typeof err.code === "string" && typeof err.statusCode === "number");

export const isDependencyError = (err) => {
    if (!err) return false;
    return (
        err.name === "MongooseError" ||
        err.name === "MongoNetworkError" ||
        err.name === "MongoTimeoutError" ||
        err.name === "MongoServerSelectionError" ||
        (typeof err.code === "string" && err.code.startsWith("ECONN")) ||
        /redis/i.test(err.message || "")
    );
};

export const toErrorResponse = ({ code, message }) => ({
    code,
    message,
    traceId: randomUUID(),
});
