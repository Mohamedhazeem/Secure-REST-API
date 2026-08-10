import { isOriginAllowed, corsHeaders } from "../configs/cors.js";
import { createError } from "../utils/errors.js";

/**
 * CORS origin allowlist enforcement (US6, T067).
 *
 * Requests carrying an Origin header are accepted only when the origin is
 * in the environment-driven allowlist. Disallowed origins are rejected
 * with a structured 403 FORBIDDEN envelope and never receive CORS headers,
 * so browsers cannot read responses and preflight is blocked outright.
 * Requests without an Origin header (server-to-server, curl) pass through.
 *
 * Complexity: O(n) per request - allowlist membership check.
 */
export const corsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
        if (!isOriginAllowed(origin)) {
            return next(createError("FORBIDDEN", "Origin is not allowed", 403));
        }
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", corsHeaders["Access-Control-Allow-Credentials"]);
        res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
        res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
};
