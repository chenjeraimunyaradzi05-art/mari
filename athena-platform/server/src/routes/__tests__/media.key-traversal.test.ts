/**
 * A file key names its owner in its second segment, and the routes decide who
 * may read or delete a file by comparing that segment with the caller. The disk
 * resolves `..` afterwards, so a key that began with the caller's own id and
 * then climbed out of it was "hers" to the check and somebody else's to the
 * file system:
 *
 *   resumes/<my id>/../<her id>/<file>.pdf
 *
 * The key is a path of plain names or it is refused.
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    jobApplication: { findMany: jest.fn() },
    apprenticeshipApplication: { findMany: jest.fn() },
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'mallory', role: 'USER', email: 'mallory@example.com' };
      next();
    },
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example/signed'),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// No credentials: the file is on this host's disk, which is where a climbing
// key does its harm.
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const UPLOADS = path.resolve(process.cwd(), 'uploads');
const VICTIM_DIR = path.join(UPLOADS, 'resumes', 'alice-test-traversal');
const VICTIM_FILE = path.join(VICTIM_DIR, 'cv.pdf');
const MINE_DIR = path.join(UPLOADS, 'resumes', 'mallory');
const MINE_FILE = path.join(MINE_DIR, 'mine.pdf');

/** Keys that start with the caller's id and then climb to someone else's file. */
const CLIMBING_KEYS = [
  'resumes/mallory/../alice-test-traversal/cv.pdf',
  'resumes/mallory/./../alice-test-traversal/cv.pdf',
  'resumes/mallory/..\\alice-test-traversal\\cv.pdf',
  'resumes//mallory/../alice-test-traversal/cv.pdf',
  'resumes/mallory/../../resumes/alice-test-traversal/cv.pdf',
];

describe('a file key that climbs out of the caller’s own folder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([]);
    fs.mkdirSync(VICTIM_DIR, { recursive: true });
    fs.mkdirSync(MINE_DIR, { recursive: true });
    fs.writeFileSync(VICTIM_FILE, "alice’s résumé");
    fs.writeFileSync(MINE_FILE, 'my own résumé');
  });

  afterEach(() => {
    fs.rmSync(VICTIM_DIR, { recursive: true, force: true });
    fs.rmSync(MINE_DIR, { recursive: true, force: true });
    try {
      // Only if nothing else is in it: the folder may not have existed before the test.
      fs.rmdirSync(path.join(UPLOADS, 'resumes'));
    } catch {
      /* not empty, or already gone */
    }
  });

  it('is not given a link to somebody else’s file', async () => {
    for (const key of CLIMBING_KEYS) {
      const res = await request(app).post('/api/media/download-url').send({ key });
      expect(res.status).toBe(400);
      expect(res.body.data?.downloadUrl).toBeUndefined();
    }
  });

  it('cannot read somebody else’s file from the byte server', async () => {
    // The slash is encoded, so no client tidies the dots away and the route
    // receives the climb as a parameter.
    for (const key of ['resumes/mallory/..%2Falice-test-traversal/cv.pdf', 'resumes/mallory/..%5Calice-test-traversal/cv.pdf']) {
      const res = await request(app).get(`/api/media/local/${key}`);
      expect(res.status).toBe(400);
      expect(res.text).not.toContain('alice’s');
    }

    // A client that does tidy `%2e%2e` away asks for her key outright, which is
    // not Mallory's to read.
    const tidied = await request(app).get('/api/media/local/resumes/mallory/%2e%2e/alice-test-traversal/cv.pdf');
    expect(tidied.status).toBe(404);
    expect(tidied.text).not.toContain('alice’s');
  });

  it('cannot delete somebody else’s file', async () => {
    for (const key of CLIMBING_KEYS) {
      const res = await request(app).delete('/api/media/delete').send({ key });
      expect(res.status).toBe(400);
    }
    expect(fs.existsSync(VICTIM_FILE)).toBe(true);
    expect(fs.readFileSync(VICTIM_FILE, 'utf8')).toBe("alice’s résumé");
  });

  it('still lets her read and delete her own file by its plain key', async () => {
    const link = await request(app).post('/api/media/download-url').send({ key: 'resumes/mallory/mine.pdf' }).expect(200);
    expect(link.body.data.fileName).toBe('mine.pdf');

    await request(app).get('/api/media/local/resumes/mallory/mine.pdf').expect(200);

    await request(app).delete('/api/media/delete').send({ key: 'resumes/mallory/mine.pdf' }).expect(200);
    expect(fs.existsSync(MINE_FILE)).toBe(false);
    expect(fs.existsSync(VICTIM_FILE)).toBe(true);
  });
});
