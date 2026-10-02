/**
 * An invoice for a sale that was refunded, or lost to a card dispute.
 *
 * A refunded sale kept a PAID tax invoice: nothing anywhere updated one. Now the
 * amount that went back is recorded against the invoice and printed beneath its
 * total as a credit line, and a credit of the whole amount cancels it. The credit
 * is cumulative, as the refund events are, so it only ever grows and the same
 * event delivered twice writes it once.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    invoice: { findFirst: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The words printed on the page, in the order they were printed, so a test can
// read what a member would.
jest.mock('pdfkit', () => {
  class FakeDocument {
    static texts: string[] = [];
    private handlers: Record<string, Array<(chunk?: Buffer) => void>> = {};
    on(event: string, fn: (chunk?: Buffer) => void) {
      (this.handlers[event] ??= []).push(fn);
      return this;
    }
    text(value: unknown) {
      FakeDocument.texts.push(String(value));
      return this;
    }
    end() {
      (this.handlers.data ?? []).forEach((fn) => fn(Buffer.from('%PDF')));
      (this.handlers.end ?? []).forEach((fn) => fn());
    }
  }
  for (const method of ['fontSize', 'font', 'fillColor', 'rect', 'roundedRect', 'fill', 'moveTo', 'lineTo', 'stroke', 'addPage']) {
    (FakeDocument.prototype as any)[method] = function chain() {
      return this;
    };
  }
  return { __esModule: true, default: FakeDocument };
});

import PDFDocument from 'pdfkit';
import { prisma as prismaTyped } from '../../utils/prisma';
import { creditInvoiceForPayment, creditSubscriptionInvoice, generateInvoicePDF, type InvoiceData } from '../invoice.service';

const prisma: any = prismaTyped;
const printed = () => (PDFDocument as any).texts as string[];

const filed = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-202610-00001',
  amount: '250',
  creditedAmount: '0',
  status: 'PAID',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  printed().length = 0;
  prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
});

describe('Crediting an invoice', () => {
  it('records a part refund as a credit and leaves the invoice PAID', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed());

    const credit = await creditInvoiceForPayment('pay-1', 10);

    expect(prisma.invoice.findFirst.mock.calls[0][0].where).toEqual({ paymentId: 'pay-1' });
    // Conditional on the figure it read, so two events together cannot shrink it or write it twice.
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', creditedAmount: { lt: 10 } },
      data: { creditedAmount: 10, creditedAt: expect.any(Date) },
    });
    expect(credit).toMatchObject({ credited: 10, cancelled: false, changed: true, invoiceNumber: 'INV-202610-00001' });
  });

  it('cancels the invoice when the whole of it has gone back', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed());

    const credit = await creditInvoiceForPayment('pay-1', 250);

    expect(prisma.invoice.updateMany.mock.calls[0][0].data).toMatchObject({ creditedAmount: 250, status: 'CANCELLED' });
    expect(credit).toMatchObject({ credited: 250, cancelled: true });
  });

  it('never credits more than the invoice was for', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed());

    const credit = await creditInvoiceForPayment('pay-1', 999);

    expect(prisma.invoice.updateMany.mock.calls[0][0].data.creditedAmount).toBe(250);
    expect(credit?.credited).toBe(250);
  });

  it('only ever grows: the same refund again, or an older and smaller figure, changes nothing', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed({ creditedAmount: '100' }));

    const same = await creditInvoiceForPayment('pay-1', 100);
    const older = await creditInvoiceForPayment('pay-1', 40);

    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(same).toMatchObject({ credited: 100, changed: false });
    expect(older).toMatchObject({ credited: 100, changed: false });
  });

  it('leaves a membership invoice the admin already credited as it is, which is what makes it safe beside the refund', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed({ amount: '29', creditedAmount: '29', status: 'CANCELLED' }));

    const credit = await creditInvoiceForPayment('pay-1', 29);

    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(credit).toMatchObject({ credited: 29, cancelled: true, changed: false });
  });

  it('counts in whole cents, so a part refund is never a rounding error from the total', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed({ amount: '0.30' }));

    const credit = await creditInvoiceForPayment('pay-1', 0.1 + 0.2);

    expect(credit).toMatchObject({ credited: 0.3, cancelled: true });
  });

  it('finds a membership period’s invoice by the subscription and the instant Stripe says it was paid', async () => {
    prisma.invoice.findFirst.mockResolvedValue(filed({ amount: '29' }));
    const paidAt = new Date('2026-09-01T00:00:00Z');

    await creditSubscriptionInvoice('sub-1', paidAt, 29);

    expect(prisma.invoice.findFirst.mock.calls[0][0].where).toEqual({ subscriptionId: 'sub-1', paidAt });
    expect(prisma.invoice.updateMany.mock.calls[0][0].data.status).toBe('CANCELLED');
  });

  it('is nothing for a sale ATHENA never issued an invoice for', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    expect(await creditInvoiceForPayment('pay-mentor', 120)).toBeNull();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});

describe('The document for a credited sale', () => {
  const data = (over: Partial<InvoiceData> = {}): InvoiceData => ({
    invoiceNumber: 'INV-202610-00001',
    invoiceDate: new Date('2026-09-01T00:00:00Z'),
    dueDate: new Date('2026-09-01T00:00:00Z'),
    status: 'PAID',
    documentTitle: 'Invoice',
    // A supplier that says who it is: no document is produced for one that does not
    // (services/invoice.service supplierReadiness).
    seller: { name: 'Example Trading Pty Ltd', address: ['1 Example St', 'Brisbane QLD 4000'], email: 'billing@mail.example-trading.org', abn: '51 824 753 556' },
    buyer: { name: 'Sarah K', email: 'sarah@example.com' },
    items: [{ description: 'Gift balance top-up', quantity: 1, unitPrice: 250, amount: 250 }],
    subtotal: 250,
    taxTotal: 0,
    total: 250,
    currency: 'AUD',
    ...over,
  });

  it('prints what went back beneath the total, and what is left after it', async () => {
    await generateInvoicePDF(data({ credit: { amount: 100, creditedAt: new Date('2026-09-10T00:00:00Z') } }));

    const text = printed();
    expect(text.some((line) => line.startsWith('Credited back to you ('))).toBe(true);
    expect(text).toContain('-A$100.00');
    expect(text).toContain('Balance after the credit:');
    expect(text).toContain('A$150.00');
    // The sale stands as it was made.
    expect(text).toContain('A$250.00');
  });

  it('shows a balance of nothing for a sale credited in full, and not a negative', async () => {
    await generateInvoicePDF(data({ status: 'CANCELLED', credit: { amount: 400 } }));

    const text = printed();
    expect(text).toContain('-A$250.00');
    expect(text).toContain('A$0.00');
    expect(text.some((line) => line.includes('-A$400'))).toBe(false);
  });

  it('prints no credit line for a sale nothing went back on', async () => {
    await generateInvoicePDF(data());
    await generateInvoicePDF(data({ credit: { amount: 0 } }));

    expect(printed().some((line) => line.includes('Credited back'))).toBe(false);
  });
});
