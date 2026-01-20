import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/opensearch', () => ({
  getOpenSearchClient: () => null,
  IndexNames: {},
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    jobApplication: {
      findMany: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../utils/prisma';
import { getRecommendedJobs } from '../search.service';

describe('getRecommendedJobs (Prisma fallback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ranks jobs using skills + remote preference and excludes applied jobs', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-123',
      city: 'Sydney',
      state: 'NSW',
      country: 'Australia',
      currentJobTitle: 'Data Analyst',
      headline: 'Analytics and insights',
      profile: { remotePreference: 'remote' },
      skills: [{ skill: { name: 'sql' } }, { skill: { name: 'data' } }],
    });

    (prisma.jobApplication.findMany as any).mockResolvedValue([{ jobId: 'job-applied' }]);

    const jobApplied = {
      id: 'job-applied',
      title: 'SQL Analyst',
      description: 'Work with data and SQL',
      isRemote: true,
      city: 'Sydney',
      state: 'NSW',
      salaryMin: 0,
      salaryMax: 0,
      createdAt: new Date('2026-01-01'),
      publishedAt: new Date('2026-01-02'),
      organization: { id: 'o1', name: 'Org', logo: null },
      skills: [{ skill: { name: 'sql' } }],
    };

    const jobRemoteSkillMatch = {
      id: 'job-remote',
      title: 'Data Analyst (Remote)',
      description: 'Data analytics, SQL dashboards',
      isRemote: true,
      city: 'Melbourne',
      state: 'VIC',
      salaryMin: 0,
      salaryMax: 0,
      createdAt: new Date('2026-01-03'),
      publishedAt: new Date('2026-01-10'),
      organization: { id: 'o1', name: 'Org', logo: null },
      skills: [{ skill: { name: 'data' } }, { skill: { name: 'sql' } }],
    };

    const jobOnsiteNoMatch = {
      id: 'job-onsite',
      title: 'Office Manager',
      description: 'Operations and admin',
      isRemote: false,
      city: 'Sydney',
      state: 'NSW',
      salaryMin: 0,
      salaryMax: 0,
      createdAt: new Date('2026-01-05'),
      publishedAt: new Date('2026-01-09'),
      organization: { id: 'o1', name: 'Org', logo: null },
      skills: [{ skill: { name: 'excel' } }],
    };

    (prisma.job.findMany as any).mockResolvedValue([jobApplied, jobRemoteSkillMatch, jobOnsiteNoMatch]);

    const results = await getRecommendedJobs('user-123', 2);

    expect(results.map((r) => r.id)).toEqual(['job-remote', 'job-onsite']);
    expect(results.find((r) => r.id === 'job-applied')).toBeUndefined();
  });
});
