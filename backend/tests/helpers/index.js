import request from "supertest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { generateAccessToken, generateRefreshToken } from "../../src/utils/generateToken.js";

export const testApp = request(app);

export const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

export const cookieString = (cookies) => cookies.map((c) => c.split(";")[0]).join("; ");

export const cookieValue = (cookies, name) => {
    const entry = cookies.find((c) => c.startsWith(`${name}=`));
    return entry ? entry.split(";")[0].slice(name.length + 1) : undefined;
};

export const sessionIdOf = (refreshToken) => jwt.decode(refreshToken)?.jti;

export const makeTokens = (userId) => {
    const access = generateAccessToken({ sub: userId });
    const refresh = generateRefreshToken({ sub: userId, jti: crypto.randomUUID() });
    return { access, refresh };
};

export const authCookie = (accessToken) => ({
    Cookie: `access_token=${accessToken}; refresh_token=dummy`,
});
