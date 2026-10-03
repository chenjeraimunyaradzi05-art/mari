/**
 * No member write escapes the account-standing check.
 *
 * The women-only and minimum-age promises are enforced once, inside
 * `authenticate` (middleware/account-standing.ts), so that a route written
 * tomorrow is covered the day it is mounted instead of the day somebody
 * remembers to ask. That holds for every route behind `authenticate`. It does
 * not hold for a write that reads the member from `optionalAuth`: there the
 * handler sees a signed-in member, `authenticate` never runs, and a member a
 * reviewer has refused, or whose date of birth is under the minimum, acts as
 * a member in good standing.
 *
 * This walks the router the app really mounts, as route-auth-coverage.test.ts
 * does, and fails on a POST, PUT, PATCH or DELETE that is neither behind
 * `authenticate`, nor open to the world on purpose (src/config/public-routes.ts),
 * nor named below with the reason it is safe. Adding a route to the list
 * below is a decision somebody can argue with in review, which is the point:
 * the alternative was a gate that quietly stopped covering a new router.
 */

import http from 'http';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';

process.env.RATE_LIMIT_ENABLED = 'false';

jest.mock('../utils/prisma', () => {
  const method = () => jest.fn(async () => null);
  const model = new Proxy({}, { get: () => method() });
  const prisma = new Proxy({}, { get: (_target, name) => (String(name).startsWith('$') ? method() : model) });
  return { prisma };
});

jest.mock('../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../index';
import { authenticate, optionalAuth } from '../middleware/auth';
import { PUBLIC_ROUTES, publicRouteKey } from '../config/public-routes';
import { STANDING_EXEMPT_OPTIONAL_AUTH_WRITES } from '../config/woman-gate-policy';

type Method = 'post' | 'put' | 'patch' | 'delete';
const WRITE_METHODS: Method[] = ['post', 'put', 'patch', 'delete'];

interface MountedWrite {
  method: Method;
  path: string;
  carriesAuthenticate: boolean;
  carriesOptionalAuth: boolean;
}

/** `^\/api\/auth\/?(?=\/|$)` -> `/api/auth`. Anything it cannot read is an error, not a guess. */
function mountPath(layer: any): string {
  if (layer.regexp?.fast_slash) return '';
  let source: string = layer.regexp.source;
  source = source.replace(/^\^/, '').replace(/\\\/\?\(\?=\\\/\|\$\)$/, '');
  const keys: Array<{ name: string }> = layer.keys ?? [];
  for (const key of keys) source = source.replace('(?:([^\\/]+?))', `:${key.name}`);
  source = source.replace(/\\\//g, '/');
  if (/[\\()[\]?*+^$|]/.test(source)) {
    throw new Error(`The router walker cannot read the mount path ${layer.regexp.source}`);
  }
  return source;
}

function walk(stack: any[], prefix: string, inherited: { auth: boolean; optional: boolean }, out: MountedWrite[]): void {
  // `router.use(authenticate)` guards what is registered after it, in that
  // router only, so the flags are carried forward in registration order.
  const carried = { ...inherited };
  for (const layer of stack) {
    if (layer.route) {
      const handlers: unknown[] = layer.route.stack.map((entry: any) => entry.handle);
      const paths: unknown[] = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const path of paths) {
        if (typeof path !== 'string') throw new Error(`The router walker only reads string route paths, found ${String(path)}`);
        const joined = `${prefix}${path === '/' ? '' : path}` || '/';
        for (const method of WRITE_METHODS) {
          if (!layer.route.methods[method]) continue;
          out.push({
            method,
            path: joined,
            carriesAuthenticate: carried.auth || handlers.includes(authenticate),
            carriesOptionalAuth: carried.optional || handlers.includes(optionalAuth),
          });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, carried, out);
    } else if (layer.handle === authenticate) {
      carried.auth = true;
    } else if (layer.handle === optionalAuth) {
      carried.optional = true;
    }
  }
}

describe('every member write passes the account-standing check or says why not', () => {
  const writes: MountedWrite[] = [];
  let server: http.Server;

  beforeAll(async () => {
    walk((app as any)._router.stack, '', { auth: false, optional: false }, writes);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const keyOf = (route: { method: string; path: string }) => publicRouteKey({ method: route.method.toUpperCase(), path: route.path });
  const publicKeys = new Set(PUBLIC_ROUTES.map(publicRouteKey));

  it('finds the whole API, so a walker that silently breaks cannot pass', () => {
    expect(writes.length).toBeGreaterThan(400);
    const keys = new Set(writes.map(keyOf));
    for (const known of ['POST /api/auth/login', 'PATCH /api/users/me/profile', 'POST /api/messages/conversations']) {
      expect(keys.has(known)).toBe(true);
    }
  });

  it('has no write that reads a signed-in member from optionalAuth without being named here', () => {
    const exempt = new Set(STANDING_EXEMPT_OPTIONAL_AUTH_WRITES.map((entry) => entry.route));
    const unnamed = writes
      .filter((route) => !route.carriesAuthenticate && route.carriesOptionalAuth)
      .filter((route) => !publicKeys.has(keyOf(route)))
      .map(keyOf)
      .filter((key) => !exempt.has(key));

    // Every line is a write a member of any standing can make, because the
    // handler trusts optionalAuth. Put authenticate in front of it, or, if an
    // anonymous caller is meant to be able to do it, name it in
    // STANDING_EXEMPT_OPTIONAL_AUTH_WRITES (config/woman-gate-policy.ts) with the
    // reason a refused member doing it is harmless.
    expect(unnamed).toEqual([]);
  });

  it('names no route that has gone, or that now carries authenticate, so the list cannot go stale', () => {
    const byKey = new Map(writes.map((route) => [keyOf(route), route]));
    const gone = STANDING_EXEMPT_OPTIONAL_AUTH_WRITES.map((entry) => entry.route).filter((key) => !byKey.has(key));
    expect(gone).toEqual([]);

    const guarded = STANDING_EXEMPT_OPTIONAL_AUTH_WRITES.map((entry) => entry.route).filter(
      (key) => byKey.get(key)?.carriesAuthenticate
    );
    expect(guarded).toEqual([]);
  });

  it('gives every exemption a reason and lists none twice', () => {
    for (const entry of STANDING_EXEMPT_OPTIONAL_AUTH_WRITES) {
      expect(entry.reason.trim().length).toBeGreaterThan(20);
    }
    const keys = STANDING_EXEMPT_OPTIONAL_AUTH_WRITES.map((entry) => entry.route);
    expect(keys.length).toBe(new Set(keys).size);
  });
});
