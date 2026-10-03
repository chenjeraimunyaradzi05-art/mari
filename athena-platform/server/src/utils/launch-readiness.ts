/**
 * Saying, at boot, what a production launch is still missing.
 *
 * Stripe, SendGrid and the AI key are not requirements of env.ts on purpose:
 * a process that boots without them is how a deployment with a missing
 * secret still answers /livez and is looked at by an operator, and refusing to
 * start would turn "payments are not set up yet" into "the site is down". The
 * cost of that choice was that the degraded state was silent. The one place
 * that listed the gaps was GET /health/launch-readiness, which answers only a
 * caller holding the diagnostics token, and nothing called it.
 *
 * So this keeps the choice and removes the silence. It is handed the same
 * report that endpoint answers with, and writes every required failure to the
 * log as an error and to Sentry as one message, once per boot. It never stops
 * the process and never throws: a report about configuration that took the
 * server down would be the same mistake from the other side.
 */

import type { LaunchReadinessReport } from '../routes/health.routes';
import { logger } from './logger';
import { captureMessage } from './sentry';

/** What reportRequiredGaps needs of the world; replaced in tests. */
export interface ReadinessSinks {
  error: (message: string, context?: Record<string, unknown>) => void;
  notify: (message: string) => void;
}

const defaultSinks: ReadinessSinks = {
  error: (message, context) => logger.error(message, context),
  notify: (message) => captureMessage(message, 'error'),
};

/**
 * Logs each required check that failed, and sends one summary to Sentry.
 * Returns the keys it reported, so a caller (and a test) can see what was said.
 */
export function reportRequiredGaps(report: LaunchReadinessReport, sinks: ReadinessSinks = defaultSinks): string[] {
  const gaps = report.checks.filter((check) => check.required && !check.ok);
  if (gaps.length === 0) {
    logger.info('Launch readiness: every required setting is in place', {
      passed: report.summary.passed,
      total: report.summary.total,
    });
    return [];
  }

  for (const gap of gaps) {
    sinks.error('Launch readiness: a required setting is missing', { key: gap.key, category: gap.category, message: gap.message });
  }
  sinks.notify(
    `Production is running without ${gaps.length} required setting${gaps.length === 1 ? '' : 's'}: ${gaps
      .map((gap) => gap.key)
      .join(', ')}. GET /health/launch-readiness lists what each one needs.`
  );
  return gaps.map((gap) => gap.key);
}

/**
 * Asks the question and reports the answer, in production only. Meant to be
 * started and left running at the end of startServer: it carries its own
 * try/catch, because the checks reach out to the database and to S3 and either
 * may be the very thing that is down.
 */
export async function reportLaunchReadinessAtBoot(
  ask: () => Promise<LaunchReadinessReport>,
  isProduction: boolean = process.env.NODE_ENV === 'production',
  sinks: ReadinessSinks = defaultSinks
): Promise<string[]> {
  if (!isProduction) return [];
  try {
    return reportRequiredGaps(await ask(), sinks);
  } catch (error) {
    logger.error('Launch readiness could not be checked at boot', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
