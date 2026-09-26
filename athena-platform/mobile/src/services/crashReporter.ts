/**
 * Getting a crash off the phone.
 *
 * The error boundary in App.tsx caught render crashes and wrote them to the
 * console, with a comment saying there was no crash reporter — which on a
 * store build means a crash reached nobody. The web and the API both report
 * to Sentry. A native crash SDK here is a build-pipeline change (a config
 * plugin, a DSN per build profile, source-map upload) that cannot be checked
 * from this repository, so the app reports what its JavaScript can see to the
 * API's POST /client-errors, and the API logs it and forwards it to Sentry.
 * Native crashes, the kind that kill the process below JavaScript, are still
 * not reported; that is what the SDK would add.
 *
 * Three things about how it sends:
 *
 *  - It uses fetch, not the app's axios instance. That instance refreshes an
 *    expired session and, when it cannot, signs the member out. A crash report
 *    must never be the thing that signs her out, and it must still go when the
 *    session is what broke.
 *  - It writes the report down before it sends it. A fatal error ends the
 *    process moments after the handler runs, and a report that only existed
 *    in memory would die with it; the next launch sends whatever is waiting.
 *  - It sends no identity. The server does not ask for one and would drop it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

export type CrashKind = 'render' | 'fatal' | 'error';

export interface CrashReport {
  kind: CrashKind;
  message: string;
  stack?: string;
  componentStack?: string;
  platform: string;
  appVersion?: string;
  occurredAt: string;
}

export const PENDING_CRASHES_KEY = 'athena_pending_crash_reports';
/** A crash loop must not grow this without bound; the newest few say enough. */
const MAX_PENDING = 5;
const SEND_TIMEOUT_MS = 8_000;

function endpoint(): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/+$/, '');
  return `${base}/client-errors`;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'An error with no message';
}

export function buildCrashReport(error: unknown, kind: CrashKind, componentStack?: string | null): CrashReport {
  const report: CrashReport = {
    kind,
    message: messageOf(error).slice(0, 500),
    platform: Platform.OS,
    occurredAt: new Date().toISOString(),
  };
  const stack = error instanceof Error ? error.stack : undefined;
  if (stack) report.stack = stack.slice(0, 4000);
  if (componentStack) report.componentStack = componentStack.slice(0, 2000);
  const version = Constants.expoConfig?.version;
  if (typeof version === 'string' && version) report.appVersion = version;
  return report;
}

async function readPending(): Promise<CrashReport[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CRASHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrashReport[]) : [];
  } catch {
    return [];
  }
}

async function writePending(reports: CrashReport[]): Promise<void> {
  try {
    if (reports.length === 0) await AsyncStorage.removeItem(PENDING_CRASHES_KEY);
    else await AsyncStorage.setItem(PENDING_CRASHES_KEY, JSON.stringify(reports.slice(-MAX_PENDING)));
  } catch {
    // Storage refusing is not worth a second crash; the send below still runs.
  }
}

async function send(report: CrashReport): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(report),
      signal: controller.signal,
    });
    // A 4xx is the server's judgement of this report and will not change on
    // a retry, so it counts as delivered; only a failure to reach the server
    // or a 5xx is worth keeping for the next launch.
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// One flush at a time, so two crashes in quick succession do not send the
// same waiting report twice.
let flushing: Promise<void> | null = null;

/** Sends every report still waiting. Never rejects. */
export function flushCrashReports(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const pending = await readPending();
    if (pending.length === 0) return;
    const unsent: CrashReport[] = [];
    for (const report of pending) {
      if (!(await send(report))) unsent.push(report);
    }
    await writePending(unsent);
  })()
    .catch(() => undefined)
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

/** Records a crash and tries to send it at once. Never rejects. */
export async function reportCrash(error: unknown, kind: CrashKind, componentStack?: string | null): Promise<void> {
  try {
    const report = buildCrashReport(error, kind, componentStack);
    const pending = await readPending();
    await writePending([...pending, report]);
    await flushCrashReports();
  } catch {
    // Reporting a crash must never be the next crash.
  }
}

/**
 * Routes errors nothing else caught — thrown in a handler, a timer, a
 * rejected promise React Native surfaces as fatal — through reportCrash, and
 * then on to whatever handled them before, so the red screen in development
 * and the platform's own crash handling are unchanged. Returns a function
 * that puts the previous handler back.
 */
type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler(): GlobalErrorHandler | undefined;
  setGlobalHandler(handler: GlobalErrorHandler): void;
};

export function installGlobalCrashHandler(): () => void {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils) return () => undefined;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    void reportCrash(error, isFatal ? 'fatal' : 'error');
    previous?.(error, isFatal);
  });
  return () => {
    if (previous) utils.setGlobalHandler(previous);
  };
}
