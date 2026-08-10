import { REFRESH_TOKEN } from "../configs/constants.js";
import * as authService from "../service/auth.service.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import { setAuthCookies } from "../controller/auth.controller.js";

export const refreshTokenController = async (req, res, next) => {
    const token = req.cookies[REFRESH_TOKEN];
    if (!token) return next(createError("UNAUTHORIZED", "Refresh token is missing", 401));

    try {
        const { accessToken, refreshToken } = await authService.refreshSession({ refreshToken: token });
        setAuthCookies(res, { accessToken, refreshToken });
        return sendSuccess(res, 200, { message: "Token refreshed" });
    } catch (err) {
        next(err);
    }
};
