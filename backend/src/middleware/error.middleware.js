import { formatError } from "../service/error.service.js";

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
