import { createError } from "../utils/errors.js";

export const notFoundHandler = (req, res, next) => {
    next(createError("NOT_FOUND", `No route found for ${req.method} ${req.originalUrl}`, 404));
};
