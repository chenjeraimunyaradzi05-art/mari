/**
 * Crashes the phone reports about itself.
 *
 * The web and this API both send their crashes to Sentry; the mobile app had
 * nothing. Its error boundary caught a render crash and wrote it to the
 * console of a phone nobody was looking at, so a crash in a store build
 * reached no one. Adding a native crash SDK is a build-pipeline decision (a
 * config plugin, a DSN per build profile, symbol upload), so the app sends
 * what its JavaScript can see — the message, the stack, the component stack
 * for a render crash — to POST /api/client-errors, and this turns that into
 * an error-level log line and, where Sentry is configured, a Sentry event
 * beside the server's own.
 *
 * What is kept is deliberately small. The endpoint takes no identity: a
 * report arrives the same whether anyone is signed in or not, and nothing
 * here asks who she is. Every field is length-capped, because an error
 * message can carry whatever the code was holding when it threw, and a crash
 * report is not a place to keep a member's words.
 */

import { logger } from './logger';
import { captureClientCrash } from './sentry';

export const CLIENT_CRASH_KINDS = ['render', 'fatal', 'error'] as const;
export type ClientCrashKind = (typeof CLIENT_CRASH_KINDS)[number];

export interface ClientCrashReport {
  source: 'mobile';
  kind: ClientCrashKind;
  message: string;
  stack?: string;
  componentStack?: string;
  platform?: string;
  appVersion?: string;
  occurredAt?: string;
}

const LIMITS = {
  message: 500,
  stack: 4000,
  componentStack: 2000,
  short: 40,
} as const;

function capped(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** A short token such as "ios" or "1.2.0"; anything else is dropped rather than stored. */
function token(value: unknown): string | undefined {
  const text = capped(value, LIMITS.short);
  return text && /^[\w.+-]+$/.test(text) ? text : undefined;
}

/** The report the body describes, or null when it does not describe one. */
export function parseClientCrashReport(body: unknown): ClientCrashReport | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;

  const message = capped(input.message, LIMITS.message);
  if (!message) return null;

  const kind = CLIENT_CRASH_KINDS.includes(input.kind as ClientCrashKind) ? (input.kind as ClientCrashKind) : 'error';
  const occurredAt = typeof input.occurredAt === 'string' && !Number.isNaN(Date.parse(input.occurredAt)) ? new Date(input.occurredAt).toISOString() : undefined;

  const report: ClientCrashReport = { source: 'mobile', kind, message };
  const stack = capped(input.stack, LIMITS.stack);
  const componentStack = capped(input.componentStack, LIMITS.componentStack);
  const platform = token(input.platform);
  const appVersion = token(input.appVersion);
  if (stack) report.stack = stack;
  if (componentStack) report.componentStack = componentStack;
  if (platform) report.platform = platform;
  if (appVersion) report.appVersion = appVersion;
  if (occurredAt) report.occurredAt = occurredAt;
  return report;
}

/** Logs the crash where every server error goes, and hands it to Sentry when Sentry is configured. */
export function recordClientCrash(report: ClientCrashReport, requestId?: string): void {
  logger.error('Mobile app crash reported', {
    requestId,
    kind: report.kind,
    crashMessage: report.message,
    platform: report.platform,
    appVersion: report.appVersion,
    occurredAt: report.occurredAt,
    stack: report.stack,
    componentStack: report.componentStack,
  });
  captureClientCrash(report);
}
