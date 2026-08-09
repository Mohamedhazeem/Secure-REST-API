import { createError } from "../utils/errors.js";

export const requirePermission = (permission) => (req, res, next) => {
    if (!req.user) {
        return next(createError("UNAUTHORIZED", "Authentication is required", 401));
    }

    const permissions = req.user.permissions || [];
    if (!permissions.includes(permission)) {
        return next(createError("ROLE_DENIED", `Missing required permission: ${permission}`, 403));
    }

    next();
};
