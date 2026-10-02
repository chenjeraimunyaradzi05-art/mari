/**
 * What happens to a Stripe Identity session once Stripe has one: recording a
 * passed check as evidence for the women-only gate, and asking Stripe to erase
 * the check once a person has decided.
 *
 * The recording half is shared by two callers that can land in either order or
 * together - the Stripe webhook and the member's return from the hosted page -
 * so the cases that matter are the repeats. The redaction half is best effort
 * by design, so the cases that matter are the refusals: a failure must neither
 * throw nor be stamped as done.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const client: any = {
    verificationBadge: {
      update: jest.fn(async () => ({})),
      findMany: jest.fn(async () => []),
    },
    user: { update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    legalHold: { findMany: jest.fn(async () => []) },
    $executeRaw: jest.fn(async () => 1),
  };
  // What the writes inside a transaction are handed. A distinct object with its
  // own mocks, so a write made on the outer client instead would not be counted.
  const tx: any = {
    // The claim that records a document check: how many rows it changed.
    $executeRaw: jest.fn(async () => 1),
    user: { update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
  };
  client.$transaction = jest.fn(async (work: any) => work(tx));
  client.__tx = tx;
  return { prisma: client };
});

const stripeConfigured = jest.fn(() => true);
const retrieve = jest.fn<(...args: any[]) => Promise<any>>();
const redact = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => stripeConfigured(),
  getStripe: () => ({ identity: { verificationSessions: { retrieve, redact } } }),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  applyWomanGateDocumentResult,
  recordWomanGateDocumentCheck,
  redactIdentityChecksBeforeErasure,
  redactIdentitySession,
} from '../identity-verification.service';

const prisma: any = prismaTyped;
const tx: any = prisma.__tx;

/** What the claim that records a document check was asked to do: its SQL, what it was given, and the patch it merges. */
function claimOf(call = 0) {
  const [strings, ...values] = tx.$executeRaw.mock.calls[call] as [string[], ...unknown[]];
  const sql = strings.reduce((out: string, part: string, i: number) => out + part + (i < values.length ? '?' : ''), '');
  const patchText = values.find((value) => typeof value === 'string' && value.startsWith('{')) as string | undefined;
  return { sql, values, patch: patchText ? JSON.parse(patchText) : null };
}

const GATE_BADGE = { purpose: 'WOMAN_GATE', provider: 'stripe_identity', sessionId: 'vs_1' };

/** A document whose date of birth is comfortably an adult's. */
const ADULT_DOCUMENT = {
  first_name: 'Ana',
  last_name: 'Moreau',
  id_number_type: 'drivers_license',
  dob: { day: 4, month: 5, year: 1990 },
};

beforeEach(() => {
  jest.clearAllMocks();
  stripeConfigured.mockReturnValue(true);
  prisma.legalHold.findMany.mockResolvedValue([]);
  prisma.verificationBadge.findMany.mockResolvedValue([]);
  tx.$executeRaw.mockResolvedValue(1);
  redact.mockResolvedValue({});
});

describe('applyWomanGateDocumentResult', () => {
  it('writes the evidence, stamps the age the document proves, and tells the member', async () => {
    const outcome = await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, ADULT_DOCUMENT);

    expect(outcome).toEqual({ applied: true, ageFlag: null });
    const claim = claimOf();
    // A claim in the database: it merges only what this check adds, onto a badge
    // that holds no result yet and still points at the session that was read.
    expect(claim.sql).toContain('UPDATE "VerificationBadge"');
    expect(claim.sql).toContain("COALESCE(\"metadata\", '{}'::jsonb) || ?::jsonb");
    expect(claim.sql).toContain("(\"metadata\" ->> 'documentCheckPassedAt') IS NULL");
    expect(claim.sql).toContain("(\"metadata\" ->> 'sessionId') IS NOT DISTINCT FROM ?::text");
    expect(claim.values).toContain('b1');
    expect(claim.values).toContain('vs_1');
    expect(claim.patch).toMatchObject({
      purpose: 'WOMAN_GATE',
      provider: 'stripe_identity',
      documentName: 'Ana Moreau',
      documentType: 'drivers_license',
    });
    expect(typeof claim.patch.documentCheckPassedAt).toBe('string');
    expect(claim.patch.documentAgeFlag).toBeUndefined();
    // Only what the check adds is merged: nothing already on the badge is
    // written over with a copy read earlier.
    expect(claim.patch.sessionId).toBeUndefined();

    const userData = tx.user.update.mock.calls[0][0].data;
    expect(userData.dateOfBirth).toEqual(new Date(Date.UTC(1990, 4, 4)));
    expect(userData.ageVerifiedAt).toBeInstanceOf(Date);
    // The document proves who she is and how old, not that she is a woman, so
    // a passed check must never hand out the Verified mark by itself.
    expect(userData.isVerified).toBeUndefined();
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'ana',
      link: '/dashboard/settings/profile',
    });
  });

  it('makes the three writes in one transaction, on the client the transaction hands out', async () => {
    await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, ADULT_DOCUMENT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    // None of them went round the transaction.
    expect(prisma.verificationBadge.update).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('leaves nothing half done: a failure after the evidence is written fails the whole call, so the retry can finish it', async () => {
    tx.user.update.mockRejectedValueOnce(new Error('connection reset'));

    await expect(applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, ADULT_DOCUMENT)).rejects.toThrow('connection reset');

    // No notice went out for a result that was not recorded.
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('writes nothing the second time, so the webhook and the return page cannot both announce it', async () => {
    const recorded = { ...GATE_BADGE, documentCheckPassedAt: '2026-10-01T00:00:00.000Z' };

    const outcome = await applyWomanGateDocumentResult('ana', 'b1', recorded, ADULT_DOCUMENT);

    expect(outcome.applied).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('writes nothing when the other caller recorded it between this one reading the badge and writing it', async () => {
    // Both callers read "not recorded"; the first claim records it, so the
    // second one's claim changes no row.
    tx.$executeRaw.mockResolvedValue(0);

    const outcome = await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, ADULT_DOCUMENT);

    expect(outcome).toEqual({ applied: false, ageFlag: null });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('flags a document under the minimum age for the reviewer and stamps no age on the account', async () => {
    const thisYear = new Date().getUTCFullYear();
    const outcome = await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, {
      ...ADULT_DOCUMENT,
      dob: { day: 1, month: 1, year: thisYear - 15 },
    });

    expect(outcome).toEqual({ applied: true, ageFlag: 'BELOW_MINIMUM_AGE' });
    expect(claimOf().patch).toMatchObject({ documentAgeFlag: 'BELOW_MINIMUM_AGE' });
    // Writing a minor's document date as "age verified" would say the opposite
    // of what the document found.
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('flags a date no adult could have as implausible rather than as a child', async () => {
    const outcome = await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, {
      ...ADULT_DOCUMENT,
      dob: { day: 1, month: 1, year: 1850 },
    });

    expect(outcome.ageFlag).toBe('IMPLAUSIBLE_DATE');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('still records the check when the document carries no date of birth', async () => {
    const outcome = await applyWomanGateDocumentResult('ana', 'b1', GATE_BADGE, {
      first_name: 'Ana',
      last_name: 'Moreau',
    });

    expect(outcome).toEqual({ applied: true, ageFlag: null });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('recordWomanGateDocumentCheck', () => {
  it('asks Stripe for the document fields by name, because the event does not carry them', async () => {
    retrieve.mockResolvedValue({ status: 'verified', verified_outputs: ADULT_DOCUMENT });

    const check = await recordWomanGateDocumentCheck('ana', { id: 'b1', metadata: GATE_BADGE }, 'vs_1');

    expect(retrieve).toHaveBeenCalledWith('vs_1', { expand: ['verified_outputs'] });
    expect(check).toEqual({ outcome: 'recorded', ageFlag: null });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('reports already recorded, not recorded, when the other caller got there first', async () => {
    retrieve.mockResolvedValue({ status: 'verified', verified_outputs: ADULT_DOCUMENT });
    tx.$executeRaw.mockResolvedValue(0);

    const check = await recordWomanGateDocumentCheck('ana', { id: 'b1', metadata: GATE_BADGE }, 'vs_1');

    expect(check).toEqual({ outcome: 'already_recorded', ageFlag: null });
  });

  it('does not even ask Stripe when the result is already on the badge', async () => {
    const check = await recordWomanGateDocumentCheck(
      'ana',
      { id: 'b1', metadata: { ...GATE_BADGE, documentCheckPassedAt: '2026-10-01T00:00:00.000Z' } },
      'vs_1'
    );

    expect(check.outcome).toBe('already_recorded');
    expect(retrieve).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('reports a session that has not passed without recording anything', async () => {
    retrieve.mockResolvedValue({ status: 'requires_input', last_error: { reason: 'The document was blurry.' } });

    const check = await recordWomanGateDocumentCheck('ana', { id: 'b1', metadata: GATE_BADGE }, 'vs_1');

    expect(check).toEqual({ outcome: 'not_ready', documentCheck: 'requires_input', reason: 'The document was blurry.' });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

describe('redactIdentitySession', () => {
  const badge = { id: 'b1', userId: 'ana', metadata: GATE_BADGE };

  it('asks Stripe to redact the session and notes on the badge that it did', async () => {
    const done = await redactIdentitySession(badge);

    expect(done).toBe(true);
    expect(redact).toHaveBeenCalledTimes(1);
    expect(redact).toHaveBeenCalledWith('vs_1');
    const stamped = prisma.verificationBadge.update.mock.calls[0][0];
    expect(stamped.where).toEqual({ id: 'b1' });
    expect(typeof stamped.data.metadata.redactedAt).toBe('string');
    // The rest of the badge is kept: the stamp is added, nothing is dropped.
    expect(stamped.data.metadata).toMatchObject({ purpose: 'WOMAN_GATE', sessionId: 'vs_1' });
  });

  it('does not ask twice for a session already redacted', async () => {
    const done = await redactIdentitySession({ ...badge, metadata: { ...GATE_BADGE, redactedAt: '2026-10-01T00:00:00.000Z' } });

    expect(done).toBe(true);
    expect(redact).not.toHaveBeenCalled();
  });

  it('does nothing for a badge that never had a Stripe session', async () => {
    const done = await redactIdentitySession({ id: 'b2', userId: 'ana', metadata: { provider: 'manual', statement: 'x' } });

    expect(done).toBe(false);
    expect(redact).not.toHaveBeenCalled();
  });

  it('does not throw and does not stamp when Stripe refuses, so the sweep tries again', async () => {
    redact.mockRejectedValue(new Error('This VerificationSession cannot be redacted in its current status'));

    const done = await redactIdentitySession(badge);

    expect(done).toBe(false);
    expect(prisma.verificationBadge.update).not.toHaveBeenCalled();
  });

  it('leaves the session alone for a member named in an active legal hold', async () => {
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['ana'], affectedDataTypes: [] }]);

    const done = await redactIdentitySession(badge);

    expect(done).toBe(false);
    expect(redact).not.toHaveBeenCalled();
    // Only holds still in force are read.
    expect(prisma.legalHold.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it.each(['identity_verification', 'Identity Verification', 'identity-documents', '*', 'ALL'])(
    'leaves every identity check alone under a hold on "%s", whoever the hold names',
    async (type) => {
      prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['somebody-else'], affectedDataTypes: [type] }]);

      const done = await redactIdentitySession(badge);

      expect(done).toBe(false);
      expect(redact).not.toHaveBeenCalled();
    }
  );

  it('is not stopped by a hold on another member, or on another kind of record', async () => {
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['somebody-else'], affectedDataTypes: ['messages', 'notifications'] }]);

    const done = await redactIdentitySession(badge);

    expect(done).toBe(true);
    expect(redact).toHaveBeenCalledWith('vs_1');
  });

  it('leaves the session alone when the hold lookup itself fails, because a redaction cannot be taken back', async () => {
    prisma.legalHold.findMany.mockRejectedValue(new Error('connection reset'));

    const done = await redactIdentitySession(badge);

    expect(done).toBe(false);
    expect(redact).not.toHaveBeenCalled();
  });

  it('skips the per-member hold lookup when the sweep has already applied the holds', async () => {
    await redactIdentitySession(badge, { holdsChecked: true });

    expect(prisma.legalHold.findMany).not.toHaveBeenCalled();
    expect(redact).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a deployment with no Stripe key', async () => {
    stripeConfigured.mockReturnValue(false);

    const done = await redactIdentitySession(badge);

    expect(done).toBe(false);
    expect(redact).not.toHaveBeenCalled();
  });
});

describe('redactIdentityChecksBeforeErasure', () => {
  it('asks Stripe to erase every check the member started, decided or not, before her badges are deleted', async () => {
    prisma.verificationBadge.findMany.mockResolvedValue([
      { id: 'b1', userId: 'ana', metadata: { ...GATE_BADGE, sessionId: 'vs_1' } },
      { id: 'b2', userId: 'ana', metadata: { provider: 'stripe_identity', sessionId: 'vs_2' } },
      { id: 'b3', userId: 'ana', metadata: { provider: 'manual', statement: 'a written note, nothing at Stripe' } },
    ]);

    await redactIdentityChecksBeforeErasure('ana');

    expect(prisma.verificationBadge.findMany.mock.calls[0][0].where).toEqual({ userId: 'ana', type: 'IDENTITY' });
    expect(redact).toHaveBeenCalledTimes(2);
    expect(redact).toHaveBeenCalledWith('vs_1');
    expect(redact).toHaveBeenCalledWith('vs_2');
  });

  it('skips a check that was redacted when it was decided', async () => {
    prisma.verificationBadge.findMany.mockResolvedValue([
      { id: 'b1', userId: 'ana', metadata: { ...GATE_BADGE, redactedAt: '2026-10-01T00:00:00.000Z' } },
    ]);

    await redactIdentityChecksBeforeErasure('ana');

    expect(redact).not.toHaveBeenCalled();
  });

  it('never throws and never holds the erasure up, whatever Stripe or the database says', async () => {
    prisma.verificationBadge.findMany.mockResolvedValueOnce([{ id: 'b1', userId: 'ana', metadata: GATE_BADGE }]);
    redact.mockRejectedValueOnce(new Error('Stripe is down'));
    await expect(redactIdentityChecksBeforeErasure('ana')).resolves.toBeUndefined();

    prisma.verificationBadge.findMany.mockRejectedValueOnce(new Error('connection reset'));
    await expect(redactIdentityChecksBeforeErasure('ana')).resolves.toBeUndefined();
  });

  it('leaves the check alone under a legal hold, as at a decision', async () => {
    prisma.verificationBadge.findMany.mockResolvedValue([{ id: 'b1', userId: 'ana', metadata: GATE_BADGE }]);
    prisma.legalHold.findMany.mockResolvedValue([{ affectedUserIds: ['ana'], affectedDataTypes: [] }]);

    await redactIdentityChecksBeforeErasure('ana');

    expect(redact).not.toHaveBeenCalled();
  });
});
