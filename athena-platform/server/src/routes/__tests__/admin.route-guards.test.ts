/**
 * Every administrator route refuses everyone who is not one, proved rather than
 * assumed.
 *
 * The admin routers guard each route by convention: nine of them spell
 * `[authenticate, requireRole('ADMIN')]` in front of every handler, and a tenth
 * puts the same guard on the whole router. Nothing failed if a new route forgot
 * it, and because the routers are mounted in front of one another (index.ts), a
 * route that forgot it would simply have been open: to anyone signed in, or, if
 * it forgot `authenticate` as well, to anyone at all. (src/__tests__/
 * route-auth-coverage.test.ts proves the second half for the whole API; this is
 * the first half, for the console.)
 *
 * This walks the router the app really mounts and sends every route under
 * /api/admin three callers, one at a time, against the real middleware. The
 * only thing standing in for the session is a stand-in for `authenticate` that
 * believes the role a test header names, since a real one needs a database.
 *
 *   - a member (role USER) must be turned away with 403;
 *   - a moderator must be turned away with 403 everywhere except the two
 *     prefixes the moderation queue lives under (admin.routes.ts,
 *     MODERATOR_PREFIXES);
 *   - an administrator with no second factor must be turned away with the
 *     TWO_FACTOR_REQUIRED refusal, because the role check and the second factor
 *     are one gate (middleware/roles.ts), and a route guarded some other way
 *     would skip it.
 *
 * Nothing here calls a handler on purpose: a route that is guarded never lets
 * the request reach one, and a route that is not guarded is reported by the
 * status it answers, whatever it does with the request.
 */

import http from 'http';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';

// The limiter in front of /api counts every call, and this test makes a few
// hundred from one address.
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.STAFF_TWO_FACTOR_REQUIRED = 'true';

jest.mock('../../utils/prisma', () => {
  // Every model, every method: answers nothing. A guarded route never asks.
  const method = () => jest.fn(async () => null);
  const model = new Proxy({}, { get: () => method() });
  const prisma = new Proxy({}, { get: (_target, name) => (String(name).startsWith('$') ? method() : model) });
  return { prisma };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    // Believes the role the test says; nobody at all is a 401. The second factor
    // is on unless the test says it is not, which is what lets an administrator
    // through the role gate in the one case a test needs it to.
    authenticate: (req: any, res: any, next: any) => {
      const role = req.headers['x-test-role'];
      if (!role) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      req.user = {
        id: 'u-guard-test',
        email: 'guard-test@athena.test',
        role: String(role),
        twoFactorEnabled: req.headers['x-test-two-factor'] !== 'off',
      };
      next();
    },
  };
});

import { app } from '../../index';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const METHODS: Method[] = ['get', 'post', 'put', 'patch', 'delete'];

interface MountedRoute {
  method: Method;
  /** The path as registered, with its :params, joined to every mount in front of it. */
  path: string;
}

/** `^\/api\/admin\/?(?=\/|$)` -> `/api/admin`. Anything it cannot read is an error, not a guess. */
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

function routePaths(route: any): string[] {
  const paths = Array.isArray(route.path) ? route.path : [route.path];
  for (const path of paths) {
    if (typeof path !== 'string') {
      throw new Error(`The router walker only reads string route paths, found ${String(path)}`);
    }
  }
  return paths;
}

/** The same walk src/__tests__/route-auth-coverage.test.ts makes: every route, with its mounts in front of it. */
function walk(stack: any[], prefix: string, out: MountedRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      for (const path of routePaths(layer.route)) {
        const joined = `${prefix}${path === '/' ? '' : path}` || '/';
        for (const method of METHODS) {
          if (layer.route.methods[method]) out.push({ method, path: joined });
        }
        if (layer.route.methods._all) out.push({ method: 'get', path: joined });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, out);
    }
  }
}

/** A concrete URL for a route: every :param filled with something that matches any pattern a param carries. */
function concretePath(path: string, value: string): string {
  return path.replace(/:[A-Za-z0-9_]+(\([^)]*\))?\??/g, value);
}

const UUID = '00000000-0000-4000-8000-000000000000';

type Caller = { role?: string; twoFactor?: 'on' | 'off' };

/** What a route answers one caller, trying a second value for a param that insists on digits. */
async function answerTo(server: http.Server, route: MountedRoute, caller: Caller) {
  const send = (value: string) => {
    let call = request(server)[route.method](concretePath(route.path, value));
    if (caller.role) call = call.set('x-test-role', caller.role);
    if (caller.twoFactor === 'off') call = call.set('x-test-two-factor', 'off');
    return call;
  };
  let res = await send(UUID);
  if (res.status === 404 && /Endpoint not found/.test(res.body?.message ?? '')) res = await send('1');
  return res;
}

const keyOf = (route: MountedRoute) => `${route.method.toUpperCase()} ${route.path}`;

/**
 * The routes that answered something other than what the caller was owed, one
 * line each, naming what they answered instead.
 */
async function unguarded(
  server: http.Server,
  routes: MountedRoute[],
  caller: Caller,
  refused: (res: request.Response) => boolean,
  skip: (route: MountedRoute) => boolean = () => false
): Promise<string[]> {
  const open: string[] = [];
  for (const route of routes) {
    if (skip(route)) continue;
    const res = await answerTo(server, route, caller);
    if (!refused(res)) open.push(`${keyOf(route)} answered ${res.status}`);
  }
  return open;
}

const SEED_PREFIX = '/api/admin/seed';
// The two prefixes admin.routes.ts lets a moderator reach (MODERATOR_PREFIXES).
const MODERATOR_PREFIXES = ['/api/admin/moderation', '/api/admin/content'];

const isSeed = (route: MountedRoute) => route.path === SEED_PREFIX || route.path.startsWith(`${SEED_PREFIX}/`);
const isModeratorRoute = (route: MountedRoute) =>
  MODERATOR_PREFIXES.some((prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`));

describe('every administrator route refuses a caller who is not one', () => {
  const routes: MountedRoute[] = [];
  let server: http.Server;

  beforeAll(async () => {
    const all: MountedRoute[] = [];
    walk((app as any)._router.stack, '', all);
    routes.push(...all.filter((route) => route.path === '/api/admin' || route.path.startsWith('/api/admin/')));
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('finds the whole console, so a walker that silently breaks cannot pass', () => {
    expect(routes.length).toBeGreaterThan(150);
    const keys = new Set(routes.map(keyOf));
    for (const known of ['GET /api/admin/stats', 'GET /api/admin/users', 'GET /api/admin/seed/status']) {
      expect(keys.has(known)).toBe(true);
    }
    // At least one route from each of the routers that guard route by route.
    for (const prefix of ['/api/admin/marketing', '/api/admin/blog']) {
      expect(routes.some((route) => route.path.startsWith(prefix))).toBe(true);
    }
  });

  it('turns a signed-in member away from every one with a 403', async () => {
    const open = await unguarded(server, routes, { role: 'USER' }, (res) => res.status === 403, isSeed);
    // Every line here is a route a plain member got through. Guard it with
    // `[authenticate, requireRole('ADMIN')]`, as its neighbours are.
    expect(open).toEqual([]);
  }, 300_000);

  it('turns a moderator away from everything but the moderation queue', async () => {
    const open = await unguarded(
      server,
      routes,
      { role: 'MODERATOR' },
      (res) => res.status === 403,
      (route) => isSeed(route) || isModeratorRoute(route)
    );
    // A moderator works reports and content (MODERATOR_PREFIXES in
    // admin.routes.ts). Users, billing, settings and compliance are the
    // administrator's alone.
    expect(open).toEqual([]);
  }, 300_000);

  it('turns an administrator with no second factor away from every one, with the refusal that sends her to set it up', async () => {
    const open = await unguarded(
      server,
      routes,
      { role: 'ADMIN', twoFactor: 'off' },
      (res) => res.status === 403 && res.body?.code === 'TWO_FACTOR_REQUIRED',
      isSeed
    );
    // The role check and the second factor are one gate (middleware/roles.ts);
    // a route guarded some other way does not ask for it.
    expect(open).toEqual([]);
  }, 300_000);

  it('answers every seed route with 404 for everyone, an administrator included, while seeding is off', async () => {
    const seed = routes.filter(isSeed);
    expect(seed.length).toBeGreaterThan(0);

    for (const caller of [{}, { role: 'USER' }, { role: 'ADMIN' }] as Caller[]) {
      const open = await unguarded(server, seed, caller, (res) => res.status === 404);
      expect(open).toEqual([]);
    }
  });

  it('would say so if a route were left open: the probe reports an unguarded route', async () => {
    // The same probe, against a router that forgot its guard on one route.
    const forgetful = express();
    const guard = (req: any, res: any, next: any) => (req.headers['x-test-role'] === 'ADMIN' ? next() : res.status(403).json({}));
    forgetful.get('/api/admin/guarded', guard, (_req, res) => res.json({ ok: true }));
    forgetful.get('/api/admin/forgotten', (_req, res) => res.json({ ok: true }));
    const stand = http.createServer(forgetful);
    await new Promise<void>((resolve) => stand.listen(0, '127.0.0.1', resolve));
    try {
      const found: MountedRoute[] = [];
      walk((forgetful as any)._router.stack, '', found);
      expect(found.map(keyOf)).toEqual(['GET /api/admin/guarded', 'GET /api/admin/forgotten']);

      const open = await unguarded(stand, found, { role: 'USER' }, (res) => res.status === 403);
      expect(open).toEqual(['GET /api/admin/forgotten answered 200']);
    } finally {
      await new Promise<void>((resolve) => stand.close(() => resolve()));
    }
  });
});
