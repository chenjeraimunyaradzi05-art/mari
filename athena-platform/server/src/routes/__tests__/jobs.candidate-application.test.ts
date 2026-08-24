import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    jobApplication: { findUnique: jest.fn(), update: jest.fn() },
    job: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'candidate-1', role: 'USER', email: 'u@a.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._r: string[]) => (_req: any, __res: any, next: any) => next(),
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

const CANDIDATE = 'candidate-1';
const EMPLOYER = 'employer-1';
const OTHER = 'other-1';

const as = (id: string) => ({ 'x-test-user': id });

function mockApplication(overrides: Record<string, unknown> = {}) {
  (prisma.jobApplication.findUnique as any).mockResolvedValue({
    id: 'a1',
    userId: CANDIDATE,
    status: 'OFFERED',
    job: { id: 'j1', title: 'Electrician', postedById: EMPLOYER },
    ...overrides,
  });
}

const patch = (body: object, user = CANDIDATE) =>
  request(app).patch('/api/jobs/me/applications/a1').set(as(user)).send(body);

describe("A candidate's own application actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.jobApplication.update as any).mockImplementation(async (args: any) => ({
      id: 'a1',
      ...args.data,
    }));
    (notify as any).mockResolvedValue(undefined);
  });

  it('accepts an offer', async () => {
    mockApplication({ status: 'OFFERED' });

    await patch({ status: 'ACCEPTED' }).expect(200);

    expect((prisma.jobApplication.update as any).mock.calls[0][0].data).toEqual({
      status: 'ACCEPTED',
    });
  });

  it('tells the employer who posted the job', async () => {
    mockApplication({ status: 'OFFERED' });

    await patch({ status: 'ACCEPTED' }).expect(200);

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: EMPLOYER }));
  });

  it('will not accept an offer that was never made', async () => {
    mockApplication({ status: 'INTERVIEW' });

    await patch({ status: 'ACCEPTED' }).expect(400);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('withdraws from any stage before a decision', async () => {
    for (const status of ['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED']) {
      jest.clearAllMocks();
      (prisma.jobApplication.update as any).mockResolvedValue({});
      mockApplication({ status });

      await patch({ status: 'WITHDRAWN' }).expect(200);
    }
  });

  it('will not withdraw an application that was already rejected', async () => {
    mockApplication({ status: 'REJECTED' });

    await patch({ status: 'WITHDRAWN' }).expect(400);
  });

  it("404s on somebody else's application rather than 403", async () => {
    mockApplication({ userId: OTHER });

    await patch({ status: 'WITHDRAWN' }, CANDIDATE).expect(404);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('404s when the application does not exist', async () => {
    (prisma.jobApplication.findUnique as any).mockResolvedValue(null);

    await patch({ status: 'WITHDRAWN' }).expect(404);
  });

  it('is idempotent', async () => {
    mockApplication({ status: 'WITHDRAWN' });

    await patch({ status: 'WITHDRAWN' }).expect(200);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('refuses statuses that are the employer\'s to set', async () => {
    mockApplication();

    for (const status of ['OFFERED', 'REJECTED', 'SHORTLISTED', 'PENDING']) {
      await patch({ status }).expect(400);
    }
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });
});
