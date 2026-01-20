"use strict";
/**
 * Invoice PDF Generation Service
 * Generates professional PDF invoices for payments
 * Phase 2: Backend Logic & Integrations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceService = void 0;
exports.generateInvoicePDF = generateInvoicePDF;
exports.createInvoiceForPayment = createInvoiceForPayment;
exports.createInvoiceForSubscription = createInvoiceForSubscription;
exports.getInvoice = getInvoice;
exports.getUserInvoices = getUserInvoices;
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ==========================================
// CONSTANTS
// ==========================================
const ATHENA_INFO = {
    name: 'Athena Platform Inc.',
    address: [
        '123 Innovation Drive',
        'Suite 500',
        'San Francisco, CA 94105',
        'United States',
    ],
    email: 'billing@athena.app',
    phone: '+1 (555) 123-4567',
    taxId: 'US12-3456789',
};
const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    SAR: '﷼',
    AUD: 'A$',
    SGD: 'S$',
    PHP: '₱',
    ZAR: 'R',
    INR: '₹',
    EGP: 'E£',
    MXN: 'MX$',
};
// ==========================================
// PDF GENERATION
// ==========================================
/**
 * Generate a PDF invoice
 */
async function generateInvoicePDF(invoiceData, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `Invoice ${invoiceData.invoiceNumber}`,
                    Author: 'Athena Platform',
                    Subject: `Invoice for ${invoiceData.buyer.name}`,
                },
            });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                // Optionally write to file
                if (outputPath) {
                    const dir = path_1.default.dirname(outputPath);
                    if (!fs_1.default.existsSync(dir)) {
                        fs_1.default.mkdirSync(dir, { recursive: true });
                    }
                    fs_1.default.writeFileSync(outputPath, pdfBuffer);
                }
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            // Generate content
            generateHeader(doc, invoiceData);
            generateBillingInfo(doc, invoiceData);
            generateItemsTable(doc, invoiceData);
            generateTotals(doc, invoiceData);
            generatePaymentInfo(doc, invoiceData);
            generateFooter(doc, invoiceData);
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
function generateHeader(doc, invoice) {
    // Logo placeholder (would load actual logo in production)
    doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#4F46E5')
        .text('ATHENA', 50, 50);
    // Invoice title
    doc
        .fontSize(20)
        .fillColor('#111827')
        .text('INVOICE', 0, 50, { align: 'right' });
    // Invoice details
    doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Invoice #: ${invoice.invoiceNumber}`, 0, 80, { align: 'right' })
        .text(`Date: ${formatDate(invoice.invoiceDate)}`, 0, 95, { align: 'right' })
        .text(`Due: ${formatDate(invoice.dueDate)}`, 0, 110, { align: 'right' });
    // Status badge
    const statusColors = {
        DRAFT: '#9CA3AF',
        SENT: '#3B82F6',
        PAID: '#10B981',
        OVERDUE: '#EF4444',
        CANCELLED: '#6B7280',
    };
    doc
        .roundedRect(470, 130, 80, 20, 3)
        .fill(statusColors[invoice.status] || '#6B7280');
    doc
        .fontSize(9)
        .fillColor('#FFFFFF')
        .text(invoice.status, 470, 136, { width: 80, align: 'center' });
    // Horizontal line
    doc
        .moveTo(50, 170)
        .lineTo(545, 170)
        .stroke('#E5E7EB');
}
function generateBillingInfo(doc, invoice) {
    const startY = 190;
    // From (Seller)
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#6B7280')
        .text('FROM', 50, startY);
    doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(invoice.seller.name, 50, startY + 18);
    doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280');
    let yPos = startY + 35;
    for (const line of invoice.seller.address) {
        doc.text(line, 50, yPos);
        yPos += 13;
    }
    if (invoice.seller.email) {
        doc.text(`Email: ${invoice.seller.email}`, 50, yPos);
        yPos += 13;
    }
    if (invoice.seller.taxId) {
        doc.text(`Tax ID: ${invoice.seller.taxId}`, 50, yPos);
    }
    // To (Buyer)
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#6B7280')
        .text('BILL TO', 320, startY);
    doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(invoice.buyer.name, 320, startY + 18);
    doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280');
    yPos = startY + 35;
    if (invoice.buyer.address) {
        for (const line of invoice.buyer.address) {
            doc.text(line, 320, yPos);
            yPos += 13;
        }
    }
    doc.text(`Email: ${invoice.buyer.email}`, 320, yPos);
    yPos += 13;
    if (invoice.buyer.taxId) {
        doc.text(`Tax ID: ${invoice.buyer.taxId}`, 320, yPos);
    }
}
function generateItemsTable(doc, invoice) {
    const tableTop = 330;
    const currencySymbol = CURRENCY_SYMBOLS[invoice.currency] || invoice.currency;
    // Table header background
    doc
        .rect(50, tableTop, 495, 25)
        .fill('#F3F4F6');
    // Table headers
    doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('DESCRIPTION', 60, tableTop + 8)
        .text('QTY', 330, tableTop + 8, { width: 40, align: 'center' })
        .text('PRICE', 380, tableTop + 8, { width: 70, align: 'right' })
        .text('AMOUNT', 460, tableTop + 8, { width: 75, align: 'right' });
    // Table rows
    let rowY = tableTop + 35;
    doc.font('Helvetica').fillColor('#111827');
    for (const item of invoice.items) {
        // Zebra striping
        if (invoice.items.indexOf(item) % 2 === 1) {
            doc
                .rect(50, rowY - 5, 495, 25)
                .fill('#F9FAFB');
            doc.fillColor('#111827');
        }
        doc
            .fontSize(9)
            .text(item.description, 60, rowY, { width: 260 })
            .text(String(item.quantity), 330, rowY, { width: 40, align: 'center' })
            .text(`${currencySymbol}${item.unitPrice.toFixed(2)}`, 380, rowY, { width: 70, align: 'right' })
            .text(`${currencySymbol}${item.amount.toFixed(2)}`, 460, rowY, { width: 75, align: 'right' });
        rowY += 25;
        // Add new page if needed
        if (rowY > 700) {
            doc.addPage();
            rowY = 50;
        }
    }
    // Store the Y position for totals
    doc.tableEndY = rowY;
}
function generateTotals(doc, invoice) {
    const totalsY = doc.tableEndY + 30;
    const currencySymbol = CURRENCY_SYMBOLS[invoice.currency] || invoice.currency;
    const rightCol = 545;
    // Separator line
    doc
        .moveTo(350, totalsY - 10)
        .lineTo(545, totalsY - 10)
        .stroke('#E5E7EB');
    // Subtotal
    doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('Subtotal:', 360, totalsY)
        .fillColor('#111827')
        .text(`${currencySymbol}${invoice.subtotal.toFixed(2)}`, rightCol - 80, totalsY, {
        width: 80,
        align: 'right',
    });
    let currentY = totalsY + 18;
    // Discount if applicable
    if (invoice.discount && invoice.discount > 0) {
        doc
            .fillColor('#6B7280')
            .text('Discount:', 360, currentY)
            .fillColor('#10B981')
            .text(`-${currencySymbol}${invoice.discount.toFixed(2)}`, rightCol - 80, currentY, {
            width: 80,
            align: 'right',
        });
        currentY += 18;
    }
    // Tax
    doc
        .fillColor('#6B7280')
        .text('Tax:', 360, currentY)
        .fillColor('#111827')
        .text(`${currencySymbol}${invoice.taxTotal.toFixed(2)}`, rightCol - 80, currentY, {
        width: 80,
        align: 'right',
    });
    currentY += 25;
    // Total
    doc
        .rect(350, currentY - 5, 195, 28)
        .fill('#4F46E5');
    doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('TOTAL:', 360, currentY + 3)
        .text(`${currencySymbol}${invoice.total.toFixed(2)}`, rightCol - 80, currentY + 3, {
        width: 80,
        align: 'right',
    });
    doc.totalsEndY = currentY + 40;
}
function generatePaymentInfo(doc, invoice) {
    const paymentY = Math.max(doc.totalsEndY + 20, 550);
    if (invoice.status === 'PAID' && invoice.paymentDate) {
        doc
            .rect(50, paymentY, 250, 60)
            .fill('#ECFDF5');
        doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text('PAYMENT RECEIVED', 60, paymentY + 10);
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#065F46')
            .text(`Date: ${formatDate(invoice.paymentDate)}`, 60, paymentY + 28);
        if (invoice.paymentMethod) {
            doc.text(`Method: ${invoice.paymentMethod}`, 60, paymentY + 41);
        }
    }
    // Notes
    if (invoice.notes) {
        const notesY = paymentY + (invoice.status === 'PAID' ? 80 : 0);
        doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#374151')
            .text('Notes:', 50, notesY);
        doc
            .font('Helvetica')
            .fillColor('#6B7280')
            .text(invoice.notes, 50, notesY + 15, { width: 250 });
    }
}
function generateFooter(doc, invoice) {
    const footerY = 750;
    // Terms
    doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#9CA3AF')
        .text(invoice.terms || 'Payment is due within 30 days. Thank you for your business.', 50, footerY, { width: 250 });
    // Contact info
    doc
        .text('Questions? Contact us at billing@athena.app', 0, footerY, {
        width: 545,
        align: 'right',
    });
    // Page number
    doc
        .text(`Page 1 of 1`, 0, footerY + 20, {
        width: 545,
        align: 'center',
    });
}
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
// ==========================================
// DATABASE OPERATIONS
// ==========================================
/**
 * Generate and store invoice for a payment
 */
async function createInvoiceForPayment(paymentId, options) {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            user: {
                include: {
                    profile: { select: { location: true } },
                },
            },
        },
    });
    if (!payment) {
        throw new Error('Payment not found');
    }
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    // Build invoice data
    const invoiceData = {
        invoiceNumber,
        invoiceDate: payment.createdAt,
        dueDate: payment.createdAt, // Immediate for completed payments
        status: payment.status === 'COMPLETED' ? 'PAID' : 'SENT',
        seller: ATHENA_INFO,
        buyer: {
            name: payment.user?.displayName || 'Customer',
            email: payment.user?.email || '',
            address: payment.user?.profile?.location
                ? [payment.user.profile.location]
                : undefined,
        },
        items: [{
                description: getPaymentDescription(payment),
                quantity: 1,
                unitPrice: payment.amount.toNumber(),
                amount: payment.amount.toNumber(),
            }],
        subtotal: payment.amount.toNumber(),
        taxTotal: 0, // Add tax calculation if needed
        total: payment.amount.toNumber(),
        currency: payment.currency,
        paymentMethod: payment.method || undefined,
        paymentDate: payment.status === 'COMPLETED' ? payment.updatedAt : undefined,
        transactionId: payment.stripePaymentIntentId || undefined,
    };
    // Generate PDF
    const pdf = await generateInvoicePDF(invoiceData);
    // Store invoice in database
    const invoice = await prisma_1.prisma.invoice.create({
        data: {
            invoiceNumber,
            userId: payment.userId,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: invoiceData.status,
            pdfUrl: `invoices/${invoiceNumber}.pdf`, // Would upload to S3 in production
            issuedAt: invoiceData.invoiceDate,
            dueAt: invoiceData.dueDate,
            paidAt: invoiceData.paymentDate,
        },
    });
    logger_1.logger.info(`Generated invoice ${invoiceNumber} for payment ${paymentId}`);
    // Optionally send email
    if (options?.sendEmail && payment.user?.email) {
        // Email sending would be triggered here
        logger_1.logger.info(`Invoice email queued for ${payment.user.email}`);
    }
    return {
        invoiceId: invoice.id,
        pdf,
    };
}
/**
 * Generate invoice for subscription
 */
async function createInvoiceForSubscription(subscriptionId) {
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
            user: {
                include: {
                    profile: { select: { location: true } },
                },
            },
        },
    });
    if (!subscription) {
        throw new Error('Subscription not found');
    }
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceData = {
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: subscription.currentPeriodEnd,
        status: 'SENT',
        seller: ATHENA_INFO,
        buyer: {
            name: subscription.user?.displayName || 'Customer',
            email: subscription.user?.email || '',
        },
        items: [{
                description: `Athena ${subscription.tier} Subscription (${subscription.interval})`,
                quantity: 1,
                unitPrice: subscription.amount.toNumber(),
                amount: subscription.amount.toNumber(),
            }],
        subtotal: subscription.amount.toNumber(),
        taxTotal: 0,
        total: subscription.amount.toNumber(),
        currency: subscription.currency,
    };
    const pdf = await generateInvoicePDF(invoiceData);
    const invoice = await prisma_1.prisma.invoice.create({
        data: {
            invoiceNumber,
            userId: subscription.userId,
            subscriptionId: subscription.id,
            amount: subscription.amount,
            currency: subscription.currency,
            status: 'SENT',
            pdfUrl: `invoices/${invoiceNumber}.pdf`,
            issuedAt: new Date(),
            dueAt: subscription.currentPeriodEnd,
        },
    });
    logger_1.logger.info(`Generated subscription invoice ${invoiceNumber}`);
    return {
        invoiceId: invoice.id,
        pdf,
    };
}
/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    // Get count of invoices this month
    const count = await prisma_1.prisma.invoice.count({
        where: {
            invoiceNumber: {
                startsWith: `INV-${year}${month}`,
            },
        },
    });
    const sequence = String(count + 1).padStart(5, '0');
    return `INV-${year}${month}-${sequence}`;
}
/**
 * Get payment description for invoice line item
 */
function getPaymentDescription(payment) {
    switch (payment.type) {
        case 'SUBSCRIPTION':
            return `Athena Subscription - ${payment.metadata?.tier || 'Premium'}`;
        case 'MENTOR_SESSION':
            return `Mentorship Session - ${payment.metadata?.mentorName || 'One-on-one'}`;
        case 'COURSE':
            return `Course Purchase - ${payment.metadata?.courseTitle || 'Online Course'}`;
        case 'FORMATION':
            return `Business Formation Service - ${payment.metadata?.formationType || 'LLC'}`;
        case 'JOB_BOOST':
            return `Job Posting Boost - ${payment.metadata?.jobTitle || 'Featured Listing'}`;
        default:
            return payment.description || 'Athena Platform Service';
    }
}
/**
 * Get invoice by ID
 */
async function getInvoice(invoiceId) {
    return prisma_1.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            user: { select: { displayName: true, email: true } },
            payment: true,
        },
    });
}
/**
 * Get user's invoices
 */
async function getUserInvoices(userId) {
    return prisma_1.prisma.invoice.findMany({
        where: { userId },
        orderBy: { issuedAt: 'desc' },
        include: {
            payment: { select: { type: true, status: true } },
        },
    });
}
exports.invoiceService = {
    generateInvoicePDF,
    createInvoiceForPayment,
    createInvoiceForSubscription,
    getInvoice,
    getUserInvoices,
};
//# sourceMappingURL=invoice.service.js.map