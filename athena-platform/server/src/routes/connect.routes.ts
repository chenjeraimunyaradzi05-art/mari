/**
 * Stripe Connect Routes
 * API endpoints for multi-party payments and payouts
 * Phase 2: Backend Logic & Integrations
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { stripeConnectService } from '../services/stripe-connect.service';
import {
  GENERIC_SESSION_TYPES,
  assertMemberMayMoveHold,
  listBuyerHolds,
} from '../services/escrow-holds.service';
import {
  financialYearOf,
  getEarningsStatement,
  listEarningsTransactions,
  statementToCsv,
} from '../services/earnings-statement.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { creatorTermsRefusal, requireAdultAccount } from '../middleware/account-gates';
import { ApiError } from '../middleware/errorHandler';
import { payoutCeiling, startingAPayment } from '../middleware/moneyLimits';
import { zodBody } from '../middleware/validate';
import { clampLimit } from '../utils/pagination';
import { idempotencyWindow } from '../utils/idempotency';

const router = Router();

// A ceiling so a typo or a tampered request cannot ask Stripe to move an
// implausible sum. Well above any real ATHENA balance today; it exists to make
// a wrong number fail here rather than at the bank.
const MAX_PAYOUT_AMOUNT = 100_000;

// Both fields used to be cast and handed to the Stripe service as they came, so
// `type` could be any word and `businessType` any value Stripe would then
// refuse with its own message. Each is one of two things.
const connectedAccountBody = z.object({
  type: z.enum(['mentor', 'creator']).default('mentor'),
  businessType: z.enum(['individual', 'company']).optional(),
});

/**
 * @route POST /api/connect/account
 * @desc Create a connected account for a mentor/creator
 * @access Private (Mentor/Creator)
 *
 * Getting paid is for adults (Terms 2.1), and a creator is paid only once she has
 * accepted the Creator Terms Addendum (Terms 5.1). Both are checked here, where
 * the account that money lands in is made, and not only on the screens that lead
 * here. A creator with no profile yet is let through: accepting is part of turning
 * creator mode on, which is what makes her one.
 */
router.post('/account', authenticate, requireAdultAccount, zodBody(connectedAccountBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessType, type } = req.body as z.output<typeof connectedAccountBody>;

    if (type === 'creator') {
      const refusal = await creatorTermsRefusal(req.user!.id);
      if (refusal) return res.status(403).json(refusal);
    }

    const account = await stripeConnectService.createConnectedAccount({
      userId: req.user!.id,
      email: req.user!.email,
      country: 'AU', // Default to Australia
      type,
      businessType,
    });
    
    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/connect/account/onboarding
 * @desc Generate onboarding link for connected account
 * @access Private
 */
router.post('/account/onboarding', authenticate, requireAdultAccount, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const onboardingLink = await stripeConnectService.getOnboardingLink(req.user!.id);
    
    res.json({
      success: true,
      data: { url: onboardingLink },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/account
 * @desc Get connected account details
 * @access Private
 */
router.get('/account', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const account = await stripeConnectService.getAccountStatus(req.user!.id);
    
    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/connect/escrow
 * @desc Create a generic escrow payment: a hold no order, booking or session owns
 * @access Private
 *
 * This used to pass the body straight through. `sessionType` could name any
 * flow, so a hold made here looked to the rest of the platform like a mentor
 * session or a car sale that had no record behind it; and `metadata` was
 * spread into the Stripe intent, where the webhook reads `type`, `sessionId`
 * and `registrationId` as the truth about what was paid for — a member could
 * have paid a few dollars to an accomplice and had the webhook mark her own
 * mentor session or business registration as paid. The flows make their own
 * holds through their own routes; this one makes only the generic kinds, and
 * carries a free-text reference and nothing else.
 */
const MAX_ESCROW_AMOUNT_MINOR = 10_000_000; // A$100,000 in cents

// validated: recipientId, amount (a whole number of cents up to MAX_ESCROW_AMOUNT_MINOR), currency,
//   sessionType, description and reference are each checked by type, range or list before the
//   service is called.
router.post('/escrow', authenticate, startingAPayment, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId, amount, currency, description, sessionType, reference } = req.body ?? {};

    if (typeof recipientId !== 'string' || !recipientId.trim()) {
      throw new ApiError(400, 'Say who the payment is for');
    }
    if (recipientId === req.user!.id) {
      throw new ApiError(400, 'You cannot hold a payment to yourself');
    }
    // In the currency's smallest unit, as createEscrowPayment and Stripe take it.
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_ESCROW_AMOUNT_MINOR) {
      throw new ApiError(400, 'amount must be a whole number of cents greater than zero');
    }
    const chargeCurrency = currency === undefined ? 'aud' : typeof currency === 'string' ? currency.trim().toLowerCase() : '';
    if (!/^[a-z]{3}$/.test(chargeCurrency)) {
      throw new ApiError(400, 'That is not a currency code');
    }
    // Required rather than left to createEscrowPayment's default, which is
    // 'mentor_session': a generic hold that named no type was recorded as a
    // mentor session with no session behind it, so nothing could release it.
    if (typeof sessionType !== 'string' || !GENERIC_SESSION_TYPES.includes(sessionType)) {
      throw new ApiError(
        400,
        `Say what the payment is for: ${GENERIC_SESSION_TYPES.join(' or ')}. Mentor sessions, marketplace orders and car payments are paid from their own pages, not here.`
      );
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      throw new ApiError(400, 'description must be text of at most 500 characters');
    }
    if (reference !== undefined && (typeof reference !== 'string' || reference.length > 200)) {
      throw new ApiError(400, 'reference must be text of at most 200 characters');
    }

    const buyerId = req.user!.id;
    const escrowPayment = await stripeConnectService.createEscrowPayment({
      buyerId,
      sellerId: recipientId,
      amount,
      currency: chargeCurrency,
      description: description?.trim() || 'Payment',
      metadata: reference ? { reference } : undefined,
      sessionType: sessionType as 'course_purchase' | 'creator_content',
      // This route writes no row of its own to key from, so, as the payout
      // below does, it keys on the request itself inside a minute: the same
      // hold asked for twice by the same buyer in that time is a double-submit
      // and Stripe hands back the one intent, where it used to hold her card
      // twice.
      idempotencyKey: `connect-escrow-${buyerId}-${recipientId}-${sessionType}-${chargeCurrency}-${amount}-${idempotencyWindow()}`,
    });

    res.json({
      success: true,
      data: escrowPayment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/holds
 * @desc The holds on the caller's card as a buyer, and where each is released from
 * @access Private
 */
router.get('/holds', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const holds = await listBuyerHolds(req.user!.id);
    res.json({ success: true, data: holds });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/connect/escrow/:paymentId/capture
 * @desc Capture an escrow payment (release funds to recipient)
 * @access Private
 */
router.post('/escrow/:paymentId/capture', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const actor = { id: req.user!.id, role: req.user!.role };

    // A hold an order, booking or session owns is released from there, where
    // that flow checks its own state first. See escrow-holds.service.
    await assertMemberMayMoveHold(paymentId, actor, 'release');

    const result = await stripeConnectService.captureEscrowPayment(paymentId, actor);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/connect/escrow/:paymentId/cancel
 * @desc Cancel an escrow payment (refund to payer)
 * @access Private
 */
// validated: only reason is read, and only when it is text, cut to 500 characters; who may cancel
//   the hold is checked by assertMemberMayMoveHold.
router.post('/escrow/:paymentId/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body ?? {};
    const actor = { id: req.user!.id, role: req.user!.role };

    await assertMemberMayMoveHold(paymentId, actor, 'cancel');

    const result = await stripeConnectService.cancelEscrowPayment(
      paymentId,
      actor,
      typeof reason === 'string' ? reason.slice(0, 500) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/earnings
 * @desc Get earnings dashboard for connected account
 * @access Private (Mentor/Creator)
 *
 * The totals are over every row she has. A range of dates is what
 * GET /earnings/transactions is for, and a financial year is what
 * GET /earnings/statement is for.
 */
router.get('/earnings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const earnings = await stripeConnectService.getEarningsDashboard(req.user!.id);

    res.json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/earnings/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=&limit=
 * @desc Her escrow payments between two Queensland dates, newest first, a page at a time
 * @access Private
 */
router.get('/earnings/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
    // Clamped here and in the service (1 to 100): a limit that is not a number
    // is the usual page, as on every other list.
    const limit = clampLimit(req.query.limit, 50, 100);

    const page = await listEarningsTransactions(req.user!.id, {
      from: text(req.query.from),
      to: text(req.query.to),
      cursor: text(req.query.cursor),
      limit,
    });

    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/earnings/statement?fy=2026&format=csv
 * @desc Her earnings statement for an Australian financial year, as JSON or as a CSV file
 * @access Private
 */
router.get('/earnings/statement', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const fyParam = typeof req.query.fy === 'string' ? req.query.fy.trim() : '';
    if (fyParam && !/^\d{4}$/.test(fyParam)) {
      throw new ApiError(400, 'fy must be the year the financial year ends in, such as 2026');
    }
    const financialYear = fyParam ? Number(fyParam) : financialYearOf(new Date());

    const statement = await getEarningsStatement(req.user!.id, financialYear);

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="athena-earnings-FY${financialYear - 1}-${String(financialYear).slice(2)}.csv"`
      );
      // A statement is hers alone; nothing in between should keep a copy.
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(statementToCsv(statement));
      return;
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data: statement });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/connect/payout-methods
 * @desc List the connected account's payout destinations
 * @access Private (Mentor/Creator)
 */
router.get('/payout-methods', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const methods = await stripeConnectService.listPayoutMethods(req.user!.id);

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/connect/payout-methods/:methodId/default
 * @desc Make one payout method the default for its currency
 * @access Private (Mentor/Creator)
 *
 * Declared above '/payout' only for readability — the paths do not overlap.
 */
router.post(
  '/payout-methods/:methodId/default',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const method = await stripeConnectService.setDefaultPayoutMethod(
        req.user!.id,
        req.params.methodId
      );

      res.json({
        success: true,
        data: method,
        message: 'Default payout method updated',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/connect/payout
 * @desc Request a payout to bank account
 * @access Private (Mentor/Creator)
 */
// validated: amount must be a finite number above zero and at most MAX_PAYOUT_AMOUNT, currency a
//   three-letter code; the destination account comes from the session, never the body.
router.post('/payout', authenticate, requireAdultAccount, payoutCeiling, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency } = req.body;

    // `if (!amount)` was the whole of the old check, so "1e9", "-50" and
    // "abc" all got through to Stripe as an amount to move.
    const requested = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new ApiError(400, 'Enter an amount greater than zero');
    }
    if (requested > MAX_PAYOUT_AMOUNT) {
      throw new ApiError(400, `Payouts are limited to ${MAX_PAYOUT_AMOUNT} at a time`);
    }
    // Rounded rather than rejected on a third decimal, because a UI that
    // produced 10.005 from a percentage split should not hand a member an
    // error she cannot act on.
    const payoutAmount = Math.round(requested * 100) / 100;

    // Required, not defaulted. A missing currency used to become AUD, so a
    // member whose balance was held in NZD was sent an AUD payout she did not
    // ask for and did not hold. The earnings screen sends the currency it shows
    // her balance in; a request that names none is refused before anything
    // reaches Stripe, rather than guessed at.
    const payoutCurrency = typeof currency === 'string' ? currency.trim().toLowerCase() : '';
    if (!payoutCurrency) {
      throw new ApiError(400, 'Say which currency to withdraw');
    }
    if (!/^[a-z]{3}$/.test(payoutCurrency)) {
      throw new ApiError(400, 'That is not a currency code');
    }

    // The destination is resolved from the session, never from the request.
    // Taking it from the body let any authenticated user name someone else's
    // connected account and move money out of it.
    //
    // And only an account Stripe has verified and switched on for payouts: one
    // that has not finished its checks, or that Stripe has since paused, is turned
    // away here with what to do about it, before Stripe is asked, instead of
    // being refused there and reported as "Failed to create payout".
    const connectedAccountId = await stripeConnectService.requirePayableAccountId(
      req.user!.id
    );

    // This route writes no row of its own, so there is no id to key the call
    // from the way the creator payout keys from its CreatorPayout row. The
    // next best stable thing is the request itself inside a short window: two
    // identical payouts from the same member in the same minute are a
    // double-submit, not two intentions, and Stripe collapses them. A member
    // who genuinely wants to withdraw the same amount twice can do so a minute
    // later. Without any key, a double-tap on a slow connection sent two real
    // payouts out of her balance.
    const window = Math.floor(Date.now() / 60_000);
    const idempotencyKey = `connect-payout-${req.user!.id}-${payoutCurrency}-${payoutAmount}-${window}`;

    const payout = await stripeConnectService.createPayout({
      connectedAccountId,
      amount: payoutAmount,
      currency: payoutCurrency,
      idempotencyKey,
    });
    
    res.json({
      success: true,
      data: payout,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
