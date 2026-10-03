/**
 * A mention is how somebody else's post or comment reaches a woman who has
 * closed her own door. Naming her by id markup used to ring her bell and her
 * phone, and be listed under "posts mentioning me", from an account she had
 * blocked, because the mention resolved to "an active member" and nothing more.
 * notifySocial now holds the notification back across a block (see
 * social-notifications.block.test.ts); this is the other half, that a mention
 * the author is not allowed to make is not made: not recorded on the post, so
 * not listed for her either.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const userFindMany = jest.fn() as Query;
const safetySettingsFindUnique = jest.fn() as Query;
const safetySettingsFindMany = jest.fn() as Query;
const dvFindUnique = jest.fn() as Query;
const dvFindMany = jest.fn() as Query;
jest.mock('../prisma', () => ({
  prisma: {
    user: { findMany: userFindMany },
    userSafetySettings: { findUnique: safetySettingsFindUnique, findMany: safetySettingsFindMany },
    dvSafetyProfile: { findUnique: dvFindUnique, findMany: dvFindMany },
  },
}));

import { MENTION_LIMIT, resolveMentionedUserIds } from '../mentions';

const MEI = '11111111-1111-4111-8111-111111111111';
const SARAH = '22222222-2222-4222-8222-222222222222';
const PRIYA = '33333333-3333-4333-8333-333333333333';
const ZARA = '44444444-4444-4444-8444-444444444444';
const AUTHOR = '99999999-9999-4999-8999-999999999999';

const text = `Thanks @[Mei](${MEI}), @[Sarah](${SARAH}), @[Priya](${PRIYA}) and @[Zara](${ZARA})`;

beforeEach(() => {
  jest.resetAllMocks();
  userFindMany.mockImplementation(async (args: any) => args.where.id.in.map((id: string) => ({ id })));
  safetySettingsFindUnique.mockResolvedValue(null);
  safetySettingsFindMany.mockResolvedValue([]);
  dvFindUnique.mockResolvedValue(null);
  dvFindMany.mockResolvedValue([]);
});

describe('resolveMentionedUserIds across a block', () => {
  it('is unchanged when no author is given: it names every active member the text names', async () => {
    expect(await resolveMentionedUserIds(text)).toEqual([MEI, SARAH, PRIYA, ZARA]);
    expect(safetySettingsFindUnique).not.toHaveBeenCalled();
  });

  it('leaves out a member the author blocked, and one who blocked the author, in the platform list', async () => {
    safetySettingsFindUnique.mockResolvedValue({ blockedUsers: [MEI] });
    safetySettingsFindMany.mockResolvedValue([{ userId: SARAH }]);

    expect(await resolveMentionedUserIds(text, MENTION_LIMIT, AUTHOR)).toEqual([PRIYA, ZARA]);
    // Read for the author, in both directions.
    expect(safetySettingsFindUnique.mock.calls[0][0].where).toEqual({ userId: AUTHOR });
    expect(safetySettingsFindMany.mock.calls[0][0].where).toEqual({ blockedUsers: { has: AUTHOR } });
  });

  it('honours a block that exists only in the DV safety profile, in either direction', async () => {
    dvFindUnique.mockResolvedValue({ blockedUserIds: [PRIYA] });
    dvFindMany.mockResolvedValue([{ userId: ZARA }]);

    expect(await resolveMentionedUserIds(text, MENTION_LIMIT, AUTHOR)).toEqual([MEI, SARAH]);
    expect(dvFindMany.mock.calls[0][0].where).toEqual({ blockedUserIds: { has: AUTHOR } });
  });

  it('still drops an account that is not an active member, as before', async () => {
    userFindMany.mockResolvedValue([{ id: MEI }]);

    expect(await resolveMentionedUserIds(text, MENTION_LIMIT, AUTHOR)).toEqual([MEI]);
  });

  it('keeps the limit: only the first names are looked at', async () => {
    expect(await resolveMentionedUserIds(text, 2, AUTHOR)).toEqual([MEI, SARAH]);
  });

  it('asks nothing when the text names nobody', async () => {
    expect(await resolveMentionedUserIds('No names here', MENTION_LIMIT, AUTHOR)).toEqual([]);
    expect(userFindMany).not.toHaveBeenCalled();
    expect(safetySettingsFindUnique).not.toHaveBeenCalled();
  });

  it('fails, rather than mentioning someone who may have blocked her, when the block lists cannot be read', async () => {
    safetySettingsFindMany.mockRejectedValue(new Error('connection reset'));

    await expect(resolveMentionedUserIds(text, MENTION_LIMIT, AUTHOR)).rejects.toThrow('connection reset');
  });
});
