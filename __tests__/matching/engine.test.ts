import { getJobMatches } from '@/lib/matching/engine';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    member: {
      findUnique: jest.fn(),
    },
    userFeature: {
      findUnique: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
    },
  },
}));

describe('Matching Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return matches based on interest overlap', async () => {
    // Mock Data
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({ userId: 'user1' });
    (prisma.userFeature.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user1',
      interests: ['React', 'TypeScript'],
    });
    (prisma.job.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'job1',
        title: 'Frontend Developer',
        description: 'We need a React expert.',
        postedDate: new Date(),
        company: { name: 'Tech Corp' },
      },
      {
        id: 'job2',
        title: 'Backend Developer',
        description: 'Java and Spring.',
        postedDate: new Date(),
        company: { name: 'Old Corp' },
      },
    ]);

    const matches = await getJobMatches('user1');

    expect(matches).toHaveLength(2);
    expect(matches[0].id).toBe('job1'); // Should be first due to interest match
    expect(matches[0].matchScore).toBeGreaterThan(matches[1].matchScore);
    expect(matches[0].matchReasons).toContain('Matches 1 interests');
  });

  it('should return empty array if user is not a member', async () => {
    (prisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const matches = await getJobMatches('unknown');

    expect(matches).toEqual([]);
  });
});
