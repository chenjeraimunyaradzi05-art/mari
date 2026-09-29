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

      echoCreate();
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

    it('records who decided a check, and how long the listing had waited', async () => {
      const waiting = { id: 'l-1', agentId: 'lister', title: 'Unit', type: 'RENTAL', dvSafe: true, safetyVerified: false, status: 'PENDING', createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), features: ['dv-safe-note:x'] };
      prisma.housingListing.findUnique.mockResolvedValue(waiting);
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...waiting, ...data }));

      await request(app).patch('/api/housing/admin/listings/l-1').set(staff).send({ safetyVerified: true, status: 'ACTIVE', note: 'Spoke to you today.' }).expect(200);

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
      });
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
