/**
 * Payments Routes
 * Multi-provider payment orchestration, creator payouts, regional pricing
 * 
 * Uses the available functions from payments-orchestration.service.ts:
 * - getBestProvider
 * - getAvailablePaymentMethods
 * - processPayment
 * - processCreatorPayout
 * - convertCurrency
 * - getRegionalPricing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuditAction } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { ApiError } from '../middleware/errorHandler';
import paymentsService, { Currency } from '../services/payments-orchestration.service';
import { getLastReconciliationReport, reconcileAndRecord } from '../services/stripe-reconciliation.service';
import { listHeldEscrowForAdmin } from '../services/escrow-holds.service';
import { auditAfterCommit } from '../services/admin-audit.service';
import { logger } from '../utils/logger';

const router = Router();

// Supported currencies for validation (must match Currency type in service)
const SUPPORTED_CURRENCIES: Currency[] = [
  'AUD', 'NZD', 'USD', 'GBP', 'EUR', 'SGD', 'PHP', 'INR', 'BRL', 'KES'
];

/**
 * Where a caller is assumed to be when it does not say.
 *
 * Every route here defaulted to 'US'. ATHENA is a Queensland platform and the
 * overwhelming majority of the women using it are in Australia, so the default
 * was quietly pricing and routing the typical member as an American.
 */
const DEFAULT_REGION = 'AU';

/**
 * @route GET /api/payments/methods
 * @desc Get available payment methods for user's region
 * @access Private
 */
router.get('/methods', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { region } = req.query;
    const regionCode = (region as string) || DEFAULT_REGION;

    const methods = paymentsService.getAvailablePaymentMethods(regionCode);
    res.json({ methods });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/best-provider
 * @desc Get the best payment provider for a region
 * @access Private
 */
router.get('/best-provider', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { region, paymentType } = req.query;
    const regionCode = (region as string) || DEFAULT_REGION;

    // Only a provider that can take the money is named, the same filter
    // /methods applies, and null when nothing can in this environment. This
    // used to answer 'gcash', 'mpesa', 'pix' or 'upi' — none of them built.
    const provider = paymentsService.getBestProvider(
      regionCode,
      paymentType as 'card' | 'wallet' | 'mobile_money' | undefined
    );

    res.json({ provider });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/pricing
 * @desc Get regional pricing for products
 * @access Public
 */
router.get('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { region } = req.query;
    const regionCode = (region as string) || DEFAULT_REGION;

    // Read from the Stripe prices checkout charges, not from a table of its
    // own; see getRegionalPricing for what is left out and why.
    const pricing = await paymentsService.getRegionalPricing(regionCode);
    res.json(pricing);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/process
 * @desc Process a payment
 * @access Private
 */
router.post('/process', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { 
      amount, 
      currency, 
      description,
      paymentMethodId,
      returnUrl,
      metadata 
    } = req.body;

    if (!amount || !currency || !description) {
      return res.status(400).json({ 
        error: 'Amount, currency, and description are required' 
      });
    }

    // Validate currency
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    const result = await paymentsService.processPayment({
      userId,
      amount,
      currency,
      description,
      paymentMethodId,
      returnUrl,
      metadata,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/payout
 * @desc Process a creator payout
 * @access Private (Creator only)
 */
router.post('/payout', authenticate, requireRole('CREATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { 
      amount, 
      currency, 
      destinationType,
      destinationId,
    } = req.body;

    if (!amount || !currency || !destinationType || !destinationId) {
      return res.status(400).json({ 
        error: 'Amount, currency, destinationType, and destinationId are required' 
      });
    }

    // Validate currency
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    // Validate destination type
    const validDestTypes = ['bank', 'wallet', 'mobile_money'] as const;
    if (!validDestTypes.includes(destinationType)) {
      return res.status(400).json({
        error: `Invalid destinationType. Must be: ${validDestTypes.join(', ')}`
      });
    }

    const result = await paymentsService.processCreatorPayout({
      userId,
      amount,
      currency,
      destinationType,
      destinationId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/convert
 * @desc Convert currency. A pair ATHENA holds no rate for comes back 422 from
 *       convertCurrency rather than being quoted at parity, which is what it
 *       used to do: A$100 to PHP returned 99 pesos. GET /currencies lists the
 *       pairs that can be quoted, so a caller can ask before it offers.
 * @access Private
 */
router.post('/convert', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, from, to } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({ 
        error: 'Amount, from currency, and to currency are required' 
      });
    }

    // Validate currencies
    if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
      return res.status(400).json({
        error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
      });
    }

    const result = paymentsService.convertCurrency(
      amount,
      from as Currency,
      to as Currency
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/currencies
 * @desc Get list of supported currencies, and the pairs /convert can quote
 * @access Public
 */
router.get('/currencies', async (_req: Request, res: Response) => {
  res.json({
    currencies: SUPPORTED_CURRENCIES,
    // A currency ATHENA can price in is not necessarily one it can convert to
    // or from. Both lists go out so nothing has to guess at the difference.
    conversions: paymentsService.supportedConversions(),
  });
});

// ---------------------------------------------------------------------------
// Payment operations, for ATHENA's team
// ---------------------------------------------------------------------------

/**
 * @route GET /api/payments/reconciliation
 * @desc The most recent comparison of ATHENA's payment records against Stripe
 * @access Admin
 *
 * Nothing compared the two before stripe-reconciliation.service existed. The
 * report lists what it repaired and, first, what needs a person, with the ids
 * to find each one by in Stripe and in the database.
 */
router.get('/reconciliation', authenticate, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getLastReconciliationReport();
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/reconciliation/run
 * @desc Compare against Stripe now rather than at the next scheduled run
 * @access Admin
 *
 * Every Stripe call it makes is a read, but it does move rows that were behind
 * Stripe and it files invoices a payment never got, so who asked for it is
 * written to the audit log.
 */
router.post('/reconciliation/run', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reconcileAndRecord();
    if (!report) {
      throw new ApiError(409, 'A reconciliation is already running. Its report will be here when it finishes.');
    }

    const authReq = req as AuthRequest;
    // Filed in the shape recordAdminAction writes, under the configuration
    // action that platform-operations verbs are filed under.
    await auditAfterCommit({
      action: AuditAction.ADMIN_CONFIG_UPDATE,
      actorUserId: authReq.user?.id ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') || null,
      metadata: {
        adminAction: 'PAYMENT_RECONCILIATION_RUN',
        resourceType: 'StripeReconciliation',
        repaired: report.repaired,
        needsAttention: report.needsAttention,
        skipped: report.skipped ?? null,
      },
    });

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/holds?cursor=&limit=
 * @desc Every escrow hold still held, oldest first, with who owns it and when it lapses
 * @access Admin
 *
 * The expiry sweep tells the admins that holds are close to lapsing and asks
 * them to release or cancel each one. This is the list to do that from: the
 * hold's own flow page for most, and POST /api/connect/escrow/:paymentIntentId/
 * capture or /cancel, which admins may use on any hold, for the rest.
 */
router.get('/holds', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === 'string' && req.query.limit ? Number(req.query.limit) : undefined;
    if (limit !== undefined && !Number.isFinite(limit)) {
      throw new ApiError(400, 'limit must be a number');
    }

    const page = await listHeldEscrowForAdmin({ cursor, limit });
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
});

export default router;
