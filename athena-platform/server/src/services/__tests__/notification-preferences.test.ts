import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { wantsSocialNotification } from '../notification-preferences.service';
import { notifySocial } from '../../utils/social-notifications';

const prisma: any = prismaTyped;

describe('Social notification preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a missing or empty preference means yes', () => {
    expect(wantsSocialNotification(null, 'LIKE')).toBe(true);
    expect(wantsSocialNotification({}, 'COMMENT')).toBe(true);
    expect(wantsSocialNotification({ inApp: {} }, 'FOLLOW')).toBe(true);
  });

  it('"all" off silences every social kind', () => {
    const prefs = { inApp: { all: false, likes: true } };
    expect(wantsSocialNotification(prefs, 'LIKE')).toBe(false);
    expect(wantsSocialNotification(prefs, 'MENTION')).toBe(false);
  });

  it('each kind can be switched off on its own; follow requests count as follows', () => {
    const prefs = { inApp: { all: true, likes: false, follows: false } };
    expect(wantsSocialNotification(prefs, 'LIKE')).toBe(false);
    expect(wantsSocialNotification(prefs, 'FOLLOW_REQUEST')).toBe(false);
    expect(wantsSocialNotification(prefs, 'COMMENT')).toBe(true);
    expect(wantsSocialNotification(prefs, 'REPOST')).toBe(true);
  });

  it('notifySocial writes nothing for a kind the member switched off', async () => {
    prisma.user.findUnique.mockResolvedValue({ notificationPreferences: { inApp: { all: true, likes: false } }, displayName: 'Mei C.' });

    await notifySocial({
      recipientId: 'sarah',
      actorId: 'mei',
      type: 'LIKE',
      title: 'New reaction',
      message: (name) => `${name} liked your post`,
      link: '/posts/p1',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();

    await notifySocial({
      recipientId: 'sarah',
      actorId: 'mei',
      type: 'COMMENT',
      title: 'New comment',
      message: (name) => `${name} commented on your post`,
      link: '/posts/p1',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create.mock.calls[0][0].data.type).toBe('COMMENT');
  });
});
