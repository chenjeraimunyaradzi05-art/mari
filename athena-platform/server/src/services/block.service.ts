/**
 * One way to block someone, for every door that can.
 *
 * A block is written to the platform-wide list (utils/safety-store) and then
 * counts, once, towards the picture a moderator is given of the person who was
 * blocked: her trust record, her safety score, and the count of different women
 * who have blocked her after an unwanted message (unwanted-contact.service).
 * Only the Safety Centre's block did all of that. The DV safety page, a host
 * removing a viewer from a live stream, and a member declining an organisation's
 * invitation and blocking its managers each wrote the block and nothing else, so
 * the same act weighed differently depending on which button she pressed, and an
 * account blocked by six women through four doors looked, to the score, like one
 * blocked by none.
 *
 * What follows the block is best effort, and on purpose. The block is already
 * written and is what protects her; the Safety Centre's version let a failure
 * in the score return an error after the block had been applied, which told her
 * the block had failed when it had not, and she would press it again. A failed
 * consequence is logged, labelled with the door it came from, and carried past.
 *
 * What the score does with a block is bounded in safety-score.service: each
 * blocker counts once, and the total is capped, so blocks are a signal for a
 * person to look at and never, on their own, a way to move someone's standing a
 * long way. That matters most for the one door a survivor of abuse uses: whoever
 * she blocks, the arithmetic cannot be turned the other way to make her look
 * like the risk.
 *
 * The consequence modules are loaded when needed rather than at the top. The
 * score service sends notifications, which read the DV safety settings, which
 * block people through this file; loading them up front would be a ring.
 */

import { bestEffort } from '../utils/best-effort';
import { blockUser, unblockUser } from '../utils/safety-store';

/** Which door the block came through; named in the log when a consequence fails. */
export type BlockSource = 'safety-centre' | 'dv-safe' | 'live-stream' | 'employer-invitation';

export async function applyBlock(
  blockerId: string,
  blockedUserId: string,
  context: { source: BlockSource }
): Promise<{ created: boolean }> {
  const result = await blockUser(blockerId, blockedUserId);
  if (!result.created) return result;

  const { source } = context;
  await bestEffort(`block.${source}.trust-record`, async () => {
    const { recordUserBlock } = await import('./trust.service');
    await recordUserBlock(blockedUserId);
  });
  await bestEffort(`block.${source}.safety-score`, async () => {
    const { handleUserBlock } = await import('./safety-score.service');
    await handleUserBlock(blockedUserId, blockerId);
  });
  // One of the three signals that, in number, put an account in front of a
  // moderator. It never throws on its own; this is for the load.
  await bestEffort(`block.${source}.unwanted-contact`, async () => {
    const { reviewUnwantedContact } = await import('./unwanted-contact.service');
    await reviewUnwantedContact(blockedUserId);
  });

  return result;
}

/**
 * Lifts a block, and stops it counting against the person it was made against.
 * A block she took back is not a block she still holds, and the score used to
 * go on counting it for as long as the incident was in the window.
 */
export async function liftBlock(blockerId: string, blockedUserId: string): Promise<void> {
  await unblockUser(blockerId, blockedUserId);
  await bestEffort('block.lift.safety-score', async () => {
    const { handleUserUnblock } = await import('./safety-score.service');
    await handleUserUnblock(blockedUserId, blockerId);
  });
}
