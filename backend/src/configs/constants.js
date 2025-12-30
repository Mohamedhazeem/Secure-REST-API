import ms from "ms";

export const DB_NAME = "DB Test";
export const ACCESS_TOKEN="access_token";
export const REFRESH_TOKEN="refresh_token";

export const API_REQUEST_LIMIT = 15 * 60 *1000;
export const LOGIN_API_REQUEST_LIMIT = 5 * 60 *1000; 


export const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN;
export const ACCESS_TOKEN_MAX_AGE = ms(ACCESS_TOKEN_EXPIRES_IN);

export const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;
export const REFRESH_TOKEN_MAX_AGE = ms(REFRESH_TOKEN_EXPIRES_IN);