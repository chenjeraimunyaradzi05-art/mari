/**
 * Invoice PDF Generation Service
 * Generates professional PDF invoices for payments
 * Phase 2: Backend Logic & Integrations
 */

import PDFDocument from 'pdfkit';
import type Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import fs from 'fs';
import path from 'path';

// ==========================================
// TYPES
// ==========================================

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  
  // Seller info
  seller: {
    name: string;
    address: string[];
    email: string;
    phone?: string;
    taxId?: string;
    logo?: string;
  };
  
  // Buyer info
  buyer: {
    name: string;
    email: string;
    address?: string[];
    taxId?: string;
  };
  
  // Line items
  items: InvoiceLineItem[];
  
  // Totals
  subtotal: number;
  taxTotal: number;
  discount?: number;
  total: number;
  currency: string;
  
  // Payment info
  paymentMethod?: string;
  paymentDate?: Date;
  transactionId?: string;
  
  // Notes
  notes?: string;
  terms?: string;
}

// ==========================================
// CONSTANTS
// ==========================================

const ATHENA_INFO = {
  name: 'ATHENA Platform Pty Ltd',
  address: [
    'Australia',
    'Final billing address to be published before production invoicing is enabled',
  ],
  email: 'billing@athena.app',
  phone: undefined,
  taxId: undefined,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
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
export async function generateInvoicePDF(
  invoiceData: InvoiceData,
  outputPath?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice ${invoiceData.invoiceNumber}`,
          Author: 'Athena Platform',
          Subject: `Invoice for ${invoiceData.buyer.name}`,
        },
      });
      
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        
        // Optionally write to file
        if (outputPath) {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(outputPath, pdfBuffer);
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
    } catch (error) {
      reject(error);
    }
  });
}

function generateHeader(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
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
  const statusColors: Record<string, string> = {
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

function generateBillingInfo(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
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

function generateItemsTable(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
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
  (doc as any).tableEndY = rowY;
}

function generateTotals(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
  const totalsY = (doc as any).tableEndY + 30;
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
  
  (doc as any).totalsEndY = currentY + 40;
}

function generatePaymentInfo(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
  const paymentY = Math.max((doc as any).totalsEndY + 20, 550);
  
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

function generateFooter(doc: typeof PDFDocument.prototype, invoice: InvoiceData): void {
  const footerY = 750;
  
  // Terms
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#9CA3AF')
    .text(
      invoice.terms || 'Payment is due within 30 days. Thank you for your business.',
      50,
      footerY,
      { width: 250 }
    );
  
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

function formatDate(date: Date): string {
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
 * What an issue call hands back. `created` is false when the invoice already
 * existed and the same one is being returned: every issuer here is idempotent,
 * because the Stripe webhook is retried and the admin button can be pressed
 * twice, and a second invoice number for one charge is a bookkeeping error.
 */
export interface IssuedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  created: boolean;
  pdf: Buffer;
}

/**
 * What Stripe says was paid for a membership period. Subscription.amount and
 * .interval are never written by checkout or the webhook, so a membership
 * invoice carries Stripe's figures rather than reading the row.
 */
export interface PaidSubscriptionCharge {
  /** Major units in the invoice currency (29.00, not 2900). */
  amount: number;
  /** ISO code, upper case. */
  currency: string;
  /** When Stripe recorded the payment; also the idempotency key per invoice. */
  paidAt: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

/**
 * The paid figures from a Stripe invoice, or null when nothing was paid (a
 * trial period, a 100% coupon): a tax invoice records money received, and a
 * $0 line is not that.
 */
export function paidChargeFromStripeInvoice(invoice: Stripe.Invoice): PaidSubscriptionCharge | null {
  if (typeof invoice.amount_paid !== 'number' || invoice.amount_paid <= 0) return null;
  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created;
  const period = invoice.lines?.data?.[0]?.period;
  const toDate = (seconds: number | null | undefined) => (typeof seconds === 'number' ? new Date(seconds * 1000) : null);
  return {
    amount: Math.round(invoice.amount_paid) / 100,
    currency: String(invoice.currency || 'aud').toUpperCase(),
    paidAt: new Date(paidAtSeconds * 1000),
    periodStart: toDate(period?.start ?? invoice.period_start),
    periodEnd: toDate(period?.end ?? invoice.period_end),
  };
}

/**
 * Writes the row, minting a fresh number if two issuers raced for the same
 * one: the sequence is a count, so two webhooks landing together can both
 * compute the next number and the second create trips the unique index.
 */
async function createInvoiceRow(data: Omit<Prisma.InvoiceUncheckedCreateInput, 'invoiceNumber' | 'pdfUrl'>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      return await prisma.invoice.create({
        data: { ...data, invoiceNumber, pdfUrl: `invoices/${invoiceNumber}.pdf` },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Issue an invoice for a Payment row, once. A second call for the same
 * paymentId returns the invoice already filed.
 *
 * No flow writes Payment rows yet (mentor sessions and the formation fee keep
 * their state on their own models), so today this is reached by the admin
 * re-issue route and by the webhook hook that fires when a Payment carrying
 * the succeeded intent exists.
 */
export async function createInvoiceForPayment(
  paymentId: string,
  options?: { sendEmail?: boolean }
): Promise<IssuedInvoice> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: true,
    },
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  const existing = await prisma.invoice.findFirst({ where: { paymentId: payment.id } });

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoiceNumber: existing?.invoiceNumber ?? '',
    invoiceDate: payment.createdAt,
    dueDate: payment.createdAt, // Immediate for completed payments
    status: payment.status === 'COMPLETED' ? 'PAID' : 'SENT',

    seller: ATHENA_INFO,

    buyer: {
      name: payment.user?.displayName || 'Customer',
      email: payment.user?.email || '',
      address: payment.user?.city
        ? [payment.user.city, payment.user.state, payment.user.country].filter(Boolean) as string[]
        : undefined,
    },

    items: [{
      description: getPaymentDescription(payment),
      quantity: 1,
      unitPrice: payment.amount.toNumber(),
      amount: payment.amount.toNumber(),
    }],

    subtotal: payment.amount.toNumber(),
    taxTotal: 0, // No GST is computed yet; see the note in invoice.routes.ts
    total: payment.amount.toNumber(),
    currency: payment.currency,

    paymentMethod: payment.method || undefined,
    paymentDate: payment.status === 'COMPLETED' ? payment.updatedAt : undefined,
    transactionId: payment.stripePaymentIntentId || undefined,
  };

  if (existing) {
    return {
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      created: false,
      pdf: await generateInvoicePDF({ ...invoiceData, status: existing.status as InvoiceData['status'] }),
    };
  }

  // Store invoice in database
  const invoice = await createInvoiceRow({
    userId: payment.userId,
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: invoiceData.status,
    issuedAt: invoiceData.invoiceDate,
    dueAt: invoiceData.dueDate,
    paidAt: invoiceData.paymentDate,
  });

  logger.info(`Generated invoice ${invoice.invoiceNumber} for payment ${paymentId}`);

  // Optionally send email
  if (options?.sendEmail && payment.user?.email) {
    // Email sending would be triggered here
    logger.info(`Invoice email queued for ${payment.user.email}`);
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    created: true,
    pdf: await generateInvoicePDF({ ...invoiceData, invoiceNumber: invoice.invoiceNumber }),
  };
}

function tierLabel(tier: string): string {
  return tier
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Issue an invoice for a paid membership period, once. Called by the Stripe
 * webhook on invoice.paid and by the admin re-issue; both pass what Stripe
 * says was paid. Idempotent per Stripe invoice: the paid-at instant Stripe
 * recorded is stored as paidAt, and an invoice already filed against this
 * subscription for that instant is returned instead of a second one.
 */
export async function createInvoiceForSubscription(
  subscriptionId: string,
  paid: PaidSubscriptionCharge
): Promise<IssuedInvoice> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: true,
    },
  });

  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  const existing = await prisma.invoice.findFirst({
    where: { subscriptionId: subscription.id, paidAt: paid.paidAt },
  });

  const period =
    paid.periodStart && paid.periodEnd
      ? ` (${formatDate(paid.periodStart)} to ${formatDate(paid.periodEnd)})`
      : '';

  const invoiceData: InvoiceData = {
    invoiceNumber: existing?.invoiceNumber ?? '',
    invoiceDate: paid.paidAt,
    dueDate: paid.paidAt,
    status: 'PAID',

    seller: ATHENA_INFO,

    buyer: {
      name: subscription.user?.displayName || 'Customer',
      email: subscription.user?.email || '',
    },

    items: [{
      description: `ATHENA ${tierLabel(subscription.tier)} membership${period}`,
      quantity: 1,
      unitPrice: paid.amount,
      amount: paid.amount,
    }],

    subtotal: paid.amount,
    taxTotal: 0, // No GST is computed yet; see the note in invoice.routes.ts
    total: paid.amount,
    currency: paid.currency,
    paymentMethod: 'card',
    paymentDate: paid.paidAt,
  };

  if (existing) {
    return {
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      created: false,
      pdf: await generateInvoicePDF(invoiceData),
    };
  }

  const invoice = await createInvoiceRow({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    amount: paid.amount,
    currency: paid.currency,
    status: 'PAID',
    issuedAt: paid.paidAt,
    dueAt: paid.paidAt,
    paidAt: paid.paidAt,
  });

  logger.info(`Generated subscription invoice ${invoice.invoiceNumber}`, { subscriptionId: subscription.id });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    created: true,
    pdf: await generateInvoicePDF({ ...invoiceData, invoiceNumber: invoice.invoiceNumber }),
  };
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of invoices this month
  const count = await prisma.invoice.count({
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
function getPaymentDescription(payment: any): string {
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
export async function getInvoice(invoiceId: string): Promise<any> {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      user: { select: { displayName: true, email: true } },
      subscription: true,
    },
  });
}

/**
 * Get user's invoices
 */
export async function getUserInvoices(userId: string): Promise<any[]> {
  return prisma.invoice.findMany({
    where: { userId },
    orderBy: { issuedAt: 'desc' },
    include: {
      subscription: { select: { tier: true, status: true } },
    },
  });
}

export const invoiceService = {
  generateInvoicePDF,
  createInvoiceForPayment,
  createInvoiceForSubscription,
  paidChargeFromStripeInvoice,
  getInvoice,
  getUserInvoices,
};
