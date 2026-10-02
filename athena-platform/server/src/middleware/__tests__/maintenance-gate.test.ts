import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * While the platform is closed, a member in danger must still reach the safety
 * tooling. The gate used to open only the operators' paths, so the panic
 * button, Safe Mode, hidden chats, emergency-contact alerts and the crisis
 * lines all answered 503 for as long as maintenance was on — and the launch
 * and rollback runbooks both close the platform.
 *
 * The first half drives the gate on a small app so each path is asserted on
 * its own. The second half drives the real app, because a gate that is correct
 * and mounted after the router it should guard (or not mounted at all) would
 * pass the first half and protect nothing.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    article: { findMany: jest.fn(async () => []) },
    dVSupportService: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const closed = {
  enabled: true,
  message: 'ATHENA is being updated.',
  startedAt: '2026-10-01T01:00:00.000Z',
  endsAt: null as string | null,
  updatedBy: 'ops',
  updatedAt: '2026-10-01T01:00:00.000Z',
};
const open = { ...closed, enabled: false };

const mockGetMaintenanceState = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../services/feature-flags.service', () => ({
  ...(jest.requireActual('../../services/feature-flags.service') as object),
  getMaintenanceState: (...args: any[]) => mockGetMaintenanceState(...args),
}));

import { isMaintenanceOpenPath, maintenanceGate, MAINTENANCE_OPEN_PATHS } from '../maintenance-gate';

/** A tiny app whose every route answers 200 "reached", so a 503 can only come from the gate. */
function gatedApp(state: typeof closed) {
  const app = express();
  app.use('/api', maintenanceGate(async () => state));
  app.use('/api', (_req, res) => res.status(200).json({ reached: true }));
  return app;
}

describe('the maintenance gate', () => {
  it('lets the operators in and the client find out why', async () => {
    const app = gatedApp(closed);
    for (const path of ['/api/auth/login', '/api/auth/refresh', '/api/auth/me', '/api/maintenance', '/api/feature-flags/active', '/api/admin/feature-flags']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
    }
  });

  it('keeps every safety endpoint a member in danger might need reachable', async () => {
    const app = gatedApp(closed);
    const reachable: Array<['get' | 'post' | 'put' | 'delete', string]> = [
      ['post', '/api/safety/dv/panic'],
      ['post', '/api/safety/dv/safe-mode'],
      ['get', '/api/safety/dv/settings'],
      ['put', '/api/safety/dv/settings'],
      ['post', '/api/safety/dv/emergency-contacts'],
      ['delete', '/api/safety/dv/emergency-contacts/abc'],
      ['get', '/api/safety/dv/chats'],
      ['post', '/api/safety/dv/chats/abc/access'],
      ['post', '/api/safety/dv/block/someone'],
      ['post', '/api/safety/dv/clear-traces'],
      ['get', '/api/safety/dv/resources'],
      ['get', '/api/safety/settings'],
      ['get', '/api/safety/blocks'],
      ['post', '/api/safety/blocks'],
      ['get', '/api/wellness/reference'],
      ['get', '/api/wellness/library'],
    ];
    for (const [method, path] of reachable) {
      const res = await request(app)[method](path);
      expect({ path, status: res.status }).toEqual({ path, status: 200 });
    }
  });

  it('still closes everything else with a 503, a Retry-After and the maintenance body', async () => {
    const app = gatedApp(closed);
    for (const path of ['/api/jobs', '/api/posts', '/api/payments/checkout', '/api/housing/listings', '/api/safety/moderation/flags', '/api/wellness/entries']) {
      const res = await request(app).get(path);
      expect({ path, status: res.status }).toEqual({ path, status: 503 });
    }
    const res = await request(app).get('/api/jobs');
    expect(res.headers['retry-after']).toBe('60');
    expect(res.body.success).toBe(false);
    expect(res.body.maintenance).toMatchObject({ enabled: true, message: 'ATHENA is being updated.' });
  });

  it('does not open a path merely because it starts with an open one', async () => {
    // '/safety/dv' must not open '/safety/dvx', nor '/safety/settingsfoo'.
    expect(isMaintenanceOpenPath('/safety/dv')).toBe(true);
    expect(isMaintenanceOpenPath('/safety/dv/panic')).toBe(true);
    expect(isMaintenanceOpenPath('/safety/dvx')).toBe(false);
    expect(isMaintenanceOpenPath('/safety/settingsfoo')).toBe(false);
    expect(isMaintenanceOpenPath('/wellness/library-admin')).toBe(false);
    expect(isMaintenanceOpenPath('/safety')).toBe(false);
  });

  it('keeps reports and staff moderation behind the gate on purpose', () => {
    expect(isMaintenanceOpenPath('/safety/reports')).toBe(false);
    expect(isMaintenanceOpenPath('/safety/moderation/flags')).toBe(false);
  });

  it('is a no-op when the platform is open', async () => {
    const res = await request(gatedApp(open)).get('/api/jobs');
    expect(res.status).toBe(200);
  });

  it('asks clients back after the announced end time, never sooner than 30 seconds', async () => {
    const soon = { ...closed, endsAt: new Date(Date.now() + 5_000).toISOString() };
    const later = { ...closed, endsAt: new Date(Date.now() + 600_000).toISOString() };
    const a = await request(gatedApp(soon)).get('/api/jobs');
    expect(a.headers['retry-after']).toBe('30');
    const b = await request(gatedApp(later)).get('/api/jobs');
    expect(Number(b.headers['retry-after'])).toBeGreaterThan(500);
  });

  it('lists the safety paths in one place', () => {
    expect(MAINTENANCE_OPEN_PATHS).toEqual(expect.arrayContaining(['/safety/dv', '/safety/settings', '/safety/blocks', '/wellness/reference', '/wellness/library']));
  });
});

describe('the maintenance gate on the real app', () => {
  beforeEach(() => {
    mockGetMaintenanceState.mockReset();
    mockGetMaintenanceState.mockResolvedValue(closed);
  });

  it('closes /api/jobs but still serves the public support lines and crisis lines', async () => {
    const { app } = await import('../../index');

    const jobs = await request(app).get('/api/jobs');
    expect(jobs.status).toBe(503);
    expect(jobs.headers['retry-after']).toBeDefined();

    const resources = await request(app).get('/api/safety/dv/resources');
    expect(resources.status).toBe(200);
    expect(JSON.stringify(resources.body)).toContain('1800');

    const library = await request(app).get('/api/wellness/library');
    expect(library.status).toBe(200);
    expect(library.body.data.crisisLines.length).toBeGreaterThan(0);
  });

  it('refuses the panic button an anonymous caller with 401, not 503', async () => {
    const { app } = await import('../../index');
    const res = await request(app).post('/api/safety/dv/panic').send({});
    // 401 is the route's own answer: the gate let the request through to the
    // handler. A 503 here would mean the member never got as far as the panic
    // handler during maintenance.
    expect(res.status).toBe(401);
  });
});
