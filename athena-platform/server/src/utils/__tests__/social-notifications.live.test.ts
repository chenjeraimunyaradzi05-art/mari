/**
 * A like, comment, follow, mention or repost used to reach an open web or
 * mobile client only on its next poll: the row was written, and nothing told
 * the socket. These pin the live emit, and that it goes once, to the user
 * room, only after the row exists and only when the member wants that kind.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const userFindUnique = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
jest.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    notification: { create: notificationCreate },
  },
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const memberWantsSocialNotification = jest.fn() as jest.Mock<(userId: string, type: string) => Promise<boolean>>;
jest.mock('../../services/notification-preferences.service', () => ({ memberWantsSocialNotification }));

const pushToUser = jest.fn();
jest.mock('../../services/push.service', () => ({ pushToUser }));

const emitToUserRoom = jest.fn();
jest.mock('../../services/socket.service', () => ({ emitToUserRoom }));

import { notifySocial } from '../social-notifications';

const comment = {
  recipientId: 'sarah',
  actorId: 'mei',
  type: 'COMMENT' as const,
  title: 'New comment',
  message: (name: string) => `${name} commented on your post`,
  link: '/posts/p1',
};

beforeEach(() => {
  jest.clearAllMocks();
  userFindUnique.mockResolvedValue({ displayName: 'Mei C.', firstName: 'Mei', lastName: 'Chen' });
  memberWantsSocialNotification.mockResolvedValue(true);
  notificationCreate.mockImplementation(async (args: any) => ({ id: 'n-1', ...args.data }));
});

describe('notifySocial, live', () => {
  it('sends the stored row to her user room, once', async () => {
    await notifySocial(comment);

    expect(emitToUserRoom).toHaveBeenCalledTimes(1);
    expect(emitToUserRoom).toHaveBeenCalledWith(
      'sarah',
      'notifications:new',
      expect.objectContaining({ id: 'n-1', userId: 'sarah', type: 'COMMENT', message: 'Mei C. commented on your post' })
    );
  });

  it('sends nothing live for a kind she switched off', async () => {
    memberWantsSocialNotification.mockResolvedValue(false);

    await notifySocial(comment);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(emitToUserRoom).not.toHaveBeenCalled();
  });

  it('sends nothing live when the row could not be written, and does not throw', async () => {
    notificationCreate.mockRejectedValue(new Error('connection reset'));

    await expect(notifySocial(comment)).resolves.toBeUndefined();
    expect(emitToUserRoom).not.toHaveBeenCalled();
  });

  it('never tells anyone about their own action', async () => {
    await notifySocial({ ...comment, actorId: 'sarah' });

    expect(emitToUserRoom).not.toHaveBeenCalled();
  });
});
