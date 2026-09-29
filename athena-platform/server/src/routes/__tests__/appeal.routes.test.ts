/**
 * Appeals: filing one, the paged queue, and what a decision does.
 *
 * The queue read every appeal on every load. Upholding a verification appeal
 * left the member REJECTED, with no way back. And no decision was ever told to
 * the member at all — which mattered most for a suspension appeal filed from
 * the sign-in page, because she cannot sign in to read an in-app notice.
 *
 * The appeal router is mounted on its own so these tests answer for it alone.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    appeal: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    contentReport: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    bannedIdentity: { deleteMany: jest.fn() },
    post: { updateMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'staff-1', role: 'ADMIN', email: 'staff@athena.test' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

import appealRoutes from '../appeal.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';

const app = express();
app.use(express.json());
app.use('/api/appeals', appealRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;
const emailed = sendEmail as unknown as jest.Mock<(options: { to: string; subject: string; html: string }) => Promise<boolean>>;

function pendingAppeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appeal-1',
    userId: 'member-1',
    type: 'ACCOUNT_SUSPENSION',
    status: 'PENDING',
    reason: 'I was not the one who sent those messages',
    metadata: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  prisma.notification.create.mockResolvedValue({ id: 'n-1' });
  prisma.user.findUnique.mockResolvedValue({ email: 'member@example.org', firstName: 'Mere', isSuspended: false, bannedAt: null });
  prisma.user.update.mockResolvedValue({});
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
  prisma.contentReport.findFirst.mockResolvedValue(null);
  prisma.contentReport.findUnique.mockResolvedValue(null);
  prisma.bannedIdentity.deleteMany.mockResolvedValue({ count: 1 });
  // The update answers with the row as it now stands: whatever the test set
  // up as the stored appeal, with the decision written over it.
  prisma.appeal.update.mockImplementation(async ({ data }: any) => ({ ...(await prisma.appeal.findUnique()), ...data }));
});

describe('POST /api/appeals', () => {
  it('files an appeal', async () => {
    prisma.appeal.create.mockResolvedValue({ id: 'appeal-1', status: 'PENDING' });

    const res = await request(app)
      .post('/api/appeals')
      .send({ type: 'VERIFICATION_DECISION', reason: 'Please look again', metadata: { appealType: 'verification_decision' } });

    expect(res.status).toBe(201);
    expect(prisma.appeal.create.mock.calls[0][0].data).toMatchObject({ userId: 'staff-1', type: 'VERIFICATION_DECISION' });
  });

  it('refuses metadata that is not an object', async () => {
    const res = await request(app).post('/api/appeals').send({ type: 'OTHER', reason: 'x', metadata: 'a string' });

    expect(res.status).toBe(400);
    expect(prisma.appeal.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/appeals', () => {
  it('reads one page, oldest waiting first, and says how many there are', async () => {
    prisma.appeal.findMany.mockResolvedValue([{ id: 'appeal-1' }]);
    prisma.appeal.count.mockResolvedValue(130);

    const res = await request(app).get('/api/appeals?status=PENDING&page=2&limit=50');

    expect(res.status).toBe(200);
    const args = prisma.appeal.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ skip: 50, take: 50, where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
    expect(res.body.pagination).toEqual({ page: 2, limit: 50, total: 130, totalPages: 3 });
  });

  it('refuses a page size past a hundred', async () => {
    const res = await request(app).get('/api/appeals?limit=5000');

    expect(res.status).toBe(400);
    expect(prisma.appeal.findMany).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/appeals/:id', () => {
  it('answers 404 for an appeal that does not exist', async () => {
    prisma.appeal.findUnique.mockResolvedValue(null);

    const res = await request(app).patch('/api/appeals/nope').send({ status: 'APPROVED' });

    expect(res.status).toBe(404);
  });

  it('will not decide an appeal twice', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ status: 'REJECTED' }));

    const res = await request(app).patch('/api/appeals/appeal-1').send({ status: 'APPROVED' });

    expect(res.status).toBe(409);
    expect(prisma.appeal.update).not.toHaveBeenCalled();
  });

  it('sends an upheld verification appeal back to the women-only reviewer rather than leaving her refused', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ type: 'VERIFICATION_DECISION' }));

    const res = await request(app).patch('/api/appeals/appeal-1').send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'member-1', womanVerificationStatus: 'REJECTED' },
      data: { womanVerificationStatus: 'PENDING', womanVerifiedAt: null },
    });
    expect(res.body.reversal).toEqual({ verificationReopened: true });
  });

  it('tells the member the decision in the app and by email, escaping what the reviewer wrote', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ metadata: { submittedFrom: 'sign-in' } }));

    await request(app)
      .patch('/api/appeals/appeal-1')
      .send({ status: 'REJECTED', decisionNote: 'The messages came from <b>this</b> account' });

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'member-1', link: '/help/appeals' });
    expect(emailed).toHaveBeenCalledTimes(1);
    const email = emailed.mock.calls[0][0];
    // She appealed from the sign-in page and cannot read an in-app notice.
    expect(email.to).toBe('member@example.org');
    expect(email.html).toContain('&lt;b&gt;this&lt;/b&gt;');
    expect(email.html).not.toContain('<b>this</b>');
  });

  it('writes to the address she asked us to use when she gave one', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ metadata: { contactEmail: 'safe@example.net' } }));

    await request(app).patch('/api/appeals/appeal-1').send({ status: 'REJECTED' });

    expect(emailed.mock.calls[0][0].to).toBe('safe@example.net');
  });

  it('does not tell the member anything when the appeal is only taken under review', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal());

    await request(app).patch('/api/appeals/appeal-1').send({ status: 'UNDER_REVIEW' });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emailed).not.toHaveBeenCalled();
  });

  it('lifts a ban, and the bar on her address, when her appeal against the account lock is upheld', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal());
    prisma.user.findUnique.mockResolvedValue({ email: 'member@example.org', firstName: 'Mere', isSuspended: true, bannedAt: new Date() });

    const res = await request(app).patch('/api/appeals/appeal-1').send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: false, bannedAt: null, suspensionReason: null });
    expect(prisma.bannedIdentity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'member-1' } });
    expect(res.body.reversal).toMatchObject({ suspensionLifted: true, banLifted: true });
  });

  it('keeps a ban in place when the upheld appeal was only about a piece of content', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ type: 'CONTENT_MODERATION' }));
    prisma.user.findUnique.mockResolvedValue({ email: 'member@example.org', firstName: 'Mere', isSuspended: true, bannedAt: new Date() });

    const res = await request(app).patch('/api/appeals/appeal-1').send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.bannedIdentity.deleteMany).not.toHaveBeenCalled();
    expect(res.body.reversal).toMatchObject({ banKept: true, suspensionLifted: false });
  });

  it('finds the report her reference names, but only a report about her own account', async () => {
    prisma.appeal.findUnique.mockResolvedValue(pendingAppeal({ type: 'CONTENT_MODERATION', metadata: { referenceId: 'RPT-ABC' } }));

    await request(app).patch('/api/appeals/appeal-1').send({ status: 'APPROVED' });

    const lookups = prisma.contentReport.findFirst.mock.calls.map(([args]: any[]) => args.where);
    expect(lookups).toContainEqual({ reportedUserId: 'member-1', evidence: { path: ['ticketId'], equals: 'RPT-ABC' } });
    for (const where of lookups) expect(where.reportedUserId).toBe('member-1');
  });
});
