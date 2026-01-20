"use strict";
/**
 * Invoice Routes
 * API endpoints for invoice generation and management
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoice_service_1 = require("../services/invoice.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
/**
 * @route GET /api/invoices
 * @desc Get user's invoices
 * @access Private
 */
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const invoices = await invoice_service_1.invoiceService.getUserInvoices(req.user.id);
        res.json({
            success: true,
            data: invoices,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/invoices/:invoiceId
 * @desc Get invoice details
 * @access Private
 */
router.get('/:invoiceId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await invoice_service_1.invoiceService.getInvoice(invoiceId);
        if (!invoice) {
            throw new errorHandler_1.ApiError(404, 'Invoice not found');
        }
        // Check ownership
        if (invoice.userId !== req.user.id && !req.user.isAdmin) {
            throw new errorHandler_1.ApiError(403, 'Not authorized to view this invoice');
        }
        res.json({
            success: true,
            data: invoice,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/invoices/:invoiceId/pdf
 * @desc Download invoice PDF
 * @access Private
 */
router.get('/:invoiceId/pdf', auth_1.authenticate, async (req, res, next) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await invoice_service_1.invoiceService.getInvoice(invoiceId);
        if (!invoice) {
            throw new errorHandler_1.ApiError(404, 'Invoice not found');
        }
        // Check ownership
        if (invoice.userId !== req.user.id && !req.user.isAdmin) {
            throw new errorHandler_1.ApiError(403, 'Not authorized to download this invoice');
        }
        // Generate PDF on the fly (or retrieve from storage)
        const { pdf } = await invoice_service_1.invoiceService.createInvoiceForPayment(invoice.paymentId, { sendEmail: false });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
        res.send(pdf);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/invoices/payment/:paymentId
 * @desc Generate invoice for a payment
 * @access Private (Admin)
 */
router.post('/payment/:paymentId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const { sendEmail } = req.body;
        const result = await invoice_service_1.invoiceService.createInvoiceForPayment(paymentId, {
            sendEmail: sendEmail || false,
        });
        res.json({
            success: true,
            data: {
                invoiceId: result.invoiceId,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=invoice.routes.js.map