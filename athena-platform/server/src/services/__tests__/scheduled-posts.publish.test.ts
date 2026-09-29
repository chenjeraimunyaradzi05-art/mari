/**
 * Releasing scheduled posts.
 *
 * A post that went out on schedule never counted for its author: the posting
 * streak and the content badges advance in recordPublishedPost, and only the
 * publish-now path called it. These pin that a released post is counted, that
 * a post somebody else released or deleted first is neither counted nor
 * allowed to stop the batch, and that a failure while counting does not keep
 * the rest of the batch unpublished.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../engagement.service', () => ({
  recordPublishedPost: jest.fn(async () => undefined),
}));

import { publishDuePosts } from '../scheduled-posts.service';
import { prisma as prismaTyped } from '../../utils/prisma';
import { recordPublishedPost as recordTyped } from '../engagement.service';

const prisma = prismaTyped as unknown as {
  post: { findMany: jest.Mock; updateMany: jest.Mock };
};
const recordPublishedPost = recordTyped as unknown as jest.Mock;

const NOW = new Date('2026-09-26T09:00:00.000Z');

describe('publishDuePosts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('releases each due post and counts it for its author', async () => {
    prisma.post.findMany.mockImplementation(async () => [
      { id: 'p1', authorId: 'a1' },
      { id: 'p2', authorId: 'a2' },
    ]);
    prisma.post.updateMany.mockImplementation(async () => ({ count: 1 }));

    await expect(publishDuePosts(NOW)).resolves.toBe(2);

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', isHidden: true, scheduledFor: { not: null } },
      data: { isHidden: false, scheduledFor: null, createdAt: NOW },
    });
    expect(recordPublishedPost).toHaveBeenCalledWith('a1');
    expect(recordPublishedPost).toHaveBeenCalledWith('a2');
  });

  it('skips a post that was released or deleted before its turn, without counting it', async () => {
    prisma.post.findMany.mockImplementation(async () => [
      { id: 'gone', authorId: 'a1' },
      { id: 'p2', authorId: 'a2' },
    ]);
    prisma.post.updateMany.mockImplementation(async (args: unknown) =>
      (args as { where: { id: string } }).where.id === 'gone' ? { count: 0 } : { count: 1 }
    );

    await expect(publishDuePosts(NOW)).resolves.toBe(1);

    expect(recordPublishedPost).toHaveBeenCalledTimes(1);
    expect(recordPublishedPost).toHaveBeenCalledWith('a2');
  });

  it('a failure while counting one post does not hold back the rest', async () => {
    prisma.post.findMany.mockImplementation(async () => [
      { id: 'p1', authorId: 'a1' },
      { id: 'p2', authorId: 'a2' },
    ]);
    prisma.post.updateMany.mockImplementation(async () => ({ count: 1 }));
    recordPublishedPost.mockImplementationOnce(async () => {
      throw new Error('streak table unavailable');
    });

    await expect(publishDuePosts(NOW)).resolves.toBe(2);

    expect(prisma.post.updateMany).toHaveBeenCalledTimes(2);
  });

  it('does nothing when nothing is due', async () => {
    prisma.post.findMany.mockImplementation(async () => []);

    await expect(publishDuePosts(NOW)).resolves.toBe(0);

    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(recordPublishedPost).not.toHaveBeenCalled();
  });
});
