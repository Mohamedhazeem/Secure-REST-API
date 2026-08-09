import { config } from "./config.js";

export const allowedOrigins = config.allowedOrigins;

export const isOriginAllowed = (origin) => {
    if (!origin) return false;
    return allowedOrigins.includes(origin);
};

export const corsHeaders = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
};
