import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => {
  const client: any = {
    verificationBadge: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    user: { update: jest.fn(async () => ({})), findUnique: jest.fn() },
    notification: { create: jest.fn(async () => ({})) },
    auditLog: { create: jest.fn(async () => ({})) },
    legalHold: { findMany: jest.fn(async () => []) },
    stripeWebhookEvent: { create: jest.fn(async () => ({ id: 'evt' })), delete: jest.fn(async () => ({})) },
    // The claim that records a document check (see identity-verification.service): rows changed.
    $executeRaw: jest.fn(async () => 1),
  };
  // A list of writes, or a function that is handed the client the writes go through.
  client.$transaction = jest.fn(async (work: any) => (typeof work === 'function' ? work(client) : Promise.all(work)));
  return { prisma: client };
});

jest.mock('stripe', () => {
  const stripeClient = {
    identity: {
      verificationSessions: {
        create: jest.fn(async () => ({ id: 'vs_1', url: 'https://verify.stripe.com/vs_1' })),
        retrieve: jest.fn(),
        redact: jest.fn(async () => ({})),
      },
    },
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ana', role: req.headers['x-test-role'] || 'USER', email: 'ana@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_identity';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.CLIENT_URL = 'https://app.example';

import Stripe from 'stripe';
import { app } from '../../index';
import { WOMAN_GATE_BADGE_WHERE } from '../../middleware/account-gates';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

function webhookApp() {
  const a = express();
  a.use('/api/webhooks', webhookRoutes);
  a.use((err: any, _req: any, res: any, _next: any) => res.status(err?.statusCode || 500).json({ message: err?.message }));
  return a;
}

describe('Identity verification through Stripe Identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.verificationBadge.findFirst.mockResolvedValue(null);
  });

  it('starts a hosted document check and keeps one pending badge pointed at it', async () => {
    prisma.verificationBadge.create.mockResolvedValue({ id: 'b1' });

    const res = await request(app).post('/api/verification/identity/session').expect(200);

    expect(res.body.data).toEqual({ url: 'https://verify.stripe.com/vs_1', sessionId: 'vs_1' });
    const params = stripe.identity.verificationSessions.create.mock.calls[0][0];
    expect(params).toMatchObject({ type: 'document', metadata: { userId: 'ana' }, return_url: 'https://app.example/dashboard/settings/verification?identity=done' });
    expect(prisma.verificationBadge.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', type: 'IDENTITY', status: 'PENDING', metadata: { provider: 'stripe_identity', sessionId: 'vs_1' } });

    // A retry reuses the pending badge instead of stacking another.
    prisma.verificationBadge.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'PENDING' ? { id: 'b1' } : null));
    await request(app).post('/api/verification/identity/session').expect(200);
    expect(prisma.verificationBadge.update.mock.calls[0][0]).toMatchObject({ where: { id: 'b1' } });
  });

  it('refuses when the identity is already verified', async () => {
    prisma.verificationBadge.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'APPROVED' ? { id: 'b0' } : null));
    await request(app).post('/api/verification/identity/session').expect(409);
    expect(stripe.identity.verificationSessions.create).not.toHaveBeenCalled();
  });

  it('a passed check approves the badge, marks the profile verified and tells the member', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'b1', userId: 'ana', status: 'PENDING' });
    stripe.webhooks.constructEvent.mockReturnValue({ id: 'evt_v', type: 'identity.verification_session.verified', data: { object: { id: 'vs_1', status: 'verified' } } });

    await request(webhookApp()).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=x').send(Buffer.from('{}')).expect(200);

    expect(prisma.verificationBadge.findFirst.mock.calls[0][0].where).toEqual({ type: 'IDENTITY', metadata: { path: ['sessionId'], equals: 'vs_1' } });
    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: true } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', title: 'Identity verified' });
  });

  it.each([
    ['verified', 'evt_late_v', { id: 'vs_1', status: 'verified' }],
    ['requires_input', 'evt_late_r', { id: 'vs_1', status: 'requires_input', last_error: { reason: 'Blurry.' } }],
  ])('an event that arrives after a person rejected the badge (%s) does not rewrite the decision', async (kind, id, object) => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'b1', userId: 'ana', status: 'REJECTED' });
    stripe.webhooks.constructEvent.mockReturnValue({ id, type: `identity.verification_session.${kind}`, data: { object } });

    await request(webhookApp()).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=x').send(Buffer.from('{}')).expect(200);

    // No Verified mark, no rewritten reason, no notice, and nothing asked of Stripe.
    expect(prisma.verificationBadge.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
  });

  it('a check that needs input records why and asks the member to go again', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'b1', userId: 'ana', status: 'PENDING' });
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_r',
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_1', status: 'requires_input', last_error: { code: 'document_unverified_other', reason: 'The document was blurry.' } } },
    });

    await request(webhookApp()).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=x').send(Buffer.from('{}')).expect(200);

    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toEqual({ reason: 'The document was blurry.' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('blurry');
  });

  it('the pending list is the admin’s', async () => {
    await request(app).get('/api/verification/badges/pending').expect(403);
    prisma.verificationBadge.findMany.mockResolvedValue([{ id: 'b1', type: 'EMPLOYER', status: 'PENDING', user: { id: 'u1' } }]);
    const res = await request(app).get('/api/verification/badges/pending').set('x-test-role', 'ADMIN').expect(200);
    expect(res.body.data).toHaveLength(1);
    // Women-gate submissions are VerificationBadge rows too — same model, same
    // IDENTITY type, same Stripe session — and they are reviewed in their own
    // queue against evidence this screen does not show. Excluding them here is
    // what keeps a reviewer from approving one by eye from the generic list.
    // The filter itself is held to the SQL it compiles to in
    // middleware/__tests__/account-gates.badge-where.test.ts: a bare NOT over the
    // purpose comparison left out every badge that has no purpose, which is
    // every ordinary one.
    expect(prisma.verificationBadge.findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      NOT: WOMAN_GATE_BADGE_WHERE,
    });
  });
});

/**
 * A women-only gate submission and an ordinary identity badge are the same
 * model, the same type and the same Stripe session; metadata.purpose is the
 * only thing that tells them apart. The webhook used to look at neither: every
 * passed check approved the badge and set the Verified mark, so a document
 * check taken for the gate skipped the reviewer, never wrote the evidence the
 * reviewer's queue is built on, and left the member stuck.
 */
function sendStripeEvent(event: unknown) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  return request(webhookApp())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

const verifiedEvent = (id = 'evt_gate_v') => ({
  id,
  type: 'identity.verification_session.verified',
  data: { object: { id: 'vs_1', status: 'verified' } },
});

const gateBadge = (overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) => ({
  id: 'g1',
  userId: 'ana',
  status: 'PENDING',
  metadata: { purpose: 'WOMAN_GATE', provider: 'stripe_identity', sessionId: 'vs_1', submittedAt: '2026-10-01T00:00:00.000Z', ...metadata },
  ...overrides,
});

/** What the claim that records a document check was asked to do: its SQL, what it was given, and the patch it merges. */
function claimOf(mock: any, call = 0) {
  const [strings, ...values] = mock.mock.calls[call] as [string[], ...unknown[]];
  const sql = strings.reduce((out, part, i) => out + part + (i < values.length ? '?' : ''), '');
  const patchText = values.find((value) => typeof value === 'string' && value.startsWith('{')) as string | undefined;
  return { sql, values, patch: patchText ? JSON.parse(patchText) : null };
}

const adultOutputs = {
  first_name: 'Ana',
  last_name: 'Moreau',
  id_number_type: 'drivers_license',
  dob: { day: 4, month: 5, year: 1990 },
};

describe('A document check taken for the women-only gate, arriving by webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.verificationBadge.findFirst.mockReset();
    prisma.user.findUnique.mockResolvedValue({ id: 'ana' });
    stripe.identity.verificationSessions.retrieve.mockResolvedValue({ id: 'vs_1', status: 'verified', verified_outputs: adultOutputs });
  });

  it('records the evidence and leaves the request with the reviewer, without the Verified mark', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge());

    await sendStripeEvent(verifiedEvent()).expect(200);

    // The event payload does not carry the document's fields; they have to be asked for by name.
    expect(stripe.identity.verificationSessions.retrieve).toHaveBeenCalledWith('vs_1', { expand: ['verified_outputs'] });

    // One claim on the badge, and it is a merge, never a status change: still
    // pending, because a document proves identity and age, not that the member is a woman.
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.verificationBadge.update).not.toHaveBeenCalled();
    const claim = claimOf(prisma.$executeRaw);
    expect(claim.sql).toContain('UPDATE "VerificationBadge"');
    expect(claim.sql).not.toContain('"status"');
    // It only lands on a badge that holds no result yet and still points at this
    // session, which is what stops the return page and the webhook both
    // recording and announcing the same result.
    expect(claim.sql).toContain("(\"metadata\" ->> 'documentCheckPassedAt') IS NULL");
    expect(claim.sql).toContain("(\"metadata\" ->> 'sessionId') IS NOT DISTINCT FROM");
    expect(claim.values).toEqual(expect.arrayContaining(['g1', 'vs_1']));
    expect(claim.patch).toMatchObject({
      purpose: 'WOMAN_GATE',
      provider: 'stripe_identity',
      documentName: 'Ana Moreau',
      documentType: 'drivers_license',
    });
    expect(typeof claim.patch.documentCheckPassedAt).toBe('string');

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const userData = prisma.user.update.mock.calls[0][0].data;
    expect(userData.isVerified).toBeUndefined();
    expect(userData.dateOfBirth).toEqual(new Date(Date.UTC(1990, 4, 4)));
    expect(userData.ageVerifiedAt).toBeInstanceOf(Date);

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'ana',
      link: '/dashboard/settings/profile',
    });
    // No decision has been made, so nothing is erased at Stripe yet.
    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
  });

  it('flags a document under the minimum age for the reviewer and stamps no age on the account', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge());
    stripe.identity.verificationSessions.retrieve.mockResolvedValue({
      id: 'vs_1',
      status: 'verified',
      verified_outputs: { ...adultOutputs, dob: { day: 1, month: 1, year: new Date().getUTCFullYear() - 16 } },
    });

    await sendStripeEvent(verifiedEvent('evt_gate_minor')).expect(200);

    expect(claimOf(prisma.$executeRaw).patch).toMatchObject({ documentAgeFlag: 'BELOW_MINIMUM_AGE' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does nothing a second time when the return page has already recorded the result', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(
      gateBadge({}, { documentCheckPassedAt: '2026-10-01T00:05:00.000Z', documentName: 'Ana Moreau' })
    );

    await sendStripeEvent(verifiedEvent('evt_gate_again')).expect(200);

    expect(stripe.identity.verificationSessions.retrieve).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('writes and announces nothing when the return page recorded the result between the read and the write', async () => {
    // The webhook read the badge as not recorded; by the time it writes, the
    // member's return from Stripe has recorded it, so the claim changes no row.
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge());
    prisma.$executeRaw.mockResolvedValueOnce(0);

    await sendStripeEvent(verifiedEvent('evt_gate_race')).expect(200);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('does not rewrite a request a reviewer has already decided', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge({ status: 'REJECTED' }));

    await sendStripeEvent(verifiedEvent('evt_gate_late')).expect(200);

    expect(stripe.identity.verificationSessions.retrieve).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('hands the event back to Stripe when the session no longer reads as verified', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge());
    stripe.identity.verificationSessions.retrieve.mockResolvedValue({ id: 'vs_1', status: 'processing' });

    await sendStripeEvent(verifiedEvent('evt_gate_odd')).expect(500);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    // The idempotency row is released so Stripe's retry is not mistaken for a replay.
    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_gate_odd' } });
  });

  it('a check that needs input records why and sends the member to the profile page, not the identity page', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(gateBadge());

    await sendStripeEvent({
      id: 'evt_gate_r',
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_1', status: 'requires_input', last_error: { code: 'document_unverified_other', reason: 'The document was blurry.' } } },
    }).expect(200);

    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toEqual({ reason: 'The document was blurry.' });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'ana',
      link: '/dashboard/settings/profile',
    });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('blurry');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(stripe.identity.verificationSessions.retrieve).not.toHaveBeenCalled();
  });
});

describe('An ordinary identity badge, which keeps its behaviour and now has the check erased once decided', () => {
  const ordinary = { id: 'b1', userId: 'ana', status: 'PENDING', metadata: { provider: 'stripe_identity', sessionId: 'vs_1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.verificationBadge.findFirst.mockReset();
    prisma.legalHold.findMany.mockResolvedValue([]);
    stripe.identity.verificationSessions.redact.mockResolvedValue({});
  });

  it('approves the badge and asks Stripe to redact the session', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(ordinary);

    await sendStripeEvent(verifiedEvent('evt_ord')).expect(200);

    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: true } });
    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledTimes(1);
    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledWith('vs_1');
    // The stamp keeps what was on the badge and adds when Stripe was asked.
    const stamp = prisma.verificationBadge.update.mock.calls[1][0].data.metadata;
    expect(stamp).toMatchObject({ provider: 'stripe_identity', sessionId: 'vs_1' });
    expect(typeof stamp.redactedAt).toBe('string');
  });

  it('keeps the approval when Stripe will not redact', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue(ordinary);
    stripe.identity.verificationSessions.redact.mockRejectedValue(new Error('Stripe is down'));

    await sendStripeEvent(verifiedEvent('evt_ord_down')).expect(200);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: true } });
    // Not stamped as redacted: the nightly sweep asks again.
    expect(prisma.verificationBadge.update).toHaveBeenCalledTimes(1);
  });

  it('leaves an already-approved badge alone, and asks Stripe nothing', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ ...ordinary, status: 'APPROVED' });

    await sendStripeEvent(verifiedEvent('evt_ord_dupe')).expect(200);

    expect(prisma.verificationBadge.update).not.toHaveBeenCalled();
    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
  });
});

describe('Deciding a women-only request', () => {
  const evidence = {
    purpose: 'WOMAN_GATE',
    provider: 'stripe_identity',
    sessionId: 'vs_1',
    documentCheckPassedAt: '2026-10-01T00:05:00.000Z',
    documentName: 'Ana Moreau',
  };

  /** The gate badge for the first lookup, and `other` for the "is there another basis for the mark" lookup. */
  function badges(gate: unknown, other: unknown = null) {
    prisma.verificationBadge.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'APPROVED' ? other : gate));
  }

  const decide = (status: 'VERIFIED' | 'REJECTED') =>
    request(app).patch('/api/verification/woman-gate/ana').set('x-test-role', 'ADMIN').send({ status });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.verificationBadge.findFirst.mockReset();
    prisma.user.findUnique.mockResolvedValue({ id: 'ana' });
    prisma.legalHold.findMany.mockResolvedValue([]);
    stripe.identity.verificationSessions.redact.mockResolvedValue({});
  });

  it('asks Stripe to erase the check once, and does not give the Verified mark with an approval', async () => {
    badges({ id: 'g1', metadata: evidence });

    const res = await decide('VERIFIED').expect(200);

    expect(res.body.data.womanVerificationStatus).toBe('VERIFIED');
    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledTimes(1);
    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledWith('vs_1');
    expect(prisma.user.update.mock.calls[0][0].data.isVerified).toBeUndefined();
    // Redaction is noted on the badge, beside the decision.
    const stamped = prisma.verificationBadge.update.mock.calls.find((call: any[]) => call[0].data.metadata?.redactedAt);
    expect(stamped?.[0].where).toEqual({ id: 'g1' });
  });

  it('a redaction Stripe refuses does not fail the decision', async () => {
    badges({ id: 'g1', metadata: evidence });
    stripe.identity.verificationSessions.redact.mockRejectedValue(new Error('Stripe is down'));

    const res = await decide('VERIFIED').expect(200);

    expect(res.body.data.womanVerificationStatus).toBe('VERIFIED');
    expect(prisma.verificationBadge.update).toHaveBeenCalledTimes(1);
  });

  it('leaves the check in place for a member named in a legal hold, but still records the decision', async () => {
    badges({ id: 'g1', metadata: evidence });
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['ana'], affectedDataTypes: [] }]);

    await decide('VERIFIED').expect(200);

    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it.each([
    ['named by its console value', 'identity_verification'],
    ['typed by a person', 'Identity Verification'],
    ['named as documents', 'verification-documents'],
    ['holding everything', 'all'],
  ])('leaves the check in place under a hold on the kind of record, with no member named (%s)', async (_label, type) => {
    // The nightly sweep stops for this hold; the redaction at the moment of a
    // decision has to stop for it too, because it cannot be taken back.
    badges({ id: 'g1', metadata: evidence });
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['someone-else'], affectedDataTypes: [type] }]);

    await decide('VERIFIED').expect(200);

    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('is not held up by a hold on something else, or on somebody else', async () => {
    badges({ id: 'g1', metadata: evidence });
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['someone-else'], affectedDataTypes: ['messages'] }]);

    await decide('VERIFIED').expect(200);

    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledWith('vs_1');
  });

  it('a rejection takes back a Verified mark that nothing else earned', async () => {
    // What the old webhook left behind: the gate badge approved by a document
    // check alone, with the mark set and no person involved.
    badges({ id: 'g1', metadata: evidence }, null);

    await decide('REJECTED').expect(200);

    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ womanVerificationStatus: 'REJECTED', isVerified: false });
  });

  it('a rejection keeps a Verified mark an ordinary identity badge properly earned', async () => {
    badges({ id: 'g1', metadata: evidence }, { id: 'ordinary-approved' });

    await decide('REJECTED').expect(200);

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.womanVerificationStatus).toBe('REJECTED');
    expect('isVerified' in data).toBe(false);
  });

  it('refuses to approve a document whose date of birth is below the minimum age', async () => {
    badges({ id: 'g1', metadata: { ...evidence, documentAgeFlag: 'BELOW_MINIMUM_AGE' } });

    await decide('VERIFIED').expect(409);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(stripe.identity.verificationSessions.redact).not.toHaveBeenCalled();
  });

  it('lets the reviewer reject that same request, with the check erased', async () => {
    badges({ id: 'g1', metadata: { ...evidence, documentAgeFlag: 'BELOW_MINIMUM_AGE' } });

    await decide('REJECTED').expect(200);

    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledWith('vs_1');
  });

  it('an ordinary identity badge reviewed by hand has its check erased too', async () => {
    prisma.verificationBadge.findUnique.mockResolvedValue({
      type: 'IDENTITY',
      userId: 'ana',
      metadata: { provider: 'stripe_identity', sessionId: 'vs_9' },
    });
    prisma.verificationBadge.update.mockResolvedValue({
      id: 'b9',
      userId: 'ana',
      type: 'IDENTITY',
      metadata: { provider: 'stripe_identity', sessionId: 'vs_9' },
    });

    // A person approving by hand records what was checked; see the rule in
    // routes/verification.routes.ts.
    await request(app)
      .patch('/api/verification/badges/b9')
      .set('x-test-role', 'ADMIN')
      .send({ status: 'APPROVED', reason: 'Passport seen on a video call and the face matches' })
      .expect(200);

    expect(stripe.identity.verificationSessions.redact).toHaveBeenCalledWith('vs_9');
  });
});
