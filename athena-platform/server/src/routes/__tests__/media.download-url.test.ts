import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    jobApplication: { findFirst: jest.fn() },
  },
}));

let currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

// Signing is local, but the URL it produces depends on the bucket and the
// credentials in the environment; a fixed one keeps the assertions honest.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example/signed'),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const RESUME_KEY = 'resumes/owner-1/7f3a.pdf';

describe('POST /api/media/download-url for a résumé', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobApplication.findFirst.mockResolvedValue(null);
  });

  it('the owner gets a URL without any application being consulted', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    expect(res.body.data.fileName).toBe('7f3a.pdf');
    expect(prisma.jobApplication.findFirst).not.toHaveBeenCalled();
  });

  it('a team member of the organisation the application went to gets a URL', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };
    prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1' });

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    // Matched on the application's stored résumé URL, scoped to her organisations.
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
      where: {
        resumeUrl: { endsWith: `/${RESUME_KEY}` },
        job: { organization: { members: { some: { userId: 'recruiter-1' } } } },
      },
      select: { id: true },
    });
  });

  it('a stranger is told the file does not exist', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledTimes(1);
  });

  it('only résumés travel with applications: another private folder stays owner-only', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };

    await request(app).post('/api/media/download-url').send({ key: 'documents/owner-1/deed.pdf' }).expect(404);

    expect(prisma.jobApplication.findFirst).not.toHaveBeenCalled();
  });

  it('the byte server applies the same rule', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    await request(app).get(`/api/media/local/${RESUME_KEY}`).expect(404);
    expect(prisma.jobApplication.findFirst).toHaveBeenCalledTimes(1);
  });
});
