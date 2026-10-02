/**
 * Looking at what a video shows before it is stored.
 *
 * A picture was checked for explicit content and a video was not: the branch of
 * the upload route that streams a video to storage returned before the check, so
 * the same thing a photo would have been refused for went up as a video, to a
 * reel or a chat. A few frames of it are put through the same check now.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const recordFailure = jest.fn();
jest.mock('../../utils/ops-metrics', () => ({ recordFailure: (...args: unknown[]) => recordFailure(...args) }));

const moderateImage = jest.fn(async (_frame: Buffer): Promise<{ action: string; reason?: string }> => ({ action: 'allow' }));
jest.mock('../moderation.service', () => ({ moderateImage: (frame: Buffer) => moderateImage(frame) }));

const extractFrameJpeg = jest.fn(async (_path: string, _at: number): Promise<Buffer | null> => Buffer.from('jpeg'));
const isFfmpegAvailable = jest.fn(() => true);
jest.mock('../video-pipeline.service', () => ({
  extractFrameJpeg: (path: string, at: number) => extractFrameJpeg(path, at),
  isFfmpegAvailable: () => isFfmpegAvailable(),
}));

import { VIDEO_SCREEN_SECONDS, screenVideoFrames } from '../video-screening.service';

beforeEach(() => {
  jest.clearAllMocks();
  isFfmpegAvailable.mockReturnValue(true);
  extractFrameJpeg.mockImplementation(async (_path, at) => Buffer.from(`frame-${at}`));
  moderateImage.mockResolvedValue({ action: 'allow' });
});

describe('screenVideoFrames', () => {
  it('takes a frame at each sample time and puts every one through the picture check', async () => {
    await screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' });

    expect(extractFrameJpeg.mock.calls.map((call) => call[1])).toEqual([...VIDEO_SCREEN_SECONDS]);
    expect(extractFrameJpeg.mock.calls.every((call) => call[0] === '/tmp/clip.mp4')).toBe(true);
    expect(moderateImage.mock.calls.map((call) => call[0].toString())).toEqual(VIDEO_SCREEN_SECONDS.map((at) => `frame-${at}`));
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('refuses the video with a 400 that says why when a frame is explicit, and looks no further', async () => {
    moderateImage.mockResolvedValueOnce({ action: 'allow' });
    moderateImage.mockResolvedValueOnce({ action: 'block', reason: 'Image contains explicit content' });

    await expect(screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Video rejected: Image contains explicit content',
    });

    expect(moderateImage).toHaveBeenCalledTimes(2);
  });

  it('refuses a video that is explicit from its first frame without taking the others', async () => {
    moderateImage.mockResolvedValueOnce({ action: 'block' });

    await expect(screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('explicit'),
    });

    expect(extractFrameJpeg).toHaveBeenCalledTimes(1);
  });

  it('lets a video through that is flagged for review, which is a person\'s to look at and not the upload\'s to refuse', async () => {
    moderateImage.mockResolvedValue({ action: 'review', reason: 'Image contains violent content' });

    await expect(screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' })).resolves.toBeUndefined();
  });

  it('skips a second that is past the end of a short video, and still looks at the frames it has', async () => {
    extractFrameJpeg.mockImplementation(async (_path, at) => (at <= 1 ? Buffer.from(`frame-${at}`) : null));

    await screenVideoFrames('/tmp/short.mp4', { userId: 'u1' });

    expect(moderateImage).toHaveBeenCalledTimes(1);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('counts a video it could take nothing from as unscreened, rather than saying nothing', async () => {
    extractFrameJpeg.mockResolvedValue(null);

    await expect(screenVideoFrames('/tmp/odd.mp4', { userId: 'u1' })).resolves.toBeUndefined();

    expect(moderateImage).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_video', expect.any(Error));
  });

  it('counts a host with no ffmpeg as unscreened, and takes nothing from the video', async () => {
    isFfmpegAvailable.mockReturnValue(false);

    await expect(screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' })).resolves.toBeUndefined();

    expect(extractFrameJpeg).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('moderation.unscreened_video', expect.any(Error));
  });

  it('counts a frame ffmpeg failed to take and goes on to the next, instead of failing the upload', async () => {
    extractFrameJpeg.mockRejectedValueOnce(new Error('ffmpeg timed out after 30s'));

    await screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' });

    expect(recordFailure).toHaveBeenCalledWith('moderation.video_frame_failed', expect.any(Error));
    expect(moderateImage).toHaveBeenCalledTimes(VIDEO_SCREEN_SECONDS.length - 1);
  });

  it('lets the picture check refuse the upload when it cannot be made, as it does for a photograph', async () => {
    moderateImage.mockRejectedValue(Object.assign(new Error('The image check is unavailable'), { statusCode: 503 }));

    await expect(screenVideoFrames('/tmp/clip.mp4', { userId: 'u1' })).rejects.toMatchObject({ statusCode: 503 });
  });
});
