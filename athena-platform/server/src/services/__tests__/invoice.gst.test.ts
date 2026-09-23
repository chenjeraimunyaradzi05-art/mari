import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    invoice: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
    payment: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  athenaSupplier,
  isPlatformSupply,
  paymentLineDescription,
  taxTreatmentFor,
} from '../invoice.service';

// Passes the ABN checksum, which is the only reason it is kept.
const VALID_ABN = '51824753556';

const original = {
  abn: process.env.ATHENA_ABN,
  from: process.env.ATHENA_GST_REGISTERED_FROM,
  address: process.env.ATHENA_BILLING_ADDRESS,
};

function configure(options: { abn?: string; from?: string; address?: string }) {
  if (options.abn === undefined) delete process.env.ATHENA_ABN;
  else process.env.ATHENA_ABN = options.abn;

  if (options.from === undefined) delete process.env.ATHENA_GST_REGISTERED_FROM;
  else process.env.ATHENA_GST_REGISTERED_FROM = options.from;

  if (options.address === undefined) delete process.env.ATHENA_BILLING_ADDRESS;
  else process.env.ATHENA_BILLING_ADDRESS = options.address;
}

afterAll(() => {
  configure({ abn: original.abn, from: original.from, address: original.address });
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

  it('keeps the placeholder address visible until a real one is configured', () => {
    expect(athenaSupplier().address.join(' ')).toMatch(/Final billing address to be published/);

    configure({ address: 'Level 3, 100 Queen St|Brisbane QLD 4000|Australia' });
    expect(athenaSupplier().address).toEqual(['Level 3, 100 Queen St', 'Brisbane QLD 4000', 'Australia']);
  });
});
