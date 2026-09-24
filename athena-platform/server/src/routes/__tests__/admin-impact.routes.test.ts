import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    communitySupportProgram: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data, milestones: [], _count: { enrollments: 0 } })),
      update: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })),
    },
    programMilestone: { count: jest.fn(async () => 0), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'm1', ...data })), update: jest.fn(), delete: jest.fn() },
    bridgingProgram: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'b1', ...data })), update: jest.fn() },
    dVSupportService: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 's1', ...data })), update: jest.fn(), delete: jest.fn() },
    impactPartner: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'ip1', ...data })), update: jest.fn() },
    indigenousCommunityPage: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'c1', ...data })), update: jest.fn(), delete: jest.fn() },
    indigenousResource: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
    internationalCredential: {
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'cr1', ...data })),
    },
    notification: { create: jest.fn(async () => ({})) },
    user: { findUnique: jest.fn(async () => ({ email: 'amina@example.com', firstName: 'Amina' })) },
  },
}));

// The real requireRole, with the caller's role taken from a header.
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff', role: req.headers['x-test-role'] || 'ADMIN', email: 'staff@athena.com', persona: 'EARLY_CAREER' };
      next();
    },
  };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';

const prisma: any = prismaTyped;
const as = (role: string) => ({ 'x-test-role': role });

describe('Admin impact catalogues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://app.example';
  });

  it('is the platform admin’s alone', async () => {
    await request(app).get('/api/admin/impact/programs').set(as('USER')).expect(403);
    await request(app).get('/api/admin/impact/programs').set(as('MODERATOR')).expect(403);
    await request(app).get('/api/admin/impact/dv-services').set(as('USER')).expect(403);
    await request(app).get('/api/admin/credentials').set(as('MODERATOR')).expect(403);
    expect(prisma.communitySupportProgram.findMany).not.toHaveBeenCalled();

    await request(app).get('/api/admin/impact/programs').set(as('ADMIN')).expect(200);
    expect(prisma.communitySupportProgram.findMany).toHaveBeenCalledTimes(1);
  });

  it('creates a program with its lists defaulted and refuses a nonsense one', async () => {
    const res = await request(app)
      .post('/api/admin/impact/programs')
      .send({ name: 'Settled and Working', communityType: 'REFUGEE_IMMIGRANT', description: 'A twelve-week settlement-to-work program.', startDate: '2026-10-01' })
      .expect(201);
    const data = prisma.communitySupportProgram.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Settled and Working', communityType: 'REFUGEE_IMMIGRANT', objectives: [], partnerOrgs: [] });
    expect(data.startDate).toBeInstanceOf(Date);
    expect(res.body.data.id).toBe('p1');

    await request(app).post('/api/admin/impact/programs').send({ name: 'X', communityType: 'MARTIAN', description: 'short' }).expect(400);
    await request(app).post('/api/admin/impact/programs').send({ name: 'Settled', communityType: 'GENERAL', description: 'Long enough description.', surprise: true }).expect(400);
  });

  it('retires a program rather than deleting it, and adds milestones in order', async () => {
    prisma.communitySupportProgram.findUnique.mockResolvedValue({ id: 'p1' });
    await request(app).delete('/api/admin/impact/programs/p1').expect(200);
    expect(prisma.communitySupportProgram.update.mock.calls[0][0].data).toEqual({ isActive: false });

    prisma.programMilestone.count.mockResolvedValue(2);
    await request(app).post('/api/admin/impact/programs/p1/milestones').send({ title: 'First interview', requiredForCompletion: true }).expect(201);
    expect(prisma.programMilestone.create.mock.calls[0][0].data).toMatchObject({ programId: 'p1', title: 'First interview', orderIndex: 2, requiredForCompletion: true });

    prisma.programMilestone.findUnique.mockResolvedValue({ id: 'm1', _count: { progress: 3 } });
    await request(app).delete('/api/admin/impact/milestones/m1').expect(409);
    expect(prisma.programMilestone.delete).not.toHaveBeenCalled();
  });

  it('a DV service must carry a real phone number and a real state, or be national', async () => {
    const base = { name: 'DVConnect Womensline', type: 'CRISIS', available24x7: true };

    await request(app).post('/api/admin/impact/dv-services').send({ ...base, phone: 'call me', state: 'QLD' }).expect(400);
    await request(app).post('/api/admin/impact/dv-services').send({ ...base, phone: '1800 811 811', state: 'Queensland' }).expect(400);
    await request(app).post('/api/admin/impact/dv-services').send({ ...base, phone: '1800 811 811' }).expect(400);
    await request(app).post('/api/admin/impact/dv-services').send({ ...base, type: 'MAGIC', phone: '1800 811 811', state: 'QLD' }).expect(400);
    expect(prisma.dVSupportService.create).not.toHaveBeenCalled();

    await request(app).post('/api/admin/impact/dv-services').send({ ...base, phone: '1800 811 811', state: 'qld', website: 'https://www.dvconnect.org' }).expect(201);
    expect(prisma.dVSupportService.create.mock.calls[0][0].data).toMatchObject({ name: 'DVConnect Womensline', type: 'CRISIS', phone: '1800 811 811', state: 'QLD', available24x7: true });

    await request(app).post('/api/admin/impact/dv-services').send({ name: '1800RESPECT', type: 'CRISIS', phone: '1800 737 732', isNational: true }).expect(201);
    await request(app).post('/api/admin/impact/dv-services').send({ name: 'Bad link', type: 'LEGAL', isNational: true, website: 'javascript:alert(1)' }).expect(400);
  });

  // Entering a service is somebody having just looked at it. Without this the
  // directory could never say how old any of it was, and a crisis number that
  // has changed is worse than no number, because she rings it when she needs it.
  it('stamps when a service was last checked, on entry and on every edit', async () => {
    await request(app)
      .post('/api/admin/impact/dv-services')
      .send({ name: 'DVConnect Womensline', type: 'CRISIS', phone: '1800 811 811', state: 'QLD' })
      .expect(201);
    expect(prisma.dVSupportService.create.mock.calls[0][0].data.lastCheckedAt).toBeInstanceOf(Date);

    prisma.dVSupportService.findUnique.mockResolvedValue({ id: 's1', state: 'QLD', isNational: false });
    prisma.dVSupportService.update.mockResolvedValue({ id: 's1' });
    await request(app).patch('/api/admin/impact/dv-services/s1').send({ phone: '1800 811 812' }).expect(200);
    expect(prisma.dVSupportService.update.mock.calls[0][0].data.lastCheckedAt).toBeInstanceOf(Date);
  });

  // A service that closes can be retired instead of deleted, so the record that
  // ATHENA once listed it survives — that is a different fact from never having
  // listed it, on a page like this one.
  it('retires a service without losing the row', async () => {
    prisma.dVSupportService.findUnique.mockResolvedValue({ id: 's1', state: 'QLD', isNational: false });
    prisma.dVSupportService.update.mockResolvedValue({ id: 's1', isActive: false });

    await request(app).patch('/api/admin/impact/dv-services/s1').send({ isActive: false }).expect(200);

    expect(prisma.dVSupportService.update.mock.calls[0][0].data).toMatchObject({ isActive: false });
    expect(prisma.dVSupportService.delete).not.toHaveBeenCalled();
  });

  it('a community page with members cannot be removed', async () => {
    prisma.indigenousCommunityPage.findUnique.mockResolvedValue({ id: 'c1', _count: { members: 4, resources: 0 } });
    await request(app).delete('/api/admin/impact/indigenous/communities/c1').expect(409);
    expect(prisma.indigenousCommunityPage.delete).not.toHaveBeenCalled();

    prisma.indigenousCommunityPage.findUnique.mockResolvedValue({ id: 'c2', _count: { members: 0, resources: 1 } });
    await request(app).delete('/api/admin/impact/indigenous/communities/c2').expect(200);
    expect(prisma.indigenousResource.updateMany.mock.calls[0][0]).toEqual({ where: { communityId: 'c2' }, data: { communityId: null } });
    expect(prisma.indigenousCommunityPage.delete).toHaveBeenCalledTimes(1);
  });
});

describe('Admin credentials queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://app.example';
  });

  it('lists pending credentials with the reference table’s suggestion beside each', async () => {
    prisma.internationalCredential.findMany.mockResolvedValue([
      { id: 'cr1', userId: 'u1', credentialName: 'Bachelor of Nursing', fieldOfStudy: 'Nursing', status: 'PENDING_REVIEW', user: { id: 'u1', firstName: 'Amina', lastName: null, email: 'amina@example.com' } },
    ]);
    const res = await request(app).get('/api/admin/credentials').expect(200);
    expect(prisma.internationalCredential.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING_REVIEW' });
    expect(res.body.data[0].suggestion.body.name).toContain('ANMAC');
    expect(res.body.reference.bodies.length).toBeGreaterThan(10);

    await request(app).get('/api/admin/credentials?status=all').expect(200);
    expect(prisma.internationalCredential.findMany.mock.calls[1][0].where).toEqual({});
  });

  it('recording a decision stamps the outcome and tells the member in the app and by email', async () => {
    prisma.internationalCredential.findUnique.mockResolvedValue({ id: 'cr1', userId: 'u1', credentialName: 'Bachelor of Nursing', fieldOfStudy: 'Nursing', status: 'PENDING_REVIEW', australianEquiv: null, bridgingRequired: null, assessmentDate: null });

    await request(app)
      .patch('/api/admin/credentials/cr1')
      .send({ status: 'BRIDGING_REQUIRED', assessmentBody: 'ANMAC', bridgingRequired: 'IRON program', australianEquiv: 'Bachelor of Nursing (AQF 7)', notes: 'ANMAC wrote on 12 September.' })
      .expect(200);

    const data = prisma.internationalCredential.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'BRIDGING_REQUIRED', assessmentBody: 'ANMAC', bridgingRequired: 'IRON program', australianEquiv: 'Bachelor of Nursing (AQF 7)', notes: 'ANMAC wrote on 12 September.' });
    expect(data.assessmentDate).toBeInstanceOf(Date);

    const notification = prisma.notification.create.mock.calls[0][0].data;
    expect(notification).toMatchObject({ userId: 'u1', type: 'SYSTEM', link: '/dashboard/impact/migrant' });
    expect(notification.message).toContain('IRON program');

    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('amina@example.com');
    expect(mail.text).toContain('Hi Amina,');
    expect(mail.text).toContain('https://app.example/dashboard/impact/migrant');

    await request(app).patch('/api/admin/credentials/cr1').send({ status: 'MAYBE' }).expect(400);
    await request(app).patch('/api/admin/credentials/cr1').set(as('USER')).send({ status: 'RECOGNIZED' }).expect(403);
  });

  it('answers 404 for a credential that does not exist', async () => {
    prisma.internationalCredential.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/admin/credentials/nope').send({ status: 'RECOGNIZED' }).expect(404);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
