/**
 * Fees Routes
 * What ATHENA keeps, in one place, for anyone to read
 */

import { Router, Request, Response, NextFunction } from 'express';
import { publicFeeSchedule } from '../config/price-book';
import { CREATOR_TIERS } from '../services/creator.service';
import { isGstRegistered } from '../services/invoice.service';

const router = Router();

/**
 * GET /api/fees
 *
 * Every fee ATHENA takes, with the figures the code charges and not a copy of them:
 * what it keeps of a mentoring session, a marketplace sale, a creator's gift (by
 * tier, with the follower count each tier starts at), and an automotive sale, job
 * or report; that card processing is not a second charge; and whether the prices
 * include GST yet. Public, because a woman deciding whether to offer her time or
 * her work reads this before she has an account, and because every figure here is
 * already printed in the Terms.
 *
 * The creator tiers are read from the same list the gift code pays from, so the
 * page cannot say 80 per cent while a gift pays 75.
 */
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = publicFeeSchedule(isGstRegistered());
    res.json({
      success: true,
      data: {
        ...schedule,
        creatorGifts: {
          ...schedule.creatorGifts,
          tiers: CREATOR_TIERS.map((tier) => ({
            name: tier.name,
            minFollowers: tier.minFollowers,
            creatorSharePercent: tier.revShare,
            platformSharePercent: 100 - tier.revShare,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
