import { describe, expect, it, jest } from '@jest/globals';

/**
 * The boot-time report of what a production launch is missing.
 *
 * Stripe, email and the Connect secret are not conditions of starting (the API
 * boots without them so that /livez answers and someone can look), which meant
 * a production deployment missing all three said nothing about it unless an
 * operator held the diagnostics token and asked. This is what makes it loud:
 * every required failure to the log, one summary to Sentry, once per boot, and
 * never a reason for the process to stop.
 */

jest.mock('../logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('../sentry', () => ({ captureMessage: jest.fn() }));

import { reportLaunchReadinessAtBoot, reportRequiredGaps, type ReadinessSinks } from '../launch-readiness';
import type { LaunchReadinessReport } from '../../routes/health.routes';

function report(checks: Array<Partial<LaunchReadinessReport['checks'][number]> & { key: string }>): LaunchReadinessReport {
  const full = checks.map((check) => ({ category: 'payments' as const, required: true, ok: true, message: 'Configured', ...check }));
  return {
    status: full.some((check) => check.required && !check.ok) ? 'not_ready' : 'ready',
    environment: 'production',
    timestamp: new Date().toISOString(),
    summary: {
      total: full.length,
      passed: full.filter((check) => check.ok).length,
      requiredFailures: full.filter((check) => check.required && !check.ok).length,
      recommendedMissing: full.filter((check) => !check.required && !check.ok).length,
    },
    checks: full,
  };
}

function sinks(): ReadinessSinks & { error: jest.Mock; notify: jest.Mock } {
  return { error: jest.fn(), notify: jest.fn() } as never;
}

describe('reportRequiredGaps', () => {
  it('logs every required check that failed, and one summary naming them all', () => {
    const out = sinks();

    const reported = reportRequiredGaps(
      report([
        { key: 'STRIPE_SECRET_KEY', ok: false, message: 'Stripe payments are not configured' },
        { key: 'STRIPE_CONNECT_WEBHOOK_SECRET', ok: false, message: 'Connect secret is not configured' },
        { key: 'DATABASE_URL' },
      ]),
      out
    );

    expect(reported).toEqual(['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET']);
    expect(out.error).toHaveBeenCalledTimes(2);
    expect(out.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ key: 'STRIPE_CONNECT_WEBHOOK_SECRET', message: 'Connect secret is not configured' })
    );
    expect(out.notify).toHaveBeenCalledTimes(1);
    const summary = String(out.notify.mock.calls[0][0]);
    expect(summary).toContain('2 required settings');
    expect(summary).toContain('STRIPE_SECRET_KEY');
    expect(summary).toContain('STRIPE_CONNECT_WEBHOOK_SECRET');
  });

  it('does not raise the alarm over a setting that is only recommended', () => {
    const out = sinks();

    const reported = reportRequiredGaps(
      report([{ key: 'SENTRY_DSN', required: false, ok: false, message: 'not set' }, { key: 'DATABASE_URL' }]),
      out
    );

    expect(reported).toEqual([]);
    expect(out.error).not.toHaveBeenCalled();
    expect(out.notify).not.toHaveBeenCalled();
  });

  it('says "setting" in the singular for one', () => {
    const out = sinks();

    reportRequiredGaps(report([{ key: 'STRIPE_SECRET_KEY', ok: false }]), out);

    expect(String(out.notify.mock.calls[0][0])).toContain('1 required setting:');
  });
});

describe('reportLaunchReadinessAtBoot', () => {
  it('asks nothing outside production, where a missing setting is a developer machine', async () => {
    const ask = jest.fn<() => Promise<LaunchReadinessReport>>();

    const reported = await reportLaunchReadinessAtBoot(ask, false, sinks());

    expect(reported).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });

  it('reports what the readiness question answers in production', async () => {
    const out = sinks();

    const reported = await reportLaunchReadinessAtBoot(
      async () => report([{ key: 'SENDGRID_API_KEY', ok: false }]),
      true,
      out
    );

    expect(reported).toEqual(['SENDGRID_API_KEY']);
    expect(out.notify).toHaveBeenCalledTimes(1);
  });

  it('never throws, whatever is down: the checks reach out to the database and to S3', async () => {
    const out = sinks();

    await expect(
      reportLaunchReadinessAtBoot(
        async () => {
          throw new Error('connect ETIMEDOUT');
        },
        true,
        out
      )
    ).resolves.toEqual([]);
    expect(out.notify).not.toHaveBeenCalled();
  });
});
