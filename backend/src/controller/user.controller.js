import { ACCESS_TOKEN, REFRESH_TOKEN } from "../configs/constants.js";
import { blacklistAccessToken, blacklistRefreshTokenOnLogout, createAuthSession } from "../controller/auth.controller.js";
import * as userService from "../service/user.service.js";
import { sendSuccess } from "../utils/response.js";

export const loginUser = async (req, res, next) => {
    try {
        const user = await userService.loginUser(req.body);
        await createAuthSession(res, user);
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
        const token = req.cookies[ACCESS_TOKEN];
        if (token) {
            await blacklistAccessToken(token);
        }

        const refresh = req.cookies[REFRESH_TOKEN];
        if (refresh) {
            await blacklistRefreshTokenOnLogout(refresh);
        }

        res.clearCookie(ACCESS_TOKEN).clearCookie(REFRESH_TOKEN);
        return sendSuccess(res, 200, { message: "Logged out" });
    } catch (err) {
        next(err);
    }
};

export const registerUser = async (req, res, next) => {
    try {
        const user = await userService.registerUser(req.body);
        await createAuthSession(res, user);
        return sendSuccess(res, 201, { message: "user created", user });
    } catch (err) {
        next(err);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        await userService.deleteUserAccount(req.user._id);
        res.clearCookie(ACCESS_TOKEN).clearCookie(REFRESH_TOKEN);
        return sendSuccess(res, 200, { message: "deleted successful" });
    } catch (err) {
        next(err);
    }
};
