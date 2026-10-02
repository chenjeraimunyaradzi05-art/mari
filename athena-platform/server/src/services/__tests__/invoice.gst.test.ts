import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    invoice: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
    payment: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
    // An invoice is filed inside a transaction that first takes an advisory lock.
    $executeRaw: jest.fn(async () => 1),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import PDFDocument from 'pdfkit';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { prisma as prismaTyped } from '../../utils/prisma';
import {
  assertSupplierConfigured,
  athenaSupplier,
  createInvoiceForPayment,
  createInvoiceForSubscription,
  generateInvoicePDF,
  isPlatformSupply,
  paymentLineDescription,
  supplierReadiness,
  taxTreatmentFor,
  type InvoiceData,
} from '../invoice.service';

const prisma: any = prismaTyped;

// Passes the ABN checksum, which is the only reason it is kept.
const VALID_ABN = '51824753556';

const original = {
  abn: process.env.ATHENA_ABN,
  from: process.env.ATHENA_GST_REGISTERED_FROM,
  address: process.env.ATHENA_BILLING_ADDRESS,
  name: process.env.ATHENA_LEGAL_NAME,
  email: process.env.ATHENA_BILLING_EMAIL,
};

function configure(options: { abn?: string; from?: string; address?: string; name?: string; email?: string }) {
  const set = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  set('ATHENA_ABN', options.abn);
  set('ATHENA_GST_REGISTERED_FROM', options.from);
  set('ATHENA_BILLING_ADDRESS', options.address);
  set('ATHENA_LEGAL_NAME', options.name);
  set('ATHENA_BILLING_EMAIL', options.email);
}

/** Every value the supplier needs, on a domain that is not on the refused list. */
const FULL_IDENTITY = {
  name: 'Example Trading Pty Ltd',
  abn: VALID_ABN,
  address: 'Level 3, 100 Queen St|Brisbane QLD 4000|Australia',
  email: 'billing@mail.example-trading.org',
};

afterAll(() => {
  configure({ abn: original.abn, from: original.from, address: original.address, name: original.name, email: original.email });
});

describe('What an ATHENA document may claim about GST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configure({});
  });

  it('does not call itself a tax invoice when there is no ABN and no registration', () => {
    const treatment = taxTreatmentFor({
      total: 49,
      currency: 'AUD',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      platformIsSupplier: true,
    });

    expect(treatment.title).toBe('Invoice');
    expect(treatment.isTaxInvoice).toBe(false);
    expect(treatment.taxTotal).toBe(0);
    expect(treatment.subtotal).toBe(49);
    expect(treatment.note).toMatch(/not registered for GST/);
  });

  it('is not a tax invoice on an ABN alone: an ABN is not a GST registration', () => {
    configure({ abn: VALID_ABN });

    const treatment = taxTreatmentFor({
      total: 49,
      currency: 'AUD',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      platformIsSupplier: true,
    });

    expect(treatment.isTaxInvoice).toBe(false);
    expect(treatment.taxTotal).toBe(0);
  });

  it('charges one eleventh on an AUD sale once the registration is in force', () => {
    configure({ abn: VALID_ABN, from: '2026-07-01' });

    const treatment = taxTreatmentFor({
      total: 499,
      currency: 'AUD',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      platformIsSupplier: true,
    });

    expect(treatment.title).toBe('Tax invoice');
    expect(treatment.isTaxInvoice).toBe(true);
    expect(treatment.taxTotal).toBe(45.36);
    expect(treatment.subtotal).toBe(453.64);
    expect(treatment.subtotal + treatment.taxTotal).toBeCloseTo(499, 2);
    expect(treatment.note).toContain('A$45.36');
  });

  it('leaves an invoice issued before the registration date alone', () => {
    // The whole reason the registration is a date and not a flag: a PDF is
    // re-rendered from the row on every download, so a document issued in
    // June must not sprout a GST line because July arrived.
    configure({ abn: VALID_ABN, from: '2026-07-01' });

    const treatment = taxTreatmentFor({
      total: 499,
      currency: 'AUD',
      issuedAt: new Date('2026-06-30T00:00:00Z'),
      platformIsSupplier: true,
    });

    expect(treatment.isTaxInvoice).toBe(false);
    expect(treatment.taxTotal).toBe(0);
  });

  it('claims no GST position on a sale settled in another currency', () => {
    configure({ abn: VALID_ABN, from: '2026-07-01' });

    const treatment = taxTreatmentFor({
      total: 100,
      currency: 'USD',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      platformIsSupplier: true,
    });

    expect(treatment.title).toBe('Invoice');
    expect(treatment.taxTotal).toBe(0);
    expect(treatment.note).toMatch(/No GST is included/);
  });

  it('is a receipt, never a tax invoice, for money collected on a provider\'s behalf', () => {
    configure({ abn: VALID_ABN, from: '2026-07-01' });

    const treatment = taxTreatmentFor({
      total: 120,
      currency: 'AUD',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      platformIsSupplier: false,
    });

    expect(treatment.title).toBe('Payment receipt');
    expect(treatment.isTaxInvoice).toBe(false);
    expect(treatment.taxTotal).toBe(0);
    expect(treatment.note).toMatch(/for the provider/);
  });

  it('knows which sales are ATHENA\'s own', () => {
    expect(isPlatformSupply('FORMATION')).toBe(true);
    expect(isPlatformSupply('SUBSCRIPTION')).toBe(true);
    expect(isPlatformSupply('MENTOR_SESSION')).toBe(false);
    expect(isPlatformSupply('SERVICE_ORDER')).toBe(false);
    expect(isPlatformSupply(null)).toBe(false);
    expect(isPlatformSupply('SOMETHING_NEW')).toBe(false);
  });

  it('describes a formation fee as Australian, not as an LLC', () => {
    expect(paymentLineDescription('FORMATION')).toBe('Business formation service');
    expect(paymentLineDescription(undefined)).toBe('ATHENA platform service');
  });
});

describe('The supplier block', () => {
  beforeEach(() => configure({}));

  it('invents nothing: with nothing set there is no name, address or mailbox', () => {
    expect(athenaSupplier()).toEqual({ name: '', address: [], email: '', abn: undefined });
  });

  it('never carries the placeholder entity, address or mailbox the code used to default to', () => {
    const text = JSON.stringify(athenaSupplier());
    expect(text).not.toContain('Pty Ltd');
    expect(text).not.toContain('athena.app');
    expect(text).not.toContain('Final billing address');
  });

  it('reads the identity from the environment', () => {
    configure(FULL_IDENTITY);
    expect(athenaSupplier()).toEqual({
      name: 'Example Trading Pty Ltd',
      address: ['Level 3, 100 Queen St', 'Brisbane QLD 4000', 'Australia'],
      email: 'billing@mail.example-trading.org',
      abn: '51 824 753 556',
    });
  });

  it('prints no ABN line at all rather than an invented one', () => {
    expect(athenaSupplier().abn).toBeUndefined();
  });

  it('refuses an ABN that does not pass its checksum', () => {
    configure({ abn: '12345678901' });
    expect(athenaSupplier().abn).toBeUndefined();
  });

  it('spaces a real ABN the way the register prints it', () => {
    configure({ abn: VALID_ABN });
    expect(athenaSupplier().abn).toBe('51 824 753 556');
  });

  it('splits the billing address on | and drops blank lines', () => {
    configure({ address: ' Level 3, 100 Queen St | |Brisbane QLD 4000 ' });
    expect(athenaSupplier().address).toEqual(['Level 3, 100 Queen St', 'Brisbane QLD 4000']);
  });
});

describe('When ATHENA may put its name to a document', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configure({});
  });

  it('is not ready with nothing set, and names all four variables, not the GST date', () => {
    expect(supplierReadiness()).toEqual({
      ready: false,
      missing: ['ATHENA_LEGAL_NAME', 'ATHENA_BILLING_ADDRESS', 'ATHENA_BILLING_EMAIL', 'ATHENA_ABN'],
    });
  });

  it('is ready with the four set, and needs no GST registration date', () => {
    configure(FULL_IDENTITY);
    expect(supplierReadiness()).toEqual({ ready: true, missing: [] });
  });

  it.each([
    ['ATHENA_LEGAL_NAME', { name: undefined }],
    ['ATHENA_BILLING_ADDRESS', { address: undefined }],
    ['ATHENA_BILLING_EMAIL', { email: undefined }],
    ['ATHENA_ABN', { abn: undefined }],
  ])('names %s when it alone is missing', (variable, gap) => {
    configure({ ...FULL_IDENTITY, ...gap });
    expect(supplierReadiness()).toEqual({ ready: false, missing: [variable] });
  });

  it('does not take a name of spaces, or an ABN that fails its checksum', () => {
    configure({ ...FULL_IDENTITY, name: '   ', abn: '12345678901' });
    expect(supplierReadiness().missing).toEqual(['ATHENA_LEGAL_NAME', 'ATHENA_ABN']);
  });

  it.each(['billing@athena.app', 'billing@athena.com', 'billing@mail.athena.app', 'billing@example.com', 'not an address'])(
    'does not take %s as a billing mailbox',
    (email) => {
      configure({ ...FULL_IDENTITY, email });
      expect(supplierReadiness().missing).toEqual(['ATHENA_BILLING_EMAIL']);
    }
  );

  it('refuses with a 503 and the code, naming no value and no variable to the member who sees it', () => {
    configure({ ...FULL_IDENTITY, email: undefined });

    let thrown: unknown;
    try {
      assertSupplierConfigured();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(503);
    expect((thrown as ApiError).details).toEqual({ code: 'BILLING_IDENTITY_NOT_CONFIGURED' });
    expect((thrown as ApiError).message).not.toMatch(/ATHENA_|Example Trading|824/);
    // The operator is told which variable, in the log.
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), { missing: ['ATHENA_BILLING_EMAIL'] });
  });

  it('lets a complete supplier through', () => {
    configure(FULL_IDENTITY);
    expect(() => assertSupplierConfigured()).not.toThrow();
  });
});

const buyer = { name: 'Mei Chen', email: 'mei@example.com' };

function documentFor(seller: InvoiceData['seller']): InvoiceData {
  return {
    invoiceNumber: 'INV-202609-00001',
    invoiceDate: new Date('2026-09-01T00:00:00Z'),
    dueDate: new Date('2026-09-01T00:00:00Z'),
    status: 'PAID',
    documentTitle: 'Invoice',
    seller,
    buyer,
    items: [{ description: 'ATHENA membership', quantity: 1, unitPrice: 49, amount: 49 }],
    subtotal: 49,
    taxTotal: 0,
    total: 49,
    currency: 'AUD',
  };
}

describe('The document itself', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configure({});
  });

  it('is not produced for a supplier with no name, address or mailbox', async () => {
    await expect(generateInvoicePDF(documentFor(athenaSupplier()))).rejects.toMatchObject({
      statusCode: 503,
      details: { code: 'BILLING_IDENTITY_NOT_CONFIGURED' },
    });
  });

  it('is not produced for a supplier with an address and a mailbox but no ABN', async () => {
    configure({ ...FULL_IDENTITY, abn: undefined });
    await expect(generateInvoicePDF(documentFor(athenaSupplier()))).rejects.toMatchObject({
      details: { code: 'BILLING_IDENTITY_NOT_CONFIGURED' },
    });
  });

  it('is a PDF for a complete supplier', async () => {
    configure(FULL_IDENTITY);
    const pdf = await generateInvoicePDF(documentFor(athenaSupplier()));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('prints the configured billing mailbox in the footer as well as the header, and never athena.app', async () => {
    configure(FULL_IDENTITY);
    const printed: string[] = [];
    const text = PDFDocument.prototype.text;
    const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (this: any, ...args: any[]) {
      printed.push(String(args[0]));
      return (text as any).apply(this, args);
    });

    try {
      await generateInvoicePDF(documentFor(athenaSupplier()));
    } finally {
      spy.mockRestore();
    }

    expect(printed).toContain('Questions? Contact us at billing@mail.example-trading.org');
    expect(printed).toContain('Email: billing@mail.example-trading.org');
    expect(printed.join('\n')).not.toContain('athena.app');
    // And the address the document names is the configured one, not a sentence.
    expect(printed).toContain('Level 3, 100 Queen St');
    expect(printed.join('\n')).not.toMatch(/Final billing address/);
  });
});

describe('Filing an invoice when ATHENA has not said who it is', () => {
  const decimal = (value: number) => ({ toNumber: () => value, valueOf: () => value });

  beforeEach(() => {
    jest.clearAllMocks();
    configure({});
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.create.mockImplementation(async ({ data }: any) => ({ id: 'inv-1', ...data }));
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      userId: 'member-1',
      amount: decimal(49),
      currency: 'AUD',
      status: 'COMPLETED',
      method: 'card',
      type: 'FORMATION',
      stripePaymentIntentId: 'pi_1',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
      user: { displayName: 'Mei Chen', email: 'mei@example.com' },
    });
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'member-1',
      tier: 'PREMIUM_CAREER',
      user: { displayName: 'Mei Chen', email: 'mei@example.com' },
    });
  });

  const charge = { amount: 29, currency: 'AUD', paidAt: new Date('2026-09-01T00:00:00Z') };

  it('still files the invoice for a payment, since the sale happened, and produces no document', async () => {
    const issued = await createInvoiceForPayment('pay-1');

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(issued).toMatchObject({ created: true, pdf: null, emailed: 'not_requested' });
    expect(issued.invoiceNumber).toMatch(/^INV-/);
  });

  it('still files the invoice for a paid membership period, so the Stripe event is handled and not retried', async () => {
    const issued = await createInvoiceForSubscription('sub-1', charge);

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.create.mock.calls[0][0].data).toMatchObject({ subscriptionId: 'sub-1', amount: 29, currency: 'AUD' });
    expect(issued).toMatchObject({ created: true, pdf: null });
  });

  it('refuses a request to email the invoice, and files and sends nothing', async () => {
    await expect(createInvoiceForPayment('pay-1', { sendEmail: true })).rejects.toMatchObject({
      statusCode: 503,
      details: { code: 'BILLING_IDENTITY_NOT_CONFIGURED' },
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('produces the document for a payment once the identity is set', async () => {
    configure(FULL_IDENTITY);
    const issued = await createInvoiceForPayment('pay-1');
    expect(issued.pdf?.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produces the document for a membership period once the identity is set', async () => {
    configure(FULL_IDENTITY);
    const issued = await createInvoiceForSubscription('sub-1', charge);
    expect(issued.pdf?.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
