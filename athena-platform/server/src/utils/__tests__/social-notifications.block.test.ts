/**
 * A block ends contact in both directions, and the notification is the contact
 * that was easiest to miss. The mention, the reply, the repost, the like and
 * the follow each reach notifySocial from a different route, and most of those
 * routes checked nothing: a man she had blocked could still ring her phone by
 * naming her under somebody else's post, where no block check applies to the
 * post itself. notifySocial is the one place they all pass, so the rule is
 * pinned here. The same door holds back a notification that one account has
 * sent too many times to the same member, and one that is part of a crowd of
 * strangers turning on her (services/pile-on.service has its own suite).
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const userFindUnique = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
const safetySettingsFindMany = jest.fn() as Query;
const dvProfileFindFirst = jest.fn() as Query;
jest.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    notification: { create: notificationCreate },
    userSafetySettings: { findMany: safetySettingsFindMany },
    dvSafetyProfile: { findFirst: dvProfileFindFirst },
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

const quietedByPileOn = jest.fn() as jest.Mock<(targetId: string, actorId: string) => Promise<boolean>>;
jest.mock('../../services/pile-on.service', () => ({ quietedByPileOn }));

const withinTargetLimit = jest.fn() as jest.Mock<(kind: string, actorId: string, targetId: string) => Promise<boolean>>;
jest.mock('../../middleware/socialLimits', () => ({ withinTargetLimit }));

import { notifySocial, type SocialNotificationInput } from '../social-notifications';

const mention: SocialNotificationInput = {
  recipientId: 'mei',
  actorId: 'sarah',
  type: 'MENTION',
  title: 'You were mentioned',
  message: (name) => `${name} mentioned you in a comment`,
  link: '/posts/p1',
};

beforeEach(() => {
  jest.resetAllMocks();
  userFindUnique.mockResolvedValue({ displayName: 'Sarah D.', firstName: 'Sarah', lastName: 'Demo' });
  notificationCreate.mockImplementation(async (args: any) => ({ id: 'n-1', ...args.data }));
  safetySettingsFindMany.mockResolvedValue([]);
  dvProfileFindFirst.mockResolvedValue(null);
  memberWantsSocialNotification.mockResolvedValue(true);
  quietedByPileOn.mockResolvedValue(false);
  withinTargetLimit.mockResolvedValue(true);
});

function expectSilence() {
  expect(notificationCreate).not.toHaveBeenCalled();
  expect(emitToUserRoom).not.toHaveBeenCalled();
  expect(pushToUser).not.toHaveBeenCalled();
}

describe('notifySocial across a block', () => {
  it('rings nothing for an account the recipient blocked', async () => {
    // The platform list: the recipient's own row names the actor.
    safetySettingsFindMany.mockResolvedValue([{ userId: 'mei' }]);

    await notifySocial(mention);

    expectSilence();
    expect(safetySettingsFindMany.mock.calls[0][0].where).toEqual({
      OR: [
        { userId: 'mei', blockedUsers: { has: 'sarah' } },
        { userId: 'sarah', blockedUsers: { has: 'mei' } },
      ],
    });
  });

  it('rings nothing for an account that blocked the recipient, either', async () => {
    safetySettingsFindMany.mockResolvedValue([{ userId: 'sarah' }]);

    await notifySocial(mention);

    expectSilence();
  });

  it('honours a block that exists only in the DV safety profile', async () => {
    dvProfileFindFirst.mockResolvedValue({ userId: 'mei' });

    await notifySocial(mention);

    expectSilence();
  });

  it.each(['LIKE', 'COMMENT', 'FOLLOW', 'MENTION', 'REPOST', 'FOLLOW_REQUEST'] as const)(
    'holds for a %s as for every other kind',
    async (type) => {
      safetySettingsFindMany.mockResolvedValue([{ userId: 'mei' }]);

      await notifySocial({ ...mention, type });

      expectSilence();
    }
  );

  it('does not count a blocked account towards a pile-on, or spend a limit on it', async () => {
    safetySettingsFindMany.mockResolvedValue([{ userId: 'mei' }]);

    await notifySocial(mention);

    expect(quietedByPileOn).not.toHaveBeenCalled();
    expect(withinTargetLimit).not.toHaveBeenCalled();
  });

  it('sends nothing, rather than guessing, when the block lists cannot be read', async () => {
    safetySettingsFindMany.mockRejectedValue(new Error('connection reset'));

    await expect(notifySocial(mention)).resolves.toBeUndefined();

    expectSilence();
  });

  it('still rings for two members who have not blocked each other', async () => {
    await notifySocial(mention);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({ userId: 'mei', type: 'MENTION' });
    expect(emitToUserRoom).toHaveBeenCalledTimes(1);
    expect(pushToUser).toHaveBeenCalledTimes(1);
  });
});

describe('notifySocial and the crowd', () => {
  it('rings nothing for an account that is part of a pile-on on the recipient', async () => {
    quietedByPileOn.mockResolvedValue(true);

    await notifySocial({ ...mention, type: 'COMMENT' });

    expect(quietedByPileOn).toHaveBeenCalledWith('mei', 'sarah');
    expectSilence();
  });

  it.each(['COMMENT', 'MENTION', 'FOLLOW', 'FOLLOW_REQUEST', 'REPOST'] as const)(
    'counts a %s towards the crowd, since it is somebody reaching for her attention',
    async (type) => {
      await notifySocial({ ...mention, type });

      expect(quietedByPileOn).toHaveBeenCalledWith('mei', 'sarah');
    }
  );

  it('does not count a like: a crowd of likes is a good day, not a siege', async () => {
    await notifySocial({ ...mention, type: 'LIKE' });

    expect(quietedByPileOn).not.toHaveBeenCalled();
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it('counts the contact even when she has switched that kind of alert off', async () => {
    memberWantsSocialNotification.mockResolvedValue(false);

    await notifySocial(mention);

    expect(quietedByPileOn).toHaveBeenCalledWith('mei', 'sarah');
    expectSilence();
  });
});

describe('notifySocial and one account returning to the same member', () => {
  it('holds back a mention past the per-member ceiling for mentions', async () => {
    withinTargetLimit.mockResolvedValue(false);

    await notifySocial(mention);

    expect(withinTargetLimit).toHaveBeenCalledWith('mention', 'sarah', 'mei');
    expectSilence();
  });

  it('holds back any other kind past its own ceiling', async () => {
    withinTargetLimit.mockResolvedValue(false);

    await notifySocial({ ...mention, type: 'LIKE' });

    expect(withinTargetLimit).toHaveBeenCalledWith('notice', 'sarah', 'mei');
    expectSilence();
  });

  it('is not spent on an alert she has switched off', async () => {
    memberWantsSocialNotification.mockResolvedValue(false);

    await notifySocial(mention);

    expect(withinTargetLimit).not.toHaveBeenCalled();
  });
});
