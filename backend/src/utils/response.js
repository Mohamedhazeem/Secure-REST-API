export const sendSuccess = (res, statusCode, body) => {
    if (body === undefined) {
        return res.sendStatus(statusCode);
    }
    return res.status(statusCode).json(body);
};
