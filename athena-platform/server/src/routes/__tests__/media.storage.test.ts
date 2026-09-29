/**
 * Where an upload lands, and what happens when it cannot.
 *
 * Two things this route used to get wrong. A reel of up to 500 MB was held in
 * the heap for the whole upload and again for the write to S3. And a write S3
 * refused fell back to the container's own disk in production too, handing the
 * member a URL that died at the next deploy.
 */

import fs from 'fs';
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
jest.mock('../../utils/media-storage', () => {
  const actual: any = jest.requireActual('../../utils/media-storage');
  return {
    ...actual,
    storeFile: jest.fn(async (key: string, filePath: string) => {
      // What storage was handed: a path on disk, which still exists while it
      // is being stored.
      storedFrom.push(filePath);
      if (!fs.existsSync(filePath)) throw new Error('the temporary file was gone before it was stored');
      return `https://cdn.example/${key}`;
    }),
  };
});

import { app } from '../../index';
import { storeFile as storeFileTyped } from '../../utils/media-storage';

const storeFile = storeFileTyped as unknown as jest.Mock;

// An MP4 starts with a box size and "ftyp".
const MP4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(2048)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(252)]);
const TEXT = Buffer.from('this is not a video at all, just words in a file\n');

const ORIGINAL_ENV = { ...process.env };

describe('a video upload', () => {
  beforeEach(() => {
    storedFrom.length = 0;
    storeFile.mockClear();
  });

  it('is received to a temporary file, streamed to storage from there, and the file removed', async () => {
    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', MP4, { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(200);

    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.example\/videos\/u1\/.+\.mp4$/);
    expect(res.body.data.size).toBe(MP4.length);
    expect(storedFrom).toHaveLength(1);
    // Removed once the request is done with it.
    expect(fs.existsSync(storedFrom[0])).toBe(false);
  });

  it('still has its bytes checked, read from the start of the temporary file', async () => {
    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', TEXT, { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(400);

    expect(res.body.message).toMatch(/not what it says it is/);
    expect(storeFile).not.toHaveBeenCalled();
  });

  it('answers 503 when storage fails, and still removes the temporary file', async () => {
    storeFile.mockImplementationOnce(async (_key: unknown, filePath: unknown) => {
      storedFrom.push(String(filePath));
      throw new Error('Media storage is unavailable: the write to S3 failed (AccessDenied)');
    });

    const res = await request(app)
      .post('/api/media/upload/video')
      .attach('file', MP4, { filename: 'reel.mp4', contentType: 'video/mp4' })
      .expect(503);

    expect(res.body.message).toMatch(/Media storage is unavailable/);
    expect(fs.existsSync(storedFrom[0])).toBe(false);
  });
});

describe('an S3 write that fails in production', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('is a 503, never a copy on the container disk', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.NODE_ENV = 'production';
    const send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => {
      throw new Error('AccessDenied');
    });
    const writeFile = jest.spyOn(fs.promises, 'writeFile');

    // A thumbnail is stored as sent, so the test reaches the write without a
    // real image for sharp to decode.
    const res = await request(app)
      .post('/api/media/upload/thumbnail')
      .attach('file', JPEG, { filename: 'poster.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Media storage is unavailable/);
    expect(send).toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
