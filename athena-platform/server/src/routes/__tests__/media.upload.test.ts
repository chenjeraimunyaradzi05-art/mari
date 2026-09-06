import request from 'supertest';
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: {} }));

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

import { app } from '../../index';

const pad = (head: Buffer, length = 256) => Buffer.concat([head, Buffer.alloc(Math.max(0, length - head.length))]);
const JPEG = pad(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
const EXE = pad(Buffer.from('MZ\x90\x00'));
const HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');
const TEXT = Buffer.from('Dear hiring manager, this is not a PDF.\n');

describe('An upload has to be what it says it is', () => {
  it('a JPEG sent as a PNG avatar is refused before moderation or resizing', async () => {
    const res = await request(app).post('/api/media/upload/avatar').attach('file', JPEG, { filename: 'me.png', contentType: 'image/png' }).expect(400);
    expect(res.body.message).toMatch(/not what it says it is/);
    expect(res.body.message).toMatch(/image\/jpeg, not image\/png/);
    const { moderateImage } = jest.requireMock('../../services/moderation.service') as { moderateImage: jest.Mock };
    expect(moderateImage).not.toHaveBeenCalled();
  });

  it('a program wearing an image type is refused', async () => {
    const res = await request(app).post('/api/media/upload/cover').attach('file', EXE, { filename: 'cover.jpg', contentType: 'image/jpeg' }).expect(400);
    expect(res.body.message).toMatch(/the file is a program/);
  });

  it('an HTML page cannot come in as a post image', async () => {
    const res = await request(app).post('/api/media/post-images').attach('images', HTML, { filename: 'pic.png', contentType: 'image/png' }).expect(400);
    expect(res.body.message).toMatch(/text\/html/);
  });

  it('a text file is not a PDF resume', async () => {
    const res = await request(app).post('/api/media/resume').attach('resume', TEXT, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(400);
    expect(res.body.message).toMatch(/text\/plain, not application\/pdf/);
  });

  it('the allow-list still runs first for types the platform never takes', async () => {
    const res = await request(app).post('/api/media/upload/avatar').attach('file', HTML, { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(400);
    expect(res.body.message).toMatch(/Invalid file type/);
  });
});
