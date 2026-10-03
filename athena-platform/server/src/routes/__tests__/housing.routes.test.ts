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
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    housingProviderVerification: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 0 })),
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
    notification: { create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    // Read when a notice is written, for the member's "keep notifications vague".
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    profile: { findUnique: jest.fn(async () => null) },
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

// The screen a post goes through, which a listing's words now go through too.
// Allowed unless a test says otherwise; what matters here is that it is asked,
// and that its refusal stops the write.
const assertContentAllowed = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../../services/moderation.service', () => ({
  ...(jest.requireActual('../../services/moderation.service') as object),
  assertContentAllowed: (...args: unknown[]) => assertContentAllowed(...args),
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

const DAY = 24 * 60 * 60 * 1000;
/** A provider check that stands: approved, with a year left. */
const standingProvider = (over: Record<string, unknown> = {}) => ({
  id: 'prov-1',
  userId: 'lister',
  providerName: 'Quiet Streets Housing',
  relationship: 'SERVICE',
  abn: null,
  statement: 'We run three units for women leaving violence in Brisbane.',
  status: 'APPROVED',
  basis: 'Rang two references and checked the ABN.',
  evidence: null,
  reviewedById: 'staff',
  reviewedAt: new Date(Date.now() - 30 * DAY),
  expiresAt: new Date(Date.now() + 335 * DAY),
  submittedAt: new Date(Date.now() - 31 * DAY),
  updatedAt: new Date(),
  ...over,
});

describe('Housing safety rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.housingListing.count.mockResolvedValue(0);
    prisma.housingInquiry.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
    prisma.housingProviderVerification.findMany.mockResolvedValue([]);
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

      // Eligible, but still only listings staff have checked: a confidential row
      // that was never checked is not shown to her as safe.
      expect(lastListingWhere().AND).toEqual([{ OR: [{ safetyVerified: true }, { dvSafe: false, type: { notIn: ['EMERGENCY', 'TRANSITIONAL'] } }] }]);
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
      expect(lastListingWhere().AND).toEqual([{ OR: [{ safetyVerified: true }, { dvSafe: false, type: { notIn: ['EMERGENCY', 'TRANSITIONAL'] } }] }]);
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

      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'ADMIN', isActive: true });
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
      prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());

      await request(app).patch('/api/housing/admin/listings/l-safe').set(as('member')).send({ safetyVerified: true }).expect(403);
      expect(prisma.housingListing.update).not.toHaveBeenCalled();

      const res = await request(app)
        .patch('/api/housing/admin/listings/l-safe')
        .set(as('staff', 'ADMIN'))
        .send({ safetyVerified: true, dvSafe: true, status: 'ACTIVE', checkNote: 'Rang the refuge manager and confirmed the unit and the secure entry.', note: 'Spoke to you on the phone today.' })
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

      // DV-safe claims, and emergency and transitional places, which are
      // confidential whether or not the lister ticks DV-safe.
      expect(lastListingWhere()).toEqual({
        OR: [{ dvSafe: true }, { type: { in: ['EMERGENCY', 'TRANSITIONAL'] } }],
        safetyVerified: false,
        status: { notIn: ['WITHDRAWN', 'LEASED'] },
      });
      const [row] = res.body.data;
      expect(row.dvSafeNote).toBe('I live upstairs and nobody else has the address');
      expect(row.address).toBe('7 Hidden Lane');
      expect(row.lister.email).toBe('ada@example.com');
    });
  });

  describe('what the lister learns about the woman asking', () => {
    const asker = { id: 'survivor', firstName: 'Jane', lastName: 'Doe', displayName: null, avatar: 'https://cdn/jane.png' };

    // What Prisma returns for an inquiry with its user included: every scalar of
    // the row, userId among them, beside the included user. The fixtures used to
    // leave userId out, which is how a response carrying it passed every check.
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'inq-4f2a',
      listingId: 'l-safe',
      userId: 'survivor',
      status: 'CONTACTED',
      message: 'Is it still free?',
      viewingDate: null,
      notes: null,
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
      updatedAt: new Date('2026-09-18T00:00:00.000Z'),
      user: asker,
      ...over,
    });
    const identityStrings = ['survivor', 'Jane', 'Doe', 'jane.png'];

    it('on a DV-safe listing she is an alias with no user id or avatar; on an ordinary one she is herself', async () => {
      prisma.housingListing.findMany.mockResolvedValue([
        { ...safeHouse, inquiries: [row()] },
        { ...rental, inquiries: [row({ id: 'inq-1111', listingId: 'l-rental', status: 'PENDING', message: null })] },
      ]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const [safe, plain] = res.body.data;
      expect(safe.inquiries[0].alias).toBe('Applicant 4F2A');
      expect(safe.inquiries[0].user).toBeNull();
      expect(plain.inquiries[0].user.id).toBe('survivor');
    });

    it('before she has approved and chosen to share, nothing in the lister response can be used to find her', async () => {
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, inquiries: [row()] }]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const inquiry = res.body.data[0].inquiries[0];
      // The id is the key to GET /api/users/:id, so it must be absent as a key,
      // not only absent from the strings a person would read.
      expect(Object.keys(inquiry)).not.toContain('userId');
      expect(Object.keys(inquiry)).not.toContain('notes');
      const wire = JSON.stringify(inquiry);
      for (const s of identityStrings) expect(wire).not.toContain(s);
      // What the lister is meant to have.
      expect(inquiry).toEqual(
        expect.objectContaining({ id: 'inq-4f2a', status: 'CONTACTED', message: 'Is it still free?', alias: 'Applicant 4F2A', contactShared: false, thread: [] })
      );
    });

    it('approval alone does not unmask her; she has to choose to share', async () => {
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, inquiries: [row({ status: 'APPROVED' })] }]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const inquiry = res.body.data[0].inquiries[0];
      expect(inquiry.user).toBeNull();
      expect(Object.keys(inquiry)).not.toContain('userId');
      for (const s of identityStrings) expect(JSON.stringify(inquiry)).not.toContain(s);
    });

    it('a column the lister was never meant to have stays out, whatever the table gains', async () => {
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, inquiries: [row({ applicantPhone: '0400 000 000', referrerId: 'survivor' })] }]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const wire = JSON.stringify(res.body.data[0].inquiries[0]);
      expect(wire).not.toContain('0400 000 000');
      expect(wire).not.toContain('survivor');
    });

    it('after approval and her explicit choice, the lister sees who she is', async () => {
      const shared = JSON.stringify({ thread: [], contactSharedAt: '2026-09-19T00:00:00.000Z' });
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, inquiries: [row({ status: 'APPROVED', notes: shared, message: null })] }]);
      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);
      const inquiry = res.body.data[0].inquiries[0];
      expect(inquiry.user.id).toBe('survivor');
      expect(inquiry.userId).toBe('survivor');
      expect(inquiry.contactShared).toBe(true);
      // The private JSON the thread lives in is never sent as it is stored.
      expect(Object.keys(inquiry)).not.toContain('notes');
    });

    it('sharing her details on a listing that is not approved does not unmask her either', async () => {
      const shared = JSON.stringify({ thread: [], contactSharedAt: '2026-09-19T00:00:00.000Z' });
      prisma.housingListing.findMany.mockResolvedValue([{ ...safeHouse, inquiries: [row({ status: 'DECLINED', notes: shared })] }]);

      const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);

      const inquiry = res.body.data[0].inquiries[0];
      expect(inquiry.user).toBeNull();
      expect(Object.keys(inquiry)).not.toContain('userId');
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
      // The row carries userId: 'survivor', as Prisma's does; the lister must not get it back.
      expect(Object.keys(fromLister.body.data)).not.toContain('userId');
      expect(JSON.stringify(fromLister.body.data)).not.toContain('survivor');
      expect(JSON.stringify(fromLister.body.data)).not.toContain('Jane');
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

/**
 * Emergency and transitional places are offered to a woman leaving a bad
 * situation, which is the offer a bad actor would make. They used to go live the
 * moment they were posted, so anyone with an account could advertise
 * "emergency accommodation" with nobody having looked. They are confidential on
 * their own, and held for the same staff check as a DV-safe claim.
 */
describe('Emergency and transitional listings', () => {
  const emergency = { ...rental, id: 'l-emergency', type: 'EMERGENCY', title: 'Emergency room tonight', features: [], safetyVerified: false };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'VERIFIED', dvSafetyProfile: null });
    prisma.housingListing.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
    prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
  });

  it.each(['EMERGENCY', 'TRANSITIONAL'])('a new %s listing is held for a check, off the list, and staff are told', async (type) => {
    const res = await request(app)
      .post('/api/housing/listings')
      .set(as('lister'))
      // No dvSafe flag and no note: the type alone is what makes it confidential.
      .send({ title: 'A bed', description: 'A bed for a few nights', type, safetyVerified: true })
      .expect(201);

    const data = prisma.housingListing.create.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.safetyVerified).toBe(false);
    expect(data.features.some((f: string) => f.startsWith('dv-safe-check-requested:'))).toBe(true);
    expect(res.body.pendingSafetyCheck).toBe(true);
    expect(res.body.data.awaitingSafetyCheck).toBe(true);
    expect(res.body.message).toContain('before it goes live');
    expect(res.body.message).toContain('provider check');
    // Staff are told it is waiting, with the link to the queue.
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told.userId).toBe('admin-1');
    expect(told.link).toBe('/admin/housing');
    expect(told.title).toContain(type.toLowerCase());
  });

  it('a plain rental still goes live at once, so the hold is for confidential places only', async () => {
    const res = await request(app).post('/api/housing/listings').set(as('lister')).send({ title: 'Room', description: 'A room', type: 'RENTAL' }).expect(201);
    expect(prisma.housingListing.create.mock.calls[0][0].data.status).toBe('ACTIVE');
    expect(res.body.pendingSafetyCheck).toBe(false);
  });

  it('an unchecked one is never in the list, even for a woman who may see confidential places', async () => {
    prisma.housingListing.findMany.mockResolvedValue([]);
    await request(app).get('/api/housing/listings').set(as('survivor')).expect(200);
    const where = lastListingWhere();
    // The database is asked only for rows that are checked or not confidential,
    // so an unchecked emergency row cannot reach the response however it got there.
    expect(where.AND).toEqual([{ OR: [{ safetyVerified: true }, { dvSafe: false, type: { notIn: ['EMERGENCY', 'TRANSITIONAL'] } }] }]);
  });

  it('is not inquired about while it is unchecked', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...emergency, status: 'ACTIVE' });
    const res = await request(app).post('/api/housing/listings/l-emergency/inquire').set(as('survivor')).send({}).expect(400);
    expect(res.body.message).toContain('no longer available');
    expect(prisma.housingInquiry.create).not.toHaveBeenCalled();
  });

  it('is in the staff queue, and cannot be shown as an ordinary listing', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...emergency, status: 'PENDING' });
    // "Show as an ordinary listing" is for a DV-safe claim staff could not
    // confirm. An emergency place has no ordinary version of itself.
    const res = await request(app).patch('/api/housing/admin/listings/l-emergency').set(as('staff', 'ADMIN')).send({ dvSafe: false, status: 'ACTIVE' }).expect(400);
    expect(res.body.message).toContain('only once it is marked as checked');
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it('is checked from the same route, with the note and the provider check, and the lister is told in plain words', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...emergency, status: 'PENDING' });
    prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...emergency, ...data }));
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());

    await request(app)
      .patch('/api/housing/admin/listings/l-emergency')
      .set(as('staff', 'ADMIN'))
      .send({ safetyVerified: true, status: 'ACTIVE', checkNote: 'Visited the property with the owner and saw the room.' })
      .expect(200);

    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ safetyVerified: true, status: 'ACTIVE' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('as emergency housing');
  });
});

describe('Who can read a listing by its id, and what it carries', () => {
  const live = { ...rental, id: 'l-live', features: [] };
  const confidentialLive = { ...safeHouse, id: 'l-conf' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingInquiry.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: { isSafeMode: true } });
  });

  it.each(['PENDING', 'WITHDRAWN', 'LEASED'])('a %s listing does not exist for anyone but its lister and staff', async (status) => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...live, status });
    await request(app).get('/api/housing/listings/l-live').expect(404);
    await request(app).get('/api/housing/listings/l-live').set(as('someone-else')).expect(404);
    await request(app).get('/api/housing/listings/l-live').set(as('lister')).expect(200);
    await request(app).get('/api/housing/listings/l-live').set(as('staff', 'ADMIN')).expect(200);
  });

  it('a held confidential listing is a 404, not a 403, to a member who could otherwise see such places', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...confidentialLive, safetyVerified: false, status: 'PENDING' });
    // A 403 would say a listing exists and was refused; she was only given a link.
    await request(app).get('/api/housing/listings/l-conf').set(as('survivor')).expect(404);
    prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null });
    await request(app).get('/api/housing/listings/l-conf').set(as('member')).expect(404);
  });

  it('a live confidential row nobody checked is not shown either', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...confidentialLive, safetyVerified: false, status: 'ACTIVE' });
    await request(app).get('/api/housing/listings/l-conf').set(as('survivor')).expect(404);
  });

  it('a confidential listing does not carry the key to its lister, in the list or on the detail', async () => {
    prisma.housingListing.findMany.mockResolvedValue([confidentialLive]);
    prisma.housingListing.count.mockResolvedValue(1);
    prisma.housingListing.findUnique.mockResolvedValue(confidentialLive);

    const list = await request(app).get('/api/housing/listings').set(as('survivor')).expect(200);
    const detail = await request(app).get('/api/housing/listings/l-conf').set(as('survivor')).expect(200);

    for (const body of [list.body.data[0], detail.body.data]) {
      expect(Object.keys(body)).not.toContain('agentId');
      expect(JSON.stringify(body)).not.toContain('"lister"');
    }
  });

  it('a woman reading confidential listings, or the one who listed it, leaves no staff-read row; a member of staff does', async () => {
    prisma.housingListing.findMany.mockResolvedValue([confidentialLive]);
    prisma.housingListing.count.mockResolvedValue(1);
    prisma.housingListing.findUnique.mockResolvedValue(confidentialLive);
    const viewedRows = () => prisma.auditLog.create.mock.calls.filter((c: any) => c[0].data.metadata?.adminAction === 'HOUSING_DV_SAFE_VIEWED');

    await request(app).get('/api/housing/listings').set(as('survivor')).expect(200);
    await request(app).get('/api/housing/listings/l-conf').set(as('survivor')).expect(200);
    await request(app).get('/api/housing/listings/l-conf').set(as('lister')).expect(200);
    expect(viewedRows()).toEqual([]);

    await request(app).get('/api/housing/listings/l-conf').set(as('staff', 'ADMIN')).expect(200);
    expect(viewedRows()).toHaveLength(1);
    expect(viewedRows()[0][0].data).toMatchObject({ action: 'DATA_ACCESS', actorUserId: 'staff', targetUserId: 'lister' });
  });

  it('the lister and staff still get it back, because their own views need it', async () => {
    prisma.housingListing.findMany.mockResolvedValue([{ ...confidentialLive, inquiries: [] }]);
    const mine = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);
    expect(mine.body.data[0].agentId).toBe('lister');
  });

  it('answers every housing read as private and not to be stored, errors included', async () => {
    prisma.housingListing.findMany.mockResolvedValue([]);
    prisma.housingListing.findUnique.mockResolvedValue(null);
    for (const [path, headers, status] of [
      ['/api/housing/listings', {}, 200],
      ['/api/housing/listings', as('survivor'), 200],
      ['/api/housing/listings/missing', {}, 404],
      ['/api/housing/my/inquiries', as('survivor'), 200],
      ['/api/housing/my/listings', as('lister'), 200],
    ] as Array<[string, Record<string, string>, number]>) {
      const res = await request(app).get(path).set(headers).expect(status);
      expect({ path, cache: res.headers['cache-control'] }).toEqual({ path, cache: 'private, no-store' });
    }
  });
});

describe('Editing a checked listing ends the check', () => {
  const checked = { ...safeHouse, id: 'l-checked', title: 'Quiet unit', description: 'Secure entry, second floor.', rentWeekly: 400, city: 'Brisbane', status: 'ACTIVE', safetyVerified: true };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...checked, ...data }));
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
  });

  it.each([
    ['description', { description: 'Secure entry, second floor. Pets welcome.' }],
    ['title', { title: 'Sunny quiet unit' }],
    ['rent', { rentWeekly: 150 }],
  ])('changing the %s takes it off the list and back to the queue, and tells staff', async (_what, change) => {
    prisma.housingListing.findUnique.mockResolvedValue(checked);

    const res = await request(app).patch('/api/housing/listings/l-checked').set(as('lister')).send(change).expect(200);

    const data = prisma.housingListing.update.mock.calls[0][0].data;
    expect(data.safetyVerified).toBe(false);
    expect(data.status).toBe('PENDING');
    expect(data.features.some((f: string) => f.startsWith('dv-safe-check-requested:'))).toBe(true);
    expect(res.body.message).toContain('safety check has ended');
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told.userId).toBe('admin-1');
    expect(told.title).toContain('needs checking again');
  });

  it('saving the same words again changes nothing, so a lister who only edits the form is not punished', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(checked);

    await request(app)
      .patch('/api/housing/listings/l-checked')
      .set(as('lister'))
      .send({ title: 'Quiet unit', description: 'Secure entry, second floor.', rentWeekly: 400 })
      .expect(200);

    const data = prisma.housingListing.update.mock.calls[0][0].data;
    expect(data.safetyVerified).toBeUndefined();
    expect(data.status).toBeUndefined();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('a field the check was not about (the pet and access switches) leaves the badge', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(checked);
    await request(app).patch('/api/housing/listings/l-checked').set(as('lister')).send({ petFriendly: true }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data.safetyVerified).toBeUndefined();
  });

  it('an ordinary rental that carries the badge loses it on an edit but stays live', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...rental, safetyVerified: true, description: 'A room.', rentWeekly: 300, features: [] });
    await request(app).patch('/api/housing/listings/l-rental').set(as('lister')).send({ description: 'A bigger room.' }).expect(200);
    const data = prisma.housingListing.update.mock.calls[0][0].data;
    expect(data.safetyVerified).toBe(false);
    expect(data.status).toBeUndefined();
  });

  it('a checked listing that was withdrawn comes back live only while its lister still has a standing provider check', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...checked, status: 'WITHDRAWN' });

    await request(app).patch('/api/housing/listings/l-checked').set(as('lister')).send({ status: 'ACTIVE' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data.status).toBe('ACTIVE');

    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider({ expiresAt: new Date(Date.now() - DAY) }));
    const res = await request(app).patch('/api/housing/listings/l-checked').set(as('lister')).send({ status: 'ACTIVE' }).expect(200);
    const held = prisma.housingListing.update.mock.calls[1][0].data;
    expect(held.status).toBe('PENDING');
    expect(held.safetyVerified).toBe(false);
    expect(res.body.message).toContain('provider check is no longer current');
  });
});

describe('A listing staff took down stays down until staff put it back', () => {
  const MARK = 'staff-takedown:2026-10-01T00:00:00.000Z';
  const removed = { ...rental, id: 'l-removed', status: 'WITHDRAWN', features: ['Garden', MARK] };
  const emergency = { ...rental, id: 'l-emerg', type: 'EMERGENCY', status: 'WITHDRAWN', safetyVerified: false, features: [MARK] };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...removed, ...data }));
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
  });

  // The status is a switch its lister can press. An ordinary listing has no
  // check to go back through, so a moderator's removal lasted until she pressed
  // "Available".
  it('refuses its lister putting an ordinary listing back on the list, and writes nothing', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(removed);
    const res = await request(app).patch('/api/housing/listings/l-removed').set(as('lister')).send({ status: 'ACTIVE' }).expect(409);
    expect(res.body.message).toContain('took this listing down');
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it('refuses it for an emergency place too, rather than queuing it again for staff who took it down', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(emergency);
    await request(app).patch('/api/housing/listings/l-emerg').set(as('lister')).send({ status: 'ACTIVE' }).expect(409);
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('still lets its lister edit the words, and change the status to anything but live', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(removed);
    await request(app).patch('/api/housing/listings/l-removed').set(as('lister')).send({ description: 'Fixed what was wrong.', status: 'LEASED' }).expect(200);
    const data = prisma.housingListing.update.mock.calls[0][0].data;
    expect(data.description).toBe('Fixed what was wrong.');
    expect(data.status).toBe('LEASED');
  });

  it('does not touch a listing its lister withdrew herself, which she can put back', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...removed, features: ['Garden'] });
    await request(app).patch('/api/housing/listings/l-removed').set(as('lister')).send({ status: 'ACTIVE' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data.status).toBe('ACTIVE');
  });

  it('keeps the mark when she asks for a DV-safe check, so the status switch is still refused afterwards', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(removed);
    await request(app).patch('/api/housing/listings/l-removed').set(as('lister')).send({ dvSafe: true, dvSafeNote: 'I live upstairs and nobody else has the address.' }).expect(200);
    const features: string[] = prisma.housingListing.update.mock.calls[0][0].data.features;
    expect(features).toContain(MARK);
  });

  it('is written by staff taking any listing down, whatever its type, and is not shown to anyone', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...rental, features: ['Garden'] });
    const res = await request(app).patch('/api/housing/admin/listings/l-rental').set(as('staff', 'ADMIN')).send({ status: 'WITHDRAWN' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ status: 'WITHDRAWN', features: ['Garden', expect.stringMatching(/^staff-takedown:/)] });
    expect(JSON.stringify(res.body)).not.toContain('staff-takedown');
    expect(res.body.data.takenDownByStaff).toBe(true);
  });

  it('is cleared when staff put the listing back, so its lister manages it again', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(removed);
    await request(app).patch('/api/housing/admin/listings/l-removed').set(as('staff', 'ADMIN')).send({ status: 'ACTIVE' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ status: 'ACTIVE', features: ['Garden'] });
  });

  it('is kept while staff change something else about it', async () => {
    prisma.housingListing.findUnique.mockResolvedValue(removed);
    await request(app).patch('/api/housing/admin/listings/l-removed').set(as('staff', 'ADMIN')).send({ dvSafe: false }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data.features).toBeUndefined();
  });

  it('is told to the lister in her own listings, and never leaks as a feature', async () => {
    prisma.housingListing.findMany.mockResolvedValue([{ ...removed, inquiries: [] }]);
    const res = await request(app).get('/api/housing/my/listings').set(as('lister')).expect(200);
    expect(res.body.data[0].takenDownByStaff).toBe(true);
    expect(res.body.data[0].features).toEqual(['Garden']);
  });
});

describe('The check on the person offering a place', () => {
  const waiting = { ...safeHouse, id: 'l-wait', safetyVerified: false, status: 'PENDING' };
  const approve = {
    safetyVerified: true,
    dvSafe: true,
    status: 'ACTIVE',
    checkNote: 'Rang the refuge manager and confirmed the unit and the secure entry.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingListing.findUnique.mockResolvedValue(waiting);
    prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...waiting, ...data }));
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
    prisma.housingProviderVerification.findMany.mockResolvedValue([]);
  });

  it('refuses a check with no record of what was checked, however the lister stands', async () => {
    const { checkNote: _omit, ...withoutNote } = approve;
    const none = await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send(withoutNote).expect(400);
    expect(none.body.message).toContain('Say what you checked');

    const short = await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send({ ...approve, checkNote: 'ok, done' }).expect(400);
    expect(short.body.message).toContain('Say what you checked');

    // The old optional line for the lister is not a record of the check.
    await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send({ ...withoutNote, note: 'Spoke to you on the phone today.' }).expect(400);
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it.each([
    ['has never asked to be checked', null],
    ['is still waiting for a decision', standingProvider({ status: 'PENDING', expiresAt: null, reviewedAt: null })],
    ['was refused', standingProvider({ status: 'REJECTED', expiresAt: null })],
    ['had a check that has run out', standingProvider({ expiresAt: new Date(Date.now() - DAY) })],
    ['has a check marked expired', standingProvider({ status: 'EXPIRED' })],
    ['has an approved check with no end date', standingProvider({ expiresAt: null })],
  ])('refuses to badge the place when the lister %s', async (_who, row) => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row);

    const res = await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send(approve).expect(400);

    expect(res.body.message).toContain('has not been checked by ATHENA yet');
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it('does not put a badged confidential listing back live for a lister whose check has run out', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...waiting, safetyVerified: true, status: 'WITHDRAWN' });
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider({ expiresAt: new Date(Date.now() - DAY) }));
    await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send({ status: 'ACTIVE' }).expect(400);
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it('badges the place when both are in order, and asks the provider check of the lister, not of the member of staff', async () => {
    await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send(approve).expect(200);
    expect(prisma.housingProviderVerification.findUnique.mock.calls[0][0].where).toEqual({ userId: 'lister' });
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ safetyVerified: true, dvSafe: true, status: 'ACTIVE' });
  });

  it('is not put on an ordinary listing, which goes through no provider check, however good the note', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...rental, features: [] });
    const res = await request(app)
      .patch('/api/housing/admin/listings/l-rental')
      .set(as('staff', 'ADMIN'))
      .send({ safetyVerified: true, checkNote: 'Rang the owner and saw the room myself.' })
      .expect(400);
    expect(res.body.message).toContain('Only a DV-safe, emergency or transitional listing');
    expect(prisma.housingListing.update).not.toHaveBeenCalled();
  });

  it('comes off a checked DV-safe listing that staff show as an ordinary one, as it does when the lister lowers the claim', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...safeHouse, status: 'PENDING' });
    await request(app).patch('/api/housing/admin/listings/l-safe').set(as('staff', 'ADMIN')).send({ dvSafe: false, status: 'ACTIVE' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ safetyVerified: false, dvSafe: false, status: 'ACTIVE' });
    // No provider check is asked for: the listing is no longer confidential.
    expect(prisma.housingProviderVerification.findUnique).not.toHaveBeenCalled();
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told.userId).toBe('lister');
    expect(told.message).toContain('ordinary listing');
  });

  it('taking a listing down also ends its check, so its lister cannot put it back with the badge on', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...waiting, safetyVerified: true, status: 'ACTIVE' });
    await request(app).patch('/api/housing/admin/listings/l-wait').set(as('staff', 'ADMIN')).send({ status: 'WITHDRAWN' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ safetyVerified: false, status: 'WITHDRAWN', features: [...waiting.features, expect.stringMatching(/^staff-takedown:/)] });
  });

  it('puts the lister standing in the staff queue, beside each listing', async () => {
    prisma.housingListing.findMany.mockResolvedValue([waiting, { ...waiting, id: 'l-other', agentId: 'other' }]);
    prisma.housingProviderVerification.findMany.mockResolvedValue([standingProvider()]);
    const res = await request(app).get('/api/housing/admin/pending').set(as('staff', 'ADMIN')).expect(200);
    const byId = Object.fromEntries(res.body.data.map((l: any) => [l.id, l.providerCheck.standing]));
    expect(byId).toEqual({ 'l-wait': 'APPROVED', 'l-other': 'NONE' });
  });
});

describe('Asking to be checked as a provider', () => {
  const application = { providerName: 'Quiet Streets Housing', relationship: 'SERVICE', statement: 'We run three units for women leaving violence in Brisbane.' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'VERIFIED', dvSafetyProfile: null });
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
    prisma.housingProviderVerification.upsert.mockImplementation(async ({ create, update }: any) => ({
      id: 'prov-1',
      submittedAt: new Date(),
      reviewedAt: null,
      expiresAt: null,
      basis: null,
      ...create,
      ...update,
    }));
  });

  it('is for a signed-in member', async () => {
    await request(app).get('/api/housing/my/provider-check').expect(401);
    await request(app).post('/api/housing/my/provider-check').send(application).expect(401);
  });

  it('tells a member who has not asked that she can, and what the choices are', async () => {
    const res = await request(app).get('/api/housing/my/provider-check').set(as('lister')).expect(200);
    expect(res.body.data).toMatchObject({ standing: 'NONE', canApply: true, renewalWindowDays: 30 });
    expect(res.body.data.relationships.map((r: any) => r.value)).toEqual(['OWNER', 'AGENT', 'SERVICE']);
  });

  it('files the request as waiting, keeps the ABN as digits, and tells staff', async () => {
    const res = await request(app)
      .post('/api/housing/my/provider-check')
      .set(as('lister'))
      .send({ ...application, abn: '51 824 753 556' })
      .expect(201);

    const call = prisma.housingProviderVerification.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'lister' });
    expect(call.create).toMatchObject({ userId: 'lister', providerName: 'Quiet Streets Housing', relationship: 'SERVICE', abn: '51824753556', status: 'PENDING' });
    expect(res.body.data.standing).toBe('PENDING');
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told.userId).toBe('admin-1');
    expect(told.link).toBe('/admin/housing#provider-checks');
  });

  it.each([
    ['no name', { ...application, providerName: '' }],
    ['a relationship that is not one of the three', { ...application, relationship: 'LANDLORD' }],
    ['no statement', { ...application, statement: 'Hi' }],
    ['an ABN that does not add up', { ...application, abn: '12 345 678 901' }],
  ])('refuses %s', async (_what, body) => {
    await request(app).post('/api/housing/my/provider-check').set(as('lister')).send(body).expect(400);
    expect(prisma.housingProviderVerification.upsert).not.toHaveBeenCalled();
  });

  it('does not let a standing check be reset months before it ends, and does inside the last month', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
    const early = await request(app).post('/api/housing/my/provider-check').set(as('lister')).send(application).expect(409);
    expect(early.body.message).toContain('stands until');
    expect(prisma.housingProviderVerification.upsert).not.toHaveBeenCalled();

    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider({ expiresAt: new Date(Date.now() + 10 * DAY) }));
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => ({ ...standingProvider(), ...data }));
    await request(app).post('/api/housing/my/provider-check').set(as('lister')).send(application).expect(201);
    // A renewal request leaves the standing check standing while staff look.
    expect(prisma.housingProviderVerification.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('never shows a member what staff wrote as the basis of an approval', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
    const res = await request(app).get('/api/housing/my/provider-check').set(as('lister')).expect(200);
    expect(res.body.data.standing).toBe('APPROVED');
    expect(JSON.stringify(res.body)).not.toContain('Rang two references');
  });

  it('does show a member the reason a check was refused', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider({ status: 'REJECTED', expiresAt: null, basis: 'We could not match the ABN to the name you gave.' }));
    const res = await request(app).get('/api/housing/my/provider-check').set(as('lister')).expect(200);
    expect(res.body.data).toMatchObject({ standing: 'REJECTED', decisionNote: 'We could not match the ABN to the name you gave.', canApply: true });
  });
});

describe('Deciding a provider check', () => {
  const staff = as('staff', 'ADMIN');
  const decision = { decision: 'APPROVE', basis: 'Rang two references and checked the ABN on the register.' };
  const pending = () => standingProvider({ status: 'PENDING', expiresAt: null, reviewedAt: null, basis: null });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingProviderVerification.findUnique.mockResolvedValue(pending());
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => ({ ...pending(), ...data }));
    prisma.housingProviderVerification.findMany.mockResolvedValue([]);
    prisma.housingListing.findMany.mockResolvedValue([]);
  });

  it('is for staff only, in the queue and in the decision', async () => {
    await request(app).get('/api/housing/admin/provider-checks').set(as('member')).expect(403);
    await request(app).patch('/api/housing/admin/provider-checks/lister').set(as('member')).send(decision).expect(403);
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
  });

  it('lists what is waiting and what is about to end, with the member beside each', async () => {
    prisma.housingProviderVerification.findMany.mockImplementation(async ({ where }: any) =>
      where.status === 'PENDING'
        ? [{ ...pending(), user: { id: 'lister', email: 'ada@example.com' } }]
        : [{ ...standingProvider({ expiresAt: new Date(Date.now() + 5 * DAY), submittedAt: new Date() }), user: { id: 'lister' } }]
    );
    const res = await request(app).get('/api/housing/admin/provider-checks').set(staff).expect(200);
    expect(res.body.data.waiting).toHaveLength(1);
    expect(res.body.data.waiting[0]).toMatchObject({ providerName: 'Quiet Streets Housing', relationshipLabel: expect.stringContaining('housing service'), standing: 'PENDING' });
    expect(res.body.data.ending[0]).toMatchObject({ standing: 'APPROVED', renewalRequested: true });
    const ask = prisma.housingProviderVerification.findMany.mock.calls.find((c: any) => c[0].where.status === 'APPROVED')[0];
    expect(ask.where.expiresAt.lte).toBeInstanceOf(Date);
  });

  // Staff could take a check back only in the last month of its year, because
  // the queue showed nothing else: a check that was found to be unsafe in month
  // three could not be found to be withdrawn.
  it('lists the checks that stand beyond the month as well, so staff can withdraw one, and does not call a lapsed one "ending"', async () => {
    prisma.housingProviderVerification.findMany.mockImplementation(async ({ where }: any) => {
      if (where.status !== 'APPROVED' || where.expiresAt.lte) return [];
      return [{ ...standingProvider(), user: { id: 'lister' } }];
    });
    const res = await request(app).get('/api/housing/admin/provider-checks').set(staff).expect(200);

    expect(res.body.data.standing).toHaveLength(1);
    expect(res.body.data.standing[0]).toMatchObject({ standing: 'APPROVED', userId: 'lister' });
    expect(res.body.data.ending).toEqual([]);
    const reads = prisma.housingProviderVerification.findMany.mock.calls.map((c: any) => c[0].where).filter((w: any) => w.status === 'APPROVED');
    const ending = reads.find((w: any) => w.expiresAt.lte);
    const standing = reads.find((w: any) => !w.expiresAt.lte);
    expect(ending.expiresAt.gt).toBeInstanceOf(Date);
    expect(standing.expiresAt.gt.getTime()).toBe(ending.expiresAt.lte.getTime());
  });

  it('needs the basis, in words, for either answer', async () => {
    for (const body of [{ decision: 'APPROVE' }, { decision: 'APPROVE', basis: 'ok' }, { decision: 'REJECT', basis: '' }, { decision: 'MAYBE', basis: 'A sentence of reasons here.' }]) {
      await request(app).patch('/api/housing/admin/provider-checks/lister').set(staff).send(body).expect(400);
    }
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
  });

  it('approves for a year by default, records who and what, and tells the member', async () => {
    const res = await request(app)
      .patch('/api/housing/admin/provider-checks/lister')
      .set(staff)
      .send({ ...decision, checks: { abnChecked: true, referencesCalled: true } })
      .expect(200);

    const data = prisma.housingProviderVerification.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'APPROVED', basis: decision.basis, reviewedById: 'staff' });
    const days = (data.expiresAt.getTime() - data.reviewedAt.getTime()) / DAY;
    expect(Math.round(days)).toBe(365);
    expect(data.evidence).toMatchObject({ checks: { abnChecked: true, referencesCalled: true } });
    expect(res.body.data.standing).toBe('APPROVED');
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told).toMatchObject({ userId: 'lister', title: 'Your provider check is approved', link: '/dashboard/housing#provider-check' });
  });

  it('will not stand for longer than two years, whatever staff type', async () => {
    await request(app).patch('/api/housing/admin/provider-checks/lister').set(staff).send({ ...decision, validForDays: 4000 }).expect(400);
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
  });

  it('a member of staff cannot decide their own check', async () => {
    const res = await request(app).patch('/api/housing/admin/provider-checks/staff').set(staff).send(decision).expect(403);
    expect(res.body.message).toContain('your own provider check');
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
  });

  it('answers 404 for a member who never asked', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/housing/admin/provider-checks/nobody').set(staff).send(decision).expect(404);
  });

  it('will not turn a refusal into an approval the member never asked for', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider({ status: 'REJECTED', expiresAt: null }));
    const res = await request(app).patch('/api/housing/admin/provider-checks/lister').set(staff).send(decision).expect(409);
    expect(res.body.message).toContain('has to ask again');
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
  });

  it('refusing says why to the member, and takes the badge off their listings straight away', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(standingProvider());
    prisma.housingListing.findMany.mockResolvedValue([{ id: 'l-1', agentId: 'lister', title: 'Quiet unit', features: ['dv-safe-note:x'] }]);
    prisma.housingProviderVerification.findMany.mockResolvedValue([{ userId: 'lister', status: 'REJECTED', expiresAt: null }]);

    await request(app)
      .patch('/api/housing/admin/provider-checks/lister')
      .set(staff)
      .send({ decision: 'REJECT', basis: 'We could not match the ABN to the name you gave us.' })
      .expect(200);

    expect(prisma.housingProviderVerification.update.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', expiresAt: null });
    // Their badged listings, and only theirs, were looked at and unbadged.
    expect(prisma.housingListing.findMany.mock.calls[0][0].where).toMatchObject({ agentId: 'lister', safetyVerified: true });
    const takeDown = prisma.housingListing.updateMany.mock.calls[0][0];
    expect(takeDown.where).toEqual({ id: 'l-1', safetyVerified: true });
    expect(takeDown.data).toMatchObject({ safetyVerified: false, status: 'PENDING' });
    // One message, carrying the reason, not two.
    const told = prisma.notification.create.mock.calls.map((c: any) => c[0].data).filter((n: any) => n.userId === 'lister');
    expect(told).toHaveLength(1);
    expect(told[0].message).toContain('could not match the ABN');
    expect(told[0].message).toContain('are off the list');
  });
});

/**
 * "Keep notifications vague" and the housing bell.
 *
 * A housing note names the place and quotes the person on the other end. Push and
 * email are shaped by the member's setting; this in-app list was the one that was
 * not, and it holds, for a woman whose phone someone else picks up, a record that
 * she was asking about a safe place.
 */
describe('housing notices and a member who keeps her notifications vague', () => {
  const askerThread = {
    id: 'inq-4f2a',
    userId: 'survivor',
    listingId: 'l-safe',
    status: 'CONTACTED',
    notes: null,
    listing: { id: 'l-safe', title: 'Quiet unit, secure entry', agentId: 'lister', dvSafe: true, type: 'RENTAL' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.profile.findUnique.mockResolvedValue(null);
    prisma.housingInquiry.findUnique.mockResolvedValue(askerThread);
    prisma.housingInquiry.update.mockImplementation(async ({ data }: any) => ({ ...askerThread, ...data, listing: askerThread.listing }));
  });

  it('writes the real words for a lister who has asked for nothing', async () => {
    await request(app).patch('/api/housing/inquiries/inq-4f2a').set(as('survivor')).send({ reply: 'Monday works.' }).expect(200);

    const told = prisma.notification.create.mock.calls.at(-1)[0].data;
    expect(told.userId).toBe('lister');
    expect(told.message).toContain('Monday works.');
    expect(told.message).toContain('Quiet unit, secure entry');
  });

  it('writes the vague wording, with neither the place nor the words, for one who has', async () => {
    prisma.dvSafetyProfile.findUnique.mockImplementation(async ({ where }: any) => (where.userId === 'lister' ? { notificationsSafe: true, isSafeMode: false } : null));

    await request(app).patch('/api/housing/inquiries/inq-4f2a').set(as('survivor')).send({ reply: 'Monday works.' }).expect(200);

    const told = prisma.notification.create.mock.calls.at(-1)[0].data;
    expect(told.userId).toBe('lister');
    expect(told.title).toBe('New Update');
    expect(told.message).toBe('You have a new update. Open app to view.');
    expect(JSON.stringify(told)).not.toContain('Monday works');
    expect(JSON.stringify(told)).not.toContain('Quiet unit');
    expect(JSON.stringify(told)).not.toContain('Applicant');
    // The link is what opens the housing page, where the words are.
    expect(told.link).toBe('/dashboard/housing#list-a-place');
  });

  it('shapes the notice to the asker too, for a member in Safe Mode from the Safety Centre', async () => {
    prisma.profile.findUnique.mockImplementation(async ({ where }: any) => (where.userId === 'survivor' ? { isSafeMode: true } : null));
    prisma.housingInquiry.update.mockImplementation(async ({ data }: any) => ({ ...askerThread, ...data, user: { id: 'survivor' } }));

    await request(app).patch('/api/housing/listings/l-safe/inquiries/inq-4f2a').set(as('lister')).send({ message: 'It is free from Monday.' }).expect(200);

    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told.userId).toBe('survivor');
    expect(told.title).toBe('New Update');
    expect(JSON.stringify(told)).not.toContain('free from Monday');
  });

  it('still tells the lister when the setting cannot be read, and tells her nothing real', async () => {
    prisma.dvSafetyProfile.findUnique.mockRejectedValue(new Error('connection lost'));

    await request(app).patch('/api/housing/inquiries/inq-4f2a').set(as('survivor')).send({ reply: 'Monday works.' }).expect(200);

    const told = prisma.notification.create.mock.calls.at(-1)[0].data;
    expect(told.title).toBe('New Update');
    expect(JSON.stringify(told)).not.toContain('Monday works');
  });
});

/**
 * Taking an inquiry back. Withdrawing only changed its status, so what she asked
 * and every line of the thread stayed on /my/inquiries for as long as the account
 * did.
 */
describe('DELETE /api/housing/inquiries/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingInquiry.findUnique.mockResolvedValue({ id: 'inq-1', userId: 'survivor', listing: { agentId: 'lister' } });
    prisma.housingInquiry.delete = jest.fn(async () => ({}));
    prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('removes her own inquiry, with the thread it carries, and tells no one', async () => {
    await request(app).delete('/api/housing/inquiries/inq-1').set(as('survivor')).expect(200);

    expect(prisma.housingInquiry.delete).toHaveBeenCalledWith({ where: { id: 'inq-1' } });
    // Nobody is notified that she took it back.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('takes the notices the lister was given about it with it, so no bell entry points at a thread that is gone', async () => {
    await request(app).delete('/api/housing/inquiries/inq-1').set(as('survivor')).expect(200);

    // Bounded to the two members who are ever sent one, so it uses the userId index
    // and is not a scan of every notification for a value inside the JSON.
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ['survivor', 'lister'] }, data: { path: ['inquiryId'], equals: 'inq-1' } },
    });
  });

  it('is still removed when the lister notices cannot be cleared', async () => {
    prisma.notification.deleteMany.mockRejectedValue(new Error('table locked'));

    await request(app).delete('/api/housing/inquiries/inq-1').set(as('survivor')).expect(200);

    expect(prisma.housingInquiry.delete).toHaveBeenCalled();
  });

  it('is not hers to remove if she did not make it, and removes nothing', async () => {
    await request(app).delete('/api/housing/inquiries/inq-1').set(as('someone-else')).expect(403);

    expect(prisma.housingInquiry.delete).not.toHaveBeenCalled();
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it('answers 404 for an inquiry that is not there, and 401 to someone not signed in', async () => {
    prisma.housingInquiry.findUnique.mockResolvedValue(null);
    await request(app).delete('/api/housing/inquiries/nope').set(as('survivor')).expect(404);
    await request(app).delete('/api/housing/inquiries/inq-1').expect(401);

    expect(prisma.housingInquiry.delete).not.toHaveBeenCalled();
  });
});

/**
 * What a listing may say and show. The words on a confidential listing reach
 * every eligible member before the lister has answered anyone, which is exactly
 * when the address is withheld; so they carry neither the street address nor a
 * phone number, and every listing's words go through the screen a post goes
 * through. The pictures are links a browser may follow, and no more than ten.
 */
describe('What a listing may say and show', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertContentAllowed.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({ womanVerificationStatus: 'VERIFIED', dvSafetyProfile: null });
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.housingListing.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
  });

  const post = (body: Record<string, unknown>) =>
    request(app).post('/api/housing/listings').set(as('lister')).send({ title: 'Quiet unit', description: 'Secure entry, close to transport.', type: 'RENTAL', ...body });

  it('refuses a street address or a phone number on a confidential listing, and writes nothing', async () => {
    const withAddress = await post({ dvSafe: true, dvSafeNote: 'I live upstairs', description: 'Secure unit at 12 Example Street, Ashgrove.' }).expect(400);
    expect(withAddress.body.message).toContain('street address');

    const withPhone = await post({ type: 'EMERGENCY', title: 'Bed tonight, ring 0400 000 000' }).expect(400);
    expect(withPhone.body.message).toContain('phone number');

    expect(prisma.housingListing.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('lets an ordinary listing say where it is: its lister chooses, and the address column is withheld as everywhere', async () => {
    await post({ description: 'Secure unit at 12 Example Street, Ashgrove.' }).expect(201);
    expect(prisma.housingListing.create).toHaveBeenCalledTimes(1);
  });

  it('puts the words through the same screen as a post, and a refusal stops the write', async () => {
    await post({}).expect(201);
    expect(assertContentAllowed).toHaveBeenCalledWith('Quiet unit\nSecure entry, close to transport.', { kind: 'housing_listing', userId: 'lister' });

    const { ApiError } = jest.requireActual('../../middleware/errorHandler') as typeof import('../../middleware/errorHandler');
    assertContentAllowed.mockRejectedValueOnce(new ApiError(400, 'This content violates our community guidelines'));
    await post({ title: 'Something the screen refuses' }).expect(400);
    expect(prisma.housingListing.create).toHaveBeenCalledTimes(1);
  });

  it('screens new words on a change too: the address rule on a confidential listing, the gate on any, and not a saved form that repeats them', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ ...safeHouse, description: 'Secure entry.', status: 'PENDING', safetyVerified: false });
    prisma.housingListing.update.mockImplementation(async ({ data }: any) => ({ ...safeHouse, description: 'Secure entry.', ...data }));

    const res = await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ description: 'Ring me on (07) 3123 4567 for the address.' }).expect(400);
    expect(res.body.message).toContain('phone number');
    expect(prisma.housingListing.update).not.toHaveBeenCalled();

    await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ description: 'Secure entry and a quiet street.' }).expect(200);
    expect(assertContentAllowed).toHaveBeenCalledWith(`${safeHouse.title}\nSecure entry and a quiet street.`, { kind: 'housing_listing', userId: 'lister' });

    assertContentAllowed.mockClear();
    await request(app).patch('/api/housing/listings/l-safe').set(as('lister')).send({ rentWeekly: 410, description: 'Secure entry.' }).expect(200);
    expect(assertContentAllowed).not.toHaveBeenCalled();
  });

  it('takes pictures only as a short list of http(s) links, and stores them trimmed', async () => {
    await post({ images: 'https://cdn.example.com/a.jpg' }).expect(400);
    await post({ images: ['javascript:alert(1)'] }).expect(400);
    await post({ images: [{ url: 'https://cdn.example.com/a.jpg' }] }).expect(400);
    await post({ images: Array.from({ length: 11 }, (_v, i) => `https://cdn.example.com/${i}.jpg`) }).expect(400);
    expect(prisma.housingListing.create).not.toHaveBeenCalled();

    await post({ images: [' https://cdn.example.com/a.jpg ', 'http://cdn.example.com/b.jpg'] }).expect(201);
    expect(prisma.housingListing.create.mock.calls[0][0].data.images).toEqual(['https://cdn.example.com/a.jpg', 'http://cdn.example.com/b.jpg']);
  });
});
