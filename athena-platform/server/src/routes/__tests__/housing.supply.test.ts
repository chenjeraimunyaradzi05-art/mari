import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Where housing comes from, and how long a DV-safe listing waits.
 *
 * The only way a listing used to enter the system was a member typing one in,
 * so the safe-housing search a survivor is sent to was empty; and the DV-safe
 * check queue had no due time, no order but creation and no reminder. Staff
 * can now list a partner's places singly or from a spreadsheet, every such
 * action is in the audit log, and the queue knows what is late.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    housingListing: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    housingProviderVerification: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    housingInquiry: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    // Read when a notice is written, for the member's "keep notifications vague".
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    profile: { findUnique: jest.fn(async () => null) },
  };
  prisma.$transaction = jest.fn(async (work: any) => (Array.isArray(work) ? Promise.all(work) : work(prisma)));
  return { prisma };
});

jest.mock('../../middleware/auth', () => {
  const principal = (req: any) =>
    req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' } : null;
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = principal(req);
      if (!user) return res.status(401).json({ success: false, message: 'No token provided' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = principal(req);
      if (user) req.user = user;
      next();
    },
    requireRole:
      (...roles: string[]) =>
      (req: any, res: any, next: any) => {
        if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        next();
      },
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const staff = as('staff-1', 'ADMIN');

const DAY = 24 * 60 * 60 * 1000;
/** A provider check that stands: approved, with most of a year left. */
const standingProvider = (userId: string) => ({ userId, status: 'APPROVED', expiresAt: new Date(Date.now() + 300 * DAY) });

const echoCreate = () => prisma.housingListing.create.mockImplementation(async ({ data }: any) => ({ id: `new-${data.title}`, createdAt: new Date(), ...data }));
const auditRows = () => prisma.auditLog.create.mock.calls.map((c: any) => c[0].data);

const place = {
  title: 'Two-bedroom unit, Chermside',
  description: 'Ground floor, near the bus interchange.',
  type: 'RENTAL',
  suburb: 'Chermside',
  city: 'Brisbane',
  state: 'qld',
  postcode: '4032',
  rentWeekly: '420',
  bedrooms: 2,
};

describe('Housing supply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
    prisma.housingProviderVerification.findMany.mockResolvedValue([]);
  });

  describe('a listing entered by staff', () => {
    it('is refused to a member, whatever the body says', async () => {
      await request(app).post('/api/housing/admin/listings').set(as('member')).send(place).expect(403);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();
    });

    it('goes live under the partner account that will answer inquiries, tells her, and is in the audit log', async () => {
      echoCreate();
      prisma.user.findFirst.mockResolvedValue({ id: 'partner-1', isActive: true, isSuspended: false, bannedAt: null });

      const res = await request(app)
        .post('/api/housing/admin/listings')
        .set(staff)
        .send({ ...place, listerEmail: '  Housing@Partner.org.au ' })
        .expect(201);

      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ email: { equals: 'housing@partner.org.au', mode: 'insensitive' } });
      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data.agentId).toBe('partner-1');
      expect(data.status).toBe('ACTIVE');
      expect(data.state).toBe('QLD');
      expect(data.rentWeekly).toBe(420);
      expect(data.safetyVerified).toBe(false);
      expect(res.body.message).toBe('Listed and live.');

      const told = prisma.notification.create.mock.calls[0][0].data;
      expect(told.userId).toBe('partner-1');
      expect(told.message).toContain('Inquiries about it come to you');

      const [row] = auditRows();
      expect(row.action).toBe('ADMIN_CONTENT_UPDATE');
      expect(row.actorUserId).toBe('staff-1');
      expect(row.targetUserId).toBe('partner-1');
      expect(row.metadata).toMatchObject({ adminAction: 'HOUSING_LISTING_CREATED', resourceType: 'HousingListing', listerId: 'partner-1', status: 'ACTIVE' });
    });

    it('with no partner named, belongs to the member of staff, so inquiries still reach a person', async () => {
      echoCreate();
      await request(app).post('/api/housing/admin/listings').set(staff).send(place).expect(201);
      expect(prisma.housingListing.create.mock.calls[0][0].data.agentId).toBe('staff-1');
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('will not attach a listing to an account that is unknown, suspended or closed', async () => {
      await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, listerEmail: 'nobody@example.com' }).expect(404);

      prisma.user.findFirst.mockResolvedValue({ id: 'gone', isActive: true, isSuspended: true, bannedAt: null });
      const res = await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, listerEmail: 'gone@example.com' }).expect(400);
      expect(res.body.message).toContain('suspended or closed');
      expect(prisma.housingListing.create).not.toHaveBeenCalled();
    });

    it('names the field that is wrong rather than failing in the database', async () => {
      const res = await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, postcode: '40321' }).expect(400);
      expect(res.body.message).toBe('postcode is four digits');
      await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, type: 'MANSION' }).expect(400);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();
    });

    it('a DV-safe place staff have not checked is held in the queue with its clock started, and the other admins are told', async () => {
      echoCreate();
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-1' }, { id: 'staff-2' }]);

      const res = await request(app)
        .post('/api/housing/admin/listings')
        .set(staff)
        .send({ ...place, dvSafe: true, dvSafeNote: 'Refuge-run unit with secure entry and on-site staff' })
        .expect(201);

      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING');
      expect(data.safetyVerified).toBe(false);
      expect(data.features.some((f: string) => f.startsWith('dv-safe-check-requested:'))).toBe(true);
      expect(res.body.data.features).toEqual([]);
      expect(res.body.data.dvSafeNote).toBe('Refuge-run unit with secure entry and on-site staff');
      const toStaff = prisma.notification.create.mock.calls.map((c: any) => c[0].data.userId);
      expect(toStaff).toEqual(['staff-1', 'staff-2']);
      expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('The check is due by');
    });

    it('marking it checked at entry needs a record of what was checked, and that record is in the audit row', async () => {
      await request(app)
        .post('/api/housing/admin/listings')
        .set(staff)
        .send({ ...place, dvSafe: true, dvSafeNote: 'Refuge-run unit', safetyVerified: true })
        .expect(400);
      await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, safetyVerified: true, safetyCheckNote: 'Visited it on Tuesday.' }).expect(400);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();

      // The listing goes under the member the partner answers through, and the
      // badge needs that member to hold a standing provider check.
      echoCreate();
      const withoutProvider = await request(app)
        .post('/api/housing/admin/listings')
        .set(staff)
        .send({ ...place, dvSafe: true, dvSafeNote: 'Refuge-run unit', safetyVerified: true, safetyCheckNote: 'Visited with the refuge manager on Tuesday; secure entry confirmed.' })
        .expect(400);
      expect(withoutProvider.body.message).toContain('has not been checked by ATHENA yet');
      expect(prisma.housingListing.create).not.toHaveBeenCalled();

      prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider('staff-1'));
      const res = await request(app)
        .post('/api/housing/admin/listings')
        .set(staff)
        .send({ ...place, dvSafe: true, dvSafeNote: 'Refuge-run unit', safetyVerified: true, safetyCheckNote: 'Visited with the refuge manager on Tuesday; secure entry confirmed.' })
        .expect(201);

      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data.status).toBe('ACTIVE');
      expect(data.safetyVerified).toBe(true);
      expect(data.features.some((f: string) => f.startsWith('dv-safe-check-requested:'))).toBe(false);
      expect(res.body.message).toContain('checked by ATHENA staff');
      expect(auditRows()[0].metadata.safetyCheckNote).toContain('refuge manager');
    });
  });

  describe('emergency and transitional places entered by staff', () => {
    it('are held for the check like a DV-safe claim, though no DV-safe box was ticked', async () => {
      echoCreate();
      const res = await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, type: 'EMERGENCY' }).expect(201);

      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ type: 'EMERGENCY', status: 'PENDING', safetyVerified: false });
      expect(data.features.some((f: string) => f.startsWith('dv-safe-check-requested:'))).toBe(true);
      expect(res.body.message).toContain('held for a safety check');
    });

    it('can be marked checked at entry only with a note and a lister whose provider check stands', async () => {
      const body = { ...place, type: 'TRANSITIONAL', safetyVerified: true, safetyCheckNote: 'Visited with the housing manager on Tuesday.' };
      await request(app).post('/api/housing/admin/listings').set(staff).send({ ...body, safetyCheckNote: 'ok' }).expect(400);
      await request(app).post('/api/housing/admin/listings').set(staff).send(body).expect(400);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();

      echoCreate();
      prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider('staff-1'));
      await request(app).post('/api/housing/admin/listings').set(staff).send(body).expect(201);
      expect(prisma.housingListing.create.mock.calls[0][0].data).toMatchObject({ status: 'ACTIVE', safetyVerified: true });
    });

    it('an ordinary rental cannot be marked checked at entry', async () => {
      const res = await request(app).post('/api/housing/admin/listings').set(staff).send({ ...place, safetyVerified: true, safetyCheckNote: 'Visited it on Tuesday.' }).expect(400);
      expect(res.body.message).toContain('DV-safe, emergency or transitional');
    });

    it('in a spreadsheet are counted as held, and no row is ever marked checked', async () => {
      const csv = [
        'title,description,type,suburb,city,state,postcode,rentWeekly,bedrooms,features,dvSafe,dvSafeNote',
        'Room in Toowong,Share with one other woman,SHARE,Toowong,Brisbane,QLD,4066,260,1,,no,',
        'A bed tonight,Emergency bed for a few nights,EMERGENCY,Kedron,Brisbane,QLD,4031,0,1,,no,',
      ].join('\n');
      const dry = await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv, dryRun: true }).expect(200);
      expect(dry.body.data).toMatchObject({ rows: 2, heldForCheck: 1 });

      echoCreate();
      await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv }).expect(201);
      const [plain, emergency] = prisma.housingListing.create.mock.calls.map((c: any) => c[0].data);
      expect(plain).toMatchObject({ status: 'ACTIVE', safetyVerified: false });
      expect(emergency).toMatchObject({ type: 'EMERGENCY', status: 'PENDING', safetyVerified: false });
    });
  });

  describe("a partner's spreadsheet", () => {
    const header = 'title,description,type,suburb,city,state,postcode,rentWeekly,bedrooms,features,dvSafe,dvSafeNote';

    it('with any bad row, writes nothing and lists every problem with its line', async () => {
      const csv = [
        header,
        'Room in Toowong,Share with one other woman,SHARE,Toowong,Brisbane,QLD,4066,$260,1,Furnished|Near train,no,',
        'Unit,Quiet,CASTLE,,Brisbane,QLD,4000,300,1,,no,',
        'Safe unit,Secure,RENTAL,,Brisbane,QLD,4000,300,1,,yes,',
      ].join('\n');

      const res = await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv }).expect(400);

      expect(res.body.message).toBe('2 problems in the sheet. Nothing was imported.');
      expect(res.body.errors).toEqual([
        expect.objectContaining({ line: 3, title: 'Unit', message: expect.stringContaining('type is one of') }),
        expect.objectContaining({ line: 4, title: 'Safe unit', message: expect.stringContaining('dvSafeNote') }),
      ]);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a column it does not know rather than dropping what was in it', async () => {
      const res = await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv: 'title,description,type,landlordPhone\nA,B,RENTAL,0400000000\n' }).expect(400);
      expect(res.body.errors[0].message).toContain('Not housing columns: landlordPhone');
    });

    it('a dry run says what would happen and writes nothing', async () => {
      const csv = `${header}\nRoom in Toowong,Share with one other woman,SHARE,Toowong,Brisbane,QLD,4066,260,1,,no,\n`;
      const res = await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv, dryRun: true }).expect(200);
      expect(res.body.data).toEqual({ rows: 1, heldForCheck: 0, listerIsStaff: true, titles: ['Room in Toowong'] });
      expect(prisma.housingListing.create).not.toHaveBeenCalled();
    });

    it('imports every row in one transaction, never marks a row checked, and records the batch', async () => {
      echoCreate();
      prisma.user.findFirst.mockResolvedValue({ id: 'partner-1', isActive: true, isSuspended: false, bannedAt: null });
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-2' }]);
      const csv = [
        header,
        'Room in Toowong,Share with one other woman,SHARE,Toowong,Brisbane,QLD,4066,"$1,260",1,Furnished|Near train,no,',
        '"Safe unit, Kedron","Secure entry, ""no visitors"" rule",TRANSITIONAL,Kedron,Brisbane,QLD,4031,300,2,,yes,Run by a women\'s refuge',
      ].join('\r\n');

      const res = await request(app).post('/api/housing/admin/listings/import').set(staff).send({ csv, listerEmail: 'housing@partner.org.au' }).expect(201);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [first, second] = prisma.housingListing.create.mock.calls.map((c: any) => c[0].data);
      expect(first).toMatchObject({ agentId: 'partner-1', title: 'Room in Toowong', rentWeekly: 1260, features: ['Furnished', 'Near train'], status: 'ACTIVE' });
      expect(second).toMatchObject({ title: 'Safe unit, Kedron', description: 'Secure entry, "no visitors" rule', dvSafe: true, safetyVerified: false, status: 'PENDING' });
      expect(res.body.data).toMatchObject({ imported: 2, heldForCheck: 1 });

      const [row] = auditRows();
      expect(row.metadata).toMatchObject({ adminAction: 'HOUSING_LISTINGS_IMPORTED', imported: 2, heldForCheck: 1, listerId: 'partner-1' });
      const told = prisma.notification.create.mock.calls.map((c: any) => c[0].data);
      expect(told.find((n: any) => n.userId === 'partner-1').message).toContain('2 places are on ATHENA');
      expect(told.find((n: any) => n.userId === 'staff-2').title).toContain('1 imported listing asks');
    });

    it('offers the template columns to download', async () => {
      const res = await request(app).get('/api/housing/admin/listings/import-template').set(staff).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.startsWith('title,description,type,address,suburb')).toBe(true);
    });
  });

  describe('the check queue', () => {
    it('orders by how long each has waited, gives each a due time, and says how many are late', async () => {
      const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
      prisma.housingListing.findMany.mockResolvedValue([
        { id: 'fresh', agentId: 'a', title: 'Fresh', type: 'RENTAL', dvSafe: true, safetyVerified: false, status: 'PENDING', createdAt: hoursAgo(200), features: [`dv-safe-note:x`, `dv-safe-check-requested:${hoursAgo(2).toISOString()}`] },
        { id: 'late', agentId: 'a', title: 'Late', type: 'RENTAL', dvSafe: true, safetyVerified: false, status: 'PENDING', createdAt: hoursAgo(60), features: ['dv-safe-note:y'] },
      ]);

      const res = await request(app).get('/api/housing/admin/pending').set(staff).expect(200);

      expect(res.body.data.map((l: any) => l.id)).toEqual(['late', 'fresh']);
      expect(res.body.data[0].safetyCheck).toMatchObject({ overdue: true, hoursWaiting: 60 });
      expect(res.body.data[1].safetyCheck).toMatchObject({ overdue: false, hoursWaiting: 2 });
      expect(res.body.sla).toEqual({ hours: 48, waiting: 2, overdue: 1 });
      expect(res.body.data[1].features).toEqual([]);
    });

    it('holds an emergency or transitional listing in the same queue, with a clock, though it never claimed to be DV-safe', async () => {
      const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
      prisma.housingListing.findMany.mockResolvedValue([
        { id: 'em', agentId: 'a', title: 'Emergency bed', type: 'EMERGENCY', dvSafe: false, safetyVerified: false, status: 'PENDING', createdAt: hoursAgo(70), features: [] },
      ]);

      const res = await request(app).get('/api/housing/admin/pending').set(staff).expect(200);

      expect(prisma.housingListing.findMany.mock.calls.at(-1)[0].where).toEqual({
        OR: [{ dvSafe: true }, { type: { in: ['EMERGENCY', 'TRANSITIONAL'] } }],
        safetyVerified: false,
        status: { notIn: ['WITHDRAWN', 'LEASED'] },
      });
      expect(res.body.data[0].awaitingSafetyCheck).toBe(true);
      expect(res.body.data[0].safetyCheck).toMatchObject({ overdue: true, hoursWaiting: 70 });
    });

    it('records who decided a check, and how long the listing had waited', async () => {
      const waiting = { id: 'l-1', agentId: 'lister', title: 'Unit', type: 'RENTAL', dvSafe: true, safetyVerified: false, status: 'PENDING', createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), features: ['dv-safe-note:x'] };
      prisma.housingListing.findUnique.mockResolvedValue(waiting);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...waiting, ...data }));

      prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider('lister'));

      await request(app)
        .patch('/api/housing/admin/listings/l-1')
        .set(staff)
        .send({ safetyVerified: true, status: 'ACTIVE', note: 'Spoke to you today.', checkNote: 'Rang the refuge manager; she confirmed the unit and who else lives there.' })
        .expect(200);

      const [row] = auditRows();
      expect(row.actorUserId).toBe('staff-1');
      expect(row.targetUserId).toBe('lister');
      expect(row.metadata).toMatchObject({
        adminAction: 'HOUSING_LISTING_SAFETY_CHECKED',
        before: { safetyVerified: false, dvSafe: true, status: 'PENDING' },
        after: { safetyVerified: true, dvSafe: true, status: 'ACTIVE' },
        waitedHours: 50,
        overdue: true,
        noteToLister: 'Spoke to you today.',
        // What was checked is in the record, and so is the fact that the lister
        // held a standing provider check when the badge was given.
        checkNote: 'Rang the refuge manager; she confirmed the unit and who else lives there.',
        providerCheckStanding: 'APPROVED',
      });
    });

    it('records nothing under the checked verb when the check is refused for want of a note or a provider check', async () => {
      const waiting = { id: 'l-1', agentId: 'lister', title: 'Unit', type: 'RENTAL', dvSafe: true, safetyVerified: false, status: 'PENDING', createdAt: new Date(), features: ['dv-safe-note:x'] };
      prisma.housingListing.findUnique.mockResolvedValue(waiting);

      await request(app).patch('/api/housing/admin/listings/l-1').set(staff).send({ safetyVerified: true, status: 'ACTIVE', note: 'Spoke to you today.' }).expect(400);
      await request(app)
        .patch('/api/housing/admin/listings/l-1')
        .set(staff)
        .send({ safetyVerified: true, status: 'ACTIVE', checkNote: 'Rang the refuge manager and saw the unit.' })
        .expect(400);

      expect(prisma.housingListing.update).not.toHaveBeenCalled();
      expect(auditRows()).toEqual([]);
    });
  });

  describe('a lister cannot carry an old check onto a new claim', () => {
    it('lowering the DV-safe claim ends the check, and raising it again goes back to the queue unchecked', async () => {
      const checked = { id: 'l-2', agentId: 'lister', title: 'Unit', city: 'Brisbane', type: 'RENTAL', dvSafe: true, safetyVerified: true, status: 'ACTIVE', features: ['Garden', 'dv-safe-note:old'] };
      prisma.housingListing.findUnique.mockResolvedValue(checked);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...checked, ...data }));

      await request(app).patch('/api/housing/listings/l-2').set(as('lister')).send({ dvSafe: false }).expect(200);
      expect(prisma.housingListing.update.mock.calls[0][0].data).toMatchObject({ dvSafe: false, safetyVerified: false, features: ['Garden'] });

      prisma.housingListing.findUnique.mockResolvedValue({ ...checked, dvSafe: false });
      await request(app).patch('/api/housing/listings/l-2').set(as('lister')).send({ dvSafe: true, dvSafeNote: 'New note' }).expect(200);
      const raised = prisma.housingListing.update.mock.calls[1][0].data;
      expect(raised).toMatchObject({ dvSafe: true, safetyVerified: false, status: 'PENDING' });
      expect(raised.features.slice(0, 2)).toEqual(['Garden', 'dv-safe-note:New note']);
      expect(raised.features[2]).toMatch(/^dv-safe-check-requested:/);
    });

    it('a member cannot write the internal tags into her own features', async () => {
      echoCreate();
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'VERIFIED' });
      await request(app)
        .post('/api/housing/listings')
        .set(as('lister'))
        .send({ title: 'Room', description: 'A room', type: 'RENTAL', features: ['Garden', 'dv-safe-check-requested:2000-01-01T00:00:00.000Z', 'dv-safe-note:forged'] })
        .expect(201);
      expect(prisma.housingListing.create.mock.calls[0][0].data.features).toEqual(['Garden']);
    });
  });
});

describe('Staff reads of confidential housing data are in the audit log', () => {
  const hiddenAddress = '7 Hidden Lane';
  const note = 'I live upstairs and nobody else has the address';
  const confidential = {
    id: 'l-safe',
    agentId: 'lister',
    title: 'Quiet unit, secure entry',
    type: 'RENTAL',
    status: 'ACTIVE',
    dvSafe: true,
    safetyVerified: true,
    address: hiddenAddress,
    suburb: 'Ashgrove',
    city: 'Brisbane',
    state: 'QLD',
    postcode: '4060',
    features: [`dv-safe-note:${note}`],
    createdAt: new Date(),
  };
  const ordinary = { ...confidential, id: 'l-rental', dvSafe: false, safetyVerified: false, address: '12 Example Street', features: [] };
  const viewed = () => auditRows().filter((r: any) => r.metadata?.adminAction === 'HOUSING_DV_SAFE_VIEWED');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.housingListing.count.mockResolvedValue(0);
    prisma.housingInquiry.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.housingProviderVerification.findMany.mockResolvedValue([]);
  });

  describe('the check queue', () => {
    it('writes one row for the request, naming every listing it held and what it showed, and none of what it showed', async () => {
      const waiting = { ...confidential, id: 'l-wait', safetyVerified: false, status: 'PENDING' };
      prisma.housingListing.findMany.mockResolvedValue([confidential, waiting]);
      prisma.user.findMany.mockResolvedValue([{ id: 'lister', firstName: 'Ada', lastName: 'Lovelace', displayName: null, email: 'ada@example.com', womanVerificationStatus: 'UNVERIFIED', createdAt: new Date() }]);

      await request(app).get('/api/housing/admin/pending').set(staff).expect(200);

      expect(viewed()).toHaveLength(1);
      const [row] = viewed();
      expect(row).toMatchObject({ action: 'DATA_ACCESS', actorUserId: 'staff-1', targetUserId: null });
      expect(row.metadata).toMatchObject({
        adminAction: 'HOUSING_DV_SAFE_VIEWED',
        resourceType: 'HousingListing',
        via: 'check queue',
        count: 2,
        listingIds: ['l-safe', 'l-wait'],
      });
      expect(row.metadata.disclosed).toEqual(expect.arrayContaining(['address', 'dvSafeNote', 'listerName', 'listerEmail']));
      // The row says the address was shown, never what it was.
      const written = JSON.stringify(row);
      for (const secret of [hiddenAddress, note, 'ada@example.com', 'Lovelace']) expect(written).not.toContain(secret);
    });

    it('keeps the reason a member of staff gives, trimmed and cut to length, and asks for none', async () => {
      prisma.housingListing.findMany.mockResolvedValue([confidential]);

      await request(app).get('/api/housing/admin/pending').set(staff).expect(200);
      expect(viewed()[0].metadata).not.toHaveProperty('statedReason');

      await request(app)
        .get('/api/housing/admin/pending')
        .query({ reason: `  Checking   the report in ticket 41 ${'x'.repeat(500)}` })
        .set(staff)
        .expect(200);
      const reason = viewed()[1].metadata.statedReason as string;
      expect(reason.startsWith('Checking the report in ticket 41 x')).toBe(true);
      expect(reason).toHaveLength(300);
    });

    it('writes nothing when the queue is empty, because nothing was shown', async () => {
      await request(app).get('/api/housing/admin/pending').set(staff).expect(200);
      expect(viewed()).toEqual([]);
    });

    it('is refused to a member, who is not recorded as having looked', async () => {
      await request(app).get('/api/housing/admin/pending').set(as('member')).expect(403);
      expect(prisma.housingListing.findMany).not.toHaveBeenCalled();
      expect(viewed()).toEqual([]);
    });

    it('still opens, and says in the log which row is missing, when the audit table refuses the write', async () => {
      prisma.housingListing.findMany.mockResolvedValue([confidential]);
      prisma.auditLog.create.mockRejectedValueOnce(new Error('audit table down'));

      const res = await request(app).get('/api/housing/admin/pending').set(staff).expect(200);

      expect(res.body.data).toHaveLength(1);
      const { logger } = jest.requireMock('../../utils/logger') as { logger: Record<string, jest.Mock> };
      const logged = [...logger.warn.mock.calls, ...logger.error.mock.calls].map((c) => JSON.stringify(c));
      expect(logged.some((line) => line.includes('audit DATA_ACCESS'))).toBe(true);
    });
  });

  describe('a listing opened by id', () => {
    it('is recorded against the listing and the member it is about, whatever its status', async () => {
      prisma.housingListing.findUnique.mockResolvedValue({ ...confidential, status: 'PENDING', safetyVerified: false });

      const res = await request(app).get('/api/housing/listings/l-safe').query({ reason: 'Answering a report' }).set(staff).expect(200);

      expect(res.body.data.address).toBe(hiddenAddress);
      const [row] = viewed();
      expect(row).toMatchObject({ action: 'DATA_ACCESS', actorUserId: 'staff-1', targetUserId: 'lister' });
      expect(row.metadata).toMatchObject({ resourceType: 'HousingListing', resourceId: 'l-safe', via: 'listing detail', disclosed: ['address'], statedReason: 'Answering a report' });
      expect(JSON.stringify(row)).not.toContain(hiddenAddress);
    });

    it('is not recorded for an ordinary listing, which holds no DV-safe data', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(ordinary);
      await request(app).get('/api/housing/listings/l-rental').set(staff).expect(200);
      expect(viewed()).toEqual([]);
    });

    it('is not recorded when the administrator is the lister of it, who reads her own', async () => {
      prisma.housingListing.findUnique.mockResolvedValue({ ...confidential, agentId: 'staff-1' });
      const res = await request(app).get('/api/housing/listings/l-safe').set(staff).expect(200);
      expect(res.body.data.address).toBe(hiddenAddress);
      expect(viewed()).toEqual([]);
    });

    it('is not recorded for the lister herself, nor for a stranger who is told it does not exist', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(confidential);
      await request(app).get('/api/housing/listings/l-safe').set(as('lister')).expect(200);
      await request(app).get('/api/housing/listings/l-safe').expect(404);
      expect(viewed()).toEqual([]);
    });
  });

  describe('the public list', () => {
    it('is recorded once, for the confidential places on it that staff were shown the address of', async () => {
      prisma.housingListing.findMany.mockResolvedValue([ordinary, confidential, { ...confidential, id: 'l-safe-2', agentId: 'other-lister' }]);
      prisma.housingListing.count.mockResolvedValue(3);

      const res = await request(app).get('/api/housing/listings').set(staff).expect(200);

      expect(res.body.data.map((l: any) => l.address)).toEqual(['12 Example Street', hiddenAddress, hiddenAddress]);
      expect(viewed()).toHaveLength(1);
      expect(viewed()[0].metadata).toMatchObject({ via: 'listing list', count: 2, listingIds: ['l-safe', 'l-safe-2'], disclosed: ['address'] });
      // Two listings are a list of ids, not one member's record.
      expect(viewed()[0].targetUserId).toBeNull();
    });

    it('is not recorded for an administrator who sees only ordinary listings', async () => {
      prisma.housingListing.findMany.mockResolvedValue([ordinary]);
      await request(app).get('/api/housing/listings').set(staff).expect(200);
      expect(viewed()).toEqual([]);
    });
  });

  describe('an inquiry thread an administrator answers for the lister', () => {
    const thread = (over: Record<string, unknown> = {}) => ({
      id: 'inq-1',
      listingId: 'l-safe',
      userId: 'survivor',
      status: 'PENDING',
      notes: null,
      updatedAt: new Date(),
      listing: { id: 'l-safe', title: 'Quiet unit', agentId: 'lister', dvSafe: true, type: 'RENTAL' },
      ...over,
    });

    it('is recorded against the woman who asked, naming the thread and not what it says', async () => {
      prisma.housingInquiry.findUnique.mockResolvedValue(thread());
      prisma.housingInquiry.update.mockResolvedValue({ ...thread(), status: 'CONTACTED', user: { id: 'survivor' } });

      await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-1').set(staff).send({ status: 'CONTACTED', message: 'Hello, the room is free.' }).expect(200);

      const [row] = viewed();
      expect(row).toMatchObject({ action: 'DATA_ACCESS', actorUserId: 'staff-1', targetUserId: 'survivor' });
      expect(row.metadata).toMatchObject({ resourceType: 'HousingInquiry', resourceId: 'inq-1', listingIds: ['l-safe'], via: 'inquiry thread' });
      expect(JSON.stringify(row)).not.toContain('the room is free');
    });

    it('is not recorded when the lister answers her own inquiry, or the listing is an ordinary one', async () => {
      prisma.housingInquiry.findUnique.mockResolvedValue(thread());
      prisma.housingInquiry.update.mockResolvedValue({ ...thread(), status: 'CONTACTED', user: { id: 'survivor' } });
      await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-1').set(as('lister')).send({ status: 'CONTACTED' }).expect(200);

      prisma.housingInquiry.findUnique.mockResolvedValue(thread({ listing: { id: 'l-safe', title: 'Room', agentId: 'lister', dvSafe: false, type: 'RENTAL' } }));
      await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-1').set(staff).send({ status: 'CONTACTED' }).expect(200);

      expect(viewed()).toEqual([]);
    });
  });

  describe('a listing an administrator changes for its lister', () => {
    it('is recorded, because the answer is the lister\'s own view: address and note', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(confidential);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...confidential, ...data }));

      await request(app).patch('/api/housing/listings/l-safe').set(staff).send({ petFriendly: true }).expect(200);

      const [row] = viewed();
      expect(row.metadata).toMatchObject({ resourceId: 'l-safe', via: 'listing change', disclosed: ['address', 'dvSafeNote'] });
      expect(row.targetUserId).toBe('lister');
    });

    it('is recorded when the change is the one that lowers the DV-safe claim, because the answer still carries the address of what it was', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(confidential);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...confidential, ...data }));

      const res = await request(app).patch('/api/housing/listings/l-safe').set(staff).send({ dvSafe: false }).expect(200);

      expect(res.body.data.address).toBe(hiddenAddress);
      const [row] = viewed();
      expect(row.metadata).toMatchObject({ resourceId: 'l-safe', via: 'listing change' });
      expect(JSON.stringify(row)).not.toContain(hiddenAddress);
    });

    it('is not recorded for an ordinary listing, or for the lister changing her own', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(ordinary);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...ordinary, ...data }));
      await request(app).patch('/api/housing/listings/l-rental').set(staff).send({ petFriendly: true }).expect(200);

      prisma.housingListing.findUnique.mockResolvedValue(confidential);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...confidential, ...data }));
      await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ petFriendly: true }).expect(200);

      expect(viewed()).toEqual([]);
    });
  });

  describe('a decision an administrator takes on a confidential listing', () => {
    it('is recorded as a read as well as a decision, because the answer to it is the lister\'s view of the place', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(confidential);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...confidential, ...data }));

      const res = await request(app).patch('/api/housing/admin/listings/l-safe').set(staff).send({ status: 'WITHDRAWN', note: 'Taken down after a report.' }).expect(200);

      expect(res.body.data.address).toBe(hiddenAddress);
      // Two rows, because they say two things: what was decided, and what was shown.
      const decided = auditRows().filter((r: any) => r.metadata?.adminAction === 'HOUSING_LISTING_SAFETY_CHECKED');
      expect(decided).toHaveLength(1);
      const [read] = viewed();
      expect(read).toMatchObject({ action: 'DATA_ACCESS', actorUserId: 'staff-1', targetUserId: 'lister' });
      expect(read.metadata).toMatchObject({ resourceId: 'l-safe', via: 'check decision', disclosed: ['address', 'dvSafeNote'] });
      expect(JSON.stringify(read)).not.toContain(hiddenAddress);
      expect(JSON.stringify(read)).not.toContain(note);
    });

    it('is not recorded as a read for an ordinary listing', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(ordinary);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...ordinary, ...data }));

      await request(app).patch('/api/housing/admin/listings/l-rental').set(staff).send({ status: 'WITHDRAWN' }).expect(200);

      expect(viewed()).toEqual([]);
    });
  });

  describe('what a reader of a listing is given of its lister', () => {
    it('is no user id, on an ordinary listing as on a confidential one, for anyone but the lister', async () => {
      prisma.housingListing.findMany.mockResolvedValue([ordinary]);
      prisma.housingListing.count.mockResolvedValue(1);
      prisma.housingListing.findUnique.mockResolvedValue(ordinary);

      const list = await request(app).get('/api/housing/listings').expect(200);
      const detail = await request(app).get('/api/housing/listings/l-rental').expect(200);

      for (const body of [list.body.data[0], detail.body.data]) {
        expect(Object.keys(body)).not.toContain('agentId');
        expect(JSON.stringify(body)).not.toContain('"lister"');
      }
    });
  });
});
