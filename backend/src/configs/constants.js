import "dotenv/config";
import ms from "ms";

export const DB_NAME = "DB Test";
export const ACCESS_TOKEN="access_token";
export const REFRESH_TOKEN="refresh_token";
export const BASE_URI = process.env.MONGODB_URI;

export const API_REQUEST_LIMIT = (parseInt(process.env.API_RATE_WINDOW_MS, 10) || 15 * 60) * 1000;
export const LOGIN_API_REQUEST_LIMIT = (parseInt(process.env.LOGIN_RATE_WINDOW_MS, 10) || 5 * 60) * 1000;
export const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT, 10) || 200;
export const LOGIN_RATE_LIMIT = parseInt(process.env.LOGIN_RATE_LIMIT, 10) || 5;


export const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN;
export const ACCESS_TOKEN_MAX_AGE = ms(ACCESS_TOKEN_EXPIRES_IN);

export const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;
export const REFRESH_TOKEN_MAX_AGE = ms(REFRESH_TOKEN_EXPIRES_IN);