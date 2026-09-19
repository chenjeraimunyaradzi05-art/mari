/**
 * Invoice Routes
 * API endpoints for invoice generation and management
 * Phase 2: Backend Logic & Integrations
 *
 * Who issues an invoice
 * ---------------------
 * Nothing on this router issues one in the ordinary course of business. The
 * Stripe webhook does (routes/webhook.routes.ts): `invoice.paid` files an
 * invoice for each paid membership period through
 * invoiceService.createInvoiceForSubscription, with the amount Stripe took,
 * and `payment_intent.succeeded` files one through createInvoiceForPayment
 * when a Payment row carries that intent. Both are idempotent (per Stripe
 * invoice, per paymentId), so a retried event cannot file two.
 *
 * The two POST routes below are the staff re-issue for when the webhook was
 * down or a member asks for her invoice again: the same idempotent calls,
 * reached from the admin subscriptions page. They return the invoice that
 * already exists rather than a second number.
 *
 * What the PDF is, and is not, as an ATO tax invoice
 * ----------------------------------------------------
 * invoiceService.generateInvoicePDF renders: the seller's name, address lines
 * and email; a "Tax ID" line only when the seller record carries one (it does
 * not yet); the invoice number, issue date and due date; the buyer's name and
 * email; each line's description, quantity, unit price and amount; subtotal,
 * a tax line and the total; the payment date and method when paid.
 *
 * For a sale under A$1,000 the ATO requires: the words "Tax invoice", the
 * seller's identity and ABN, the issue date, a brief description with
 * quantity and price, the GST amount or a statement that the total includes
 * GST, and the extent to which each sale is taxable. From A$1,000 up, the
 * buyer's identity or ABN as well (the buyer name and email are already on
 * the page). So three things are missing before these can be called tax
 * invoices: the title (the PDF says "INVOICE"), the ABN (ATHENA_BILLING and
 * the service's ATHENA_INFO carry no taxId), and the GST figure (taxTotal is
 * hardcoded to 0; no invoicer computes the 1/11th). The ATHENA_BILLING
 * address below is a placeholder for the same reason. None of that is
 * invented here; the PDF says exactly what it knows.
 */

import { Router } from 'express';
import type Stripe from 'stripe';
import { AuthRequest } from '../middleware/auth';
import { invoiceService } from '../services/invoice.service';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { getStripe } from '../utils/stripe';

const router = Router();

// Route ids are uuids from our own tables; anything else is refused before a
// query runs.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ApiError(400, `${label} is not a valid id`);
  }
  return value;
}

const ATHENA_BILLING = {
  name: 'ATHENA Platform Pty Ltd',
  address: [
    'Australia',
    'Final billing address to be published before production invoicing is enabled',
  ],
  email: 'billing@athena.app',
};

const PAYMENT_DESCRIPTIONS: Record<string, string> = {
  SUBSCRIPTION: 'Athena Subscription',
  MENTOR_SESSION: 'Mentorship Session',
  COURSE: 'Course Purchase',
  FORMATION: 'Business Formation Service',
  JOB_BOOST: 'Job Posting Boost',
};

/**
 * Re-render a stored invoice.
 *
 * A download renders the invoice that was already issued rather than asking the
 * service to issue one: generating afresh would file a second Invoice row, and
 * a second invoice number, every time somebody clicked download.
 */
async function renderStoredInvoice(invoice: any): Promise<Buffer> {
  const payment = invoice.paymentId
    ? await prisma.payment.findUnique({ where: { id: invoice.paymentId } })
    : null;

  const amount = Number(invoice.amount);
  const issuedAt = invoice.issuedAt ?? invoice.createdAt;

  const description = invoice.subscription
    ? `Athena ${invoice.subscription.tier} Subscription`
    : (payment?.type && PAYMENT_DESCRIPTIONS[payment.type]) || 'Athena Platform Service';

  return invoiceService.generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: issuedAt,
    dueDate: invoice.dueAt ?? issuedAt,
    status: invoice.status,

    seller: ATHENA_BILLING,

    buyer: {
      name: invoice.user?.displayName || 'Customer',
      email: invoice.user?.email || '',
    },

    items: [
      {
        description,
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ],

    subtotal: amount,
    taxTotal: 0,
    total: amount,
    currency: invoice.currency,

    paymentMethod: payment?.method ?? undefined,
    paymentDate: invoice.paidAt ?? undefined,
    transactionId: payment?.stripePaymentIntentId ?? undefined,
  });
}

/**
 * @route GET /api/invoices
 * @desc Get user's invoices
 * @access Private
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const invoices = await invoiceService.getUserInvoices(req.user!.id);
    
    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/invoices/:invoiceId
 * @desc Get invoice details
 * @access Private
 */
router.get('/:invoiceId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await invoiceService.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }
    
    // Check ownership
    if (invoice.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized to view this invoice');
    }
    
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/invoices/:invoiceId/pdf
 * @desc Download invoice PDF
 * @access Private
 */
router.get('/:invoiceId/pdf', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await invoiceService.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }
    
    // Check ownership
    if (invoice.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized to download this invoice');
    }
    
    const pdf = await renderStoredInvoice(invoice);

    // Set security headers - prevent caching of sensitive financial data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/invoices/payment/:paymentId
 * @desc Issue (or re-issue) the invoice for a Payment row. Idempotent: a
 *       payment that already has an invoice gets that invoice back, with
 *       alreadyIssued true, never a second number.
 * @access Private (Admin)
 */
router.post('/payment/:paymentId', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const paymentId = assertId(req.params.paymentId, 'paymentId');
    const sendEmail = req.body?.sendEmail === true;

    const result = await invoiceService.createInvoiceForPayment(paymentId, { sendEmail });

    res.json({
      success: true,
      data: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        alreadyIssued: !result.created,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/invoices/subscription/:subscriptionId
 * @desc Issue (or re-issue) the invoice for a membership's latest paid
 *       period, from what Stripe says was paid. A membership staff granted
 *       has no Stripe subscription and nothing was paid, so there is nothing
 *       to invoice: 409, said plainly. Idempotent per Stripe invoice.
 * @access Private (Admin)
 */
router.post('/subscription/:subscriptionId', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const subscriptionId = assertId(req.params.subscriptionId, 'subscriptionId');

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, stripeSubscriptionId: true },
    });
    if (!subscription) {
      throw new ApiError(404, 'Subscription not found');
    }
    if (!subscription.stripeSubscriptionId) {
      throw new ApiError(409, 'This membership was granted by staff; nothing was paid, so there is no invoice to issue.');
    }

    const paidInvoices = await getStripe().invoices.list({
      subscription: subscription.stripeSubscriptionId,
      status: 'paid',
      limit: 1,
    });
    const latest: Stripe.Invoice | undefined = paidInvoices?.data?.[0];
    const charge = latest ? invoiceService.paidChargeFromStripeInvoice(latest) : null;
    if (!charge) {
      throw new ApiError(409, 'Stripe has no paid invoice for this membership yet, so there is nothing to issue.');
    }

    const result = await invoiceService.createInvoiceForSubscription(subscription.id, charge);

    res.json({
      success: true,
      data: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        alreadyIssued: !result.created,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
