import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    follow: {
      count: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'ADMIN', email: 'admin@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { WOMAN_GATE_BADGE_WHERE } from '../../middleware/account-gates';

const prismaAny: any = prisma;

describe('Verification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockResolvedValue survives clearAllMocks, so a lookup one test set up
    // would otherwise answer for the next.
    prismaAny.verificationBadge.findFirst.mockReset();
    prismaAny.verificationBadge.findUnique.mockReset();
    prismaAny.follow.count.mockReset();
    prismaAny.organization.findUnique.mockReset();
    prismaAny.user.findUnique.mockReset();
  });

  it('GET /api/verification/badges returns badges', async () => {
    prismaAny.verificationBadge.findMany.mockResolvedValue([{ id: 'badge-1', type: 'IDENTITY' }]);

    const response = await request(app).get('/api/verification/badges').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  // The women-only review wears the same badge type as the identity badge. In
  // her own list it read as "Identity: Verified" while nothing had set the tick
  // on her profile, and carried the evidence (the name on a document) with it.
  it('GET /api/verification/badges leaves the women-only submission out, and only her own badges are asked for', async () => {
    prismaAny.verificationBadge.findMany.mockClear();
    prismaAny.verificationBadge.findMany.mockResolvedValue([]);

    await request(app).get('/api/verification/badges').expect(200);

    const where = prismaAny.verificationBadge.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('user-123');
    expect(where.NOT).toEqual(WOMAN_GATE_BADGE_WHERE);
  });

  it('POST /api/verification/badges creates badge', async () => {
    prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-1', type: 'IDENTITY', status: 'PENDING' });

    const response = await request(app)
      .post('/api/verification/badges')
      .send({ type: 'IDENTITY', metadata: { doc: 'url' } })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('badge-1');
  });

  it('PATCH /api/verification/badges/:id approves badge', async () => {
    prismaAny.verificationBadge.findUnique.mockResolvedValue({
      type: 'IDENTITY',
      userId: 'user-123',
      metadata: { provider: 'stripe_identity' },
    });
    prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-1', userId: 'user-123', type: 'IDENTITY' });

    const response = await request(app)
      .patch('/api/verification/badges/badge-1')
      .send({ status: 'APPROVED', reason: 'Passport seen, and the photo matches her selfie' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(prismaAny.user.update).toHaveBeenCalled();
  });

  // A badge is a statement to other members that something was checked. What a
  // member writes in an application is her own account of herself; what ATHENA
  // writes about a check (the provider, the Stripe session, whether a document
  // passed) is not hers to supply, and the women-only review reads some of it
  // as the reviewer's evidence.
  describe('what an application may carry', () => {
    it.each([
      ['purpose', { purpose: 'WOMAN_GATE' }],
      ['provider', { provider: 'stripe_identity' }],
      ['documentCheckPassedAt', { documentCheckPassedAt: '2026-09-21T00:00:00.000Z' }],
      ['sessionId', { sessionId: 'vs_forged' }],
      ['documentName', { documentName: 'Ana Member' }],
    ])('refuses an application that supplies %s, and stores nothing', async (_name, forged) => {
      await request(app)
        .post('/api/verification/badges')
        .send({ type: 'IDENTITY', metadata: { note: 'please', ...forged } })
        .expect(400);

      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });

    it('stores her own words and drops fields that are not part of the application', async () => {
      prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-9', type: 'EMPLOYER', status: 'PENDING' });

      await request(app)
        .post('/api/verification/badges')
        .send({
          type: 'EMPLOYER',
          metadata: { organisation: '  Acme Pty Ltd ', role: 'Talent lead', evidenceUrl: 'https://acme.example/team', isVerified: true, anything: 'else' },
        })
        .expect(201);

      expect(prismaAny.verificationBadge.create.mock.calls[0][0].data.metadata).toEqual({
        organisation: 'Acme Pty Ltd',
        role: 'Talent lead',
        evidenceUrl: 'https://acme.example/team',
      });
    });

    it('allows an identity application a note and nothing else', async () => {
      prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-9', type: 'IDENTITY', status: 'PENDING' });

      await request(app)
        .post('/api/verification/badges')
        .send({ type: 'IDENTITY', metadata: { note: 'My passport is expiring', role: 'Director', doc: 'url' } })
        .expect(201);

      expect(prismaAny.verificationBadge.create.mock.calls[0][0].data.metadata).toEqual({ note: 'My passport is expiring' });
    });

    it('refuses details that are not text, or are far too long', async () => {
      await request(app).post('/api/verification/badges').send({ type: 'MENTOR', metadata: { role: { admin: true } } }).expect(400);
      await request(app).post('/api/verification/badges').send({ type: 'MENTOR', metadata: { role: 'x'.repeat(301) } }).expect(400);
      await request(app).post('/api/verification/badges').send({ type: 'MENTOR', metadata: ['role'] }).expect(400);

      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });

    it('keeps one application per badge in the queue at a time', async () => {
      prismaAny.verificationBadge.findFirst.mockResolvedValue({ id: 'already-waiting' });

      await request(app).post('/api/verification/badges').send({ type: 'MENTOR', metadata: { role: 'Head of Product' } }).expect(409);

      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });

    it('does not take a manual identity application from somebody already verified', async () => {
      prismaAny.verificationBadge.findFirst
        .mockResolvedValueOnce(null) // nothing waiting
        .mockResolvedValueOnce({ id: 'approved-1' }); // already approved

      await request(app).post('/api/verification/badges').send({ type: 'IDENTITY' }).expect(409);

      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });
  });

  // "Creator Verified" is for 10,000 followers and 90 days of history, both of
  // which ATHENA can count, so an application that cannot meet it is not queued
  // for a person to refuse.
  describe('the creator badge', () => {
    const accountAged = (days: number) => ({ createdAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 60 * 1000) });

    it.each([
      ['too few followers', 9_999, 400],
      ['too new an account', 20_000, 89],
    ])('refuses an application with %s', async (_label, followers, days) => {
      prismaAny.follow.count.mockResolvedValue(followers);
      prismaAny.user.findUnique.mockResolvedValue(accountAged(days));

      const response = await request(app)
        .post('/api/verification/badges')
        .send({ type: 'CREATOR', metadata: { evidenceUrl: 'https://example.com/me' } })
        .expect(409);

      expect(response.body.message).toMatch(/creator badge is for accounts with/);
      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });

    it('counts followers from the follower rows of the applicant', async () => {
      prismaAny.follow.count.mockResolvedValue(0);
      prismaAny.user.findUnique.mockResolvedValue(accountAged(400));

      await request(app).post('/api/verification/badges').send({ type: 'CREATOR' }).expect(409);

      expect(prismaAny.follow.count).toHaveBeenCalledWith({ where: { followingId: 'user-123' } });
    });

    it('queues an application at exactly 10,000 followers and 90 days', async () => {
      prismaAny.follow.count.mockResolvedValue(10_000);
      prismaAny.user.findUnique.mockResolvedValue(accountAged(90));
      prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-c', type: 'CREATOR', status: 'PENDING' });

      await request(app)
        .post('/api/verification/badges')
        .send({ type: 'CREATOR', metadata: { evidenceUrl: 'https://example.com/me' } })
        .expect(201);

      expect(prismaAny.verificationBadge.create).toHaveBeenCalled();
    });

    it('checks the rule again when a reviewer approves, because the audience can have gone', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({ type: 'CREATOR', userId: 'creator-1', metadata: {} });
      prismaAny.follow.count.mockResolvedValue(8_000);
      prismaAny.user.findUnique.mockResolvedValue(accountAged(300));

      await request(app).patch('/api/verification/badges/badge-c').send({ status: 'APPROVED' }).expect(409);

      expect(prismaAny.verificationBadge.update).not.toHaveBeenCalled();
    });

    it('lets a reviewer reject without the rule being asked', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({ type: 'CREATOR', userId: 'creator-1', metadata: {} });
      prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-c', userId: 'creator-1', type: 'CREATOR' });

      await request(app).patch('/api/verification/badges/badge-c').send({ status: 'REJECTED', reason: 'Not yet' }).expect(200);

      expect(prismaAny.follow.count).not.toHaveBeenCalled();
    });

    it('GET /api/verification/eligibility tells her how far she is', async () => {
      prismaAny.follow.count.mockResolvedValue(120);
      prismaAny.user.findUnique.mockResolvedValue(accountAged(12));

      const response = await request(app).get('/api/verification/eligibility').expect(200);

      expect(response.body.data.creator).toMatchObject({
        eligible: false,
        followers: 120,
        minFollowers: 10_000,
        accountAgeDays: 12,
        minAccountAgeDays: 90,
      });
    });
  });

  // The verified tick on a profile rests on what a person checked. Approving an
  // identity badge by hand with nothing to say was possible, so a tick could be
  // handed out on no evidence at all.
  describe('approving an identity badge by hand', () => {
    beforeEach(() => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({ type: 'IDENTITY', userId: 'ana', metadata: { note: 'hello' } });
      prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-i', userId: 'ana', type: 'IDENTITY' });
    });

    it.each([
      ['no reason', {}],
      ['an empty reason', { reason: '   ' }],
      ['a reason too short to say anything', { reason: 'ok' }],
    ])('is refused with %s, and sets no tick', async (_label, extra) => {
      await request(app).patch('/api/verification/badges/badge-i').send({ status: 'APPROVED', ...extra }).expect(400);

      expect(prismaAny.verificationBadge.update).not.toHaveBeenCalled();
      expect(prismaAny.user.update).not.toHaveBeenCalled();
    });

    it('sets the tick when the reviewer records what was checked', async () => {
      await request(app)
        .patch('/api/verification/badges/badge-i')
        .send({ status: 'APPROVED', reason: 'Driver licence seen on a video call; the face matches' })
        .expect(200);

      expect(prismaAny.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: true } });
    });

    it('needs no reason to turn one down', async () => {
      await request(app).patch('/api/verification/badges/badge-i').send({ status: 'REJECTED' }).expect(200);

      expect(prismaAny.user.update).not.toHaveBeenCalled();
    });

    // The profile draws the tick from User.isVerified alone, so taking an
    // approval back has to take the tick back.
    describe('taking an approval back', () => {
      beforeEach(() => {
        prismaAny.verificationBadge.findUnique.mockResolvedValue({ type: 'IDENTITY', userId: 'ana', status: 'APPROVED', metadata: { note: 'hello' } });
      });

      it('takes the tick off when nothing else earned it', async () => {
        prismaAny.verificationBadge.findFirst.mockResolvedValue(null);

        await request(app).patch('/api/verification/badges/badge-i').send({ status: 'REJECTED', reason: 'The document was not hers' }).expect(200);

        expect(prismaAny.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: false } });
        // The look-up for another basis never counts this badge, or the women-only review.
        const where = prismaAny.verificationBadge.findFirst.mock.calls[0][0].where;
        expect(where).toMatchObject({ userId: 'ana', type: 'IDENTITY', status: 'APPROVED', id: { not: 'badge-i' } });
        expect(where.NOT).toEqual(WOMAN_GATE_BADGE_WHERE);
      });

      it('keeps the tick when a separate identity badge is still approved', async () => {
        prismaAny.verificationBadge.findFirst.mockResolvedValue({ id: 'badge-other' });

        await request(app).patch('/api/verification/badges/badge-i').send({ status: 'REJECTED' }).expect(200);

        expect(prismaAny.user.update).not.toHaveBeenCalled();
      });
    });

    it('does not ask a reason of the badges that carry no tick', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({ type: 'MENTOR', userId: 'ana', metadata: { role: 'Head of Product' } });
      prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-m', userId: 'ana', type: 'MENTOR' });

      await request(app).patch('/api/verification/badges/badge-m').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.user.update).not.toHaveBeenCalled();
    });
  });

  // For an employer or educator, what ATHENA can check is put in front of the
  // reviewer; none of it decides anything.
  describe('what a reviewer is shown for an employer application', () => {
    const employerBadge = (overrides: Record<string, unknown> = {}, user: Record<string, unknown> = {}) => ({
      id: 'badge-e',
      type: 'EMPLOYER',
      metadata: { organisation: 'Acme', website: 'https://www.acme.com.au', abn: '51824753556' },
      user: { email: 'lead@acme.com.au', emailVerified: true, ...user },
      ...overrides,
    });

    it('says the confirmed email domain matches the website', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue(employerBadge());

      const response = await request(app).get('/api/verification/badges/badge-e/checks').expect(200);

      const domain = response.body.data.checks.find((check: any) => check.key === 'email-domain');
      expect(domain.status).toBe('pass');
      expect(domain.detail).toContain('acme.com.au');
    });

    it('warns when she applied from a personal address, or one she has not confirmed', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue(employerBadge({}, { email: 'lead@gmail.com' }));
      const personal = await request(app).get('/api/verification/badges/badge-e/checks').expect(200);
      expect(personal.body.data.checks.find((c: any) => c.key === 'email-domain').status).toBe('warn');

      prismaAny.verificationBadge.findUnique.mockResolvedValue(employerBadge({}, { emailVerified: false }));
      const unconfirmed = await request(app).get('/api/verification/badges/badge-e/checks').expect(200);
      expect(unconfirmed.body.data.checks.find((c: any) => c.key === 'email-domain').status).toBe('warn');
    });

    it('warns about an ABN that fails its checksum', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue(
        employerBadge({ metadata: { organisation: 'Acme', website: 'https://acme.com.au', abn: '12345678901' } })
      );

      const response = await request(app).get('/api/verification/badges/badge-e/checks').expect(200);

      const abn = response.body.data.checks.find((check: any) => check.key === 'abn');
      expect(abn.status).toBe('warn');
      expect(abn.detail).toMatch(/not a valid ABN/);
    });

    it('offers nothing for a badge there is nothing to check against', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({
        id: 'badge-m',
        type: 'MENTOR',
        metadata: { role: 'Head of Product' },
        user: { email: 'm@example.com', emailVerified: true },
      });

      const response = await request(app).get('/api/verification/badges/badge-m/checks').expect(200);

      expect(response.body.data.checks).toEqual([]);
    });

    it('is not the way into a women-only review', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue({
        id: 'badge-w',
        type: 'IDENTITY',
        metadata: { purpose: 'WOMAN_GATE' },
        user: { email: 'w@example.com', emailVerified: true },
      });

      await request(app).get('/api/verification/badges/badge-w/checks').expect(409);
    });

    it('404s a request that is not there', async () => {
      prismaAny.verificationBadge.findUnique.mockResolvedValue(null);

      await request(app).get('/api/verification/badges/nope/checks').expect(404);
    });
  });

  // A women-gate submission wears type IDENTITY and lives in the same table.
  // Approving it here would set the verified mark and leave the gate shut, so
  // it is sent to the queue that holds the evidence.
  it('PATCH /api/verification/badges/:id refuses a women-gate submission', async () => {
    prismaAny.verificationBadge.findUnique.mockResolvedValue({ metadata: { purpose: 'WOMAN_GATE', provider: 'manual' } });

    await request(app)
      .patch('/api/verification/badges/badge-2')
      .send({ status: 'APPROVED' })
      .expect(409);

    expect(prismaAny.verificationBadge.update).not.toHaveBeenCalled();
  });

  it('GET /api/verification/woman-gate/requests carries what each member submitted', async () => {
    prismaAny.user.findMany.mockResolvedValue([
      { id: 'ana', email: 'ana@example.com', firstName: 'Ana', lastName: 'M', womanVerificationStatus: 'PENDING' },
    ]);
    prismaAny.user.count.mockResolvedValue(1);
    prismaAny.verificationBadge.findMany.mockResolvedValue([
      {
        id: 'b1',
        userId: 'ana',
        status: 'PENDING',
        submittedAt: '2026-09-20T00:00:00.000Z',
        reason: null,
        metadata: { purpose: 'WOMAN_GATE', provider: 'manual', statement: 'A sentence long enough to be read.' },
      },
    ]);

    const response = await request(app).get('/api/verification/woman-gate/requests').expect(200);

    expect(response.body.data.users[0].submission.evidence).toMatchObject({ provider: 'manual' });
  });

  // The whole point of the queue: a decision has to be made against something.
  it('PATCH /api/verification/woman-gate/:userId refuses an approval with no evidence behind it', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ id: 'ana' });
    prismaAny.verificationBadge.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/verification/woman-gate/ana')
      .send({ status: 'VERIFIED' })
      .expect(409);

    expect(prismaAny.user.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/verification/woman-gate/:userId approves against real evidence', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ id: 'ana' });
    prismaAny.verificationBadge.findFirst.mockResolvedValue({
      id: 'b1',
      metadata: {
        purpose: 'WOMAN_GATE',
        provider: 'stripe_identity',
        documentCheckPassedAt: '2026-09-21T00:00:00.000Z',
      },
    });

    const response = await request(app)
      .patch('/api/verification/woman-gate/ana')
      .send({ status: 'VERIFIED' })
      .expect(200);

    expect(response.body.data.womanVerificationStatus).toBe('VERIFIED');
    expect(prismaAny.user.update).toHaveBeenCalled();
  });
});
