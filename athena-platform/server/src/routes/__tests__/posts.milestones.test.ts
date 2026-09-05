import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { announceMilestones, REACH_MILESTONES } from '../post-insights.routes';

const prisma: any = prismaTyped;

describe('Reach milestones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks only for posts sitting exactly on a milestone', async () => {
    await announceMilestones(['p1', 'p2']);
    expect(prisma.post.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['p1', 'p2'] },
      impressionCount: { in: REACH_MILESTONES },
      isHidden: false,
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('tells the author, naming the post and the number, and links to it', async () => {
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1', authorId: 'sarah', impressionCount: 1000, content: 'Career changer notes: from teaching into product, what I wish I had known first', groupId: null },
    ]);

    await announceMilestones(['p1']);

    const data = prisma.notification.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'sarah', type: 'SYSTEM', title: 'Your post reached 1,000 people', link: '/posts/p1' });
    expect(data.message).toContain('Career changer notes');
    expect(data.message).toContain('1,000 times');
    expect(data.data).toEqual({ milestone: 1000, postId: 'p1', kind: 'reach' });
  });

  it('never lets a failed lookup surface', async () => {
    prisma.post.findMany.mockRejectedValue(new Error('db away'));
    await expect(announceMilestones(['p1'])).resolves.toBeUndefined();
  });
});
