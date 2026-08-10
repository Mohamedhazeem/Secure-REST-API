import { createError } from "../utils/errors.js";

/**
 * Role/permission gate with optional attribute conditions (FR-016, FR-023).
 *
 * Permissions are loaded per request by the auth middleware, so policy
 * changes apply from the next request (FR-015 runtime-configurable ABAC).
 *
 * requirePermission("posts:update") - RBAC only
 * requirePermission("posts:update", { attributes: ctx => ctx.user._id === ctx.params.id })
 *   - RBAC AND endpoint-level ABAC evaluated per request
 */
export const requirePermission = (permission, { attributes } = {}) => (req, res, next) => {
    if (!req.user) {
        return next(createError("UNAUTHORIZED", "Authentication is required", 401));
    }

    const permissions = req.user.permissions || [];
    if (!permissions.includes(permission)) {
        return next(createError("ROLE_DENIED", `Missing required permission: ${permission}`, 403));
    }

    if (attributes) {
        const allowed = attributes({ user: req.user, params: req.params, query: req.query, body: req.body });
        if (!allowed) {
            return next(createError("FORBIDDEN", "You do not meet the policy conditions for this operation", 403));
        }
    }

    next();
};
