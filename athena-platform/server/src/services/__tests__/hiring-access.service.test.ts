import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  assertOwnResumeUpload,
  canManageJobApplicants,
  canPostListings,
  canViewApplicants,
  hiringStaff,
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
