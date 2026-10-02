import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    organization: { findMany: jest.fn(async () => []) },
  },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  assertOwnResumeUpload,
  canManageJobApplicants,
  canPostListings,
  canViewApplicants,
  hiringStaff,
  assertHostMayPlaceApprentices,
  hostMayPlaceApprentices,
  hostStandings,
  placementOrganisationId,
  withHostStanding,
} from '../hiring-access.service';

const prisma: any = prismaTyped;
const ACCEPTED = new Date('2026-01-05T00:00:00.000Z');

describe('Who may see applicants', () => {
  it.each([
    ['an accepted owner', { role: 'OWNER', canPostJobs: false, acceptedAt: ACCEPTED }, true],
    ['an accepted admin', { role: 'ADMIN', canPostJobs: false, acceptedAt: ACCEPTED }, true],
    ['an accepted recruiter', { role: 'RECRUITER', canPostJobs: false, acceptedAt: ACCEPTED }, true],
    ['an accepted viewer given posting rights', { role: 'VIEWER', canPostJobs: true, acceptedAt: ACCEPTED }, true],
    ['an accepted viewer', { role: 'VIEWER', canPostJobs: false, acceptedAt: ACCEPTED }, false],
    ['an unanswered admin invitation', { role: 'ADMIN', canPostJobs: true, acceptedAt: null }, false],
    ['no membership at all', null, false],
  ] as const)('%s: %s', (_label, membership, expected) => {
    expect(canViewApplicants(membership as any)).toBe(expected);
  });
});

describe('Who may write listings', () => {
  it('is an accepted owner or admin, or anyone given posting rights, and not a plain recruiter', () => {
    expect(canPostListings({ role: 'OWNER', canPostJobs: false, acceptedAt: ACCEPTED } as any)).toBe(true);
    expect(canPostListings({ role: 'RECRUITER', canPostJobs: true, acceptedAt: ACCEPTED } as any)).toBe(true);
    expect(canPostListings({ role: 'RECRUITER', canPostJobs: false, acceptedAt: ACCEPTED } as any)).toBe(false);
    expect(canPostListings({ role: 'OWNER', canPostJobs: true, acceptedAt: null } as any)).toBe(false);
  });
});

describe('Who may manage a job’s applicants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is the hiring team for a job under an organisation, not whoever created the row', async () => {
    // She created the listing, and has since been made a VIEWER.
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'VIEWER', canPostJobs: false, acceptedAt: ACCEPTED });
    expect(await canManageJobApplicants({ organizationId: 'org-1', postedById: 'poster-1' }, 'poster-1')).toBe(false);

    // Removed from the team entirely.
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    expect(await canManageJobApplicants({ organizationId: 'org-1', postedById: 'poster-1' }, 'poster-1')).toBe(false);

    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'RECRUITER', canPostJobs: false, acceptedAt: ACCEPTED });
    expect(await canManageJobApplicants({ organizationId: 'org-1', postedById: 'poster-1' }, 'colleague-1')).toBe(true);
  });

  it('is the poster, and only the poster, for a job with no organisation', async () => {
    expect(await canManageJobApplicants({ organizationId: null, postedById: 'poster-1' }, 'poster-1')).toBe(true);
    expect(await canManageJobApplicants({ organizationId: null, postedById: 'poster-1' }, 'someone')).toBe(false);
    expect(prisma.organizationMember.findUnique).not.toHaveBeenCalled();
  });
});

describe('The hiring staff to tell about an application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks only for accepted members with a hiring role, and names each person once', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      { userId: 'a', organizationId: 'rto-1' },
      { userId: 'a', organizationId: 'host-1' },
      { userId: 'b', organizationId: 'host-1' },
    ]);

    const staff = await hiringStaff(['rto-1', 'host-1']);

    expect(staff).toEqual([
      { userId: 'a', organizationId: 'rto-1' },
      { userId: 'b', organizationId: 'host-1' },
    ]);
    expect(prisma.organizationMember.findMany.mock.calls[0][0].where).toEqual({
      organizationId: { in: ['rto-1', 'host-1'] },
      acceptedAt: { not: null },
      OR: [{ role: { in: ['OWNER', 'ADMIN', 'RECRUITER'] } }, { canPostJobs: true }],
    });
  });

  it('asks nothing when there is no organisation to ask about', async () => {
    expect(await hiringStaff([])).toEqual([]);
    expect(prisma.organizationMember.findMany).not.toHaveBeenCalled();
  });
});

describe('A résumé has to be her own upload', () => {
  it('accepts her own file and refuses anyone else’s or an outside link', () => {
    expect(() => assertOwnResumeUpload('/api/media/local/resumes/u1/cv.pdf', 'u1')).not.toThrow();
    expect(() => assertOwnResumeUpload('https://bucket.s3.amazonaws.com/resumes/u1/cv.pdf?x=1', 'u1')).not.toThrow();
    expect(() => assertOwnResumeUpload('/api/media/local/resumes/u2/cv.pdf', 'u1')).toThrow();
    expect(() => assertOwnResumeUpload('https://evil.example/cv.pdf', 'u1')).toThrow();
    expect(() => assertOwnResumeUpload(undefined, 'u1')).not.toThrow();
  });
});

describe('Who may place apprentices', () => {
  const NOW = new Date('2026-10-01T02:00:00.000Z');
  const org = (id: string, isVerified: boolean, attested: boolean) => ({ id, isVerified, hostSafetyAttestations: attested ? [{ id: `att-${id}` }] : [] });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findMany.mockResolvedValue([]);
  });

  it('is the host employer when one is named, and the training provider when not, and nobody when neither', () => {
    expect(placementOrganisationId({ hostEmployerId: 'host', rtoId: 'rto' })).toBe('host');
    expect(placementOrganisationId({ hostEmployerId: null, rtoId: 'rto' })).toBe('rto');
    expect(placementOrganisationId({ rtoId: 'rto' })).toBe('rto');
    expect(placementOrganisationId({ hostEmployerId: null, rtoId: null })).toBeNull();
    expect(placementOrganisationId({})).toBeNull();
  });

  it.each([
    ['verified and attested', true, true, true],
    ['verified but not attested', true, false, false],
    ['attested but not verified', false, true, false],
    ['neither', false, false, false],
  ])('an organisation that is %s may place apprentices: %s', async (_what, verified, attested, mayPlace) => {
    prisma.organization.findMany.mockResolvedValue([org('o1', verified, attested)]);
    expect(await hostMayPlaceApprentices('o1', NOW)).toBe(mayPlace);
    expect((await hostStandings(['o1'], NOW)).get('o1')).toEqual({ verified, attested, mayPlace });
  });

  it('asks the database only for an attestation that is approved and has not run out, as of now', async () => {
    await hostStandings(['o1'], NOW);
    expect(prisma.organization.findMany.mock.calls[0][0]).toEqual({
      where: { id: { in: ['o1'] } },
      select: {
        id: true,
        isVerified: true,
        hostSafetyAttestations: { where: { status: 'APPROVED', expiresAt: { gt: NOW } }, select: { id: true }, take: 1 },
      },
    });
  });

  it('fails closed: an organisation nobody knows, or no organisation, may place nobody', async () => {
    expect(await hostMayPlaceApprentices('ghost', NOW)).toBe(false);
    expect(await hostMayPlaceApprentices(null, NOW)).toBe(false);
    expect(await hostMayPlaceApprentices(undefined, NOW)).toBe(false);
  });

  it('reads many organisations in one query, once each, and not at all when there are none', async () => {
    prisma.organization.findMany.mockResolvedValue([org('a', true, true), org('b', true, false)]);
    const map = await hostStandings(['a', 'b', 'a', null, undefined], NOW);
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.organization.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['a', 'b'] } });
    expect([...map.keys()].sort()).toEqual(['a', 'b']);

    prisma.organization.findMany.mockClear();
    expect((await hostStandings([null, undefined])).size).toBe(0);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('labels each listing by the organisation it is placed with, and keeps what it had', async () => {
    prisma.organization.findMany.mockResolvedValue([org('rto', true, true), org('host', true, false)]);

    const out = await withHostStanding(
      [
        { id: '1', rtoId: 'rto', hostEmployerId: null },
        { id: '2', rtoId: 'rto', hostEmployerId: 'host' },
        { id: '3', rtoId: null, hostEmployerId: null },
      ],
      NOW
    );

    expect(out.map((l) => [l.id, l.hostVerified, l.hostSafetyChecked, l.hostMayPlace])).toEqual([
      ['1', true, true, true],
      ['2', true, false, false],
      ['3', false, false, false],
    ]);
  });

  it('refuses with words for the audience: what to do for staff, why for an applicant', async () => {
    const listing = { rtoId: 'rto', hostEmployerId: null };
    await expect(assertHostMayPlaceApprentices(listing, 'staff', NOW)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('verified and its host safety attestation approved'),
    });
    await expect(assertHostMayPlaceApprentices(listing, 'applicant', NOW)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('has not safety-checked this host yet'),
    });

    prisma.organization.findMany.mockResolvedValue([org('rto', true, true)]);
    await expect(assertHostMayPlaceApprentices(listing, 'staff', NOW)).resolves.toBeUndefined();
  });
});
