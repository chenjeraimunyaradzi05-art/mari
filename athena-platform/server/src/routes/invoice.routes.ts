/**
 * Invoice Routes
 * API endpoints for invoice generation and management
 * Phase 2: Backend Logic & Integrations
 */

import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { invoiceService } from '../services/invoice.service';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

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
    
    // Generate PDF on the fly (or retrieve from storage)
    const { pdf } = await invoiceService.createInvoiceForPayment(
      invoice.paymentId,
      { sendEmail: false }
    );
    
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
router.post('/payment/:paymentId', authenticate, async (req, res, next) => {
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
