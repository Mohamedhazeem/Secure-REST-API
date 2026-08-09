import { BASE_URI, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "./constants.js";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== "test") {
    console.error(`🛑 Required environment variable ${name} is missing!`);
    process.exit(1);
  }
  return value;
};

export const config = {
  port: process.env.PORT ?? 1430,
  mongoUri: requiredEnv("MONGODB_URI"),
  redisUri: process.env.REDIS_DB_URI,
  jwtAuthKey: requiredEnv("JWT_AUTH_KEY"),
  jwtRefreshKey: requiredEnv("JWT_REFRESH_KEY"),
  accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
  refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
