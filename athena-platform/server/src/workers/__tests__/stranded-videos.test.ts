/**
 * A restart used to strand every reel the pipeline had not reached: they
 * stayed PROCESSING and nothing ever looked for them again. The sweep hands
 * them back at boot. What matters is which reels it picks: only ones older
 * than this process, never one a queued job will already process, and, when
 * the queue cannot be read, all of them rather than none.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findMany = jest.fn<(args: unknown) => Promise<Array<{ id: string; authorId: string }>>>();
jest.mock('../../utils/prisma', () => ({ prisma: { video: { findMany: (args: unknown) => findMany(args) } } }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const videoIdsWithLiveJobs = jest.fn<() => Promise<Set<string>>>();
jest.mock('../../utils/video-queue', () => ({ videoIdsWithLiveJobs: () => videoIdsWithLiveJobs() }));

const enqueueVideoProcessing = jest.fn<(videoId: string, authorId: string) => void>();
jest.mock('../../services/video-pipeline.service', () => ({
  enqueueVideoProcessing: (videoId: string, authorId: string) => enqueueVideoProcessing(videoId, authorId),
}));

import { resumeStrandedVideos, STRANDED_VIDEO_BATCH } from '../stranded-videos';
import { logger } from '../../utils/logger';

const bootedAt = new Date('2026-09-26T10:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  videoIdsWithLiveJobs.mockResolvedValue(new Set());
});

describe('resumeStrandedVideos', () => {
  it('asks only for reels still processing that were uploaded before this process started, oldest first', async () => {
    findMany.mockResolvedValue([]);

    await resumeStrandedVideos(bootedAt);

    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PROCESSING', createdAt: { lt: bootedAt } },
      select: { id: true, authorId: true },
      orderBy: { createdAt: 'asc' },
      take: STRANDED_VIDEO_BATCH,
    });
  });

  it('hands every stranded reel back to the pipeline under its own author', async () => {
    findMany.mockResolvedValue([
      { id: 'video-1', authorId: 'author-1' },
      { id: 'video-2', authorId: 'author-2' },
    ]);

    const sweep = await resumeStrandedVideos(bootedAt);

    expect(enqueueVideoProcessing).toHaveBeenNthCalledWith(1, 'video-1', 'author-1');
    expect(enqueueVideoProcessing).toHaveBeenNthCalledWith(2, 'video-2', 'author-2');
    expect(sweep).toEqual({ stranded: 2, resumed: 2, alreadyQueued: 0 });
  });

  it('leaves a reel alone when a queued job is already going to process it', async () => {
    findMany.mockResolvedValue([
      { id: 'video-1', authorId: 'author-1' },
      { id: 'video-2', authorId: 'author-2' },
    ]);
    videoIdsWithLiveJobs.mockResolvedValue(new Set(['video-1']));

    const sweep = await resumeStrandedVideos(bootedAt);

    expect(enqueueVideoProcessing).toHaveBeenCalledTimes(1);
    expect(enqueueVideoProcessing).toHaveBeenCalledWith('video-2', 'author-2');
    expect(sweep).toEqual({ stranded: 2, resumed: 1, alreadyQueued: 1 });
  });

  it('resumes all of them when the queue cannot be read, because a reel never published is the worse outcome', async () => {
    findMany.mockResolvedValue([{ id: 'video-1', authorId: 'author-1' }]);
    videoIdsWithLiveJobs.mockRejectedValue(new Error('Connection is closed.'));

    const sweep = await resumeStrandedVideos(bootedAt);

    expect(enqueueVideoProcessing).toHaveBeenCalledWith('video-1', 'author-1');
    expect(sweep.resumed).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not read the video queue; resuming every stranded reel',
      { error: 'Connection is closed.' }
    );
  });

  it('does not read the queue at all when nothing is stranded', async () => {
    findMany.mockResolvedValue([]);

    await expect(resumeStrandedVideos(bootedAt)).resolves.toEqual({ stranded: 0, resumed: 0, alreadyQueued: 0 });
    expect(videoIdsWithLiveJobs).not.toHaveBeenCalled();
    expect(enqueueVideoProcessing).not.toHaveBeenCalled();
  });
});
