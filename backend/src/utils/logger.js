import { getCorrelationId } from "../middleware/correlation.middleware.js";

const FORBIDDEN_META_KEYS = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "token",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "secret",
  "authorization",
  "cookie",
  "cookies",
  "jwt",
  "apikey",
  "api_key",
  "x_api_key",
  "x-api-key",
  "xapikey",
  "private_key",
  "privatekey",
  "idempotency_key",
  "idempotencykey",
  "sid",
  "session_id",
  "sessionid",
  "session_token",
]);

const normalizeKey = (key) => String(key).toLowerCase().replace(/-/g, "_");

const sanitize = (meta) => {
  if (meta == null) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(normalizeKey(key))) {
      out[key] = "***REDACTED***";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Error)) {
      out[key] = sanitize(value);
    } else if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
    } else {
      out[key] = value;
    }
  }
  return out;
};

const ts = () => new Date().toISOString();

const makeLogger = (context = {}) => {
  const emit = (level, method) => (msg, meta) => {
    const entry = {
      ts: ts(),
      level,
      msg,
      traceId: context.traceId ?? getCorrelationId() ?? undefined,
      ...context,
      ...sanitize(meta),
    };
    method(JSON.stringify(entry));
  };

  return {
    info: emit("info", console.log),
    warn: emit("warn", console.warn),
    error: emit("error", console.error),
    debug: (msg, meta) => {
      if (process.env.NODE_ENV !== "production") emit("debug", console.debug)(msg, meta);
    },
    createChild: (childContext) => makeLogger({ ...context, ...childContext }),
  };
};

export const logger = makeLogger();
