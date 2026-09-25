/**
 * The women-gate, and what a self-serve account deletion leaves behind.
 *
 * These are the two things in this domain that decide who is inside a
 * women-only space and what of a woman's record survives her leaving it, and
 * neither had a single test. Two of the cases below are refusals that used to
 * go the other way: a rejected applicant could put herself straight back to
 * PENDING and reopen every surface the reviewer had just closed, and a deleted
 * account kept a live authenticator secret, both OAuth subject identifiers and
 * the gender-verification record itself.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    verificationBadge: { findFirst: jest.fn(), create: jest.fn(async () => ({ id: 'badge-1' })), update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    auditLog: { create: jest.fn(async () => ({})) },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    verificationToken: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    subscription: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    profile: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    userSkill: { deleteMany: jest.fn(async () => ({ count: 0 })), findMany: jest.fn(async () => []) },
    education: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    workExperience: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    courseEnrollment: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    savedJob: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    educationApplication: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    jobApplication: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

jest.mock('../../utils/audit', () => ({ logAudit: jest.fn(async () => undefined) }));

const stripeConfigured = jest.fn(() => false);
const identityCreate = jest.fn(async (_params: unknown) => ({ id: 'vs_1', url: 'https://verify.stripe.test/vs_1' }));
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => stripeConfigured(),
  getStripe: () => ({ identity: { verificationSessions: { create: identityCreate, retrieve: jest.fn() } } }),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

/** Runs the array form of $transaction so the statements inside it are observable. */
const runTransaction = async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation(runTransaction);
  prisma.user.update.mockResolvedValue({});
  prisma.verificationBadge.findFirst.mockResolvedValue(null);
  prisma.verificationBadge.create.mockResolvedValue({ id: 'badge-1' });
  stripeConfigured.mockReturnValue(false);
});

describe('POST /api/users/me/woman-verification', () => {
  it('refuses a member who has not self-attested', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: false, womanVerificationStatus: 'UNVERIFIED' });

    await request(app)
      .post('/api/users/me/woman-verification')
      .send({ statement: 'I would like to join the women-only spaces on ATHENA please.' })
      .expect(403);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a rejected member instead of putting her back to PENDING', async () => {
    // This is the loop that mattered. Re-requesting from REJECTED used to set
    // the status back to PENDING, and because the women-only floor refuses
    // only REJECTED, one request reopened every surface a reviewer had just
    // closed — with no cooldown and no limit on how often.
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'REJECTED' });

    const res = await request(app)
      .post('/api/users/me/woman-verification')
      .send({ statement: 'Please look at this again, I think the decision was wrong.' })
      .expect(403);

    expect(res.body.message).toMatch(/appeal/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.verificationBadge.create).not.toHaveBeenCalled();
  });

  it('says yes without doing anything for a member who is already verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'VERIFIED' });

    const res = await request(app).post('/api/users/me/woman-verification').send({}).expect(200);

    expect(res.body.status).toBe('VERIFIED');
    expect(prisma.verificationBadge.create).not.toHaveBeenCalled();
  });

  it('takes a written statement and puts one pending badge in the reviewer queue', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'UNVERIFIED' });

    const res = await request(app)
      .post('/api/users/me/woman-verification')
      .send({ statement: 'I am a woman and I would like access to the women-only parts of ATHENA.' })
      .expect(200);

    expect(res.body).toMatchObject({ status: 'PENDING', method: 'MANUAL' });
    expect(prisma.verificationBadge.create.mock.calls[0][0].data).toMatchObject({
      userId: 'her',
      type: 'IDENTITY',
      status: 'PENDING',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'her' }, data: { womanVerificationStatus: 'PENDING' } });
  });

  it('reuses the open submission rather than stacking half-finished ones behind her', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'PENDING' });
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'badge-existing', metadata: {}, submittedAt: new Date() });

    await request(app)
      .post('/api/users/me/woman-verification')
      .send({ statement: 'Adding a bit more detail to what I already sent you about this.' })
      .expect(200);

    expect(prisma.verificationBadge.create).not.toHaveBeenCalled();
    expect(prisma.verificationBadge.update.mock.calls[0][0].where).toEqual({ id: 'badge-existing' });
  });

  it('refuses a statement too short for a reviewer to act on', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'UNVERIFIED' });

    await request(app).post('/api/users/me/woman-verification').send({ statement: 'please' }).expect(400);

    expect(prisma.verificationBadge.create).not.toHaveBeenCalled();
  });

  it('refuses supporting evidence behind a link that is not https', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'UNVERIFIED' });

    await request(app)
      .post('/api/users/me/woman-verification')
      .send({
        statement: 'I am a woman and I would like access to the women-only parts of ATHENA.',
        evidenceUrl: 'javascript:alert(1)',
      })
      .expect(400);

    expect(prisma.verificationBadge.create).not.toHaveBeenCalled();
  });

  it('will not offer a document check this deployment cannot run', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'UNVERIFIED' });

    // The 503's own wording is held back by the error handler, as every 5xx
    // message is; what matters here is that it refuses rather than starting a
    // check against a Stripe account this deployment has not got.
    await request(app).post('/api/users/me/woman-verification').send({ method: 'IDENTITY' }).expect(503);

    expect(identityCreate).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('sends her to the document check when the deployment has one', async () => {
    stripeConfigured.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue({ id: 'her', womanSelfAttested: true, womanVerificationStatus: 'UNVERIFIED' });

    const res = await request(app).post('/api/users/me/woman-verification').send({ method: 'IDENTITY' }).expect(200);

    expect(res.body.data.redirectUrl).toBe('https://verify.stripe.test/vs_1');
    expect(identityCreate.mock.calls[0][0]).toMatchObject({
      type: 'document',
      metadata: { userId: 'her', purpose: 'WOMAN_GATE' },
      options: { document: { require_matching_selfie: true } },
    });
  });
});

describe('GET /api/users/me/identity-gates', () => {
  it('reports both gates and never offers a path this deployment cannot run', async () => {
    prisma.user.findUnique.mockResolvedValue({
      womanSelfAttested: true,
      womanVerificationStatus: 'PENDING',
      womanVerifiedAt: null,
      dateOfBirth: new Date('1990-05-04'),
      ageVerifiedAt: null,
    });

    const res = await request(app).get('/api/users/me/identity-gates').expect(200);

    expect(res.body.data.minimumAgeMet).toBe(true);
    expect(res.body.data.womanVerification).toMatchObject({ status: 'PENDING', identityCheckAvailable: false });
  });

  it('treats an account with no date of birth as not old enough, rather than waving it through', async () => {
    prisma.user.findUnique.mockResolvedValue({
      womanSelfAttested: false,
      womanVerificationStatus: 'UNVERIFIED',
      womanVerifiedAt: null,
      dateOfBirth: null,
      ageVerifiedAt: null,
    });

    const res = await request(app).get('/api/users/me/identity-gates').expect(200);

    expect(res.body.data.minimumAgeMet).toBe(false);
  });
});

describe('DELETE /api/users/me — what the tombstone has to clear', () => {
  /** The update that anonymises the row, pulled out of whatever order the transaction was built in. */
  function tombstone() {
    const call = prisma.user.update.mock.calls.find((c: any[]) => c[0]?.where?.id === 'her');
    return call?.[0]?.data ?? {};
  }

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com' });
  });

  it('refuses without the explicit confirmation', async () => {
    await request(app).delete('/api/users/me').send({ confirm: false }).expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears the authenticator secret, so no live second factor outlives the account', async () => {
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(tombstone()).toMatchObject({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
    });
    expect(tombstone().twoFactorRecoveryCodes).toEqual({ set: [] });
  });

  it('clears both OAuth subject identifiers, which are unique columns', async () => {
    // Leaving them meant the same Google or Facebook account could never sign
    // up again: the deleted row still owned them.
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(tombstone()).toMatchObject({ googleId: null, facebookId: null });
  });

  it('clears the gender-verification record rather than leaving a finding about her on file', async () => {
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(tombstone()).toMatchObject({
      womanSelfAttested: false,
      womanVerificationStatus: 'UNVERIFIED',
      womanVerifiedAt: null,
    });
  });

  it('clears the consent flags and the payout account', async () => {
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(tombstone()).toMatchObject({
      consentMarketing: false,
      consentDataProcessing: false,
      consentCookies: false,
      stripeConnectAccountId: null,
      stripeConnectStatus: null,
    });
  });

  it('shuts the account and anonymises the identifying columns', async () => {
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    const data = tombstone();
    expect(data.isSuspended).toBe(true);
    expect(data.isPublic).toBe(false);
    expect(data.allowMessages).toBe(false);
    expect(data.passwordHash).toBeNull();
    expect(String(data.email)).toMatch(/^deleted\+her\+\d+@example\.invalid$/);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'her' } });
  });

  it('keeps the jurisdiction the retained records are governed by', async () => {
    // `country` is deliberately left alone: it is what says how long the
    // records we are keeping have to be kept for.
    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(Object.prototype.hasOwnProperty.call(tombstone(), 'country')).toBe(false);
  });
});
