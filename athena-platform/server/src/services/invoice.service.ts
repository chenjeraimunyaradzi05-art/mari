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
import { bestEffort } from '../utils/best-effort';
import { sendEmail } from '../utils/email';
import { digitsOnly, formatAbn, isValidAbn } from './abr.service';
import fs from 'fs';
import path from 'path';

/**
 * Local, as in breach.service. Nothing interpolated into the invoice email
 * below is member-supplied — an invoice number ATHENA generated, one of three
 * document titles, a formatted amount and a URL from the environment — so this
 * is belt and braces rather than the only thing standing between a member's
 * mailbox and an injected tag. It is here so that it stays true if somebody
 * later adds her name to the message.
 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

  /**
   * What the document calls itself on the page: "Tax invoice", "Invoice" or
   * "Payment receipt". It is not decoration — under Australian law the words
   * "Tax invoice" are a representation about GST, so the title is decided by
   * taxTreatmentFor() from what is actually known, never chosen by a caller.
   */
  documentTitle: string;

  /** The GST position in one sentence, printed under the totals. */
  taxNote?: string;

  // Seller info
  seller: {
    name: string;
    address: string[];
    email: string;
    phone?: string;
    /** The ABN, spaced the way the ABR prints it, when one is configured. */
    abn?: string;
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

/**
 * Who the supplier is, and what it may truthfully say about GST.
 *
 * ATHENA sells in Australia and the invoices page calls what it issues a tax
 * invoice. The ATO is specific about that phrase: a tax invoice must carry
 * the words "Tax invoice", the supplier's identity and ABN, the issue date, a
 * description with quantity and price, and either the GST amount or a
 * statement that the total includes GST; from A$1,000 up, the buyer's
 * identity as well. Until this code, every document said "INVOICE", carried
 * no ABN, and printed the literal `taxTotal: 0` — a tax position the data did
 * not support, on documents a member may hand to her accountant.
 *
 * So nothing here invents an ABN or a registration. Three environment values
 * decide what the document can claim, and when they are absent it claims
 * less:
 *
 *   ATHENA_ABN                  the supplier's ABN, kept only if it passes
 *                               its checksum
 *   ATHENA_GST_REGISTERED_FROM  the date the ATO registration took effect
 *   ATHENA_BILLING_ADDRESS      the registered address, lines separated by |
 *
 * The registration is a date rather than a flag on purpose. A GST
 * registration starts on a day, and an invoice issued before that day was
 * correctly issued without GST; storing a boolean would have made every old
 * invoice sprout a GST line the moment the company registered, because a PDF
 * is re-rendered from the row each time it is downloaded and the Invoice
 * table has nowhere to keep the figure.
 */
const GST_RATE = 0.1;
const GST_CURRENCY = 'AUD';

const PLACEHOLDER_ADDRESS = [
  'Australia',
  'Final billing address to be published before production invoicing is enabled',
];

export interface SupplierDetails {
  name: string;
  address: string[];
  email: string;
  phone?: string;
  abn?: string;
}

/** The registered ABN, spaced as the ABR prints it, or null if none is set. */
function configuredAbn(): string | null {
  const abn = digitsOnly(process.env.ATHENA_ABN);
  if (!abn || !isValidAbn(abn)) return null;
  return formatAbn(abn);
}

/**
 * The day the GST registration took effect, or null. An unparseable value is
 * treated as absent: guessing a date here would put GST on documents at the
 * wrong time in both directions.
 */
function gstRegisteredFrom(): Date | null {
  const raw = process.env.ATHENA_GST_REGISTERED_FROM;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    logger.warn('ATHENA_GST_REGISTERED_FROM is not a date; invoices will not charge GST', { value: raw });
    return null;
  }
  return date;
}

export function athenaSupplier(): SupplierDetails {
  const address = (process.env.ATHENA_BILLING_ADDRESS || '')
    .split(/[|\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    name: process.env.ATHENA_LEGAL_NAME || 'ATHENA Platform Pty Ltd',
    address: address.length > 0 ? address : PLACEHOLDER_ADDRESS,
    email: process.env.ATHENA_BILLING_EMAIL || 'billing@athena.app',
    abn: configuredAbn() ?? undefined,
  };
}

export interface TaxTreatment {
  /** "Tax invoice", "Invoice" or "Payment receipt". */
  title: string;
  isTaxInvoice: boolean;
  /** Major units, with any GST taken out. */
  subtotal: number;
  /** Major units. Zero whenever the document is not a tax invoice. */
  taxTotal: number;
  /** One plain sentence saying where the GST stands, printed on the page. */
  note: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Decide what a document may claim about GST, from the money and the date.
 *
 * Displayed prices in Australia include GST, so a taxable sale's GST is one
 * eleventh of what was charged rather than ten per cent on top of it.
 */
export function taxTreatmentFor(params: {
  /** What was actually charged, in major units, GST included if any. */
  total: number;
  currency: string;
  issuedAt: Date;
  /**
   * False when ATHENA only collected the money on someone else's behalf — a
   * mentor's hour, a marketplace provider's job. The supply is theirs, so the
   * GST on it is theirs to invoice and ATHENA must not claim it.
   */
  platformIsSupplier: boolean;
}): TaxTreatment {
  const supplier = athenaSupplier();
  const total = round2(params.total);

  if (!params.platformIsSupplier) {
    return {
      title: 'Payment receipt',
      isTaxInvoice: false,
      subtotal: total,
      taxTotal: 0,
      note: `${supplier.name} collected this payment for the provider who supplied the service. Any GST on it is theirs to invoice, so none is shown here.`,
    };
  }

  const registeredFrom = gstRegisteredFrom();
  const registered = Boolean(supplier.abn) && registeredFrom !== null && params.issuedAt >= registeredFrom;

  if (!registered) {
    return {
      title: 'Invoice',
      isTaxInvoice: false,
      subtotal: total,
      taxTotal: 0,
      note: `${supplier.name} is not registered for GST, so no GST has been charged on this sale.`,
    };
  }

  if (params.currency.toUpperCase() !== GST_CURRENCY) {
    // A sale settled in another currency is not one this code can place for
    // GST: whether it is a GST-free supply to a non-resident turns on facts
    // about the buyer that are not on the row. It says what it knows.
    return {
      title: 'Invoice',
      isTaxInvoice: false,
      subtotal: total,
      taxTotal: 0,
      note: `Charged in ${params.currency.toUpperCase()}. No GST is included in this amount.`,
    };
  }

  const taxTotal = round2(total - total / (1 + GST_RATE));
  return {
    title: 'Tax invoice',
    isTaxInvoice: true,
    subtotal: round2(total - taxTotal),
    taxTotal,
    note: `The total shown includes GST of ${formatMoney(taxTotal, GST_CURRENCY)}.`,
  };
}

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

const formatMoney = (amount: number, currency: string) =>
  `${CURRENCY_SYMBOLS[currency.toUpperCase()] || `${currency.toUpperCase()} `}${amount.toFixed(2)}`;

/**
 * The kinds of sale that end up on a Payment row. The Stripe metadata that
 * carries them is lower case and flow-specific (`business_formation`,
 * `mentor_session`); this is the canonical form written to Payment.type, and
 * the webhook maps onto it so that one description and one GST rule serve
 * every issuer.
 */
export const PAYMENT_KINDS = [
  'SUBSCRIPTION',
  'MENTOR_SESSION',
  'FORMATION',
  'ACCELERATOR',
  'GIFT_BALANCE',
  'COURSE',
  'JOB_BOOST',
  'SERVICE_ORDER',
] as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export function isPaymentKind(value: unknown): value is PaymentKind {
  return typeof value === 'string' && (PAYMENT_KINDS as readonly string[]).includes(value);
}

/**
 * What the platform sold itself, as against money that ran through its Stripe
 * account on the way to somebody else. A mentor's hour is the mentor's supply
 * and a marketplace order is the provider's: ATHENA keeps a fee out of it and
 * passes the rest on, so an ATHENA tax invoice for the whole amount would
 * claim a sale ATHENA never made.
 */
const PLATFORM_SUPPLIES: Record<PaymentKind, boolean> = {
  SUBSCRIPTION: true,
  FORMATION: true,
  ACCELERATOR: true,
  GIFT_BALANCE: true,
  COURSE: true,
  JOB_BOOST: true,
  MENTOR_SESSION: false,
  SERVICE_ORDER: false,
};

/** Whether ATHENA is the supplier for this kind of sale. Unknown kinds are not assumed to be. */
export function isPlatformSupply(type: string | null | undefined): boolean {
  return isPaymentKind(type) ? PLATFORM_SUPPLIES[type] : false;
}

const PAYMENT_DESCRIPTIONS: Record<PaymentKind, string> = {
  SUBSCRIPTION: 'ATHENA membership',
  MENTOR_SESSION: 'Mentoring session',
  FORMATION: 'Business formation service',
  ACCELERATOR: 'Accelerator cohort place',
  GIFT_BALANCE: 'Gift balance top-up',
  COURSE: 'Course purchase',
  JOB_BOOST: 'Job listing boost',
  SERVICE_ORDER: 'Skills marketplace order',
};

/**
 * The line a member reads on the document. It names only what the Payment row
 * knows: the row has no description or metadata column, so the switch that
 * used to read `payment.metadata?.formationType` here fell through to its
 * default on every call and printed "Business Formation Service - LLC" — a US
 * company type, on an Australian registration that can only be a sole trader,
 * partnership, company or trust.
 */
export function paymentLineDescription(type: string | null | undefined): string {
  return isPaymentKind(type) ? PAYMENT_DESCRIPTIONS[type] : 'ATHENA platform service';
}

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
  
  // The document names itself from its tax treatment, never from a caller's
  // preference: "Tax invoice" is a statement about GST, so it appears only
  // when taxTreatmentFor() found an ABN, a registration in force on the issue
  // date, and an AUD sale ATHENA itself made.
  doc
    .fontSize(20)
    .fillColor('#111827')
    .text(invoice.documentTitle.toUpperCase(), 0, 50, { align: 'right' });
  
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
  
  if (invoice.seller.abn) {
    doc.text(`ABN: ${invoice.seller.abn}`, 50, yPos);
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
  
  // GST, named. The ATO wants the GST amount or a statement that the total
  // includes it; a line labelled "Tax" showing 0.00 said neither.
  doc
    .fillColor('#6B7280')
    .text(invoice.taxTotal > 0 ? `GST (${Math.round(GST_RATE * 100)}%):` : 'GST:', 360, currentY)
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

  currentY += 40;

  // The sentence that keeps the document honest when there is no GST to show:
  // a reader who sees a zero needs to know whether that is a GST-free sale, an
  // unregistered supplier, or money collected for somebody else.
  if (invoice.taxNote) {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(invoice.taxNote, 300, currentY, { width: 245, align: 'right' });
    currentY += 24;
  }

  (doc as any).totalsEndY = currentY;
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
/**
 * Whether the member was actually emailed about this invoice.
 *
 * Three states rather than a boolean, because `false` could not tell an admin
 * apart from a send that was never asked for — and the whole reason this exists
 * is that the previous code could not tell them apart either. `sendEmail: true`
 * used to reach a single `logger.info('Invoice email queued for ...')` and stop
 * there: nothing was queued, nothing was sent, and the admin who ticked the box
 * had no way to find that out.
 */
export type InvoiceEmailOutcome = 'sent' | 'failed' | 'not_requested';

export interface IssuedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  created: boolean;
  pdf: Buffer;
  emailed: InvoiceEmailOutcome;
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

type InvoiceRow = Prisma.InvoiceGetPayload<Record<string, never>>;

/**
 * Files an invoice once: looks for the one already filed against `existing`,
 * and writes a new row only if there is none — with the look and the write
 * holding one lock, keyed on what the invoice is for.
 *
 * The look used to be a findFirst and the write a separate create, with nothing
 * between them. Invoice.paymentId has no unique index, so the Stripe webhook and
 * an admin re-issue arriving together could each find nothing and each mint a
 * number: two tax invoices, each showing GST, for one payment. The lock is a
 * Postgres transaction-scoped advisory lock on `lockKey`, so the second issuer
 * waits for the first to commit and then finds its row. It is released when the
 * transaction ends, whichever way it ends. A unique index on paymentId would
 * say the same thing in the schema, and is asked for separately; this holds
 * until it exists and costs nothing after.
 *
 * A retry still re-mints the number if two issuers for *different* things
 * raced for the same one: the sequence is a count, so two webhooks landing
 * together can both compute the next number and the second create trips the
 * unique index. That error aborts the transaction, so the retry runs a new one.
 */
async function fileInvoiceOnce(
  lockKey: string,
  existing: Prisma.InvoiceWhereInput,
  data: Omit<Prisma.InvoiceUncheckedCreateInput, 'invoiceNumber' | 'pdfUrl'>
): Promise<{ invoice: InvoiceRow; created: boolean }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const filed = await tx.invoice.findFirst({ where: existing });
        if (filed) return { invoice: filed, created: false };

        const invoiceNumber = await generateInvoiceNumber(tx);
        const invoice = await tx.invoice.create({
          // pdfUrl is deliberately not written. It used to be set to
          // `invoices/<number>.pdf`, which is a path nothing ever stores a file
          // at: the PDF is rendered on demand by GET /api/invoices/:id/pdf and
          // never persisted. A grep for pdfUrl across the server and the client
          // found the write and no reader, so the column said a document was
          // filed somewhere when none was — and the first reader anyone added
          // would have got a 404 for every invoice ever issued. Left null, it
          // says the true thing: there is no stored file, only a renderer.
          data: { ...data, invoiceNumber },
        });
        return { invoice, created: true };
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Tell a member her invoice is ready, and say honestly whether it went.
 *
 * The invoice itself is not attached. utils/email sends through SendGrid with
 * subject, html and text and no attachment support, and a tax document is not
 * something to bolt onto that transport in passing — an invoice mailed to the
 * wrong inbox is her name, her city and what she paid ATHENA, sitting in
 * somebody else's mail. The link goes to the invoices page, which is behind her
 * login and re-renders the PDF on demand, so the document only ever leaves the
 * platform to a session that has already authenticated as her.
 *
 * bestEffort, because an invoice that was filed correctly must not be un-filed
 * by a mail server having a bad morning — but the failure is recorded rather
 * than swallowed, and the outcome is returned so the admin who asked for the
 * email is told what happened to it.
 */
async function emailInvoiceReady(params: {
  to: string;
  invoiceNumber: string;
  documentTitle: string;
  total: number;
  currency: string;
}): Promise<InvoiceEmailOutcome> {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const invoicesUrl = `${clientUrl}/dashboard/finance/invoices`;
  const amount = formatMoney(params.total, params.currency);
  const title = params.documentTitle;

  const sent = await bestEffort(
    'invoice.email-ready',
    () =>
      sendEmail({
        to: params.to,
        subject: `Your ATHENA ${title.toLowerCase()} ${params.invoiceNumber}`,
        html:
          `<p>Your ${escapeHtml(title.toLowerCase())} <strong>${escapeHtml(params.invoiceNumber)}</strong> ` +
          `for ${escapeHtml(amount)} is ready.</p>` +
          `<p><a href="${escapeHtml(invoicesUrl)}">Open it in ATHENA</a> to download the PDF.</p>`,
        text:
          `Your ${title.toLowerCase()} ${params.invoiceNumber} for ${amount} is ready. ` +
          `Download it at ${invoicesUrl}`,
      }),
    false
  );

  if (!sent) {
    logger.error('Could not email a member about her invoice', {
      invoiceNumber: params.invoiceNumber,
    });
    return 'failed';
  }

  return 'sent';
}

/**
 * Issue an invoice for a Payment row, once. A second call for the same
 * paymentId returns the invoice already filed.
 *
 * Reached from the Stripe webhook, which writes the Payment row as each
 * intent succeeds, and from the admin re-issue route.
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

  const total = payment.amount.toNumber();
  const tax = taxTreatmentFor({
    total,
    currency: payment.currency,
    issuedAt: payment.createdAt,
    platformIsSupplier: isPlatformSupply(payment.type),
  });

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoiceNumber: '',
    invoiceDate: payment.createdAt,
    dueDate: payment.createdAt, // Immediate for completed payments
    status: payment.status === 'COMPLETED' ? 'PAID' : 'SENT',
    documentTitle: tax.title,
    taxNote: tax.note,

    seller: athenaSupplier(),

    buyer: {
      name: payment.user?.displayName || 'Customer',
      email: payment.user?.email || '',
      address: payment.user?.city
        ? [payment.user.city, payment.user.state, payment.user.country].filter(Boolean) as string[]
        : undefined,
    },

    // Lines are GST-exclusive so the page adds up: subtotal, then the GST
    // line, then the total that was actually charged.
    items: [{
      description: paymentLineDescription(payment.type),
      quantity: 1,
      unitPrice: tax.subtotal,
      amount: tax.subtotal,
      taxAmount: tax.taxTotal || undefined,
      taxRate: tax.isTaxInvoice ? GST_RATE : undefined,
    }],

    subtotal: tax.subtotal,
    taxTotal: tax.taxTotal,
    total,
    currency: payment.currency,

    paymentMethod: payment.method || undefined,
    paymentDate: payment.status === 'COMPLETED' ? payment.updatedAt : undefined,
    transactionId: payment.stripePaymentIntentId || undefined,
  };

  // The email is sent on a re-issue too. It used to sit past this early return,
  // so an admin re-sending an invoice to a member who said she had not received
  // it ticked the box, got a 200, and nothing was sent — which is exactly the
  // situation a re-issue exists for.
  const emailRecipient = options?.sendEmail ? payment.user?.email : undefined;

  const { invoice, created } = await fileInvoiceOnce(
    `invoice:payment:${payment.id}`,
    { paymentId: payment.id },
    {
      userId: payment.userId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: invoiceData.status,
      issuedAt: invoiceData.invoiceDate,
      dueAt: invoiceData.dueDate,
      paidAt: invoiceData.paymentDate,
    }
  );

  if (created) {
    logger.info(`Generated invoice ${invoice.invoiceNumber} for payment ${paymentId}`);
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    created,
    // A re-issue renders the filed invoice with the status it was filed under.
    pdf: await generateInvoicePDF({
      ...invoiceData,
      invoiceNumber: invoice.invoiceNumber,
      ...(created ? {} : { status: invoice.status as InvoiceData['status'] }),
    }),
    emailed: emailRecipient
      ? await emailInvoiceReady({
          to: emailRecipient,
          invoiceNumber: invoice.invoiceNumber,
          documentTitle: tax.title,
          total,
          currency: payment.currency,
        })
      : 'not_requested',
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

  const period =
    paid.periodStart && paid.periodEnd
      ? ` (${formatDate(paid.periodStart)} to ${formatDate(paid.periodEnd)})`
      : '';

  // A membership is ATHENA's own supply, so it carries GST when ATHENA is
  // registered for it on the day the period was paid.
  const tax = taxTreatmentFor({
    total: paid.amount,
    currency: paid.currency,
    issuedAt: paid.paidAt,
    platformIsSupplier: true,
  });

  const invoiceData: InvoiceData = {
    invoiceNumber: '',
    invoiceDate: paid.paidAt,
    dueDate: paid.paidAt,
    status: 'PAID',
    documentTitle: tax.title,
    taxNote: tax.note,

    seller: athenaSupplier(),

    buyer: {
      name: subscription.user?.displayName || 'Customer',
      email: subscription.user?.email || '',
    },

    items: [{
      description: `ATHENA ${tierLabel(subscription.tier)} membership${period}`,
      quantity: 1,
      unitPrice: tax.subtotal,
      amount: tax.subtotal,
      taxAmount: tax.taxTotal || undefined,
      taxRate: tax.isTaxInvoice ? GST_RATE : undefined,
    }],

    subtotal: tax.subtotal,
    taxTotal: tax.taxTotal,
    total: paid.amount,
    currency: paid.currency,
    paymentMethod: 'card',
    paymentDate: paid.paidAt,
  };

  const { invoice, created } = await fileInvoiceOnce(
    // Keyed on the subscription and the instant Stripe says it was paid, which
    // is what makes two deliveries of the same invoice.paid the same invoice.
    `invoice:subscription:${subscription.id}:${paid.paidAt.toISOString()}`,
    { subscriptionId: subscription.id, paidAt: paid.paidAt },
    {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      amount: paid.amount,
      currency: paid.currency,
      status: 'PAID',
      issuedAt: paid.paidAt,
      dueAt: paid.paidAt,
      paidAt: paid.paidAt,
    }
  );

  if (created) {
    logger.info(`Generated subscription invoice ${invoice.invoiceNumber}`, { subscriptionId: subscription.id });
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    created,
    pdf: await generateInvoicePDF({ ...invoiceData, invoiceNumber: invoice.invoiceNumber }),
    // The membership invoice path has no sendEmail option and never had one;
    // it is called by the Stripe webhook, which must not block on a mail
    // server. Named rather than left off, so the field means the same thing
    // everywhere it appears.
    emailed: 'not_requested',
  };
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber(db: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of invoices this month
  const count = await db.invoice.count({
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
  athenaSupplier,
  taxTreatmentFor,
  paymentLineDescription,
  isPlatformSupply,
  getInvoice,
  getUserInvoices,
};
