/**
 * The women-gate.
 *
 * What decides who is inside a women-only space had no test. One of the cases
 * below is a refusal that used to go the other way: a rejected applicant could
 * put herself straight back to PENDING and reopen every surface the reviewer
 * had just closed.
 *
 * What an account deletion leaves behind used to be tested here too, against a
 * tombstone DELETE /users/me wrote by hand. That route now runs the data-rights
 * erasure, so those cases moved with it: user.delete-account.test.ts holds the
 * route, and gdpr.account-closure.test.ts holds what the one remaining
 * tombstone clears (the authenticator secret, both OAuth ids, the women-only
 * record, the consent flags, the payout link and the date of birth).
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    verificationBadge: { findFirst: jest.fn(), create: jest.fn(async () => ({ id: 'badge-1' })), update: jest.fn(async () => ({})) },
    // The claim that records a document check (see identity-verification.service): rows changed.
    $executeRaw: jest.fn(async () => 1),
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
const identityRetrieve = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => stripeConfigured(),
  getStripe: () => ({ identity: { verificationSessions: { create: identityCreate, retrieve: identityRetrieve } } }),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

/** What the claim that records a document check was asked to do: its SQL, what it was given, and the patch it merges. */
function claimOf(call = 0) {
  const [strings, ...values] = prisma.$executeRaw.mock.calls[call] as [string[], ...unknown[]];
  const sql = strings.reduce((out: string, part: string, i: number) => out + part + (i < values.length ? '?' : ''), '');
  const patchText = values.find((value) => typeof value === 'string' && value.startsWith('{')) as string | undefined;
  return { sql, values, patch: patchText ? JSON.parse(patchText) : null };
}

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

/**
 * Coming back from Stripe's hosted check. Two things can have got there first:
 * the webhook, which writes the same result, and a reviewer. The route used to
 * look only for a PENDING badge and answer 404 to anyone the webhook had
 * already dealt with - a member whose check had gone perfectly well was told
 * nothing was waiting on her account.
 */
describe('POST /api/users/me/woman-verification/complete', () => {
  const pending = (metadata: Record<string, unknown> = {}, status = 'PENDING') => ({
    id: 'badge-1',
    status,
    submittedAt: new Date('2026-10-01T00:00:00Z'),
    metadata: { purpose: 'WOMAN_GATE', provider: 'stripe_identity', sessionId: 'vs_1', ...metadata },
  });

  const adultDocument = { first_name: 'Ana', last_name: 'Moreau', id_number_type: 'passport', dob: { day: 4, month: 5, year: 1990 } };
  const RECORDED = { documentCheckPassedAt: '2026-10-01T00:05:00.000Z' };

  beforeEach(() => {
    stripeConfigured.mockReturnValue(true);
    identityRetrieve.mockReset();
  });

  it('answers 404 when no women-gate check has ever been started', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(null);

    await request(app).post('/api/users/me/woman-verification/complete').expect(404);

    expect(identityRetrieve).not.toHaveBeenCalled();
  });

  it('looks for the latest women-gate badge whatever its status, not only a pending one', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending(RECORDED, 'APPROVED'));

    await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    const where = prisma.verificationBadge.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'her', type: 'IDENTITY', metadata: { path: ['purpose'], equals: 'WOMAN_GATE' } });
    expect(where.status).toBeUndefined();
  });

  it('records a passed check and leaves the request with the reviewer', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending());
    identityRetrieve.mockResolvedValue({ status: 'verified', verified_outputs: adultDocument });

    const res = await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    expect(identityRetrieve).toHaveBeenCalledWith('vs_1', { expand: ['verified_outputs'] });
    expect(res.body).toMatchObject({ status: 'PENDING', data: { documentCheck: 'verified' } });
    expect(claimOf().patch).toMatchObject({
      documentName: 'Ana Moreau',
      documentType: 'passport',
    });
    // Claimed only while the badge holds no result, so a webhook landing at the
    // same moment cannot record and announce the same result a second time.
    expect(claimOf().sql).toContain("(\"metadata\" ->> 'documentCheckPassedAt') IS NULL");
    expect(claimOf().values).toEqual(expect.arrayContaining(['badge-1', 'vs_1']));
    const userData = prisma.user.update.mock.calls[0][0].data;
    expect(userData.dateOfBirth).toEqual(new Date(Date.UTC(1990, 4, 4)));
    expect(userData.ageVerifiedAt).toBeInstanceOf(Date);
  });

  it('is idempotent after the webhook has already run: no 404, no second write, no second notification', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending({ ...RECORDED, documentName: 'Ana Moreau' }));

    const res = await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    expect(res.body).toMatchObject({ status: 'PENDING', data: { documentCheck: 'verified' } });
    expect(identityRetrieve).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('says the check passed, and announces nothing twice, when the webhook wins the race to record it', async () => {
    // Read as not recorded; by the time the claim is tried the webhook has
    // recorded it, so the claim changes no row.
    prisma.verificationBadge.findFirst.mockResolvedValue(pending());
    identityRetrieve.mockResolvedValue({ status: 'verified', verified_outputs: adultDocument });
    prisma.$executeRaw.mockResolvedValueOnce(0);

    const res = await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    expect(res.body).toMatchObject({ status: 'PENDING', data: { documentCheck: 'verified' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('works without a Stripe key once the result is already recorded', async () => {
    stripeConfigured.mockReturnValue(false);
    prisma.verificationBadge.findFirst.mockResolvedValue(pending(RECORDED));

    await request(app).post('/api/users/me/woman-verification/complete').expect(200);
  });

  it('reports the reviewer decision rather than saying it is still pending', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending(RECORDED, 'APPROVED'));
    const approved = await request(app).post('/api/users/me/woman-verification/complete').expect(200);
    expect(approved.body.status).toBe('VERIFIED');

    prisma.verificationBadge.findFirst.mockResolvedValue(pending(RECORDED, 'REJECTED'));
    const refused = await request(app).post('/api/users/me/woman-verification/complete').expect(200);
    expect(refused.body.status).toBe('REJECTED');
  });

  it('does not reopen a decided request that never recorded a check', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending({}, 'REJECTED'));

    await request(app).post('/api/users/me/woman-verification/complete').expect(404);

    expect(identityRetrieve).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('says so when Stripe has not finished, and writes nothing', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending());
    identityRetrieve.mockResolvedValue({ status: 'processing' });

    const res = await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    expect(res.body).toMatchObject({ status: 'PENDING', data: { documentCheck: 'processing' } });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('flags a document whose date of birth is under the minimum age, and stamps no age on the account', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(pending());
    identityRetrieve.mockResolvedValue({
      status: 'verified',
      verified_outputs: { ...adultDocument, dob: { day: 1, month: 1, year: new Date().getUTCFullYear() - 16 } },
    });

    await request(app).post('/api/users/me/woman-verification/complete').expect(200);

    expect(claimOf().patch).toMatchObject({ documentAgeFlag: 'BELOW_MINIMUM_AGE' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses with a 503 on a deployment with no Stripe key when a check is still to be asked about', async () => {
    stripeConfigured.mockReturnValue(false);
    prisma.verificationBadge.findFirst.mockResolvedValue(pending());

    await request(app).post('/api/users/me/woman-verification/complete').expect(503);

    expect(identityRetrieve).not.toHaveBeenCalled();
  });
});
