/**
 * Says out loud when a counter that should be shared through Redis is being
 * kept in this one process instead.
 *
 * The sign-in lockout, the express-rate-limit counters and the sliding-window
 * limiter all fall back to memory when Redis is unreachable, rather than
 * letting requests through uncounted. That is the right behaviour, and it used
 * to be invisible: a warning line at most once a minute and a "redis: down" in
 * /health/detailed that nobody was reading. The counters are then per
 * instance, so two instances behind the balancer hand every caller two
 * budgets, and a restart hands out a fresh one. A password-guessing run is
 * slowed, not stopped.
 *
 * This keeps a gauge for each of the three, which alerts.yml reads
 * (AthenaRedisFallbackActive), and a standing condition, which
 * /health/detailed shows as degraded with the reason.
 *
 * Only when REDIS_URL is set. With none, Redis was never expected: that is a
 * developer machine or a test, and the environment check already refuses to
 * boot in production without it. Nothing here may throw; it runs inside the
 * limiters, and observability that breaks a request is worse than none.
 */

import { Gauge } from 'prom-client';
import { register } from './metrics';
import { recordCondition } from './ops-metrics';

export const REDIS_FALLBACK_COMPONENTS = ['login_lockout', 'rate_limit_counters', 'rate_limit_sliding_window'] as const;
export type RedisFallbackComponent = (typeof REDIS_FALLBACK_COMPONENTS)[number];

const WHAT_IT_IS: Record<RedisFallbackComponent, string> = {
  login_lockout: 'The sign-in lockout counters are in this process only',
  rate_limit_counters: 'The API rate-limit counters are in this process only',
  rate_limit_sliding_window: 'The sliding-window rate limits are in this process only',
};

export const redisFallbackActive = new Gauge({
  name: 'athena_redis_fallback_active',
  help: '1 while a counter that should be shared through Redis is being kept in this process instead, 0 otherwise',
  labelNames: ['component'] as const,
  registers: [register],
});

// Every series starts at zero, so a rule on it sees a series that exists
// rather than one that appears for the first time already at one.
for (const component of REDIS_FALLBACK_COMPONENTS) {
  redisFallbackActive.labels(component).set(0);
}

const active = new Map<RedisFallbackComponent, boolean>();

const conditionName = (component: RedisFallbackComponent) => `redis_fallback.${component}`;

/** Redis was expected and could not be used for this component's counters. */
export function noteRedisFallback(component: RedisFallbackComponent, reason: string): void {
  try {
    if (!process.env.REDIS_URL) return;
    if (active.get(component) === true) return;
    active.set(component, true);
    redisFallbackActive.labels(component).set(1);
    recordCondition(
      conditionName(component),
      1,
      `${WHAT_IT_IS[component]} (${reason}), so each instance counts for itself and a restart clears the count. Restore Redis; see the on-call runbook.`
    );
  } catch {
    // Observability never breaks the request it is watching.
  }
}

/** A Redis call for this component worked, so the counters are shared again. */
export function noteRedisRecovered(component: RedisFallbackComponent): void {
  try {
    if (active.get(component) !== true) return;
    active.set(component, false);
    redisFallbackActive.labels(component).set(0);
    recordCondition(conditionName(component), 0, null);
  } catch {
    // As above.
  }
}

/** For tests. */
export function resetRedisFallbackState(): void {
  active.clear();
  for (const component of REDIS_FALLBACK_COMPONENTS) {
    redisFallbackActive.labels(component).set(0);
  }
}
