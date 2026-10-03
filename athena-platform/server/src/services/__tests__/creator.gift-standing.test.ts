import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * A gift is money that a creator is later paid. Good standing is hers to keep:
 * a suspended or banned creator cannot be sent one (she could not withdraw it,
 * and it would leave as a real transfer the day she was reinstated), and a gift
 * never crosses a block in either direction, because it names its sender to her.
 * Both are read before any points move, so a refusal costs the sender nothing.
 */

const prismaMock: any = {
  creatorProfile: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/stripe', () => ({ getStripe: () => ({}) }));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));
jest.mock('../stripe-connect.service', () => ({
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
  resolveConnectedAccountId: jest.fn(),
}));
jest.mock('../feature-flags.service', () => ({ assertPaymentsOpen: jest.fn(async () => undefined) }));
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship: jest.fn(async () => false) }));

import { GIFT_TYPES, sendGift } from '../creator.service';
import { ApiError } from '../../middleware/errorHandler';
import { isBlockedRelationship } from '../../utils/safety-store';
import { sendNotification } from '../socket.service';

const blocked = isBlockedRelationship as jest.MockedFunction<typeof isBlockedRelationship>;
const giftType = Object.keys(GIFT_TYPES)[0] as keyof typeof GIFT_TYPES;

function receiver(standing: { isSuspended: boolean; bannedAt: Date | null }) {
  prismaMock.creatorProfile.findUnique.mockResolvedValue({
    userId: 'creator',
    isMonetized: true,
    user: { followers: [] },
  });
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'creator' ? standing : { giftBalance: 100_000, displayName: 'A supporter' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  blocked.mockResolvedValue(false);
  prismaMock.$transaction.mockResolvedValue({ id: 'gt-1' });
});

describe('sendGift and the creator’s standing', () => {
  it('refuses a gift to a suspended creator before any points move', async () => {
    receiver({ isSuspended: true, bannedAt: null });

    const refused = sendGift('sender', 'creator', giftType);
    await expect(refused).rejects.toBeInstanceOf(ApiError);
    await expect(refused).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('refuses a gift to a banned creator the same way', async () => {
    receiver({ isSuspended: false, bannedAt: new Date('2026-09-01') });

    await expect(sendGift('sender', 'creator', giftType)).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('does not let a gift cross a block in either direction', async () => {
    receiver({ isSuspended: false, bannedAt: null });
    blocked.mockResolvedValue(true);

    await expect(sendGift('sender', 'creator', giftType)).rejects.toMatchObject({ statusCode: 403 });
    expect(blocked).toHaveBeenCalledWith('sender', 'creator');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('moves the points for a creator in good standing whom the sender may reach', async () => {
    receiver({ isSuspended: false, bannedAt: null });

    const result = await sendGift('sender', 'creator', giftType);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result.transaction).toEqual({ id: 'gt-1' });
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'creator', type: 'GIFT_RECEIVED' }));
  });
});
