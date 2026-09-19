import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The safety rules on housing: who sees an address, who sees a DV-safe
 * listing at all, who may say a listing was checked, and what the lister
 * learns about the woman asking.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
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
      findMany: jest.fn(async () => []),
    },
    notification: { create: jest.fn(async () => ({})) },
  },
}));

// A signed-in principal is named by two headers; without them the caller is
// anonymous, which is what the confidentiality rules are about.
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

const rental = {
  id: 'l-rental',
  agentId: 'lister',
  title: 'Sunny room in Paddington',
  type: 'RENTAL',
  status: 'ACTIVE',
  dvSafe: false,
  safetyVerified: false,
  address: '12 Example Street',
  suburb: 'Paddington',
  city: 'Brisbane',
  state: 'QLD',
  postcode: '4064',
  features: [],
};

const safeHouse = {
  ...rental,
  id: 'l-safe',
  title: 'Quiet unit, secure entry',
  dvSafe: true,
  safetyVerified: true,
  address: '7 Hidden Lane',
  suburb: 'Ashgrove',
  postcode: '4060',
  features: ['dv-safe-note:I live upstairs and nobody else has the address'],
};

const lastListingWhere = () => prisma.housingListing.findMany.mock.calls.at(-1)[0].where;

describe('Housing safety rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.housingListing.count.mockResolvedValue(0);
    prisma.housingInquiry.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  describe('who sees what in the public list', () => {
    it('an anonymous visitor never gets DV-safe, emergency or transitional rows, nor an address', async () => {
      prisma.housingListing.findMany.mockResolvedValue([rental]);
      prisma.housingListing.count.mockResolvedValue(1);

      const res = await request(app).get('/api/housing/listings').expect(200);

      expect(lastListingWhere().AND).toEqual([{ dvSafe: false }, { type: { notIn: ['EMERGENCY', 'TRANSITIONAL'] } }]);
      expect(res.body.confidential).toEqual({ hidden: true, reason: expect.stringContaining('signed-in members') });
      const [row] = res.body.data;
      expect(row.address).toBeNull();
      expect(row.addressReleased).toBe(false);
      // An ordinary rental still says where it roughly is.
      expect(row.suburb).toBe('Paddington');
      expect(row.postcode).toBe('4064');
    });

    it('a signed-in member without Safe Mode or verification is treated the same, and told how to change that', async () => {
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: { isSafeMode: false } });

      const res = await request(app).get('/api/housing/listings?dvSafe=true').set(as('member')).expect(200);

      expect(lastListingWhere().AND).toEqual([{ dvSafe: false }, { type: { notIn: ['EMERGENCY', 'TRANSITIONAL'] } }]);
      expect(res.body.confidential.hidden).toBe(true);
      expect(res.body.confidential.reason).toContain('Safe Mode');
    });

    it('a member with Safe Mode on sees DV-safe listings, with the city but no suburb, postcode or address', async () => {
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: { isSafeMode: true } });
      prisma.housingListing.findMany.mockResolvedValue([safeHouse]);
      prisma.housingListing.count.mockResolvedValue(1);

      const res = await request(app).get('/api/housing/listings?dvSafe=true').set(as('survivor')).expect(200);

      expect(lastListingWhere().AND).toBeUndefined();
      expect(res.body.confidential.hidden).toBe(false);
      const [row] = res.body.data;
      expect(row.address).toBeNull();
      expect(row.suburb).toBeNull();
      expect(row.postcode).toBeNull();
      expect(row.city).toBe('Brisbane');
      // The lister's note to staff never reaches a member.
      expect(row.features).toEqual([]);
      expect(JSON.stringify(row)).not.toContain('nobody else has the address');
    });

    it('a woman-verified member is eligible too', async () => {
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'VERIFIED', dvSafetyProfile: null });
      const res = await request(app).get('/api/housing/listings').set(as('verified')).expect(200);
      expect(lastListingWhere().AND).toBeUndefined();
      expect(res.body.confidential.hidden).toBe(false);
    });

    it('a DV-safe listing does not exist for a stranger, and is refused to an ineligible member with the reason', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(safeHouse);
      await request(app).get('/api/housing/listings/l-safe').expect(404);

      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null });
      const res = await request(app).get('/api/housing/listings/l-safe').set(as('member')).expect(403);
      expect(res.body.message).toContain('Safe Mode');
    });

    it('the lister and an admin see their own address on the detail', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(rental);
      const own = await request(app).get('/api/housing/listings/l-rental').set(as('lister')).expect(200);
      expect(own.body.data.address).toBe('12 Example Street');
      const admin = await request(app).get('/api/housing/listings/l-rental').set(as('staff', 'ADMIN')).expect(200);
      expect(admin.body.data.address).toBe('12 Example Street');
    });
  });

  describe('who may say a listing was checked', () => {
    it('the member body cannot set safetyVerified on create, and a plain rental goes live at once', async () => {
      prisma.housingListing.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));

      const res = await request(app)
        .post('/api/housing/listings')
        .set(as('lister'))
        .send({ title: 'Room', description: 'A room', type: 'RENTAL', safetyVerified: true, dvSafe: false })
        .expect(201);

      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data.safetyVerified).toBe(false);
      expect(data.dvSafe).toBe(false);
      expect(data.status).toBe('ACTIVE');
      expect(res.body.pendingSafetyCheck).toBe(false);
      expect(res.body.message).toContain('live now');
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('asking for DV-safe needs a note, holds the listing for a check, and tells staff', async () => {
      await request(app)
        .post('/api/housing/listings')
        .set(as('lister'))
        .send({ title: 'Quiet unit', description: 'Secure entry', type: 'RENTAL', dvSafe: true })
        .expect(400);
      expect(prisma.housingListing.create).not.toHaveBeenCalled();

      prisma.housingListing.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const res = await request(app)
        .post('/api/housing/listings')
        .set(as('lister'))
        .send({ title: 'Quiet unit', description: 'Secure entry', type: 'RENTAL', dvSafe: true, safetyVerified: true, dvSafeNote: 'I live upstairs and nobody else has the address' })
        .expect(201);

      const data = prisma.housingListing.create.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING');
      expect(data.dvSafe).toBe(true);
      expect(data.safetyVerified).toBe(false);
      expect(data.features).toContain('dv-safe-note:I live upstairs and nobody else has the address');
      expect(res.body.pendingSafetyCheck).toBe(true);
      expect(res.body.message).toContain('staff');
      expect(res.body.data.awaitingSafetyCheck).toBe(true);

      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'ADMIN' });
      const staffNote = prisma.notification.create.mock.calls[0][0].data;
      expect(staffNote.userId).toBe('admin-1');
      expect(staffNote.link).toBe('/admin/housing');
    });

    it('the member body cannot set safetyVerified on change, and cannot put a held listing live herself', async () => {
      prisma.housingListing.findUnique.mockResolvedValue({ ...safeHouse, safetyVerified: false, status: 'PENDING' });

      await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ safetyVerified: true, rentWeekly: 400 }).expect(200);
      expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ rentWeekly: 400 });

      const res = await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ status: 'ACTIVE' }).expect(400);
      expect(res.body.message).toContain('safety check');
    });

    it('an admin can mark it checked and live, and the lister is told; a member cannot reach the route', async () => {
      prisma.housingListing.findUnique.mockResolvedValue({ ...safeHouse, safetyVerified: false, status: 'PENDING' });
      prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...safeHouse, ...data }));

      await request(app).patch('/api/housing/admin/listings/l-safe').set(as('member')).send({ safetyVerified: true }).expect(403);
      expect(prisma.housingListing.update).not.toHaveBeenCalled();

      const res = await request(app)
        .patch('/api/housing/admin/listings/l-safe')
        .set(as('staff', 'ADMIN'))
        .send({ safetyVerified: true, dvSafe: true, status: 'ACTIVE', note: 'Spoke to you on the phone today.' })
        .expect(200);

      expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ safetyVerified: true, dvSafe: true, status: 'ACTIVE' });
      expect(res.body.data.safetyVerified).toBe(true);
      const told = prisma.notification.create.mock.calls[0][0].data;
      expect(told.userId).toBe('lister');
      expect(told.message).toContain('checked by ATHENA staff');
      expect(told.message).toContain('Spoke to you');
    });

    it('a DV-safe listing cannot be put live unchecked, even by an admin', async () => {
      prisma.housingListing.findUnique.mockResolvedValue({ ...safeHouse, safetyVerified: false, status: 'PENDING' });
      await request(app).patch('/api/housing/admin/listings/l-safe').set(as('staff', 'ADMIN')).send({ status: 'ACTIVE' }).expect(400);
      expect(prisma.housingListing.update).not.toHaveBeenCalled();
    });

    it('the admin queue is the DV-safe listings nobody has checked, with the note and the lister', async () => {
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, safetyVerified: false, status: 'PENDING' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'lister', firstName: 'Ada', lastName: 'L', email: 'ada@example.com', womanVerificationStatus: 'UNVERIFIED', createdAt: new Date() }]);

      const res = await request(app).get('/api/housing/admin/pending').set(as('staff', 'ADMIN')).expect(200);

      expect(lastListingWhere()).toEqual({ dvSafe: true, safetyVerified: false });
      const [row] = res.body.data;
      expect(row.dvSafeNote).toBe('I live upstairs and nobody else has the address');
      expect(row.address).toBe('7 Hidden Lane');
      expect(row.lister.email).toBe('ada@example.com');
    });
  });

  describe('what the lister learns about the woman asking', () => {
    const asker = { id: 'survivor', firstName: 'Jane', lastName: 'Doe', displayName: null, avatar: 'https://cdn/jane.png' };

    it('on a DV-safe listing she is an alias with no user id or avatar; on an ordinary one she is herself', async () => {
      prisma.housingListing.findMany.mockResolvedValue([
        { ...safeHouse, inquiries: [{ id: 'inq-4f2a', status: 'CONTACTED', message: 'Is it still free?', notes: null, createdAt: new Date(), user: asker }] },
        { ...rental, inquiries: [{ id: 'inq-1111', status: 'PENDING', message: null, notes: null, createdAt: new Date(), user: asker }] },
      ]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const [safe, plain] = res.body.data;
      expect(safe.inquiries[0].alias).toBe('Applicant 4F2A');
      expect(safe.inquiries[0].user).toBeNull();
      expect(JSON.stringify(safe.inquiries[0])).not.toContain('jane.png');
      expect(JSON.stringify(safe.inquiries[0])).not.toContain('survivor');
      expect(plain.inquiries[0].user.id).toBe('survivor');
    });

    it('after approval and her explicit choice, the lister sees who she is', async () => {
      const shared = JSON.stringify({ thread: [], contactSharedAt: '2026-09-19T00:00:00.000Z' });
      prisma.housingListing.findMany.mockResolvedValue([
        { ...safeHouse, inquiries: [{ id: 'inq-4f2a', status: 'APPROVED', message: null, notes: shared, createdAt: new Date(), user: asker }] },
      ]);
      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);
      expect(res.body.data[0].inquiries[0].user.id).toBe('survivor');
      expect(res.body.data[0].inquiries[0].contactShared).toBe(true);
    });

    it('she can share her details only on a DV-safe listing and only once approved', async () => {
      prisma.housingInquiry.findUnique.mockResolvedValue({ id: 'inq-4f2a', userId: 'survivor', listingId: 'l-safe', status: 'CONTACTED', notes: null, listing: { id: 'l-safe', title: 'Quiet unit', agentId: 'lister', dvSafe: true, type: 'RENTAL' } });
      await request(app).post('/api/housing/inquiries/inq-4f2a/share-contact').set(as('survivor')).expect(400);

      prisma.housingInquiry.findUnique.mockResolvedValue({ id: 'inq-4f2a', userId: 'survivor', listingId: 'l-safe', status: 'APPROVED', notes: null, listing: { id: 'l-safe', title: 'Quiet unit', agentId: 'lister', dvSafe: true, type: 'RENTAL' } });
      await request(app).post('/api/housing/inquiries/inq-4f2a/share-contact').set(as('survivor')).expect(200);

      const saved = JSON.parse(prisma.housingInquiry.update.mock.calls[0][0].data.notes);
      expect(typeof saved.contactSharedAt).toBe('string');
      const told = prisma.notification.create.mock.calls[0][0].data;
      expect(told.userId).toBe('lister');
      expect(told.message).toContain('Applicant 4F2A');
    });

    it('the conversation is carried on the inquiry: the lister writes without changing the status, the asker replies', async () => {
      const row = { id: 'inq-4f2a', userId: 'survivor', listingId: 'l-safe', status: 'CONTACTED', notes: null, listing: { id: 'l-safe', title: 'Quiet unit', agentId: 'lister', dvSafe: true, type: 'RENTAL' } };
      prisma.housingInquiry.findUnique.mockResolvedValue(row);
      prisma.housingInquiry.update.mockImplementation(async ({ data }: any) => ({ ...row, ...data, user: asker }));

      const fromLister = await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-4f2a').set(as('lister')).send({ message: 'It is free from Monday.' }).expect(200);
      expect(prisma.housingInquiry.update.mock.calls[0][0].data.status).toBeUndefined();
      expect(fromLister.body.data.thread).toEqual([expect.objectContaining({ from: 'LISTER', text: 'It is free from Monday.' })]);
      expect(fromLister.body.data.user).toBeNull();
      expect(prisma.notification.create.mock.calls[0][0].data.userId).toBe('survivor');

      await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-4f2a').set(as('lister')).send({}).expect(400);

      const fromAsker = await request(app).patch('/api/housing/inquiries/inq-4f2a').set(as('survivor')).send({ reply: 'Monday works.' }).expect(200);
      expect(fromAsker.body.data.thread).toEqual([expect.objectContaining({ from: 'ASKER', text: 'Monday works.' })]);
      const told = prisma.notification.create.mock.calls.at(-1)[0].data;
      expect(told.userId).toBe('lister');
      expect(told.message).toContain('Applicant 4F2A');
      expect(told.message).not.toContain('Jane');
    });
  });

  describe('when the asker sees the address', () => {
    it('not while the inquiry is pending; yes once the lister has been in touch', async () => {
      prisma.housingInquiry.findMany.mockResolvedValue([
        { id: 'inq-1', userId: 'survivor', status: 'PENDING', notes: null, createdAt: new Date(), listing: safeHouse },
        { id: 'inq-2', userId: 'survivor', status: 'CONTACTED', notes: null, createdAt: new Date(), listing: safeHouse },
      ]);

      const res = await request(app).get('/api/housing/my/inquiries').set(as('survivor')).expect(200);

      const [pending, contacted] = res.body.data;
      expect(pending.listing.address).toBeNull();
      expect(pending.listing.suburb).toBeNull();
      expect(pending.listing.addressReleased).toBe(false);
      expect(contacted.listing.address).toBe('7 Hidden Lane');
      expect(contacted.listing.suburb).toBe('Ashgrove');
      expect(contacted.listing.addressReleased).toBe(true);
      expect(pending.confidential).toBe(true);
    });

    it('in the public list too, once her inquiry on that listing has been answered', async () => {
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: { isSafeMode: true } });
      prisma.housingListing.findMany.mockResolvedValue([rental, safeHouse]);
      prisma.housingListing.count.mockResolvedValue(2);
      prisma.housingInquiry.findMany.mockResolvedValue([{ listingId: 'l-safe' }]);

      const res = await request(app).get('/api/housing/listings').set(as('survivor')).expect(200);

      const released = prisma.housingInquiry.findMany.mock.calls[0][0].where;
      expect(released.userId).toBe('survivor');
      expect(released.status.in).toEqual(['CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED']);
      const [plain, safe] = res.body.data;
      expect(plain.address).toBeNull();
      expect(safe.address).toBe('7 Hidden Lane');
    });

    it('asking about a DV-safe listing needs the same eligibility, and the lister is told by alias', async () => {
      prisma.housingListing.findUnique.mockResolvedValue(safeHouse);
      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null });
      await request(app).post('/api/housing/listings/l-safe/inquire').set(as('member')).send({}).expect(403);

      prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: { isSafeMode: true } });
      prisma.housingInquiry.findUnique.mockResolvedValue(null);
      prisma.housingInquiry.create.mockResolvedValue({ id: 'inq-4f2a', userId: 'survivor', listingId: 'l-safe', status: 'PENDING', notes: null, listing: safeHouse });

      const res = await request(app).post('/api/housing/listings/l-safe/inquire').set(as('survivor')).send({ message: 'Hello' }).expect(201);
      expect(res.body.data.listing.address).toBeNull();
      const told = prisma.notification.create.mock.calls[0][0].data;
      expect(told.userId).toBe('lister');
      expect(told.message).toContain('Applicant 4F2A');
    });
  });
});
