/**
 * Invoice Routes
 * API endpoints for invoice generation and management
 * Phase 2: Backend Logic & Integrations
 */

import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { invoiceService } from '../services/invoice.service';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

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
 * @desc Generate invoice for a payment
 * @access Private (Admin)
 */
router.post('/payment/:paymentId', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { sendEmail } = req.body;
    
    const result = await invoiceService.createInvoiceForPayment(paymentId, {
      sendEmail: sendEmail || false,
    });
    
    res.json({
      success: true,
      data: {
        invoiceId: result.invoiceId,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
