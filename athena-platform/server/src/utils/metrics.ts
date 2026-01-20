import client, { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// Create a dedicated registry (allows resetting in tests if needed)
export const register = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({ register });

// ===========================================
// Custom Application Metrics
// ===========================================

/**
 * HTTP request counter: total requests labeled by method, path, and status code.
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [register],
});

/**
 * HTTP request duration histogram (seconds).
 * Buckets optimized for typical web latency (5ms to 10s).
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export { client };
