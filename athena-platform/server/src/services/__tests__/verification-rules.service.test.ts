import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * The rules a verification badge rests on: what an application may carry, who
 * may apply for the creator badge, and what a reviewer is shown for an
 * employer or educator badge. See the service for why each exists.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    follow: { count: jest.fn() },
    organization: { findUnique: jest.fn() },
  },
}));

const mockLookupAbn = jest.fn<(abn: unknown) => Promise<unknown>>();
let mockAbrConfigured = false;
jest.mock('../abr.service', () => {
  const actual = jest.requireActual('../abr.service') as Record<string, unknown>;
  return {
    ...actual,
    isConfigured: () => mockAbrConfigured,
    lookupAbn: (abn: unknown) => mockLookupAbn(abn),
  };
});

import { prisma } from '../../utils/prisma';
import { ApiError } from '../../middleware/errorHandler';
import {
  CREATOR_MIN_ACCOUNT_AGE_DAYS,
  CREATOR_MIN_FOLLOWERS,
  abnCheck,
  creatorEligibility,
  creatorRefusal,
  emailDomainCheck,
  hostOf,
  reviewerChecks,
  sameOrganisationHost,
  sanitiseBadgeMetadata,
} from '../verification-rules.service';

const prismaAny: any = prisma;

// A valid ABN (the checksum passes); 12 345 678 901 is not.
const VALID_ABN = '51824753556';

beforeEach(() => {
  jest.clearAllMocks();
  mockAbrConfigured = false;
  prismaAny.user.findUnique.mockReset();
  prismaAny.follow.count.mockReset();
  prismaAny.organization.findUnique.mockReset();
});

describe('sanitiseBadgeMetadata', () => {
  it('returns nothing when nothing was sent, so the column stays empty', () => {
    expect(sanitiseBadgeMetadata('MENTOR', undefined)).toBeUndefined();
    expect(sanitiseBadgeMetadata('MENTOR', null)).toBeUndefined();
    expect(sanitiseBadgeMetadata('MENTOR', {})).toBeUndefined();
    expect(sanitiseBadgeMetadata('MENTOR', { role: '   ', note: '' })).toBeUndefined();
  });

  it('keeps only the fields each badge is applied for with, trimmed', () => {
    expect(sanitiseBadgeMetadata('MENTOR', { role: ' Head of Product ', evidenceUrl: 'https://x.example', organisation: 'Acme' })).toEqual({
      role: 'Head of Product',
      evidenceUrl: 'https://x.example',
    });
    expect(sanitiseBadgeMetadata('CREATOR', { evidenceUrl: 'https://x.example', note: '12k', role: 'Ignored' })).toEqual({
      evidenceUrl: 'https://x.example',
      note: '12k',
    });
    expect(sanitiseBadgeMetadata('IDENTITY', { note: 'hello', organisation: 'Ignored' })).toEqual({ note: 'hello' });
    expect(
      sanitiseBadgeMetadata('EDUCATOR', {
        organisation: 'TAFE',
        organizationId: 'org-1',
        organizationName: 'TAFE Queensland',
        abn: '51 824 753 556',
        website: 'https://tafeqld.edu.au',
        evidenceUrl: 'https://tafeqld.edu.au/staff',
        role: 'Lecturer',
      })
    ).toMatchObject({ organizationId: 'org-1', abn: '51 824 753 556', website: 'https://tafeqld.edu.au' });
  });

  it.each([
    'purpose',
    'provider',
    'sessionId',
    'startedAt',
    'submittedAt',
    'documentCheckPassedAt',
    'documentName',
    'documentType',
    'documentAgeFlag',
    'redactedAt',
    'statement',
  ])('refuses %s, which ATHENA writes about a check and a member cannot supply', (key) => {
    expect(() => sanitiseBadgeMetadata('IDENTITY', { note: 'ok', [key]: 'x' })).toThrow(ApiError);
    try {
      sanitiseBadgeMetadata('IDENTITY', { [key]: 'x' });
    } catch (error) {
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toContain(key);
    }
  });

  it('refuses a reserved key even when it is not one the badge type would keep, and when it is empty', () => {
    expect(() => sanitiseBadgeMetadata('CREATOR', { provider: '' })).toThrow(/provider/);
    expect(() => sanitiseBadgeMetadata('CREATOR', { purpose: null })).toThrow(/purpose/);
  });

  it('refuses a non-object, text that is not text, and text that is too long', () => {
    expect(() => sanitiseBadgeMetadata('MENTOR', 'role')).toThrow(ApiError);
    expect(() => sanitiseBadgeMetadata('MENTOR', ['role'])).toThrow(ApiError);
    expect(() => sanitiseBadgeMetadata('MENTOR', { role: 5 })).toThrow(/must be text/);
    expect(() => sanitiseBadgeMetadata('MENTOR', { role: { a: 1 } })).toThrow(/must be text/);
    expect(() => sanitiseBadgeMetadata('MENTOR', { role: 'x'.repeat(301) })).toThrow(/too long/);
    expect(() => sanitiseBadgeMetadata('MENTOR', { evidenceUrl: `https://x.example/${'a'.repeat(500)}` })).toThrow(/too long/);
    expect(sanitiseBadgeMetadata('MENTOR', { evidenceUrl: `https://x.example/${'a'.repeat(400)}` })).toBeDefined();
  });
});

describe('creatorEligibility', () => {
  const now = new Date('2026-10-01T00:00:00.000Z');
  const accountCreated = (daysAgo: number, extraMs = 0) => ({ createdAt: new Date(now.getTime() - daysAgo * 86_400_000 - extraMs) });

  it('is the audience and the history together, at exactly the stated thresholds', async () => {
    prismaAny.follow.count.mockResolvedValue(CREATOR_MIN_FOLLOWERS);
    prismaAny.user.findUnique.mockResolvedValue(accountCreated(CREATOR_MIN_ACCOUNT_AGE_DAYS));

    await expect(creatorEligibility('u1', now)).resolves.toMatchObject({ eligible: true, followers: 10_000, accountAgeDays: 90 });
  });

  it.each([
    ['one follower short', CREATOR_MIN_FOLLOWERS - 1, CREATOR_MIN_ACCOUNT_AGE_DAYS],
    ['one day short', CREATOR_MIN_FOLLOWERS, CREATOR_MIN_ACCOUNT_AGE_DAYS - 1],
  ])('is not met %s', async (_label, followers, days) => {
    prismaAny.follow.count.mockResolvedValue(followers);
    prismaAny.user.findUnique.mockResolvedValue(accountCreated(days, 60_000));

    expect((await creatorEligibility('u1', now)).eligible).toBe(false);
  });

  it('counts the people following her, not the people she follows', async () => {
    prismaAny.follow.count.mockResolvedValue(3);
    prismaAny.user.findUnique.mockResolvedValue(accountCreated(500));

    await creatorEligibility('u1', now);

    expect(prismaAny.follow.count).toHaveBeenCalledWith({ where: { followingId: 'u1' } });
  });

  it('is not met for an account that does not exist', async () => {
    prismaAny.follow.count.mockResolvedValue(50_000);
    prismaAny.user.findUnique.mockResolvedValue(null);

    expect((await creatorEligibility('ghost', now)).eligible).toBe(false);
  });

  it('says what is missing, with the numbers, the same way to the member and to the reviewer', () => {
    expect(
      creatorRefusal({ eligible: false, followers: 120, minFollowers: 10_000, accountAgeDays: 12, minAccountAgeDays: 90 })
    ).toBe(
      'The creator badge is for accounts with 10,000 followers on ATHENA (this account has 120) and at least 90 days on ATHENA (this account is 12 days old).'
    );
    expect(
      creatorRefusal({ eligible: false, followers: 12_000, minFollowers: 10_000, accountAgeDays: 30, minAccountAgeDays: 90 })
    ).toBe('The creator badge is for accounts with at least 90 days on ATHENA (this account is 30 days old).');
  });
});

describe('hostOf and sameOrganisationHost', () => {
  it('reads a host from a website as people type it', () => {
    expect(hostOf('https://www.Acme.com.au/about')).toBe('acme.com.au');
    expect(hostOf('acme.com.au')).toBe('acme.com.au');
    expect(hostOf('http://acme.com.au:8080')).toBe('acme.com.au');
  });

  it('reads nothing from text that is not a website', () => {
    expect(hostOf('Team page, LinkedIn, or a work email domain')).toBeNull();
    expect(hostOf('')).toBeNull();
    expect(hostOf(undefined)).toBeNull();
    expect(hostOf('localhost')).toBeNull();
  });

  it('matches the organisation itself and its subdomains, and nothing that merely contains the name', () => {
    expect(sameOrganisationHost('acme.com.au', 'acme.com.au')).toBe(true);
    expect(sameOrganisationHost('mail.acme.com.au', 'acme.com.au')).toBe(true);
    expect(sameOrganisationHost('acme.com.au', 'careers.acme.com.au')).toBe(true);
    expect(sameOrganisationHost('notacme.com.au', 'acme.com.au')).toBe(false);
    expect(sameOrganisationHost('acme.com.au.evil.example', 'acme.com.au')).toBe(false);
  });
});

describe('emailDomainCheck', () => {
  it('passes when the confirmed address is at the organisation\'s website', () => {
    const check = emailDomainCheck({ email: 'lead@acme.com.au', emailVerified: true, websites: ['https://www.acme.com.au'] });
    expect(check).toMatchObject({ key: 'email-domain', status: 'pass' });
  });

  it('passes on any of the websites it was given', () => {
    const check = emailDomainCheck({ email: 'lead@acme.com.au', emailVerified: true, websites: ['https://elsewhere.example', null, 'acme.com.au'] });
    expect(check.status).toBe('pass');
  });

  it('warns when the confirmed address is somewhere else', () => {
    const check = emailDomainCheck({ email: 'lead@other.example', emailVerified: true, websites: ['https://acme.com.au'] });
    expect(check.status).toBe('warn');
    expect(check.detail).toContain('does not match');
  });

  it('warns that a personal mail provider shows nothing, even when the website is the provider\'s', () => {
    const check = emailDomainCheck({ email: 'lead@gmail.com', emailVerified: true, websites: ['https://gmail.com'] });
    expect(check.status).toBe('warn');
    expect(check.detail).toMatch(/personal mail provider/);
  });

  it('warns that an unconfirmed address proves nothing, however well it matches', () => {
    const check = emailDomainCheck({ email: 'lead@acme.com.au', emailVerified: false, websites: ['https://acme.com.au'] });
    expect(check.status).toBe('warn');
    expect(check.detail).toMatch(/not been confirmed/);
  });

  it('says there is nothing to compare when no website was given, and when there is no address', () => {
    expect(emailDomainCheck({ email: 'lead@acme.com.au', emailVerified: true, websites: [null, undefined] }).status).toBe('info');
    expect(emailDomainCheck({ email: null, emailVerified: true, websites: ['acme.com.au'] }).status).toBe('unavailable');
  });
});

describe('abnCheck', () => {
  it('says so when no ABN was given', async () => {
    expect((await abnCheck({ abn: undefined, organisationName: 'Acme' })).status).toBe('info');
    expect((await abnCheck({ abn: '  ', organisationName: 'Acme' })).status).toBe('info');
  });

  it('warns about a number that fails the checksum, before asking the register anything', async () => {
    mockAbrConfigured = true;

    const check = await abnCheck({ abn: '12 345 678 901', organisationName: 'Acme' });

    expect(check.status).toBe('warn');
    expect(check.detail).toMatch(/not a valid ABN/);
    expect(mockLookupAbn).not.toHaveBeenCalled();
  });

  it('says plainly that the live lookup is off, rather than implying the register agreed', async () => {
    const check = await abnCheck({ abn: VALID_ABN, organisationName: 'Acme' });

    expect(check.status).toBe('info');
    expect(check.detail).toMatch(/valid ABN checksum/);
    expect(check.detail).toMatch(/not switched on/);
    expect(mockLookupAbn).not.toHaveBeenCalled();
  });

  describe('with the register switched on', () => {
    beforeEach(() => {
      mockAbrConfigured = true;
    });

    const entity = (overrides: Record<string, unknown> = {}) => ({
      abn: VALID_ABN,
      abnStatus: 'Active',
      entityName: 'ACME HOLDINGS PTY LTD',
      businessNames: ['Acme Careers'],
      state: 'QLD',
      ...overrides,
    });

    it('passes an active ABN whose registered name agrees with the organisation', async () => {
      mockLookupAbn.mockResolvedValue(entity());

      const check = await abnCheck({ abn: VALID_ABN, organisationName: 'Acme Holdings' });

      expect(check.status).toBe('pass');
      expect(check.detail).toContain('ACME HOLDINGS PTY LTD');
    });

    it('also agrees with a registered business name', async () => {
      mockLookupAbn.mockResolvedValue(entity());

      expect((await abnCheck({ abn: VALID_ABN, organisationName: 'Acme Careers' })).status).toBe('pass');
    });

    it('warns when the registered name does not look like the organisation', async () => {
      mockLookupAbn.mockResolvedValue(entity({ entityName: 'SOMEBODY ELSE PTY LTD', businessNames: [] }));

      const check = await abnCheck({ abn: VALID_ABN, organisationName: 'Acme Holdings' });

      expect(check.status).toBe('warn');
      expect(check.detail).toContain('does not look like');
    });

    it('warns about an ABN that is not Active', async () => {
      mockLookupAbn.mockResolvedValue(entity({ abnStatus: 'Cancelled' }));

      const check = await abnCheck({ abn: VALID_ABN, organisationName: 'Acme Holdings' });

      expect(check.status).toBe('warn');
      expect(check.detail).toContain('Cancelled');
    });

    it('warns when the register has no record of a number with a valid checksum', async () => {
      mockLookupAbn.mockResolvedValue(null);

      expect((await abnCheck({ abn: VALID_ABN, organisationName: 'Acme' })).status).toBe('warn');
    });

    it('reports a register that did not answer as unavailable, not as a failed check', async () => {
      mockLookupAbn.mockRejectedValue(new ApiError(502, 'The ABR did not answer in time'));

      const check = await abnCheck({ abn: VALID_ABN, organisationName: 'Acme' });

      expect(check.status).toBe('unavailable');
      expect(check.detail).toContain('did not answer in time');
    });
  });
});

describe('reviewerChecks', () => {
  const applicant = { email: 'lead@acme.com.au', emailVerified: true };

  it('has nothing to check for the badges ATHENA holds no data to check against', async () => {
    for (const type of ['IDENTITY', 'MENTOR', 'CREATOR']) {
      await expect(reviewerChecks({ type, metadata: { role: 'x' }, user: applicant })).resolves.toEqual([]);
    }
  });

  it('checks an employer badge from what she wrote', async () => {
    const checks = await reviewerChecks({
      type: 'EMPLOYER',
      metadata: { organisation: 'Acme', website: 'https://acme.com.au', abn: VALID_ABN },
      user: applicant,
    });

    expect(checks.map((c) => [c.key, c.status])).toEqual([
      ['email-domain', 'pass'],
      ['abn', 'info'],
    ]);
    expect(prismaAny.organization.findUnique).not.toHaveBeenCalled();
  });

  it('adds the website and ABN on the organisation\'s own page when the application names it', async () => {
    prismaAny.organization.findUnique.mockResolvedValue({ name: 'Acme Holdings', website: 'https://acme.com.au', abn: VALID_ABN });

    const checks = await reviewerChecks({
      type: 'EDUCATOR',
      metadata: { organizationId: 'org-1' },
      user: applicant,
    });

    expect(prismaAny.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { name: true, website: true, abn: true },
    });
    expect(checks.find((c) => c.key === 'email-domain')?.status).toBe('pass');
    expect(checks.find((c) => c.key === 'abn')?.detail).toContain(VALID_ABN);
  });

  it('does not use the "where we can confirm it" link as the organisation\'s website', async () => {
    const checks = await reviewerChecks({
      type: 'EMPLOYER',
      metadata: { organisation: 'Acme', evidenceUrl: 'https://www.linkedin.com/company/acme' },
      user: applicant,
    });

    expect(checks.find((c) => c.key === 'email-domain')?.status).toBe('info');
  });
});
