import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'owner-1', role: 'USER', email: 'o@example.com' };
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
const ORG = 'org-A';
const OWNER = 'owner-1';
const INVITEE = 'invitee-1';

const SENT = 'If that email address belongs to an ATHENA member, she has been sent an invitation. She will appear on your team once she accepts it.';

/** The caller is an accepted owner; the invitee's row is whatever `inviteeRow` says. */
function setUpMembership(inviteeRow: Record<string, unknown> | null = null) {
  prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) => {
    const key = where.organizationId_userId;
    if (key?.userId === OWNER) {
      return {
        id: 'mem-owner', organizationId: ORG, userId: OWNER, role: 'OWNER',
        canPostJobs: true, canManageTeam: true, canViewAnalytics: true, acceptedAt: new Date('2026-01-01'),
      };
    }
    if (key?.userId === INVITEE) return inviteeRow;
    return null;
  });
}

const invite = (body: Record<string, unknown>) =>
  request(app).post(`/api/employer/organizations/${ORG}/team/invite`).send(body);

describe('Inviting someone to a team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpMembership();
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: OWNER }]);
    prisma.organizationMember.create.mockResolvedValue({ id: 'mem-new' });
    prisma.notification.create.mockResolvedValue({});
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
  });

  it('answers an address with no account exactly as it answers one with an account', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await invite({ email: 'nobody@example.com', role: 'RECRUITER' });

    prisma.user.findUnique.mockResolvedValueOnce({ id: INVITEE });
    const known = await invite({ email: 'her@example.com', role: 'RECRUITER' });

    // Same status, same words: inviting cannot be used to learn who is on ATHENA.
    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(known.body.message).toBe(SENT);
    expect(prisma.organizationMember.create).toHaveBeenCalledTimes(1);
  });

  it('sends nothing to a woman who has blocked the person inviting her, and says nothing different', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });
    // Her own block list names the owner.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [OWNER] });

    const res = await invite({ email: 'her@example.com', role: 'RECRUITER' });

    expect(res.status).toBe(202);
    expect(res.body.message).toBe(SENT);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('honours a block made on her DV safety page as well', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: [OWNER] });

    const res = await invite({ email: 'her@example.com', role: 'VIEWER' });

    expect(res.status).toBe(202);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it('refuses the person she blocked even when someone else on his team presses the button', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });
    // The owner is the one she blocked; the caller is a colleague who can manage the team.
    prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) => {
      const key = where.organizationId_userId;
      if (key?.userId === 'colleague-1') {
        return { id: 'mem-c', organizationId: ORG, userId: 'colleague-1', role: 'ADMIN', canPostJobs: true, canManageTeam: true, canViewAnalytics: true, acceptedAt: new Date() };
      }
      return null;
    });
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: OWNER }, { userId: 'colleague-1' }]);
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [OWNER] });

    const res = await invite({ email: 'her@example.com', role: 'VIEWER' }).set({ 'x-test-user': 'colleague-1' });

    expect(res.status).toBe(202);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it('gives a second invitation the same answer instead of confirming a pending one exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });
    setUpMembership({ acceptedAt: null });

    const res = await invite({ email: 'her@example.com', role: 'RECRUITER' });

    expect(res.status).toBe(202);
    expect(res.body.message).toBe(SENT);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it('puts no text the sender chose into her notifications', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });

    await invite({ email: 'her@example.com', role: 'RECRUITER' }).expect(202);

    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice.userId).toBe(INVITEE);
    expect(notice.link).toBe('/employer/invitations');
    // The organisation's name is whatever its creator typed; it is read on the
    // invitations page, not pushed into her inbox.
    expect(notice.message).toBe(
      'An organisation on ATHENA has invited you to join its hiring team. Open your invitations to see which one, and choose whether to accept.'
    );
  });

  it('refuses a role outside the list rather than handing out ownership', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: INVITEE });

    await invite({ email: 'her@example.com', role: 'OWNER' }).expect(400);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });
});

describe('The team roster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpMembership();
    prisma.organizationMember.findMany.mockResolvedValue([]);
  });

  it('lists only people who have accepted', async () => {
    await request(app).get(`/api/employer/organizations/${ORG}/team`).expect(200);

    expect(prisma.organizationMember.findMany.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      acceptedAt: { not: null },
    });
  });
});

describe('Declining an invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: 'mem-pending', organizationId: ORG, userId: INVITEE, role: 'RECRUITER', acceptedAt: null,
    });
    prisma.organizationMember.delete.mockResolvedValue({});
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: OWNER }, { userId: 'manager-2' }]);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.create.mockResolvedValue({});
    prisma.userSafetySettings.update.mockResolvedValue({});
  });

  it('removes the invitation and blocks nobody by default', async () => {
    await request(app)
      .post('/api/employer/invitations/mem-pending/decline')
      .set({ 'x-test-user': INVITEE })
      .expect(200);

    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-pending' } });
    expect(prisma.userSafetySettings.create).not.toHaveBeenCalled();
  });

  it('with block, blocks everyone who runs the organisation so the no sticks', async () => {
    const res = await request(app)
      .post('/api/employer/invitations/mem-pending/decline')
      .set({ 'x-test-user': INVITEE })
      .send({ block: true })
      .expect(200);

    expect(res.body.data.blocked).toBe(2);
    const managersQuery = prisma.organizationMember.findMany.mock.calls[0][0].where;
    expect(managersQuery).toMatchObject({ organizationId: ORG, acceptedAt: { not: null } });
    expect(prisma.userSafetySettings.create).toHaveBeenCalledWith({ data: { userId: INVITEE, blockedUsers: [OWNER] } });
  });

  it('is only hers to decline', async () => {
    await request(app)
      .post('/api/employer/invitations/mem-pending/decline')
      .set({ 'x-test-user': 'someone-else' })
      .send({ block: true })
      .expect(404);

    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
  });
});
