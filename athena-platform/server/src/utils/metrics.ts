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

/**
 * The emails a member cannot get in or back in without: the confirmation link
 * after registering, a resent one, a password-reset link, the link that unlocks an
 * account its owner locked, and the notice that an address already has an
 * account. `outcome` is `sent` when the provider accepted
 * the message and `failed` when every attempt was refused or timed out.
 *
 * What alerts.yml reads (AthenaAuthEmailFailing). Before this, a refused or
 * lost one of these was a line in the log and nothing else: the member was
 * locked out and nobody could see it happening.
 */
export const AUTH_EMAIL_KINDS = ['verification', 'resend_verification', 'password_reset', 'account_exists', 'account_unlock'] as const;
export type AuthEmailKind = (typeof AUTH_EMAIL_KINDS)[number];

export const authEmailTotal = new Counter({
  name: 'athena_auth_email_total',
  help: 'Verification, password-reset and account-exists emails by what became of them',
  labelNames: ['kind', 'outcome'] as const,
  registers: [register],
});

// Every series starts at zero, so the first failure after a restart is an
// increase Prometheus can see instead of a series that appears already at one.
for (const kind of AUTH_EMAIL_KINDS) {
  for (const outcome of ['sent', 'failed'] as const) {
    authEmailTotal.labels(kind, outcome);
  }
}

export { client };
