/**
 * Stripe Connect Routes
 * API endpoints for multi-party payments and payouts
 * Phase 2: Backend Logic & Integrations
 */

import { Router, Response, NextFunction } from 'express';
import { stripeConnectService } from '../services/stripe-connect.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireSubscription } from '../middleware/subscription';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// A ceiling so a typo or a tampered request cannot ask Stripe to move an
// implausible sum. Well above any real ATHENA balance today; it exists to make
// a wrong number fail here rather than at the bank.
const MAX_PAYOUT_AMOUNT = 100_000;

/**
 * @route POST /api/connect/account
 * @desc Create a connected account for a mentor/creator
 * @access Private (Mentor/Creator)
 */
router.post('/account', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { businessType, type = 'mentor' } = req.body;
    
    const account = await stripeConnectService.createConnectedAccount({
      userId: req.user!.id,
      email: req.user!.email,
      country: 'AU', // Default to Australia
      type: type as 'mentor' | 'creator',
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
router.post('/account/onboarding', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
 * @desc Create an escrow payment (mentor session, course, etc.)
 * @access Private
 */
router.post('/escrow', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientId, amount, currency, metadata, description, sessionType } = req.body;
    
    if (!recipientId || !amount) {
      throw new ApiError(400, 'recipientId and amount are required');
    }
    
    const escrowPayment = await stripeConnectService.createEscrowPayment({
      buyerId: req.user!.id,
      sellerId: recipientId,
      amount,
      currency: currency || 'aud',
      description: description || 'Payment',
      metadata,
      sessionType,
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
 * @route POST /api/connect/escrow/:paymentId/capture
 * @desc Capture an escrow payment (release funds to recipient)
 * @access Private
 */
router.post('/escrow/:paymentId/capture', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;

    const result = await stripeConnectService.captureEscrowPayment(paymentId, {
      id: req.user!.id,
      role: req.user!.role,
    });
    
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
router.post('/escrow/:paymentId/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const result = await stripeConnectService.cancelEscrowPayment(
      paymentId,
      { id: req.user!.id, role: req.user!.role },
      reason
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
 */
router.get('/earnings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Note: startDate and endDate are currently not used by the service
    // const { startDate, endDate } = req.query;
    
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
router.post('/payout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    const payoutCurrency = (typeof currency === 'string' && currency.trim() ? currency : 'aud').toLowerCase();

    // The destination is resolved from the session, never from the request.
    // Taking it from the body let any authenticated user name someone else's
    // connected account and move money out of it.
    const connectedAccountId = await stripeConnectService.requireConnectedAccountId(
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
