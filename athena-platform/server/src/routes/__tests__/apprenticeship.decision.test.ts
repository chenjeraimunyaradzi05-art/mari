import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    apprenticeship: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) },
    apprenticeshipApplication: { findUnique: jest.fn(), update: jest.fn() },
    // Staff reach an application through membership of the RTO or the host
    // employer named on the apprenticeship, never through their role alone.
    organizationMember: { findFirst: jest.fn(async () => null) },
    // The host check: an organisation places apprentices only while it is
    // verified and holds an approved, unexpired host safety attestation.
    organization: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'coordinator',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const notify = jest.fn();
jest.mock('../../services/notification.service', () => ({
  ...(jest.requireActual('../../services/notification.service') as object),
  notificationService: { notify: (...a: unknown[]) => notify(...a) },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const COORDINATOR = 'coordinator';
const STRANGER = 'stranger';
const APPLICANT = 'applicant-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function mockApplication(status = 'SUBMITTED') {
  prisma.apprenticeshipApplication.findUnique.mockResolvedValue({
    id: 'app-1',
    apprenticeshipId: 'ap-1',
    userId: APPLICANT,
    status,
  });
}

function mockApprenticeship(overrides: Record<string, unknown> = {}) {
  prisma.apprenticeship.findUnique.mockResolvedValue({
    id: 'ap-1',
    title: 'Certificate III in Electrotechnology',
    rtoId: 'rto-1',
    hostEmployerId: null,
    positions: 2,
    positionsFilled: 0,
    ...overrides,
  });
}

/**
 * How the host named on the listing stands. `checked` is verified with an
 * approved attestation; the others are each one half missing.
 */
function hostIs(standing: 'checked' | 'unverified' | 'unattested') {
  prisma.organization.findMany.mockImplementation(async ({ where }: any) =>
    (where.id.in as string[]).map((id) => ({
      id,
      isVerified: standing !== 'unverified',
      hostSafetyAttestations: standing === 'unattested' ? [] : [{ id: 'att-1' }],
    }))
  );
}

/** The membership lookup findApprenticeshipForStaff makes for a non-admin. */
function staffOf(...userIds: string[]) {
  prisma.organizationMember.findFirst.mockImplementation(async ({ where }: any) =>
    userIds.includes(where.userId) ? { id: 'member-1' } : null
  );
}

describe('Deciding an apprenticeship application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notify.mockImplementation(async () => undefined);
    prisma.apprenticeship.updateMany.mockResolvedValue({ count: 1 });
    prisma.apprenticeshipApplication.update.mockImplementation(async ({ data }: any) => ({
      id: 'app-1',
      apprenticeshipId: 'ap-1',
      userId: APPLICANT,
      ...data,
    }));
    mockApplication();
    mockApprenticeship();
    staffOf(COORDINATOR);
    hostIs('checked');
  });

  it('lets the provider move an application along, and tells the applicant', async () => {
    const res = await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'INTERVIEW' })
      .expect(200);

    expect(res.body.data.status).toBe('INTERVIEW');
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APPLICANT, type: 'APPLICATION_UPDATE' })
    );
  });

  it('claims a seat on the placement when it accepts', async () => {
    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'ACCEPTED' })
      .expect(200);

    // Conditional, so a second coordinator racing this one cannot overfill it.
    expect(prisma.apprenticeship.updateMany).toHaveBeenCalledWith({
      where: { id: 'ap-1', positionsFilled: { lt: 2 } },
      data: { positionsFilled: { increment: 1 } },
    });
  });

  it('refuses to accept past the number of positions', async () => {
    prisma.apprenticeship.updateMany.mockResolvedValue({ count: 0 });

    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'ACCEPTED' })
      .expect(409);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  // An offer and a confirmed placement are the two promises that put an
  // apprentice in a workplace. They are refused for a host ATHENA has not
  // checked, and nothing is claimed or written when they are.
  describe.each([
    ['is not verified', 'unverified'],
    ['has no approved safety attestation', 'unattested'],
  ] as const)('when the host %s', (_what, standing) => {
    beforeEach(() => hostIs(standing));

    it.each(['OFFERED', 'ACCEPTED'])('refuses %s, claims no seat, and tells staff what to do', async (status) => {
      const res = await request(app).patch('/api/apprenticeships/applications/app-1').set(as(COORDINATOR)).send({ status }).expect(409);

      expect(res.body.message).toContain('verified and its host safety attestation approved');
      expect(prisma.apprenticeship.updateMany).not.toHaveBeenCalled();
      expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it.each(['SCREENING', 'INTERVIEW', 'REJECTED'])('still lets the provider record %s, which promises nothing', async (status) => {
      await request(app).patch('/api/apprenticeships/applications/app-1').set(as(COORDINATOR)).send({ status }).expect(200);
      expect(prisma.apprenticeshipApplication.update).toHaveBeenCalled();
    });
  });

  it('asks about the host named on the listing, not the training provider, when both are named', async () => {
    mockApprenticeship({ rtoId: 'rto-1', hostEmployerId: 'host-1' });
    prisma.organization.findMany.mockImplementation(async ({ where }: any) =>
      (where.id.in as string[]).map((id) => ({ id, isVerified: id === 'rto-1', hostSafetyAttestations: id === 'rto-1' ? [{ id: 'att-1' }] : [] }))
    );

    // The RTO is checked and the host is not: the apprentice would be working at the host.
    await request(app).patch('/api/apprenticeships/applications/app-1').set(as(COORDINATOR)).send({ status: 'ACCEPTED' }).expect(409);
    expect(prisma.organization.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['host-1'] } });
  });

  it('gives the seat back when a confirmed placement is later rejected', async () => {
    mockApplication('ACCEPTED');

    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'REJECTED' })
      .expect(200);

    expect(prisma.apprenticeship.update).toHaveBeenCalledWith({
      where: { id: 'ap-1' },
      data: { positionsFilled: { decrement: 1 } },
    });
  });

  it('reports someone else’s application as absent rather than forbidden', async () => {
    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(STRANGER))
      .send({ status: 'REJECTED' })
      .expect(404);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  it('will not let a provider record a withdrawal as its own decision', async () => {
    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'WITHDRAWN' })
      .expect(400);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  it('leaves a withdrawn application where the candidate left it', async () => {
    mockApplication('WITHDRAWN');

    await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'OFFERED' })
      .expect(400);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  it('is quiet about a status that is already set', async () => {
    mockApplication('OFFERED');

    const res = await request(app)
      .patch('/api/apprenticeships/applications/app-1')
      .set(as(COORDINATOR))
      .send({ status: 'OFFERED' })
      .expect(200);

    expect(res.body.message).toBe('No change');
    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('The retired free-booking router', () => {
  it('no longer answers POST /api/mentoring/book', async () => {
    // It created a MentorSession with no hourly rate, no Stripe hold and no
    // connected account, so any signed-in caller could take a paid mentor's
    // hour for nothing. The mount is gone; this keeps it gone.
    await request(app)
      .post('/api/mentoring/book')
      .set(as(STRANGER))
      .send({ mentorProfileId: 'm1', scheduledAt: new Date().toISOString() })
      .expect(404);
  });
});
