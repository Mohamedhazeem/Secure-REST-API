const FORBIDDEN_META_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "authorization",
  "jwt",
  "apikey",
  "api_key",
  "private_key",
]);

const sanitize = (meta) => {
  if (meta == null) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(key)) {
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

const baseLogger = {
  info: (msg, meta) => {
    const entry = { ts: ts(), level: "info", msg, ...sanitize(meta) };
    console.log(JSON.stringify(entry));
  },
  warn: (msg, meta) => {
    const entry = { ts: ts(), level: "warn", msg, ...sanitize(meta) };
    console.warn(JSON.stringify(entry));
  },
  error: (msg, meta) => {
    const entry = { ts: ts(), level: "error", msg, ...sanitize(meta) };
    console.error(JSON.stringify(entry));
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      const entry = { ts: ts(), level: "debug", msg, ...sanitize(meta) };
      console.debug(JSON.stringify(entry));
    }
  },
};

export const logger = baseLogger;
