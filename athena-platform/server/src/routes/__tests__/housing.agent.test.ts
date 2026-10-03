import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    housingListing: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    housingInquiry: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    // Read when a notice is written, for the member's "keep notifications vague".
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    profile: { findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'seeker', role: 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

const inquiry = {
  id: 'i1',
  listingId: 'l1',
  userId: 'seeker',
  status: 'PENDING',
  listing: { id: 'l1', title: 'Sunny room in Paddington', agentId: 'agent' },
};

describe('The agent’s side of housing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingInquiry.findUnique.mockResolvedValue(inquiry);
  });

  it('lists the places you listed, with who has asked about them', async () => {
    prisma.housingListing.findMany.mockResolvedValue([{ id: 'l1', title: 'Sunny room', inquiries: [] }]);
    const res = await request(app).get('/api/housing/my/listings').set(as('agent')).expect(200);
    expect(prisma.housingListing.findMany.mock.calls[0][0].where).toEqual({ agentId: 'agent' });
    expect(res.body.data[0].id).toBe('l1');
  });

  it('the agent answers an inquiry and the asker is told', async () => {
    await request(app)
      .patch('/api/housing/listings/l1/inquiries/i1')
      .set(as('agent'))
      .send({ status: 'VIEWING_SCHEDULED', viewingDate: '2026-09-12T00:30:00.000Z', message: 'Bring ID and a reference.' })
      .expect(200);

    expect(prisma.housingInquiry.update.mock.calls[0][0].data).toMatchObject({ status: 'VIEWING_SCHEDULED' });
    expect(prisma.housingInquiry.update.mock.calls[0][0].data.viewingDate).toBeInstanceOf(Date);
    const note = prisma.notification.create.mock.calls[0][0].data;
    expect(note.userId).toBe('seeker');
    expect(note.message).toContain('Sunny room in Paddington');
    expect(note.message).toContain('Bring ID');
  });

  it('a viewing needs a date, and a stranger cannot answer at all', async () => {
    await request(app).patch('/api/housing/listings/l1/inquiries/i1').set(as('agent')).send({ status: 'VIEWING_SCHEDULED' }).expect(400);
    await request(app).patch('/api/housing/listings/l1/inquiries/i1').set(as('stranger')).send({ status: 'APPROVED' }).expect(403);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('the person asking can withdraw or say she applied, but not approve herself', async () => {
    await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'APPROVED' }).expect(400);
    await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'WITHDRAWN' }).expect(200);
    expect(prisma.housingInquiry.update.mock.calls[0][0].data).toMatchObject({ status: 'WITHDRAWN' });
  });

  it('only the lister changes a listing', async () => {
    prisma.housingListing.findUnique.mockResolvedValue({ id: 'l1', agentId: 'agent' });
    await request(app).patch('/api/housing/listings/l1').set(as('stranger')).send({ status: 'LEASED' }).expect(403);
    await request(app).patch('/api/housing/listings/l1').set(as('agent')).send({ status: 'LEASED', rentWeekly: '420' }).expect(200);
    expect(prisma.housingListing.update.mock.calls[0][0].data).toEqual({ status: 'LEASED', rentWeekly: 420 });
  });
});

/**
 * The address is released by the lister's answer and nothing else. The asker's
 * route used to write whatever status it was sent, and APPLICATION_SUBMITTED is
 * one of the states that releases the address: a pending inquiry on a DV-safe
 * place could be moved there by the asker alone, and the route's own answer
 * carried the street address, with the lister never having said a word.
 */
describe('What the asker can move an inquiry to', () => {
  const safeListing = { id: 'l1', title: 'Quiet unit', agentId: 'agent', dvSafe: true, type: 'RENTAL', status: 'ACTIVE', safetyVerified: true, address: '7 Hidden Lane', suburb: 'Ashgrove', city: 'Brisbane', state: 'QLD', postcode: '4060', features: [] };
  const at = (status: string) => ({ ...inquiry, status, notes: null, listing: safeListing });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.housingInquiry.update.mockImplementation(async ({ data }: any) => ({ ...at(data.status ?? 'PENDING'), ...data }));
  });

  it('cannot say she has applied while the lister has not answered, and is handed no address', async () => {
    prisma.housingInquiry.findUnique.mockResolvedValue(at('PENDING'));

    const res = await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'APPLICATION_SUBMITTED' }).expect(409);

    expect(res.body.message).toContain('once the lister has been in touch');
    expect(JSON.stringify(res.body)).not.toContain('Hidden Lane');
    expect(prisma.housingInquiry.update).not.toHaveBeenCalled();
  });

  it('can say so once the lister has been in touch, and the address comes with the answer', async () => {
    prisma.housingInquiry.findUnique.mockResolvedValue(at('CONTACTED'));

    const res = await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'APPLICATION_SUBMITTED' }).expect(200);

    expect(prisma.housingInquiry.update.mock.calls[0][0].data).toMatchObject({ status: 'APPLICATION_SUBMITTED' });
    expect(res.body.data.listing.address).toBe('7 Hidden Lane');
  });

  it('does not reopen a declined or withdrawn inquiry: not by applying, withdrawing or writing', async () => {
    for (const status of ['DECLINED', 'WITHDRAWN']) {
      prisma.housingInquiry.findUnique.mockResolvedValue(at(status));
      const res = await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'APPLICATION_SUBMITTED' }).expect(409);
      expect(res.body.message).toBe('This inquiry is closed');
      await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'WITHDRAWN' }).expect(409);
      await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ reply: 'Still interested' }).expect(400);
    }
    expect(prisma.housingInquiry.update).not.toHaveBeenCalled();
  });

  it('can withdraw from any open state, which releases nothing', async () => {
    for (const status of ['PENDING', 'CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED']) {
      prisma.housingInquiry.findUnique.mockResolvedValue(at(status));
      const res = await request(app).patch('/api/housing/inquiries/i1').set(as('seeker')).send({ status: 'WITHDRAWN' }).expect(200);
      expect(res.body.data.listing.address).toBeNull();
    }
    expect(prisma.housingInquiry.update).toHaveBeenCalledTimes(5);
  });
});
