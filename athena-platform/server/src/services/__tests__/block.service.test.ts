/**
 * One way to block someone, whichever door she uses.
 *
 * The Safety Centre's block counted towards the blocked account's trust record,
 * her safety score and the count of women who have blocked her after an unwanted
 * message. The DV safety page, a host removing a viewer from a stream and a
 * member declining an organisation's invitation each wrote the block and nothing
 * else; and the Safety Centre's own version let a failure in the score turn a
 * block that was in place into an error.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const blockUser = jest.fn(async (_blocker: string, _blocked: string) => ({ created: true }));
const unblockUser = jest.fn(async (_blocker: string, _blocked: string) => undefined);
jest.mock('../../utils/safety-store', () => ({
  blockUser: (blocker: string, blocked: string) => blockUser(blocker, blocked),
  unblockUser: (blocker: string, blocked: string) => unblockUser(blocker, blocked),
}));

const recordUserBlock = jest.fn(async (_blocked: string) => undefined);
jest.mock('../trust.service', () => ({ recordUserBlock: (blocked: string) => recordUserBlock(blocked) }));

const handleUserBlock = jest.fn(async (_blocked: string, _blocker: string) => undefined);
const handleUserUnblock = jest.fn(async (_blocked: string, _blocker: string) => undefined);
jest.mock('../safety-score.service', () => ({
  handleUserBlock: (blocked: string, blocker: string) => handleUserBlock(blocked, blocker),
  handleUserUnblock: (blocked: string, blocker: string) => handleUserUnblock(blocked, blocker),
}));

const reviewUnwantedContact = jest.fn(async (_blocked: string) => undefined);
jest.mock('../unwanted-contact.service', () => ({ reviewUnwantedContact: (blocked: string) => reviewUnwantedContact(blocked) }));

const warn = jest.fn();
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: (...args: unknown[]) => warn(...args), error: jest.fn() },
}));

import { applyBlock, liftBlock } from '../block.service';

beforeEach(() => {
  jest.clearAllMocks();
  blockUser.mockResolvedValue({ created: true });
});

describe('applyBlock', () => {
  it.each(['safety-centre', 'dv-safe', 'live-stream', 'employer-invitation'] as const)(
    'writes the block and counts it, once, from the %s door',
    async (source) => {
      const result = await applyBlock('her', 'him', { source });

      expect(result).toEqual({ created: true });
      expect(blockUser).toHaveBeenCalledWith('her', 'him');
      expect(recordUserBlock).toHaveBeenCalledWith('him');
      expect(handleUserBlock).toHaveBeenCalledWith('him', 'her');
      expect(reviewUnwantedContact).toHaveBeenCalledWith('him');
    }
  );

  it('counts nothing for a block that was already there', async () => {
    blockUser.mockResolvedValue({ created: false });

    const result = await applyBlock('her', 'him', { source: 'safety-centre' });

    expect(result).toEqual({ created: false });
    expect(recordUserBlock).not.toHaveBeenCalled();
    expect(handleUserBlock).not.toHaveBeenCalled();
    expect(reviewUnwantedContact).not.toHaveBeenCalled();
  });

  it('is still a block, and still tries the rest, when one thing it counts towards fails', async () => {
    handleUserBlock.mockRejectedValueOnce(new Error('score unavailable'));

    const result = await applyBlock('her', 'him', { source: 'dv-safe' });

    expect(result).toEqual({ created: true });
    // The failure is in the log with the door it came from, not silent.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('block.dv-safe.safety-score'),
      expect.anything()
    );
    // And the other two were not skipped because of it.
    expect(recordUserBlock).toHaveBeenCalledWith('him');
    expect(reviewUnwantedContact).toHaveBeenCalledWith('him');
  });

  it('does not count a block that could not be written', async () => {
    blockUser.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(applyBlock('her', 'him', { source: 'live-stream' })).rejects.toThrow('database unavailable');

    expect(handleUserBlock).not.toHaveBeenCalled();
    expect(recordUserBlock).not.toHaveBeenCalled();
  });
});

describe('liftBlock', () => {
  it('lifts the block and stops it counting against the account', async () => {
    await liftBlock('her', 'him');

    expect(unblockUser).toHaveBeenCalledWith('her', 'him');
    expect(handleUserUnblock).toHaveBeenCalledWith('him', 'her');
  });

  it('is still lifted when the score cannot be worked out again', async () => {
    handleUserUnblock.mockRejectedValueOnce(new Error('score unavailable'));

    await expect(liftBlock('her', 'him')).resolves.toBeUndefined();

    expect(unblockUser).toHaveBeenCalledWith('her', 'him');
  });

  it('does not touch the score when the block could not be lifted', async () => {
    unblockUser.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(liftBlock('her', 'him')).rejects.toThrow('database unavailable');

    expect(handleUserUnblock).not.toHaveBeenCalled();
  });
});
