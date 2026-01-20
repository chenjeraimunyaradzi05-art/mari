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
    
    const result = await stripeConnectService.captureEscrowPayment(paymentId);
    
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
    
    const result = await stripeConnectService.cancelEscrowPayment(paymentId, reason);
    
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
 * @route POST /api/connect/payout
 * @desc Request a payout to bank account
 * @access Private (Mentor/Creator)
 */
router.post('/payout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency, connectedAccountId } = req.body;
    
    if (!amount) {
      throw new ApiError(400, 'amount is required');
    }
    if (!connectedAccountId) {
      throw new ApiError(400, 'connectedAccountId is required');
    }
    
    const payout = await stripeConnectService.createPayout({
      connectedAccountId,
      amount,
      currency: currency || 'aud',
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
