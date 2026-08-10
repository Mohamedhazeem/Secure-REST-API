import { ACCESS_TOKEN, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN, REFRESH_TOKEN_MAX_AGE } from "../configs/constants.js";
import { config } from "../configs/config.js";
import * as authService from "../service/auth.service.js";
import * as sessionService from "../service/session.service.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import { revokeSessionParamsSchema } from "../validators/session.validator.js";

const cookieOptions = () => ({
    httpOnly: true,
    sameSite: "strict",
    secure: config.nodeEnv === "production",
});

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
    res.cookie(ACCESS_TOKEN, accessToken, { ...cookieOptions(), maxAge: ACCESS_TOKEN_MAX_AGE });
    res.cookie(REFRESH_TOKEN, refreshToken, { ...cookieOptions(), maxAge: REFRESH_TOKEN_MAX_AGE });
};

export const clearAuthCookies = (res) => res.clearCookie(ACCESS_TOKEN).clearCookie(REFRESH_TOKEN);

/**
 * Issue a fresh session (register/login) and set the token cookies.
 */
export const createAuthSession = async (res, user, req) => {
    if (!user || !user._id) throw createError("UNAUTHORIZED", "User not found", 401);

    const { accessToken, refreshToken } = await authService.issueAuthSession({
        userId: user._id,
        ipAddress: req?.ip,
        userAgent: req?.get("user-agent"),
        acceptLanguage: req?.get("accept-language"),
    });

    setAuthCookies(res, { accessToken, refreshToken });
};

export const listSessions = async (req, res, next) => {
    try {
        const data = await sessionService.listSessions(req.user._id);
        return sendSuccess(res, 200, { data, total: data.length });
    } catch (err) {
        next(err);
    }
};

export const revokeSession = async (req, res, next) => {
    try {
        const parsed = revokeSessionParamsSchema.safeParse({ id: req.params.id });
        if (!parsed.success) {
            return next(createError("VALIDATION_ERROR", "Invalid session id", 400));
        }
        await sessionService.revokeSession({ sessionId: parsed.data.id, userId: req.user._id });
        return sendSuccess(res, 200, { message: "Session revoked" });
    } catch (err) {
        next(err);
    }
};
