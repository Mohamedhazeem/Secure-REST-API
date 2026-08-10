import { ACCESS_TOKEN, REFRESH_TOKEN } from "../configs/constants.js";
import { clearAuthCookies, createAuthSession } from "../controller/auth.controller.js";
import * as authService from "../service/auth.service.js";
import * as sessionService from "../service/session.service.js";
import * as userService from "../service/user.service.js";
import { sendSuccess } from "../utils/response.js";

export const loginUser = async (req, res, next) => {
    try {
        const user = await userService.loginUser(req.body);
        await createAuthSession(res, user, req);
        return sendSuccess(res, 200, {
            message: "user logged in successfully",
            user: { id: user.id, email: user.email, username: user.username },
        });
    } catch (err) {
        next(err);
    }
};

export const logoutUser = async (req, res, next) => {
    try {
        const access = req.cookies[ACCESS_TOKEN];
        if (access) {
            await authService.blacklistAccessToken(access);
        }

        const refresh = req.cookies[REFRESH_TOKEN];
        if (refresh) {
            await sessionService.revokeSessionByRefreshToken(refresh);
        }

        clearAuthCookies(res);
        return sendSuccess(res, 200, { message: "Logged out" });
    } catch (err) {
        next(err);
    }
};

export const registerUser = async (req, res, next) => {
    try {
        const user = await userService.registerUser(req.body);
        await createAuthSession(res, user, req);
        return sendSuccess(res, 201, { message: "user created", user });
    } catch (err) {
        next(err);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        await userService.deleteUserAccount(req.user._id);
        clearAuthCookies(res);
        return sendSuccess(res, 200, { message: "deleted successful" });
    } catch (err) {
        next(err);
    }
};
