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
  bullmqUrl: process.env.BULLMQ_URL ?? process.env.REDIS_DB_URI ?? "redis://127.0.0.1:6379",
  feedCacheTtlSeconds: parseInt(process.env.FEED_CACHE_TTL_SECONDS, 10) || 300,
  sessionIdleTtlSeconds: parseInt(process.env.SESSION_IDLE_TTL_SECONDS, 10) || 30 * 24 * 60 * 60,
  idempotencyTtlDays: parseInt(process.env.IDEMPOTENCY_TTL_DAYS, 10) || 7,
  healthTimeoutMs: parseInt(process.env.HEALTH_TIMEOUT_MS, 10) || 5000,
  gracefulShutdownHttpTimeoutMs: parseInt(process.env.GRACEFUL_SHUTDOWN_HTTP_TIMEOUT_MS, 10) || 10_000,
  gracefulShutdownJobsTimeoutMs: parseInt(process.env.GRACEFUL_SHUTDOWN_JOBS_TIMEOUT_MS, 10) || 30_000,
};
