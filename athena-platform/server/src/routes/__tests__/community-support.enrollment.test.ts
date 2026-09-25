import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The member side of community support: enrolling, leaving, and finishing.
 *
 * Every case below is one that used to go the other way. A member could
 * attach another woman's credential to her own bridging enrolment; two
 * enrolments for the last place both got in; there was no way to leave a
 * programme at all; and no code path anywhere ever wrote COMPLETED, so the
 * impact dashboard's "programs finished" tile was stuck at nought for
 * everyone forever.
 */

/**
 * A stand-in for prisma.$transaction that runs the callback against the same
 * mocked client, so the route's transactional logic is exercised rather than
 * skipped. It does not simulate rollback — what these tests check is which
 * statements run and with what, not Postgres's isolation guarantees.
 */
const runTransaction = async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    communitySupportProgram: {
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    programEnrollment: {
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'enrol-1', ...data })),
      findFirst: jest.fn(),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      delete: jest.fn(async () => ({})),
    },
    programMilestone: { findFirst: jest.fn(), findMany: jest.fn(async () => []) },
    milestoneProgress: {
      upsert: jest.fn(async ({ create }: any) => ({ id: 'prog-1', ...create })),
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    bridgingProgram: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    bridgingEnrollment: { create: jest.fn(async ({ data }: any) => ({ id: 'bridge-1', ...data })) },
    internationalCredential: { findFirst: jest.fn() },
    languageProfile: { findUnique: jest.fn(async () => null) },
    indigenousCommunityPage: {
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    indigenousCommunityMember: {
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'mem-1', ...data })),
      delete: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation(runTransaction);
  prisma.communitySupportProgram.update.mockResolvedValue({});
  prisma.communitySupportProgram.updateMany.mockResolvedValue({ count: 1 });
  prisma.milestoneProgress.deleteMany.mockResolvedValue({ count: 0 });
  prisma.programEnrollment.delete.mockResolvedValue({});
  prisma.indigenousCommunityPage.update.mockResolvedValue({});
  prisma.indigenousCommunityPage.updateMany.mockResolvedValue({ count: 1 });
  prisma.indigenousCommunityMember.delete.mockResolvedValue({});
});

describe('Bridging enrolment and whose credential it names', () => {
  beforeEach(() => {
    prisma.bridgingProgram.findUnique.mockResolvedValue({ id: 'prog-9', isActive: true });
  });

  it('refuses a credential that belongs to another member', async () => {
    // The credential exists — it is simply not hers. findFirst is scoped to
    // { id, userId }, so it comes back null and the enrolment never happens.
    prisma.internationalCredential.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/community-support/bridging-programs/prog-9/enroll')
      .send({ credentialId: 'someone-elses-credential' })
      .expect(404);

    expect(res.body.error).toBe('Credential not found');
    expect(prisma.internationalCredential.findFirst.mock.calls[0][0].where).toEqual({
      id: 'someone-elses-credential',
      userId: 'member-1',
    });
    expect(prisma.bridgingEnrollment.create).not.toHaveBeenCalled();
  });

  it('attaches a credential the member does own', async () => {
    prisma.internationalCredential.findFirst.mockResolvedValue({ id: 'cred-1' });

    await request(app)
      .post('/api/community-support/bridging-programs/prog-9/enroll')
      .send({ credentialId: 'cred-1' })
      .expect(201);

    expect(prisma.bridgingEnrollment.create.mock.calls[0][0].data).toMatchObject({
      programId: 'prog-9',
      userId: 'member-1',
      credentialId: 'cred-1',
    });
  });

  it('refuses a credentialId that is not a string instead of handing it to Prisma', async () => {
    await request(app)
      .post('/api/community-support/bridging-programs/prog-9/enroll')
      .send({ credentialId: { id: 'cred-1' } })
      .expect(400);

    expect(prisma.bridgingEnrollment.create).not.toHaveBeenCalled();
  });

  it('enrols with no credential at all, which is allowed', async () => {
    await request(app).post('/api/community-support/bridging-programs/prog-9/enroll').send({}).expect(201);

    expect(prisma.internationalCredential.findFirst).not.toHaveBeenCalled();
    expect(prisma.bridgingEnrollment.create.mock.calls[0][0].data.credentialId).toBeUndefined();
  });
});

describe('Support programme capacity', () => {
  beforeEach(() => {
    prisma.communitySupportProgram.findUnique.mockImplementation(async ({ select }: any) =>
      select?.maxParticipants ? { maxParticipants: 10 } : { id: 'prog-1', isActive: true }
    );
    prisma.programEnrollment.findUnique.mockResolvedValue(null);
  });

  it('lets the database refuse the last place rather than a number we read a moment ago', async () => {
    await request(app).post('/api/community-support/programs/prog-1/enroll').send({}).expect(201);

    // The count is claimed with a conditional write, not a plain increment:
    // two simultaneous enrolments for the last place cannot both satisfy it.
    const claim = prisma.communitySupportProgram.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: 'prog-1', currentParticipants: { lt: 10 } });
    expect(claim.data).toEqual({ currentParticipants: { increment: 1 } });
  });

  it('refuses the enrolment when the conditional claim matches nothing', async () => {
    prisma.communitySupportProgram.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post('/api/community-support/programs/prog-1/enroll').send({}).expect(400);

    expect(res.body.error).toBe('Program is at capacity');
    expect(prisma.programEnrollment.create).not.toHaveBeenCalled();
  });

  it('takes a plain increment when the programme has no ceiling', async () => {
    prisma.communitySupportProgram.findUnique.mockImplementation(async ({ select }: any) =>
      select?.maxParticipants ? { maxParticipants: null } : { id: 'prog-1', isActive: true }
    );

    await request(app).post('/api/community-support/programs/prog-1/enroll').send({}).expect(201);

    expect(prisma.communitySupportProgram.updateMany).not.toHaveBeenCalled();
    expect(prisma.communitySupportProgram.update).toHaveBeenCalled();
  });
});

describe('Leaving a support programme', () => {
  it('deletes the enrolment, its milestone progress, and gives the place back', async () => {
    prisma.programEnrollment.findUnique.mockResolvedValue({ id: 'enrol-1', status: 'ACTIVE' });

    await request(app).delete('/api/community-support/programs/prog-1/enroll').expect(200);

    // Milestone progress has no cascade on the relation, so it goes first or
    // the delete fails on the foreign key.
    expect(prisma.milestoneProgress.deleteMany).toHaveBeenCalledWith({ where: { enrollmentId: 'enrol-1' } });
    expect(prisma.programEnrollment.delete).toHaveBeenCalledWith({ where: { id: 'enrol-1' } });
    expect(prisma.communitySupportProgram.updateMany).toHaveBeenCalledWith({
      where: { id: 'prog-1', currentParticipants: { gt: 0 } },
      data: { currentParticipants: { decrement: 1 } },
    });
  });

  it('gives the place back for a finished enrolment too, because the row is going', async () => {
    prisma.programEnrollment.findUnique.mockResolvedValue({ id: 'enrol-2', status: 'COMPLETED' });

    await request(app).delete('/api/community-support/programs/prog-1/enroll').expect(200);

    expect(prisma.communitySupportProgram.updateMany).toHaveBeenCalled();
  });

  it('says so rather than decrementing when she was never enrolled', async () => {
    prisma.programEnrollment.findUnique.mockResolvedValue(null);

    await request(app).delete('/api/community-support/programs/prog-1/enroll').expect(404);

    expect(prisma.programEnrollment.delete).not.toHaveBeenCalled();
    expect(prisma.communitySupportProgram.updateMany).not.toHaveBeenCalled();
  });
});

describe('Finishing a support programme', () => {
  beforeEach(() => {
    prisma.programEnrollment.findFirst.mockResolvedValue({ id: 'enrol-1', programId: 'prog-1', status: 'ACTIVE' });
    prisma.programMilestone.findFirst.mockResolvedValue({ id: 'ms-1' });
  });

  it('refuses a milestone that belongs to a different programme', async () => {
    prisma.programMilestone.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ milestoneId: 'ms-from-elsewhere', isCompleted: true })
      .expect(404);

    expect(prisma.milestoneProgress.upsert).not.toHaveBeenCalled();
  });

  it('refuses a body with no milestoneId instead of failing inside Prisma', async () => {
    await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ isCompleted: true })
      .expect(400);

    expect(prisma.milestoneProgress.upsert).not.toHaveBeenCalled();
  });

  it('marks the enrolment COMPLETED once every required milestone is done', async () => {
    prisma.programMilestone.findMany.mockResolvedValue([{ id: 'ms-1' }, { id: 'ms-2' }]);
    prisma.milestoneProgress.count.mockResolvedValue(2);

    const res = await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ milestoneId: 'ms-1', isCompleted: true })
      .expect(200);

    expect(res.body.data.enrollmentStatus).toBe('COMPLETED');
    const update = prisma.programEnrollment.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'enrol-1' });
    expect(update.data.status).toBe('COMPLETED');
    expect(update.data.completedAt).toBeInstanceOf(Date);
  });

  it('leaves the enrolment ACTIVE while a required milestone is outstanding', async () => {
    prisma.programMilestone.findMany.mockResolvedValue([{ id: 'ms-1' }, { id: 'ms-2' }]);
    prisma.milestoneProgress.count.mockResolvedValue(1);

    const res = await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ milestoneId: 'ms-1', isCompleted: true })
      .expect(200);

    expect(res.body.data.enrollmentStatus).toBe('ACTIVE');
    expect(prisma.programEnrollment.update).not.toHaveBeenCalled();
  });

  it('puts a completed enrolment back to ACTIVE when a required milestone is un-ticked', async () => {
    prisma.programEnrollment.findFirst.mockResolvedValue({ id: 'enrol-1', programId: 'prog-1', status: 'COMPLETED' });
    prisma.programMilestone.findMany.mockResolvedValue([{ id: 'ms-1' }]);
    prisma.milestoneProgress.count.mockResolvedValue(0);

    const res = await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ milestoneId: 'ms-1', isCompleted: false })
      .expect(200);

    expect(res.body.data.enrollmentStatus).toBe('ACTIVE');
    expect(prisma.programEnrollment.update.mock.calls[0][0].data).toEqual({ status: 'ACTIVE', completedAt: null });
  });

  it('never claims completion for a programme with no required milestones', async () => {
    prisma.programMilestone.findMany.mockResolvedValue([]);

    const res = await request(app)
      .patch('/api/community-support/enrollments/enrol-1/milestone')
      .send({ milestoneId: 'ms-1', isCompleted: true })
      .expect(200);

    expect(res.body.data.enrollmentStatus).toBe('ACTIVE');
    expect(prisma.milestoneProgress.count).not.toHaveBeenCalled();
    expect(prisma.programEnrollment.update).not.toHaveBeenCalled();
  });

  it('does not overwrite a PAUSED or CANCELLED enrolment from a checkbox', async () => {
    for (const status of ['PAUSED', 'CANCELLED']) {
      jest.clearAllMocks();
      prisma.$transaction.mockImplementation(runTransaction);
      prisma.programEnrollment.findFirst.mockResolvedValue({ id: 'enrol-1', programId: 'prog-1', status });
      prisma.programMilestone.findFirst.mockResolvedValue({ id: 'ms-1' });
      prisma.programMilestone.findMany.mockResolvedValue([{ id: 'ms-1' }]);
      prisma.milestoneProgress.count.mockResolvedValue(1);

      const res = await request(app)
        .patch('/api/community-support/enrollments/enrol-1/milestone')
        .send({ milestoneId: 'ms-1', isCompleted: true })
        .expect(200);

      expect(res.body.data.enrollmentStatus).toBe(status);
      expect(prisma.programEnrollment.update).not.toHaveBeenCalled();
    }
  });
});

/**
 * Joining and leaving an Indigenous community page.
 *
 * membersCount only ever went up. The create and the increment were two
 * separate statements, so a failed increment left the figure below the truth
 * with nothing to correct it, and there was no leave route at all — the number
 * on a community page was everyone who had ever pressed join, and a woman who
 * no longer wanted her name on a cultural community's member list had to ask
 * someone to take it off.
 */
describe('Indigenous community membership', () => {
  beforeEach(() => {
    prisma.indigenousCommunityPage.findUnique.mockResolvedValue({ id: 'comm-1' });
  });

  it('writes the membership and the count in the same transaction', async () => {
    await request(app)
      .post('/api/community-support/indigenous/communities/comm-1/join')
      .send({})
      .expect(201);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.indigenousCommunityMember.create).toHaveBeenCalledWith({
      data: { communityId: 'comm-1', userId: 'member-1' },
    });
    expect(prisma.indigenousCommunityPage.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { membersCount: { increment: 1 } },
    });
  });

  it('refuses a community that is not there before it touches any count', async () => {
    prisma.indigenousCommunityPage.findUnique.mockResolvedValue(null);

    await request(app)
      .post('/api/community-support/indigenous/communities/nope/join')
      .send({})
      .expect(404);

    expect(prisma.indigenousCommunityMember.create).not.toHaveBeenCalled();
    expect(prisma.indigenousCommunityPage.update).not.toHaveBeenCalled();
  });

  it('lets a member leave, and gives the place back on the count', async () => {
    prisma.indigenousCommunityMember.findUnique.mockResolvedValue({ id: 'mem-1' });

    await request(app)
      .delete('/api/community-support/indigenous/communities/comm-1/join')
      .expect(200);

    expect(prisma.indigenousCommunityMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
    // Conditional on the count being above zero, so a figure that has drifted
    // for some other reason cannot be driven negative by people leaving.
    expect(prisma.indigenousCommunityPage.updateMany).toHaveBeenCalledWith({
      where: { id: 'comm-1', membersCount: { gt: 0 } },
      data: { membersCount: { decrement: 1 } },
    });
  });

  it('says so rather than decrementing when she was never a member', async () => {
    prisma.indigenousCommunityMember.findUnique.mockResolvedValue(null);

    await request(app)
      .delete('/api/community-support/indigenous/communities/comm-1/join')
      .expect(404);

    expect(prisma.indigenousCommunityMember.delete).not.toHaveBeenCalled();
    expect(prisma.indigenousCommunityPage.updateMany).not.toHaveBeenCalled();
  });
});
