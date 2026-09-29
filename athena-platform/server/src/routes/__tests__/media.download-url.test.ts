import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    jobApplication: { findMany: jest.fn() },
    apprenticeshipApplication: { findMany: jest.fn() },
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn() },
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
const ACCEPTED = new Date('2026-01-01T00:00:00.000Z');

describe('POST /api/media/download-url for a résumé', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([]);
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('the owner gets a URL without any application being consulted', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    expect(res.body.data.fileName).toBe('7f3a.pdf');
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('a recruiter on the hiring team of the organisation the application went to gets a URL', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'RECRUITER', canPostJobs: false, acceptedAt: ACCEPTED });

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    // Only her own applications carrying this very file are consulted.
    expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner-1', resumeUrl: { endsWith: `/${RESUME_KEY}` } },
      })
    );
    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId_userId: { organizationId: 'org-1', userId: 'recruiter-1' } } })
    );
  });

  it('a VIEWER of that organisation is told the file does not exist', async () => {
    currentUser = { id: 'viewer-1', role: 'USER', email: 'v@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'VIEWER', canPostJobs: false, acceptedAt: ACCEPTED });

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
  });

  it('an invitation she never accepted grants nothing', async () => {
    currentUser = { id: 'invitee-1', role: 'USER', email: 'i@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'RECRUITER', canPostJobs: false, acceptedAt: null });

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);
  });

  it('the poster of a job with no organisation may read what was sent to it', async () => {
    currentUser = { id: 'poster-1', role: 'USER', email: 'p@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: null, postedById: 'poster-1' } }]);

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);
  });

  it('hiring staff of the RTO or host employer may read one sent with an apprenticeship application', async () => {
    currentUser = { id: 'rto-staff-1', role: 'USER', email: 'rto@example.com' };
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([
      { apprenticeship: { rtoId: 'rto-1', hostEmployerId: null } },
    ]);
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'membership-1' });

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    const where = prisma.organizationMember.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'rto-staff-1', organizationId: { in: ['rto-1'] }, acceptedAt: { not: null } });
  });

  it('a stranger is told the file does not exist', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(prisma.jobApplication.findMany).toHaveBeenCalledTimes(1);
  });

  it('only résumés travel with applications: another private folder stays owner-only', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };

    await request(app).post('/api/media/download-url').send({ key: 'documents/owner-1/deed.pdf' }).expect(404);

    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('the byte server applies the same rule', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    await request(app).get(`/api/media/local/${RESUME_KEY}`).expect(404);
    expect(prisma.jobApplication.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/media/presigned-url', () => {
  it('is gone: every upload goes through the server, where its size and bytes are checked', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    await request(app)
      .post('/api/media/presigned-url')
      .send({ fileType: 'video', fileName: 'clip.mp4', contentType: 'video/mp4' })
      .expect(404);
  });
});
