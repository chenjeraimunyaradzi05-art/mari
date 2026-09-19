import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    internationalCredential: {
      findFirst: jest.fn(),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    bridgingProgram: { findMany: jest.fn(async () => []) },
    languageProfile: { findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Credential pathway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.languageProfile.findUnique.mockResolvedValue(null);
  });

  it('names ANMAC for a nursing degree and searches bridging programs by profession', async () => {
    const res = await request(app).get('/api/community-support/credentials/pathway?fieldOfStudy=Nursing&credentialName=Bachelor%20of%20Science%20in%20Nursing').expect(200);

    const { pathway } = res.body.data;
    expect(pathway.matched).toBe(true);
    expect(pathway.profession.id).toBe('nursing');
    expect(pathway.body.name).toContain('ANMAC');
    expect(pathway.body.url).toBe('https://www.anmac.org.au');
    expect(pathway.also[0].name).toContain('Nursing and Midwifery Board');

    const where = prisma.bridgingProgram.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toContainEqual({ profession: { contains: 'nursing', mode: 'insensitive' } });
  });

  it('sends everything else to VETASSESS, without pretending it matched', async () => {
    const res = await request(app).get('/api/community-support/credentials/pathway?fieldOfStudy=Philosophy').expect(200);
    expect(res.body.data.pathway.matched).toBe(false);
    expect(res.body.data.pathway.body.name).toBe('VETASSESS');
    expect(prisma.bridgingProgram.findMany).not.toHaveBeenCalled();
  });

  it('reads the member’s own credential, never another woman’s', async () => {
    prisma.internationalCredential.findFirst.mockResolvedValue(null);
    await request(app).get('/api/community-support/credentials/pathway?credentialId=cred-9').expect(404);
    expect(prisma.internationalCredential.findFirst.mock.calls[0][0].where).toEqual({ id: 'cred-9', userId: 'member-1' });

    prisma.internationalCredential.findFirst.mockResolvedValue({ fieldOfStudy: 'Civil Engineering', credentialName: 'BEng' });
    const res = await request(app).get('/api/community-support/credentials/pathway?credentialId=cred-1').expect(200);
    expect(res.body.data.pathway.body.name).toBe('Engineers Australia');
  });

  it('offers the Adult Migrant English Program only below vocational English', async () => {
    for (const level of ['BEGINNER', 'INTERMEDIATE', 'NONE']) {
      prisma.languageProfile.findUnique.mockResolvedValue({ englishProficiency: level });
      const res = await request(app).get('/api/community-support/credentials/pathway').expect(200);
      expect(res.body.data.englishSupport).toMatchObject({ shortName: 'AMEP', cost: 'Free', forProficiency: level });
      expect(res.body.data.pathway).toBeNull();
    }
    for (const level of ['ADVANCED', 'FLUENT', 'NATIVE']) {
      prisma.languageProfile.findUnique.mockResolvedValue({ englishProficiency: level });
      const res = await request(app).get('/api/community-support/credentials/pathway').expect(200);
      expect(res.body.data.englishSupport).toBeNull();
    }
    prisma.languageProfile.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/community-support/credentials/pathway').expect(200);
    expect(res.body.data.englishSupport).toBeNull();
  });

  it('publishes the reference table without a sign-in', async () => {
    const res = await request(app).get('/api/community-support/assessing-bodies').expect(200);
    expect(res.body.data.bodies.map((b: any) => b.profession.id)).toEqual(expect.arrayContaining(['nursing', 'engineering', 'accounting', 'teaching', 'general']));
    expect(res.body.data.asAt).toMatch(/2026/);
  });
});

describe('Recording a credential outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a member record only her own credential', async () => {
    prisma.internationalCredential.findFirst.mockResolvedValue(null);
    await request(app).patch('/api/community-support/credentials/cred-9').send({ status: 'RECOGNIZED' }).expect(404);
    expect(prisma.internationalCredential.findFirst.mock.calls[0][0].where).toEqual({ id: 'cred-9', userId: 'member-1' });
    expect(prisma.internationalCredential.update).not.toHaveBeenCalled();

    prisma.internationalCredential.findFirst.mockResolvedValue({ id: 'cred-1', userId: 'member-1' });
    await request(app)
      .patch('/api/community-support/credentials/cred-1')
      .send({ status: 'RECOGNIZED', australianEquiv: 'Bachelor of Nursing', assessmentBody: 'ANMAC', assessmentDate: '2026-09-01', bridgingRequired: '' })
      .expect(200);

    const call = prisma.internationalCredential.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'cred-1' });
    expect(call.data).toMatchObject({ status: 'RECOGNIZED', australianEquiv: 'Bachelor of Nursing', assessmentBody: 'ANMAC', bridgingRequired: null });
    expect(call.data.assessmentDate).toBeInstanceOf(Date);
  });

  it('refuses an unknown status, a stray field and an empty body', async () => {
    prisma.internationalCredential.findFirst.mockResolvedValue({ id: 'cred-1', userId: 'member-1' });
    await request(app).patch('/api/community-support/credentials/cred-1').send({ status: 'APPROVED' }).expect(400);
    await request(app).patch('/api/community-support/credentials/cred-1').send({ userId: 'someone-else' }).expect(400);
    await request(app).patch('/api/community-support/credentials/cred-1').send({}).expect(400);
    expect(prisma.internationalCredential.update).not.toHaveBeenCalled();
  });
});
