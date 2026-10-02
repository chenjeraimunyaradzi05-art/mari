/**
 * The maintenance gate: while the platform is closed, every /api path but the
 * ones below answers 503.
 *
 * It used to live inline in index.ts with a list that covered only what the
 * operators needed (sign in, turn it off again, find out why the client is
 * being refused). That list closed the safety tooling too: the panic button,
 * Safe Mode, hidden chats, emergency-contact alerts and the crisis lines all
 * answered 503 for as long as maintenance was on, and the launch and rollback
 * runbooks both close the platform. A member in danger does not stop being in
 * danger because ATHENA is being deployed, so what she reaches for in a hurry
 * is on the open list too.
 *
 * It is a module of its own, not a block in index.ts, so a test can drive it
 * without booting the whole app and so the list is one thing a reviewer can
 * read and argue with.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getMaintenanceState } from '../services/feature-flags.service';

/**
 * Paths that stay open while the platform is closed. A path is open when it
 * equals an entry or sits beneath it (`/safety/dv` opens `/safety/dv/panic`).
 *
 * Operators: they have to be able to sign in and turn maintenance back off,
 * and the client has to be able to find out why it is being refused.
 *
 * Safety: everything under /safety/dv (Safe Mode, the panic button, emergency
 * contacts, hidden chats, the visibility and block controls, the clear-traces
 * call and the support-line list), her safety settings and her block list, and
 * the public crisis-line lists that the wellness pages serve. None of these is
 * a feature she can wait for.
 *
 * Left behind the gate on purpose: reports and the staff moderation queue
 * (/safety/reports, /safety/moderation). A report is not minutes-critical, and
 * moderation is staff work that can wait for the platform to reopen; if on-call
 * ever needs it during an incident, add the path here rather than turning the
 * gate off.
 */
export const MAINTENANCE_OPEN_PATHS = [
  '/admin',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/me',
  '/feature-flags/active',
  '/maintenance',
  '/safety/dv',
  '/safety/settings',
  '/safety/blocks',
  '/wellness/reference',
  '/wellness/library',
] as const;

/** Whether a path (relative to /api) stays reachable during maintenance. */
export function isMaintenanceOpenPath(path: string): boolean {
  return MAINTENANCE_OPEN_PATHS.some((open) => path === open || path.startsWith(open + '/'));
}

type MaintenanceStateReader = typeof getMaintenanceState;

/**
 * Mounted on /api only, and after the webhook router: Stripe retries a rejected
 * webhook for days, so dropping payment events during a ten-minute deploy would
 * cost more than it saves.
 *
 * `readState` is a parameter so a test can hand it a state; production passes
 * nothing and gets the cached feature-flag read.
 */
export function maintenanceGate(readState: MaintenanceStateReader = getMaintenanceState): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await readState();
      if (!state.enabled) return next();

      if (isMaintenanceOpenPath(req.path)) return next();

      // Retry-After is in seconds and has to be an integer; without an announced
      // end time, ask clients back in a minute rather than in a tight loop.
      const retryAfterSeconds = state.endsAt
        ? Math.max(30, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000))
        : 60;

      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(503).json({
        success: false,
        message: state.message,
        maintenance: {
          enabled: true,
          message: state.message,
          startedAt: state.startedAt,
          endsAt: state.endsAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
