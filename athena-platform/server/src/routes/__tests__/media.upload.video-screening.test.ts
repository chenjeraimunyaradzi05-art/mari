/**
 * What an uploaded video shows, and the upload route.
 *
 * A photograph is put through the moderation provider and refused if it is
 * explicit. A video was streamed to storage by a branch of the route that
 * returned before that check, so the same thing went up as a video, to a reel or
 * a chat. These send a real clip through the real route and look at whether it
 * reaches storage: a check on a stand-in could not fail.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: { user: { update: jest.fn() } } }));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'u1', role: 'USER', email: 'u1@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const moderateImage = jest.fn(async (_frame: Buffer): Promise<{ action: string; reason?: string }> => ({ action: 'allow' }));
jest.mock('../../services/moderation.service', () => ({ moderateImage: (frame: Buffer) => moderateImage(frame) }));

jest.mock('../../utils/media-storage', () => {
  const actual: any = jest.requireActual('../../utils/media-storage');
  return { ...actual, storeFile: jest.fn(async (key: string) => `https://cdn.example/${key}`) };
});

import { app } from '../../index';
import { storeFile as storeFileTyped } from '../../utils/media-storage';
import { FFMPEG, makeClip } from '../../utils/__tests__/media-fixtures';

const storeFile = storeFileTyped as unknown as jest.Mock;
const withFfmpeg = FFMPEG ? it : it.skip;

describe('a video sent to a reel or a chat', () => {
  let scratch: string;
  let tmpdirSpy: jest.SpiedFunction<typeof os.tmpdir>;

  beforeEach(() => {
    jest.clearAllMocks();
    moderateImage.mockResolvedValue({ action: 'allow' });
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-screen-test-'));
    tmpdirSpy = jest.spyOn(os, 'tmpdir').mockReturnValue(scratch);
  });

  afterEach(() => {
    tmpdirSpy.mockRestore();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  withFfmpeg('has a frame of it looked at before it is stored, as a JPEG', async () => {
    await request(app)
      .post('/api/media/upload/video')
      .attach('file', makeClip('mp4'), { filename: 'clip.mp4', contentType: 'video/mp4' })
      .expect(200);

    expect(moderateImage).toHaveBeenCalled();
    const frame = moderateImage.mock.calls[0][0];
    // A JPEG starts with FF D8 FF: it is a picture the provider can read, not the video.
    expect([...frame.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(storeFile).toHaveBeenCalledTimes(1);
  });

  withFfmpeg('is refused, with the reason, and never stored, when a frame is explicit', async () => {
    moderateImage.mockResolvedValue({ action: 'block', reason: 'Image contains explicit content' });

    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', makeClip('mp4'), { filename: 'clip.mp4', contentType: 'video/mp4' })
      .expect(400);

    expect(res.body.message).toBe('Video rejected: Image contains explicit content');
    expect(storeFile).not.toHaveBeenCalled();
    // The frames and the received file are not left behind.
    expect(fs.readdirSync(scratch)).toEqual([]);
  });

  withFfmpeg('is refused when the picture check cannot be made, as a photograph would be', async () => {
    moderateImage.mockRejectedValue(Object.assign(new Error('The image check is unavailable'), { statusCode: 503, isOperational: true }));

    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', makeClip('mp4'), { filename: 'clip.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(503);
    expect(storeFile).not.toHaveBeenCalled();
  });
});
