import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The two gates the product rests on. Neither existed as code before: the
 * women-only status was read by one helper in housing and by nothing else, and
 * there was no date of birth anywhere in the schema to check an age against.
 *
 * These assert the parts that are easy to get subtly wrong and impossible to
 * notice afterwards — a birthday landing on the wrong side of the line, a null
 * date of birth being read as consent, a reviewer's Reject having no
 * consequence, and Safe Mode meaning different things on two different pages.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  isPlausibleDateOfBirth,
  isWomanMember,
  isWomanVerified,
  mayEnterConfidentialSpace,
  meetsMinimumAge,
  readWomanGateEvidence,
  requireAdultAccount,
  requireWomanMember,
  requireWomanVerified,
  womanGateState,
  yearsSince,
  WOMAN_GATE_PURPOSE,
} from '../account-gates';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const res = () => {
  const r: any = { statusCode: 0, body: null };
  r.status = (code: number) => {
    r.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    r.body = body;
    return r;
  };
  return r;
};

const req = (id: string | null) => ({ user: id ? { id } : undefined, originalUrl: '/api/posts' }) as any;

describe('the age arithmetic', () => {
  it('counts completed years, not fractions of one', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    expect(yearsSince('2008-09-23', now)).toBe(18);
    expect(yearsSince('2008-09-24', now)).toBe(17);
    expect(yearsSince('2008-09-22', now)).toBe(18);
  });

  it('puts a 29 February birthday on the right side of the line', () => {
    // Dividing milliseconds by 365.25 days gets this one wrong every year.
    expect(yearsSince('2008-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(17);
    expect(yearsSince('2008-02-29', new Date('2026-03-01T12:00:00Z'))).toBe(18);
  });

  it('refuses a date in the future or one no living person could have', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    expect(isPlausibleDateOfBirth('2030-01-01', now)).toBe(false);
    expect(isPlausibleDateOfBirth('1850-01-01', now)).toBe(false);
    expect(isPlausibleDateOfBirth('not a date', now)).toBe(false);
    expect(isPlausibleDateOfBirth('1990-05-12', now)).toBe(true);
  });

  it('lets an adult through on her birthday and not the day before', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    expect(meetsMinimumAge('2008-09-23', now)).toBe(true);
    expect(meetsMinimumAge('2008-09-24', now)).toBe(false);
  });
});

describe('the age gate', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it('treats a missing date of birth as not permitted, and names where to give one', async () => {
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: null });
    const r = res();
    const next = jest.fn();

    await requireAdultAccount(req('u1'), r, next);

    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(r.body.setup).toBe('/dashboard/settings/profile');
  });

  it('refuses an account whose recorded date of birth is under the minimum', async () => {
    const twelve = new Date();
    twelve.setFullYear(twelve.getFullYear() - 12);
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: twelve });
    const r = res();
    const next = jest.fn();

    await requireAdultAccount(req('u1'), r, next);

    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBe('MINIMUM_AGE_NOT_MET');
  });

  it('lets an adult through', async () => {
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date('1990-05-12') });
    const r = res();
    const next = jest.fn();

    await requireAdultAccount(req('u1'), r, next);

    expect(next).toHaveBeenCalled();
    expect(r.statusCode).toBe(0);
  });
});

describe('the women-only gate', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it('reads Safe Mode from either store, because two pages write two columns', async () => {
    // The Safety Centre writes Profile.isSafeMode; the DV safety screen writes
    // DvSafetyProfile.isSafeMode. A woman who used the first one was refused
    // the DV-safe housing the same page told her Safe Mode unlocked.
    prisma.user.findUnique.mockResolvedValue({
      womanVerificationStatus: 'UNVERIFIED',
      dvSafetyProfile: null,
      profile: { isSafeMode: true },
    });
    expect(mayEnterConfidentialSpace(await womanGateState('u1'))).toBe(true);

    prisma.user.findUnique.mockResolvedValue({
      womanVerificationStatus: 'UNVERIFIED',
      dvSafetyProfile: { isSafeMode: true },
      profile: null,
    });
    expect(mayEnterConfidentialSpace(await womanGateState('u1'))).toBe(true);

    prisma.user.findUnique.mockResolvedValue({
      womanVerificationStatus: 'UNVERIFIED',
      dvSafetyProfile: { isSafeMode: false },
      profile: { isSafeMode: false },
    });
    expect(mayEnterConfidentialSpace(await womanGateState('u1'))).toBe(false);
  });

  it('separates "not refused" from "verified"', () => {
    expect(isWomanMember({ status: 'UNVERIFIED', safeMode: false })).toBe(true);
    expect(isWomanMember({ status: 'REJECTED', safeMode: false })).toBe(false);
    expect(isWomanVerified({ status: 'UNVERIFIED', safeMode: true })).toBe(false);
    expect(isWomanVerified({ status: 'VERIFIED', safeMode: false })).toBe(true);
  });

  it('gives the reviewer’s Reject a consequence on every gated surface', async () => {
    prisma.user.findUnique.mockResolvedValue({
      womanVerificationStatus: 'REJECTED',
      dvSafetyProfile: null,
      profile: null,
    });
    const r = res();
    const next = jest.fn();

    await requireWomanMember(req('u1'), r, next);

    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBe('WOMAN_VERIFICATION_REJECTED');
  });

  it('asks an unverified member to verify only where verification is the promise', async () => {
    prisma.user.findUnique.mockResolvedValue({
      womanVerificationStatus: 'UNVERIFIED',
      dvSafetyProfile: null,
      profile: null,
    });

    const memberRes = res();
    const memberNext = jest.fn();
    await requireWomanMember(req('u1'), memberRes, memberNext);
    expect(memberNext).toHaveBeenCalled();

    const verifiedRes = res();
    const verifiedNext = jest.fn();
    await requireWomanVerified(req('u1'), verifiedRes, verifiedNext);
    expect(verifiedNext).not.toHaveBeenCalled();
    expect(verifiedRes.statusCode).toBe(403);
    expect(verifiedRes.body.code).toBe('WOMAN_VERIFICATION_REQUIRED');
  });

  it('refuses an unauthenticated caller rather than reading a gate off nobody', async () => {
    const r = res();
    const next = jest.fn();
    await requireWomanVerified(req(null), r, next);
    expect(r.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('what a reviewer is shown', () => {
  it('ignores metadata that does not belong to the women-only gate', () => {
    expect(readWomanGateEvidence({ provider: 'stripe_identity', sessionId: 'vs_1' })).toBeNull();
    expect(readWomanGateEvidence(null)).toBeNull();
  });

  it('reports nothing to review until something has actually been submitted', () => {
    // A started-but-abandoned document check is the case that used to be
    // indistinguishable from a finished one, because the queue showed neither.
    expect(
      readWomanGateEvidence({ purpose: WOMAN_GATE_PURPOSE, provider: 'stripe_identity', sessionId: 'vs_1' })
    ).toBeNull();
  });

  it('reports a passed document check and a written request', () => {
    const document = readWomanGateEvidence({
      purpose: WOMAN_GATE_PURPOSE,
      provider: 'stripe_identity',
      sessionId: 'vs_1',
      documentCheckPassedAt: '2026-09-23T00:00:00.000Z',
      documentName: 'Jane Doe',
    });
    expect(document).toMatchObject({ provider: 'stripe_identity', documentName: 'Jane Doe' });

    const written = readWomanGateEvidence({
      purpose: WOMAN_GATE_PURPOSE,
      provider: 'manual',
      statement: 'I have been a member of the Brisbane chapter since 2024.',
    });
    expect(written).toMatchObject({ provider: 'manual' });
    expect(written?.statement).toContain('Brisbane');
  });
});
