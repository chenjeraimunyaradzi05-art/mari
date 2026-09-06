import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    housingListing: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    housingInquiry: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
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
