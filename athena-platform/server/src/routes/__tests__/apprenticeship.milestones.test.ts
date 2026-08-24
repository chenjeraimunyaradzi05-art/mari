import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    apprenticeship: { findUnique: jest.fn() },
    apprenticeshipApplication: { findUnique: jest.fn() },
    apprenticeshipMilestone: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    apprenticeshipMilestoneSubmission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'apprentice-1',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const APPRENTICE = 'apprentice-1';
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function mockPlacement(status = 'ACCEPTED') {
  (prisma.apprenticeshipApplication.findUnique as any).mockResolvedValue({
    id: 'app-1',
    apprenticeshipId: 'ap1',
    userId: APPRENTICE,
    status,
  });
}

const MILESTONES = [
  { id: 'm1', apprenticeshipId: 'ap1', title: 'Site safety', orderIndex: 0, competencyCode: 'CPCCWHS1001' },
  { id: 'm2', apprenticeshipId: 'ap1', title: 'Hand tools', orderIndex: 1, competencyCode: null },
];

describe('Progress is gated on an accepted placement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.apprenticeshipMilestone.findMany as any).mockResolvedValue(MILESTONES);
    (prisma.apprenticeshipMilestoneSubmission.findMany as any).mockResolvedValue([]);
  });

  it('404s for someone who never applied', async () => {
    (prisma.apprenticeshipApplication.findUnique as any).mockResolvedValue(null);

    await request(app).get('/api/apprenticeships/ap1/progress').set(as(APPRENTICE)).expect(404);
  });

  it('403s while the application is still being screened', async () => {
    mockPlacement('SCREENING');

    await request(app).get('/api/apprenticeships/ap1/progress').set(as(APPRENTICE)).expect(403);
  });

  it('reports NOT_STARTED for milestones with no evidence yet', async () => {
    mockPlacement();

    const res = await request(app)
      .get('/api/apprenticeships/ap1/progress')
      .set(as(APPRENTICE))
      .expect(200);

    expect(res.body.data.milestones.map((m: any) => m.status)).toEqual([
      'NOT_STARTED',
      'NOT_STARTED',
    ]);
    expect(res.body.data.summary).toMatchObject({
      total: 2,
      approved: 0,
      notStarted: 2,
      percentComplete: 0,
      isComplete: false,
    });
  });

  it('counts approvals into a percentage', async () => {
    mockPlacement();
    (prisma.apprenticeshipMilestoneSubmission.findMany as any).mockResolvedValue([
      { milestoneId: 'm1', status: 'APPROVED', attachments: [], submittedAt: new Date() },
      { milestoneId: 'm2', status: 'SUBMITTED', attachments: [], submittedAt: new Date() },
    ]);

    const res = await request(app)
      .get('/api/apprenticeships/ap1/progress')
      .set(as(APPRENTICE))
      .expect(200);

    expect(res.body.data.summary).toMatchObject({
      approved: 1,
      awaitingReview: 1,
      percentComplete: 50,
      isComplete: false,
    });
  });

  it('a programme with no milestones defined is 0%, not 100%', async () => {
    mockPlacement();
    (prisma.apprenticeshipMilestone.findMany as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/apprenticeships/ap1/progress')
      .set(as(APPRENTICE))
      .expect(200);

    expect(res.body.data.summary.percentComplete).toBe(0);
    expect(res.body.data.summary.isComplete).toBe(false);
  });
});

describe('Submitting milestone evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacement();
    (prisma.apprenticeshipMilestone.findUnique as any).mockResolvedValue(MILESTONES[0]);
    (prisma.apprenticeshipMilestoneSubmission.findUnique as any).mockResolvedValue(null);
    (prisma.apprenticeshipMilestoneSubmission.upsert as any).mockResolvedValue({ id: 's1' });
  });

  it('records evidence against the application, not the user', async () => {
    await request(app)
      .post('/api/apprenticeships/ap1/milestones/m1/submit')
      .set(as(APPRENTICE))
      .send({ notes: 'White card attached', attachments: ['card.pdf'] })
      .expect(201);

    const call = (prisma.apprenticeshipMilestoneSubmission.upsert as any).mock.calls[0][0];
    expect(call.where).toEqual({
      milestoneId_applicationId: { milestoneId: 'm1', applicationId: 'app-1' },
    });
    expect(call.create).toMatchObject({ milestoneId: 'm1', applicationId: 'app-1' });
  });

  it('resubmitting clears the previous review so stale rejections do not stick', async () => {
    (prisma.apprenticeshipMilestoneSubmission.findUnique as any).mockResolvedValue({
      id: 's1',
      status: 'REJECTED',
    });

    await request(app)
      .post('/api/apprenticeships/ap1/milestones/m1/submit')
      .set(as(APPRENTICE))
      .send({ notes: 'Corrected' })
      .expect(201);

    const update = (prisma.apprenticeshipMilestoneSubmission.upsert as any).mock.calls[0][0].update;
    expect(update.status).toBe('SUBMITTED');
    expect(update.reviewerId).toBeNull();
    expect(update.reviewNotes).toBeNull();
    expect(update.reviewedAt).toBeNull();
  });

  it('an approved milestone cannot be reopened by the apprentice', async () => {
    (prisma.apprenticeshipMilestoneSubmission.findUnique as any).mockResolvedValue({
      id: 's1',
      status: 'APPROVED',
    });

    await request(app)
      .post('/api/apprenticeships/ap1/milestones/m1/submit')
      .set(as(APPRENTICE))
      .send({ notes: 'again' })
      .expect(400);

    expect(prisma.apprenticeshipMilestoneSubmission.upsert).not.toHaveBeenCalled();
  });

  it('a milestone belonging to a different apprenticeship is rejected', async () => {
    (prisma.apprenticeshipMilestone.findUnique as any).mockResolvedValue({
      id: 'm9',
      apprenticeshipId: 'other',
    });

    await request(app)
      .post('/api/apprenticeships/ap1/milestones/m9/submit')
      .set(as(APPRENTICE))
      .send({})
      .expect(404);
  });

  it('an assessor signs a submission off and is recorded as the reviewer', async () => {
    (prisma.apprenticeshipMilestoneSubmission.findUnique as any).mockResolvedValue({ id: 's1' });
    (prisma.apprenticeshipMilestoneSubmission.update as any).mockResolvedValue({ id: 's1' });

    await request(app)
      .patch('/api/apprenticeships/milestones/submissions/s1')
      .set(as('assessor-1', 'EDUCATION_PROVIDER'))
      .send({ status: 'APPROVED', reviewNotes: 'Evidence sighted' })
      .expect(200);

    const data = (prisma.apprenticeshipMilestoneSubmission.update as any).mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'APPROVED',
      reviewerId: 'assessor-1',
      reviewNotes: 'Evidence sighted',
    });
    expect(data.reviewedAt).toBeInstanceOf(Date);
  });

  it('a review must be an approval or a rejection', async () => {
    await request(app)
      .patch('/api/apprenticeships/milestones/submissions/s1')
      .set(as('assessor-1', 'EDUCATION_PROVIDER'))
      .send({ status: 'MAYBE' })
      .expect(400);
  });
});

describe('Certificate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacement();
    (prisma.apprenticeship.findUnique as any).mockResolvedValue({
      id: 'ap1',
      title: 'Electrical apprenticeship',
      framework: 'Electrotechnology',
      level: 'CERTIFICATE_III',
      durationMonths: 48,
      rto: { id: 'o1', name: 'TAFE' },
      hostEmployer: { id: 'o2', name: 'Sparks Pty Ltd' },
    });
    (prisma.apprenticeshipMilestone.findMany as any).mockResolvedValue(MILESTONES);
    (prisma.user.findUnique as any).mockResolvedValue({ id: APPRENTICE, displayName: 'Ada' });
  });

  it('409s while milestones are outstanding', async () => {
    (prisma.apprenticeshipMilestoneSubmission.findMany as any).mockResolvedValue([
      { milestoneId: 'm1', status: 'APPROVED', reviewedAt: new Date() },
    ]);

    const res = await request(app)
      .get('/api/apprenticeships/ap1/certificate')
      .set(as(APPRENTICE))
      .expect(409);

    expect(res.body.message).toMatch(/1 milestone/);
  });

  it('409s when the apprenticeship has no milestones defined', async () => {
    (prisma.apprenticeshipMilestone.findMany as any).mockResolvedValue([]);
    (prisma.apprenticeshipMilestoneSubmission.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/apprenticeships/ap1/certificate').set(as(APPRENTICE)).expect(409);
  });

  it('issues once every milestone is approved, dated by the last sign-off', async () => {
    const early = new Date('2026-03-01T00:00:00Z');
    const last = new Date('2026-06-01T00:00:00Z');
    (prisma.apprenticeshipMilestoneSubmission.findMany as any).mockResolvedValue([
      { milestoneId: 'm1', status: 'APPROVED', reviewedAt: early },
      { milestoneId: 'm2', status: 'APPROVED', reviewedAt: last },
    ]);

    const res = await request(app)
      .get('/api/apprenticeships/ap1/certificate')
      .set(as(APPRENTICE))
      .expect(200);

    expect(new Date(res.body.data.issuedAt).toISOString()).toBe(last.toISOString());
    expect(res.body.data.holder.displayName).toBe('Ada');
    expect(res.body.data.competencies).toEqual([
      { title: 'Site safety', competencyCode: 'CPCCWHS1001' },
      { title: 'Hand tools', competencyCode: null },
    ]);
    // Must not be mistakable for a nationally recognised qualification.
    expect(res.body.data.statement).toMatch(/not a nationally recognised/i);
  });

  it('is unavailable to someone whose placement was never accepted', async () => {
    mockPlacement('REJECTED');

    await request(app).get('/api/apprenticeships/ap1/certificate').set(as(APPRENTICE)).expect(403);
  });
});
