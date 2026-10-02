/**
 * Where an upload lands, and what happens when it cannot.
 *
 * Two things this route used to get wrong. A reel of up to 500 MB was held in
 * the heap for the whole upload and again for the write to S3. And a write S3
 * refused fell back to the container's own disk in production too, handing the
 * member a URL that died at the next deploy.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { S3Client } from '@aws-sdk/client-s3';

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

jest.mock('../../services/moderation.service', () => ({
  moderateImage: jest.fn(async () => ({ action: 'allow' })),
}));

const storedFrom: string[] = [];
const storedSizes: number[] = [];
jest.mock('../../utils/media-storage', () => {
  const actual: any = jest.requireActual('../../utils/media-storage');
  return {
    ...actual,
    storeFile: jest.fn(async (key: string, filePath: string) => {
      // What storage was handed: a path on disk, which still exists while it
      // is being stored.
      storedFrom.push(filePath);
      if (!fs.existsSync(filePath)) throw new Error('the temporary file was gone before it was stored');
      storedSizes.push(fs.statSync(filePath).size);
      return `https://cdn.example/${key}`;
    }),
  };
});

import { app } from '../../index';
import { storeFile as storeFileTyped } from '../../utils/media-storage';
import { FFMPEG, makeClip, makePhoto } from '../../utils/__tests__/media-fixtures';

const storeFile = storeFileTyped as unknown as jest.Mock;

// Uploads are looked at by ffmpeg and sharp now, so these have to be real files.
const withFfmpeg = FFMPEG ? it : it.skip;
const TEXT = Buffer.from('this is not a video at all, just words in a file\n');

const ORIGINAL_ENV = { ...process.env };

describe('a video upload', () => {
  // Every temporary file the route makes goes into a folder of this test's
  // own, so "nothing is left behind" is something it can check.
  let scratch: string;
  let tmpdirSpy: jest.SpiedFunction<typeof os.tmpdir>;
  beforeEach(() => {
    storedFrom.length = 0;
    storedSizes.length = 0;
    storeFile.mockClear();
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-storage-test-'));
    tmpdirSpy = jest.spyOn(os, 'tmpdir').mockReturnValue(scratch);
  });
  afterEach(() => {
    tmpdirSpy.mockRestore();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  withFfmpeg('is received to a temporary file, streamed to storage from there, and both files removed', async () => {
    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', makeClip('mp4'), { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(200);

    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.example\/videos\/u1\/.+\.mp4$/);
    expect(storedFrom).toHaveLength(1);
    // What is stored is the copy without its tags, and the size says so.
    expect(res.body.data.size).toBe(storedSizes[0]);
    // The file received and the clean copy are both removed once the request is done.
    expect(fs.existsSync(storedFrom[0])).toBe(false);
    expect(fs.readdirSync(scratch)).toEqual([]);
  });

  it('still has its bytes checked, read from the start of the temporary file', async () => {
    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', TEXT, { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(400);

    expect(res.body.message).toMatch(/not what it says it is/);
    expect(storeFile).not.toHaveBeenCalled();
  });

  withFfmpeg('answers 503 when storage fails, and still removes the temporary files', async () => {
    storeFile.mockImplementationOnce(async (_key: unknown, filePath: unknown) => {
      storedFrom.push(String(filePath));
      throw new Error('Media storage is unavailable: the write to S3 failed (AccessDenied)');
    });

    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', makeClip('mp4'), { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(503);

    expect(res.body.message).toMatch(/Media storage is unavailable/);
    expect(fs.existsSync(storedFrom[0])).toBe(false);
    expect(fs.readdirSync(scratch)).toEqual([]);
  });
});

describe('an S3 write that fails in production', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('is a 503, never a copy on the container disk', async () => {
    const JPEG = await makePhoto('jpeg');
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.NODE_ENV = 'production';
    const send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => {
      throw new Error('AccessDenied');
    });
    const writeFile = jest.spyOn(fs.promises, 'writeFile');

    const res = await request(app)
      .post('/api/media/upload/thumbnail')
      .attach('file', JPEG, { filename: 'poster.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Media storage is unavailable/);
    expect(send).toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
