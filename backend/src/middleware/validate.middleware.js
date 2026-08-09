import { createError } from "../utils/errors.js";

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
            .join("; ");
        return next(createError("VALIDATION_ERROR", `Validation failed: ${details}`, 400));
    }

    req.body = result.data;
    next();
};
