/**
 * What an upload is addressed as, once the bucket and a CDN are configured.
 *
 * Every kind of upload used to come back as `${CDN_URL}/key`. For an avatar or a
 * reel that is the point; for a résumé it meant that putting a CDN in front of
 * the bucket (the usual way to serve avatars) published every résumé to
 * anybody who had its address. A private kind is now addressed at the bucket,
 * and the bucket is what stays closed.
 *
 * The environment is set before the app is loaded because the CDN address is
 * read once, when the storage module is.
 */

process.env.CDN_URL = 'https://cdn.athena.example';
process.env.S3_BUCKET = 'athena-uploads-prod';
process.env.AWS_REGION = 'ap-southeast-2';
process.env.AWS_ACCESS_KEY_ID = 'AKIAABCDEFGHIJKLMNOP';
process.env.AWS_SECRET_ACCESS_KEY = 'x'.repeat(40);

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  moderateImage: jest.fn(async () => ({ action: 'allow' })),
}));

import { app } from '../../index';
import { makePhoto } from '../../utils/__tests__/media-fixtures';

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(256, 0x20), Buffer.from('\n%%EOF\n')]);

describe('uploads with the bucket and a CDN configured', () => {
  let send: jest.SpiedFunction<typeof S3Client.prototype.send>;

  beforeEach(() => {
    send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => ({}) as never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('addresses a résumé at the bucket, never at the CDN', async () => {
    const res = await request(app)
      .post('/api/media/resume')
      .attach('resume', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(200);

    const { key, url } = res.body.data;
    expect(key).toMatch(/^resumes\/u1\/.+\.pdf$/);
    expect(url).toBe(`https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/${key}`);
    expect(url).not.toContain('cdn.athena.example');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('addresses a document the same way', async () => {
    const res = await request(app)
      .post('/api/media/upload/document')
      .attach('file', PDF, { filename: 'deed.pdf', contentType: 'application/pdf' })
      .expect(200);

    expect(res.body.data.url).toMatch(/^https:\/\/athena-uploads-prod\.s3\.ap-southeast-2\.amazonaws\.com\/documents\/u1\//);
  });

  it('still addresses a public picture through the CDN, so avatars load', async () => {
    const photo = await makePhoto('jpeg');

    const res = await request(app)
      .post('/api/media/upload/cover')
      .attach('file', photo, { filename: 'cover.jpg', contentType: 'image/jpeg' })
      .expect(200);

    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.athena\.example\/covers\/u1\/.+\.webp$/);
  });
});

describe('DELETE /api/media/delete when S3 will not delete', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says so, instead of "File not found" for a file that is still stored', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      if (command instanceof DeleteObjectCommand) throw new Error('SlowDown');
      return {} as never;
    });

    const res = await request(app)
      .delete('/api/media/delete')
      .send({ key: 'covers/u1/not-on-this-disk.webp' })
      .expect(503);

    expect(res.body.message).toMatch(/could not remove that file/i);
  });

  it('still answers 404 for a file that is nowhere when there is no bucket to ask', async () => {
    const keys = { id: process.env.AWS_ACCESS_KEY_ID, secret: process.env.AWS_SECRET_ACCESS_KEY };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    try {
      await request(app).delete('/api/media/delete').send({ key: 'covers/u1/gone.webp' }).expect(404);
    } finally {
      process.env.AWS_ACCESS_KEY_ID = keys.id;
      process.env.AWS_SECRET_ACCESS_KEY = keys.secret;
    }
  });
});
