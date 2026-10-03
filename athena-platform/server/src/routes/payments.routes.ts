/**
 * Payments Routes
 * Multi-provider payment orchestration, creator payouts, regional pricing
 * 
 * Uses the available functions from payments-orchestration.service.ts:
 * - getBestProvider
 * - getAvailablePaymentMethods
 * - processCreatorPayout
 * - convertCurrency
 * - getRegionalPricing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuditAction } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import { payoutCeiling } from '../middleware/moneyLimits';
import { zodBody, zodParams } from '../middleware/validate';
import { audMoney, optionalText, text, uuid } from '../utils/schemas';
import { clampLimit } from '../utils/pagination';
import paymentsService, { Currency } from '../services/payments-orchestration.service';
import { getLastReconciliationReport, reconcileAndRecord } from '../services/stripe-reconciliation.service';
import { listHeldEscrowForAdmin } from '../services/escrow-holds.service';
import { listDisputesForAdmin, releaseDisputeHolds } from '../services/payment-disputes.service';
import { auditAfterCommit, recordAdminAction } from '../services/admin-audit.service';
import { listServiceDisputes, resolveServiceDispute } from '../services/service-disputes.service';
import { logger } from '../utils/logger';

const router = Router();

// Supported currencies for validation (must match Currency type in service)
const SUPPORTED_CURRENCIES: Currency[] = [
  'AUD', 'NZD', 'USD', 'GBP', 'EUR', 'SGD', 'PHP', 'INR', 'BRL', 'KES'
];

const currencyCode = z.enum(SUPPORTED_CURRENCIES as [Currency, ...Currency[]], {
  errorMap: () => ({ message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` }),
});

// `if (!amount)` was all this route checked, so "-50", "1e9" and "abc" reached
// the service as amounts. An amount is a positive number of dollars to the cent.
const payoutBody = z.object({
  amount: audMoney(),
  currency: currencyCode,
  destinationType: z.enum(['bank', 'wallet', 'mobile_money'], {
    errorMap: () => ({ message: 'Invalid destinationType. Must be: bank, wallet, mobile_money' }),
  }),
  destinationId: text(200),
});

const convertBody = z.object({
  amount: audMoney(10_000_000),
  from: currencyCode,
  to: currencyCode,
});

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

// There is no POST /api/payments/process. It was a generic "charge this" door
// for any signed-in member: she named the amount, the currency, the description
// and a free `metadata` object, and the route handed all of it to
// stripe.paymentIntents.create. The Stripe webhook then reads metadata as the
// truth about what was bought, so a member could pay A$1 with metadata saying
// she had bought a million gift points, or that she had paid for somebody
// else's mentor session, or that an accelerator place that costs hundreds had
// been paid for in full, and be credited for it. Nothing in the web app or the
// mobile app ever called it.
//
// Every real charge is created by the service that owns the sale (gift
// balance, mentor session, formation, accelerator, escrow, membership checkout),
// which prices it on the server and writes the metadata itself. A member never
// supplies either. If a generic charge is ever wanted, build it the way
// POST /api/connect/escrow is built: an allow-list of kinds, metadata written
// on the server, and the caller limited to a free-text reference.

/**
 * @route POST /api/payments/payout
 * @desc Process a creator payout
 * @access Private (Creator only)
 */
router.post('/payout', authenticate, requireRole('CREATOR'), payoutCeiling, zodBody(payoutBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const {
      amount,
      currency,
      destinationType,
      destinationId,
    } = req.body as z.output<typeof payoutBody>;

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
router.post('/convert', authenticate, zodBody(convertBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, from, to } = req.body as z.output<typeof convertBody>;

    const result = paymentsService.convertCurrency(amount, from, to);

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
    // Clamped here and again in the service (1 to 200). A limit that is not a
    // number used to be refused; it is now the usual page, as on every list.
    const limit = clampLimit(req.query.limit, 50, 200);

    const page = await listHeldEscrowForAdmin({ cursor, limit });
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/admin/disputes?outcome=&cursor=&limit=
 * @desc Card disputes (chargebacks), newest first, with what was done about each
 * @access Admin
 *
 * `outcome` is OPEN, WON, LOST or CLOSED; without it every dispute is listed.
 * Each row carries Stripe's evidence deadline, whether the money has left ATHENA's
 * balance, what a lost dispute did (in words), and how many creators' withdrawals
 * it is still holding. The notices the admins receive link here.
 */
router.get('/admin/disputes', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;
    const outcome = typeof req.query.outcome === 'string' ? req.query.outcome.toUpperCase() : undefined;
    const limit = clampLimit(req.query.limit, 50, 200);

    const page = await listDisputesForAdmin({ outcome, cursor, limit });
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/admin/disputes/:id/release-holds
 * @desc End the pause on withdrawals that a decided dispute put on creators
 * @access Admin
 *
 * A dispute that is won or closed releases its own pause. A lost one does not,
 * because what happens to a creator's balance after one is a decision; this is
 * where that decision is recorded. A creator that another dispute still holds
 * stays paused, and a dispute still open is left alone. Who did it is written to
 * the audit log.
 */
router.post('/admin/disputes/:id/release-holds', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw new ApiError(400, 'That is not a valid dispute id');
    }

    const released = await releaseDisputeHolds(id);
    if (released === null) {
      throw new ApiError(404, 'Dispute not found');
    }

    const authReq = req as AuthRequest;
    await auditAfterCommit({
      action: AuditAction.ADMIN_CONFIG_UPDATE,
      actorUserId: authReq.user?.id ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') || null,
      metadata: {
        adminAction: 'PAYMENT_DISPUTE_HOLDS_RELEASED',
        resourceType: 'PaymentDispute',
        resourceId: id,
        released,
      },
    });

    res.json({ success: true, data: { released } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments/admin/service-disputes
 * @desc Mentoring sessions and marketplace orders a buyer says were not delivered, oldest first
 * @access Admin
 *
 * Each row carries what the buyer said, what the provider answered, the figures,
 * and whether the money is still held and until when. A card hold lasts about a
 * week, so the one that has waited longest is first: after its date there is
 * nothing left to release, and the dispute can only be closed. Hourly bookings in
 * dispute are on their own list (GET /api/skills-marketplace/admin/bookings/disputed).
 */
router.get('/admin/service-disputes', authenticate, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const disputes = await listServiceDisputes();
    res.json({ success: true, data: { disputes } });
  } catch (error) {
    next(error);
  }
});

const serviceDisputeParams = z.object({ kind: z.enum(['session', 'order']), id: uuid });
const serviceDisputeDecision = z.object({
  outcome: z.enum(['release', 'refund'], { errorMap: () => ({ message: 'must be release or refund' }) }),
  note: optionalText(2000).optional(),
});

/**
 * @route POST /api/payments/admin/service-disputes/:kind/:id/resolve
 * @desc Decide a session or an order in dispute: release the payment to the provider, or give it back to the buyer
 * @access Admin
 *
 * Staff only, with the second factor. The two people it is between cannot decide
 * it themselves. Both are told, and who decided is written to the audit log.
 * A payment the buyer's bank is also disputing is never refunded from here.
 */
router.post(
  '/admin/service-disputes/:kind/:id/resolve',
  authenticate,
  requireRole('ADMIN'),
  zodParams(serviceDisputeParams),
  zodBody(serviceDisputeDecision),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) throw new ApiError(401, 'Sign in to continue');
      const { kind, id } = req.params as z.output<typeof serviceDisputeParams>;
      const { outcome, note } = req.body as z.output<typeof serviceDisputeDecision>;

      const decision = await resolveServiceDispute(kind, id, { id: authReq.user.id }, outcome, note ?? null);

      await recordAdminAction(authReq, kind === 'session' ? 'MENTOR_SESSION_DISPUTE_RESOLVED' : 'SERVICE_ORDER_DISPUTE_RESOLVED', {
        resourceType: kind === 'session' ? 'MentorSession' : 'ServiceOrder',
        resourceId: id,
        targetUserId: decision.buyerId,
        providerId: decision.providerId,
        outcome: outcome === 'release' ? 'released_to_provider' : 'returned_to_buyer',
        amount: decision.amount,
        currency: decision.currency,
      });

      res.json({ success: true, data: decision });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
