import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    profile: { findUnique: jest.fn(), upsert: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const withdrawPresence = jest.fn(async (_userId: string) => 0);
jest.mock('../../services/presence.service', () => ({
  ...(jest.requireActual('../../services/presence.service') as object),
  withdrawPresence: (userId: string) => withdrawPresence(userId),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('GET /api/safety/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to model defaults when the user has never saved preferences', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ allowMessages: true });
    (prisma.profile.findUnique as any).mockResolvedValue(null);
    (prisma.userSafetySettings.findUnique as any).mockResolvedValue(null);

    const res = await request(app).get('/api/safety/settings').expect(200);

    expect(res.body.data).toMatchObject({
      allowMessages: true,
      isSafeMode: false,
      hideFromSearch: false,
      allowMessagesFrom: 'connections',
      filterOffensiveContent: true,
      hideReadReceipts: false,
      profileVisibility: 'public',
      hideOnlineStatus: false,
      hideLastSeen: false,
      enableSafetyAlerts: true,
    });
  });

  it('stored preferences win over the defaults', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ allowMessages: false });
    (prisma.profile.findUnique as any).mockResolvedValue({ isSafeMode: true, hideFromSearch: true });
    (prisma.userSafetySettings.findUnique as any).mockResolvedValue({
      allowMessagesFrom: 'none',
      filterOffensiveContent: false,
      hideReadReceipts: true,
      profileVisibility: 'private',
      hideOnlineStatus: true,
      hideLastSeen: true,
      enableSafetyAlerts: false,
    });

    const res = await request(app).get('/api/safety/settings').expect(200);

    expect(res.body.data.profileVisibility).toBe('private');
    expect(res.body.data.allowMessagesFrom).toBe('none');
    expect(res.body.data.hideReadReceipts).toBe(true);
    expect(res.body.data.hideFromSearch).toBe(true);
  });
});

describe('PATCH /api/safety/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.profile.upsert as any).mockResolvedValue({});
    (prisma.userSafetySettings.upsert as any).mockResolvedValue({});
  });

  it('writes only the preference keys the caller actually sent', async () => {
    await request(app)
      .patch('/api/safety/settings')
      .send({ profileVisibility: 'connections' })
      .expect(200);

    const call = (prisma.userSafetySettings.upsert as any).mock.calls[0][0];
    // A page that owns a subset of these settings must not clobber the others.
    expect(call.update).toEqual({ profileVisibility: 'connections' });
    expect(call.create).toMatchObject({
      userId: 'user-123',
      profileVisibility: 'connections',
      allowMessagesFrom: 'connections',
    });
  });

  it('does not touch the preferences table when no preference key is sent', async () => {
    await request(app).patch('/api/safety/settings').send({ allowMessages: false }).expect(200);

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.userSafetySettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range profileVisibility', async () => {
    await request(app)
      .patch('/api/safety/settings')
      .send({ profileVisibility: 'everyone' })
      .expect(400);

    expect(prisma.userSafetySettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range allowMessagesFrom', async () => {
    await request(app)
      .patch('/api/safety/settings')
      .send({ allowMessagesFrom: 'everyone' })
      .expect(400);
  });

  it('accepts the message-settings payload the client sends', async () => {
    await request(app)
      .patch('/api/safety/settings')
      .send({ allowMessagesFrom: 'all', hideReadReceipts: false, filterOffensiveContent: true })
      .expect(200);

    expect((prisma.userSafetySettings.upsert as any).mock.calls[0][0].update).toEqual({
      allowMessagesFrom: 'all',
      hideReadReceipts: false,
      filterOffensiveContent: true,
    });
  });

  // Her counterparts saw her come online before she switched hiding on, and
  // would go on reading "Active now" until they reloaded.
  it('takes back the online status already shown when she hides it or turns Safe Mode on', async () => {
    await request(app).patch('/api/safety/settings').send({ hideOnlineStatus: true }).expect(200);
    expect(withdrawPresence).toHaveBeenCalledWith('user-123');

    withdrawPresence.mockClear();
    await request(app).patch('/api/safety/settings').send({ isSafeMode: true }).expect(200);
    expect(withdrawPresence).toHaveBeenCalledWith('user-123');
  });

  it('leaves presence alone when she shows her status again or changes something else', async () => {
    await request(app).patch('/api/safety/settings').send({ hideOnlineStatus: false }).expect(200);
    await request(app).patch('/api/safety/settings').send({ isSafeMode: false }).expect(200);
    await request(app).patch('/api/safety/settings').send({ profileVisibility: 'private' }).expect(200);
    expect(withdrawPresence).not.toHaveBeenCalled();
  });
});
