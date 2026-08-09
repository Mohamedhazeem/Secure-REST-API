import request from "supertest";
import crypto from "crypto";
import { app } from "../../src/app.js";
import { generateAccessToken, generateRefreshToken } from "../../src/utils/generateToken.js";

export const testApp = request(app);

export const makeTokens = (userId) => {
    const access = generateAccessToken({ sub: userId });
    const refresh = generateRefreshToken({ sub: userId, jti: crypto.randomUUID() });
    return { access, refresh };
};

export const authCookie = (accessToken) => ({
    Cookie: `access_token=${accessToken}; refresh_token=dummy`,
});
