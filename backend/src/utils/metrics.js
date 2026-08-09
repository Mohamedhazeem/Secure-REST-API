const DURATION_BUCKETS = [100, 250, 500, 1000, 5000];

/**
 * Metrics collection - single source of truth (FR-033).
 *
 * In-memory counters and duration histograms for critical paths:
 * request volume/duration by route and status class, authentication
 * outcomes, and queue processing status. Snapshot is exported for
 * observability endpoints; reset is used by tests.
 *
 * Complexity: O(1) per record - fixed-size counter/histogram updates.
 */
const createMetrics = () => {
  const counters = new Map();
  const histograms = new Map();

  const inc = (name, by = 1) => {
    counters.set(name, (counters.get(name) ?? 0) + by);
  };

  const histogram = (name, value) => {
    const bucket = DURATION_BUCKETS.find((b) => value < b);
    const max = DURATION_BUCKETS[DURATION_BUCKETS.length - 1];
    const key = bucket === undefined ? `${name}:gte${max}ms` : `${name}:lt${bucket}ms`;
    inc(key);
  };

  return {
    recordRequest: ({ method, route, statusCode, durationMs }) => {
      inc("http.requests.total");
      inc(`http.requests.status:${Math.floor(statusCode / 100)}xx`);
      inc(`http.requests.route:${method} ${route ?? "unknown"}`);
      histogram("http.requests.duration", durationMs);
    },
    recordAuthOutcome: (outcome) => inc(`auth.${outcome}`),
    recordQueueEvent: (type) => inc(`queue.${type}`),
    increment: (name) => inc(name),
    snapshot: () => ({
      counters: Object.fromEntries(counters),
      durationBuckets: [...DURATION_BUCKETS],
    }),
    reset: () => {
      counters.clear();
      histograms.clear();
    },
  };
};

export const metrics = createMetrics();

/**
 * Request metrics middleware - records duration and status on finish.
 * Complexity: O(1) per request.
 */
export const metricsMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    metrics.recordRequest({
      method: req.method,
      route: req.route ? `${req.baseUrl}${req.route.path}` : "unmatched",
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
};
