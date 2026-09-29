/**
 * The admin catalogue routes, end to end through the router: adding,
 * correcting, confirming, retiring and restoring a car, the CSV out and back
 * in, and what members see as a result.
 *
 * The double below differs from the one the main automotive suite uses in two
 * ways that matter here. Its reads and writes are lazy, the way Prisma's are,
 * so an array handed to $transaction runs inside it and a failure part-way
 * puts the store back — which is what lets the suite show that a catalogue
 * change and its audit row land together or not at all. And it answers a
 * Json `path` filter by reading the path, rather than letting every row
 * through, because "last checked" is read from exactly such a filter.
 * Neither makes it Postgres; the integration project is where the real
 * database answers.
 */

import request from 'supertest';
import express from 'express';
import { randomUUID } from 'crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;
const store: { cars: Row[]; audits: Row[] } = { cars: [], audits: [] };
const failures: { auditCreate: number } = { auditCreate: 0 };
const users: Record<string, Row> = { admin: { firstName: 'Priya', lastName: 'Shah', displayName: null }, member: { firstName: 'Mei', lastName: 'Lin', displayName: null } };

jest.mock('../../../utils/prisma', () => {
  const { randomUUID } = jest.requireActual<typeof import('crypto')>('crypto');
  const value = (row: Row, path: string[]) => path.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Row)[k] : undefined), row);
  const matches = (row: Row, where: Row | undefined): boolean => !where || Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      if ('path' in v) return value(row[k] ?? {}, v.path as string[]) === v.equals;
      if ('in' in v) return (v.in as unknown[]).includes(row[k]);
      if ('not' in v) return row[k] !== v.not;
      if ('equals' in v) return String(row[k]).toLowerCase() === String(v.equals).toLowerCase();
      return true;
    }
    return row[k] === v;
  });
  /** A thenable that does nothing until awaited, like a PrismaPromise. */
  const lazy = <T>(run: () => T) => {
    let started: Promise<T> | null = null;
    const go = () => (started ??= Promise.resolve().then(run));
    return { then: <A, B>(ok?: (v: T) => A, ko?: (e: unknown) => B) => go().then(ok, ko), catch: <B>(ko: (e: unknown) => B) => go().catch(ko) };
  };
  const byWhere = (rows: Row[], where: Row) => rows.find((r) => matches(r, where)) ?? null;
  const client: Row = {
    carModel: {
      findMany: ({ where }: Row = {}) => lazy(() => store.cars.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
      findFirst: ({ where }: Row) => lazy(() => { const r = byWhere(store.cars, where); return r ? { ...r } : null; }),
      findUnique: ({ where }: Row) => lazy(() => { const r = byWhere(store.cars, where); return r ? { ...r } : null; }),
      create: ({ data }: Row) => lazy(() => {
        if (store.cars.some((r) => r.slug === data.slug)) { const { Prisma } = jest.requireActual<typeof import('@prisma/client')>('@prisma/client'); throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`slug`)', { code: 'P2002', clientVersion: 'test' }); }
        const row = { ratingAvg: 0, ratingCount: 0, reliabilityAvg: 0, co2GramsKm: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        store.cars.push(row);
        return { ...row };
      }),
      update: ({ where, data }: Row) => lazy(() => {
        const row = byWhere(store.cars, where);
        if (!row) throw new Error('not found');
        for (const [k, v] of Object.entries(data as Row)) if (v !== undefined) row[k] = v;
        row.updatedAt = new Date();
        return { ...row };
      }),
    },
    auditLog: {
      create: ({ data }: Row) => lazy(() => {
        if (failures.auditCreate > 0) { failures.auditCreate -= 1; throw new Error('audit insert failed'); }
        const row = { id: randomUUID(), createdAt: new Date(Date.now() + store.audits.length), ...data };
        store.audits.push(row);
        return row;
      }),
      findMany: ({ where, take }: Row) => lazy(() => store.audits
        .filter((r) => matches(r, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take)
        .map((r) => ({ ...r, actorUser: r.actorUserId ? users[r.actorUserId] ?? null : null }))),
    },
  };
  /** All or nothing: the store is put back if any write in the array fails. */
  client.$transaction = async (ops: Array<PromiseLike<unknown>>) => {
    const snapshot = { cars: store.cars.map((r) => ({ ...r })), audits: store.audits.map((r) => ({ ...r })) };
    try {
      const out: unknown[] = [];
      for (const op of ops) out.push(await op);
      return out;
    } catch (error) {
      store.cars = snapshot.cars;
      store.audits = snapshot.audits;
      throw error;
    }
  };
  return { prisma: client };
});

jest.mock('../../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.test' }; next(); },
  optionalAuth: (req: any, _res: any, next: any) => { if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.test' }; next(); },
}));
jest.mock('../../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }, redactSensitive: (v: unknown) => v }));

import automotiveRoutes from '../../../routes/automotive.routes';
import { errorHandler } from '../../../middleware/errorHandler';
import { resetMemoryRateLimits } from '../../../middleware/rateLimiter';
import { CAR_SEEDS, CATALOGUE_AS_AT } from '../automotive-library';
import { starterRow } from '../automotive-catalogue';
import { CATALOGUE_CSV_COLUMNS } from '../catalogue-admin.service';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/automotive', automotiveRoutes);
app.use(errorHandler);

const admin = { 'x-test-user': 'admin', 'x-test-role': 'ADMIN' };
const member = { 'x-test-user': 'member' };
const CHECKED = 'Checked 26 September 2026 against the maker\'s price list, before on-road costs';

const newCar = () => ({
  make: 'Kia', model: 'EV3', variant: 'Air Standard Range', year: 2026, bodyType: 'SUV', fuelType: 'ELECTRIC', transmission: 'AUTOMATIC', seats: 5, priceFrom: 48990,
  ancapStars: 5, ancapYear: 2024, fuelPer100: null, kwhPer100: 14.9, rangeKm: 436, co2GramsKm: 0, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 300,
  safetyFeatures: ['aeb', 'lane_keep', 'blind_spot'], highlights: ['A small electric SUV with a seven-year warranty'], sourceUrl: 'https://www.kia.com/au/cars/ev3.html', asAt: CHECKED,
});

const adminActions = () => store.audits.map((a) => a.metadata.adminAction);

describe('The admin catalogue', () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    failures.auditCreate = 0;
    store.audits = [];
    store.cars = CAR_SEEDS.slice(0, 4).map((s) => ({ id: randomUUID(), ...starterRow(s), co2GramsKm: null, ratingAvg: 0, ratingCount: 0, reliabilityAvg: 0, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }));
  });

  it('is for admins only', async () => {
    await request(app).get('/api/automotive/admin/catalogue').set(member).expect(403);
    await request(app).post('/api/automotive/admin/catalogue').set(member).send(newCar()).expect(403);
    await request(app).get('/api/automotive/admin/catalogue/export').set(member).expect(403);
  });

  it('shows every starter row as never checked, because nobody has', async () => {
    const res = await request(app).get('/api/automotive/admin/catalogue').set(admin).expect(200);
    expect(res.body.data.counts).toEqual({ active: 4, retired: 0, due: 4 });
    expect(res.body.data.models.every((m: any) => m.lastCheck === null && m.flags.some((f: any) => f.key === 'UNCHECKED'))).toBe(true);
    expect(res.body.data.columns).toEqual([...CATALOGUE_CSV_COLUMNS]);
  });

  it('adds a car with its as-at, records who added it, and counts that as a check', async () => {
    const created = await request(app).post('/api/automotive/admin/catalogue').set(admin).send(newCar()).expect(201);
    expect(created.body.data.slug).toBe('kia-ev3-air-standard-range');
    expect(created.body.data.sourceUrl).toBe('https://www.kia.com/au/cars/ev3.html');
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({ action: 'ADMIN_CONTENT_UPDATE', actorUserId: 'admin', metadata: { adminAction: 'CAR_CATALOGUE_MODEL_ADDED', area: 'automotive', resourceType: 'CarModel', resourceId: created.body.data.id, via: 'form', asAt: CHECKED } });
    const list = await request(app).get('/api/automotive/admin/catalogue').set(admin).expect(200);
    const row = list.body.data.models.find((m: any) => m.slug === 'kia-ev3-air-standard-range');
    expect(row.lastCheck).toMatchObject({ by: 'Priya Shah', asAt: CHECKED });
    expect(row.due).toBe(false);
    expect(list.body.data.counts).toEqual({ active: 5, retired: 0, due: 4 });
  });

  it('refuses a duplicate, a retired duplicate with the way back, and a row that breaks the rules', async () => {
    await request(app).post('/api/automotive/admin/catalogue').set(admin).send({ ...newCar(), slug: 'toyota-corolla-hybrid' }).expect(409);
    store.cars[1].isActive = false;
    const retired = await request(app).post('/api/automotive/admin/catalogue').set(admin).send({ ...newCar(), slug: store.cars[1].slug }).expect(409);
    expect(retired.body.message).toMatch(/restore it/);
    const litres = await request(app).post('/api/automotive/admin/catalogue').set(admin).send({ ...newCar(), fuelPer100: 5 }).expect(400);
    expect(litres.body.message).toMatch(/electric car uses no fuel/);
    await request(app).post('/api/automotive/admin/catalogue').set(admin).send({ ...newCar(), asAt: '' }).expect(400);
    expect(store.audits).toEqual([]);
    expect(store.cars).toHaveLength(4);
  });

  it('will not change a figure without an as-at, and records exactly what moved when it does', async () => {
    const corolla = store.cars[0];
    const refused = await request(app).patch(`/api/automotive/admin/catalogue/${corolla.id}`).set(admin).send({ priceFrom: 33990 }).expect(400);
    expect(refused.body.message).toMatch(/as-at/);
    expect(store.cars[0].priceFrom).toBe(32000);
    expect(store.audits).toEqual([]);
    const done = await request(app).patch(`/api/automotive/admin/catalogue/${corolla.id}`).set(admin).send({ priceFrom: 33990, ancapStars: 5, asAt: CHECKED }).expect(200);
    expect(done.body.data.priceFrom).toBe(33990);
    expect(done.body.data.lastCheck).toMatchObject({ asAt: CHECKED });
    expect(store.audits[0].metadata).toMatchObject({ adminAction: 'CAR_CATALOGUE_MODEL_UPDATED', asAt: CHECKED, changes: { priceFrom: { from: 32000, to: 33990 }, asAt: { from: CATALOGUE_AS_AT, to: CHECKED } } });
    expect(store.audits[0].metadata.changes.ancapStars).toBeUndefined();
  });

  it('lets words change without an as-at, and does not count that as a check', async () => {
    const corolla = store.cars[0];
    await request(app).patch(`/api/automotive/admin/catalogue/${corolla.id}`).set(admin).send({ highlights: ['Cheapest hybrid to run in its class'] }).expect(200);
    expect(store.audits[0].metadata).toMatchObject({ adminAction: 'CAR_CATALOGUE_MODEL_UPDATED' });
    expect(store.audits[0].metadata.asAt).toBeUndefined();
    const list = await request(app).get('/api/automotive/admin/catalogue').set(admin).expect(200);
    expect(list.body.data.models.find((m: any) => m.id === corolla.id).lastCheck).toBeNull();
  });

  it('never moves a slug', async () => {
    const res = await request(app).patch(`/api/automotive/admin/catalogue/${store.cars[0].id}`).set(admin).send({ slug: 'corolla', priceFrom: 1 }).expect(400);
    expect(res.body.message).toMatch(/never changes/);
  });

  it('retires a car out of members\' sight and out of test-drive requests, and restores it', async () => {
    const yaris = store.cars[1];
    await request(app).patch(`/api/automotive/admin/catalogue/${yaris.id}`).set(admin).send({ isActive: false }).expect(200);
    expect(adminActions()).toEqual(['CAR_CATALOGUE_MODEL_RETIRED']);
    const listed = await request(app).get('/api/automotive/catalogue').expect(200);
    expect(listed.body.data.cars.map((c: any) => c.slug)).not.toContain(yaris.slug);
    const drive = await request(app).post('/api/automotive/test-drives').set(member).send({ dealershipId: '9f1c2c7e-2d1b-4c55-9d0e-2f6a4a1b3c4d', carModelId: yaris.id, preferredAt: new Date(Date.now() + 3 * 86400000).toISOString() }).expect(404);
    expect(drive.body.message).toMatch(/no longer in the catalogue/);
    const counts = await request(app).get('/api/automotive/admin/catalogue').set(admin).expect(200);
    expect(counts.body.data.counts).toEqual({ active: 3, retired: 1, due: 3 });
    await request(app).patch(`/api/automotive/admin/catalogue/${yaris.id}`).set(admin).send({ isActive: true }).expect(200);
    expect(adminActions()).toEqual(['CAR_CATALOGUE_MODEL_RETIRED', 'CAR_CATALOGUE_MODEL_RESTORED']);
  });

  it('records a check that changed nothing but the as-at', async () => {
    const rav4 = store.cars[2];
    const res = await request(app).post(`/api/automotive/admin/catalogue/${rav4.id}/checked`).set(admin).send({ asAt: CHECKED, sourceUrl: 'https://www.toyota.com.au/rav4/prices' }).expect(200);
    expect(res.body.data.due).toBe(false);
    expect(store.audits[0].metadata).toMatchObject({ adminAction: 'CAR_CATALOGUE_MODEL_CHECKED', asAt: CHECKED, sourceUrl: 'https://www.toyota.com.au/rav4/prices' });
    expect(store.cars[2]).toMatchObject({ asAt: CHECKED, sourceUrl: 'https://www.toyota.com.au/rav4/prices', priceFrom: CAR_SEEDS[2].priceFrom });
  });

  it('keeps a change and its audit row together: if the row cannot be written, neither is the change', async () => {
    failures.auditCreate = 1;
    await request(app).patch(`/api/automotive/admin/catalogue/${store.cars[0].id}`).set(admin).send({ priceFrom: 33990, asAt: CHECKED }).expect(500);
    expect(store.cars[0].priceFrom).toBe(32000);
    expect(store.cars[0].asAt).toBe(CATALOGUE_AS_AT);
    expect(store.audits).toEqual([]);
  });

  it('exports the catalogue, retired rows included, and imports a corrected copy after a preview', async () => {
    store.cars[3].isActive = false;
    const exported = await request(app).get('/api/automotive/admin/catalogue/export').set(admin).expect(200);
    expect(exported.headers['content-type']).toMatch(/text\/csv/);
    expect(exported.headers['content-disposition']).toMatch(/attachment; filename="athena-car-catalogue-/);
    const lines = exported.text.trim().split('\r\n');
    expect(lines[0]).toBe(CATALOGUE_CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(5);

    const corrected = exported.text.replace(`toyota-corolla-hybrid,Toyota,Corolla,Ascent Sport hybrid hatch,2025,HATCH,HYBRID,AUTOMATIC,5,32000`, `toyota-corolla-hybrid,Toyota,Corolla,Ascent Sport hybrid hatch,2025,HATCH,HYBRID,AUTOMATIC,5,33990`).replace(`"${CATALOGUE_AS_AT}",yes`, `"${CHECKED}",yes`);
    expect(corrected).not.toBe(exported.text);

    const preview = await request(app).post('/api/automotive/admin/catalogue/import').set(admin).send({ csv: corrected }).expect(200);
    expect(preview.body.data.applied).toBe(false);
    expect(preview.body.data.errors).toEqual([]);
    expect(preview.body.data.updates).toHaveLength(1);
    expect(preview.body.data.updates[0]).toMatchObject({ slug: 'toyota-corolla-hybrid', changes: { priceFrom: { from: 32000, to: 33990 }, asAt: { to: CHECKED } } });
    expect(preview.body.data.unchanged).toBe(3);
    expect(store.cars[0].priceFrom).toBe(32000);
    expect(store.audits).toEqual([]);

    const applied = await request(app).post('/api/automotive/admin/catalogue/import').set(admin).send({ csv: corrected, apply: true }).expect(200);
    expect(applied.body.data.applied).toBe(true);
    expect(store.cars[0]).toMatchObject({ priceFrom: 33990, asAt: CHECKED });
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0].metadata).toMatchObject({ adminAction: 'CAR_CATALOGUE_MODEL_UPDATED', via: 'csv', importId: applied.body.data.importId, line: 2, asAt: CHECKED });
  });

  it('changes nothing at all from a file with any row in error', async () => {
    const csv = `slug,priceFrom,asAt\ntoyota-corolla-hybrid,33990,${CHECKED.replace(/,/g, '')}\ntoyota-yaris-cross-hybrid,12,${CHECKED.replace(/,/g, '')}\n`;
    const preview = await request(app).post('/api/automotive/admin/catalogue/import').set(admin).send({ csv }).expect(200);
    expect(preview.body.data.updates).toHaveLength(1);
    expect(preview.body.data.errors).toHaveLength(1);
    const refused = await request(app).post('/api/automotive/admin/catalogue/import').set(admin).send({ csv, apply: true }).expect(400);
    expect(refused.body.message).toMatch(/nothing was changed/);
    expect(store.cars[0].priceFrom).toBe(32000);
    expect(store.audits).toEqual([]);
  });

  it('tells members one as-at only while every car on the page shares it, and shows where the figures came from', async () => {
    const before = await request(app).get('/api/automotive/catalogue').expect(200);
    expect(before.body.data.asAt).toBe(CATALOGUE_AS_AT);
    await request(app).post(`/api/automotive/admin/catalogue/${store.cars[2].id}/checked`).set(admin).send({ asAt: CHECKED, sourceUrl: 'https://www.toyota.com.au/rav4/prices' }).expect(200);
    const after = await request(app).get('/api/automotive/catalogue').expect(200);
    expect(after.body.data.asAt).toBeNull();
    const rav4 = after.body.data.cars.find((c: any) => c.id === store.cars[2].id);
    expect(rav4).toMatchObject({ asAt: CHECKED, sourceUrl: 'https://www.toyota.com.au/rav4/prices' });
    // Side by side, a checked price and a starter one are not passed off as equals.
    const cmp = await request(app).get(`/api/automotive/catalogue/compare?slugs=${store.cars[2].slug},${store.cars[0].slug}`).expect(200);
    expect(cmp.body.data.rows[0]).toEqual({ key: 'asAt', label: 'Figures as at', values: [CHECKED, CATALOGUE_AS_AT] });
  });
});
