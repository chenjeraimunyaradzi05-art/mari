/**
 * Deny by default, proved rather than assumed.
 *
 * `authenticate` is applied route by route, not once at the door, so nothing
 * stopped a handler registered without it from reading or writing a member's
 * data to anyone who asked. The audit read the 1,185 handlers by hand and found
 * every unguarded one was a catalogue, a calculator, a sign-in step, a webhook
 * or a probe; this is the test that keeps that true for the next route.
 *
 * It walks the router the app really mounts (not a list kept beside it), and
 * sends every route that is not named in src/config/public-routes.ts an
 * anonymous request. Each must answer 401. A route that answers anything else
 * is either open to the world, in which case it has to be written down with
 * its reason, or guarded in a way that lets an anonymous caller through.
 *
 * The routes on the public list are not called: they are the ones that run
 * real handlers against whatever is behind them.
 */

import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';

// The limiter in front of /api counts every call, and this test makes about a
// thousand from one address.
process.env.RATE_LIMIT_ENABLED = 'false';

jest.mock('../utils/prisma', () => {
  // Every model, every method: answers nothing. Only the app-wide middleware
  // can reach it here, since a route that asks a question of the database has
  // already been refused by authenticate.
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
import { authenticate } from '../middleware/auth';
import { PUBLIC_ROUTES, publicRouteKey } from '../config/public-routes';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface MountedRoute {
  method: Method;
  /** The path as registered, with its :params, joined to every mount in front of it. */
  path: string;
  /** True when `authenticate` sits in front of the handler: on the route or in an earlier router.use. */
  carriesAuthenticate: boolean;
}

const METHODS: Method[] = ['get', 'post', 'put', 'patch', 'delete'];

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

function routePaths(route: any): string[] {
  const paths = Array.isArray(route.path) ? route.path : [route.path];
  for (const path of paths) {
    if (typeof path !== 'string') {
      throw new Error(`The router walker only reads string route paths, found ${String(path)}`);
    }
  }
  return paths;
}

function walk(stack: any[], prefix: string, inheritedAuth: boolean, out: MountedRoute[]): void {
  // `router.use(authenticate)` guards what is registered after it, in that
  // router only, so the flag is carried forward in registration order.
  let guarded = inheritedAuth;
  for (const layer of stack) {
    if (layer.route) {
      const handlers: unknown[] = layer.route.stack.map((entry: any) => entry.handle);
      const carriesAuthenticate = guarded || handlers.includes(authenticate);
      for (const path of routePaths(layer.route)) {
        const joined = `${prefix}${path === '/' ? '' : path}` || '/';
        for (const method of METHODS) {
          if (layer.route.methods[method]) out.push({ method, path: joined, carriesAuthenticate });
        }
        // router.all(): any verb reaches it, so one probe stands for the rest.
        if (layer.route.methods._all) out.push({ method: 'get', path: joined, carriesAuthenticate });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, guarded, out);
    } else if (layer.handle === authenticate) {
      guarded = true;
    }
  }
}

/** A concrete URL for a route: every :param filled with something that matches any pattern a param carries. */
function concretePath(path: string, value: string): string {
  return path.replace(/:[A-Za-z0-9_]+(\([^)]*\))?\??/g, value);
}

const UUID = '00000000-0000-4000-8000-000000000000';

describe('every route refuses an anonymous caller unless it is on the public list', () => {
  const routes: MountedRoute[] = [];
  let server: http.Server;

  beforeAll(async () => {
    walk((app as any)._router.stack, '', false, routes);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const publicKeys = new Set(PUBLIC_ROUTES.map(publicRouteKey));
  const keyOf = (route: MountedRoute) => publicRouteKey({ method: route.method.toUpperCase(), path: route.path });

  it('finds the whole API, so a walker that silently breaks cannot pass', () => {
    expect(routes.length).toBeGreaterThan(900);
    const keys = new Set(routes.map(keyOf));
    for (const known of [
      'POST /api/auth/login',
      'PATCH /api/users/me/profile',
      'POST /api/messages/conversations',
      'GET /api/admin/users',
    ]) {
      expect(keys.has(known)).toBe(true);
    }
  });

  it('answers 401 to an anonymous call on every route that is not public', async () => {
    const open: string[] = [];
    let probed = 0;

    for (const route of routes) {
      if (publicKeys.has(keyOf(route))) continue;
      probed += 1;

      let res = await request(server)[route.method](concretePath(route.path, UUID));
      // A path pattern that insists on digits does not match a UUID: try again
      // before calling it a miss.
      if (res.status === 404 && /Endpoint not found/.test(res.body?.message ?? '')) {
        res = await request(server)[route.method](concretePath(route.path, '1'));
      }
      if (res.status !== 401) open.push(`${keyOf(route)} answered ${res.status}`);
    }

    expect(probed).toBeGreaterThan(500);
    // Every line here is a route an anonymous caller got past. Guard it with
    // authenticate, or, if it is meant to be open, add it to PUBLIC_ROUTES in
    // src/config/public-routes.ts with the reason.
    expect(open).toEqual([]);
  }, 300_000);

  it('lists no public route that no longer exists', () => {
    const real = new Set(routes.map(keyOf));
    const gone = PUBLIC_ROUTES.map(publicRouteKey).filter((key) => !real.has(key));
    expect(gone).toEqual([]);
  });

  it('lists no public route that now carries authenticate, so the list cannot go stale', () => {
    const guarded = routes.filter((route) => route.carriesAuthenticate && publicKeys.has(keyOf(route)));
    expect(guarded.map(keyOf)).toEqual([]);
  });

  it('gives every public route a reason and lists none twice', () => {
    for (const entry of PUBLIC_ROUTES) {
      expect(entry.reason.trim().length).toBeGreaterThan(15);
    }
    const keys = PUBLIC_ROUTES.map(publicRouteKey);
    expect(keys.length).toBe(new Set(keys).size);
  });
});
