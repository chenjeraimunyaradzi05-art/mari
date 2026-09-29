/**
 * The referral ledger's arithmetic and its bank-statement matching.
 *
 * The finding this answers was that "paid" on the ledger was the sum of
 * clicks on a dropdown. So the tests that matter most here are the ones that
 * pin what counts as money in: only a recorded, unreversed payment; never a
 * status on its own; and a fee marked paid the old way is shown as exactly
 * that, not quietly counted.
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../../utils/stripe', () => ({ isStripeConfigured: () => false, getStripe: () => { throw new Error('not in these tests'); } }));

import {
  LEDGER_VERBS, brisbaneDay, detectColumns, isReconciled, ledgerAttention, ledgerPosition, parseBankAmount, parseBankDate, planReconciliation, readLedger, readStatement, receiptSchema, receiptsToCsv,
  recordedAgainst, referenceKey, referralColumnsAfter, statusAfterPayments, stripeProblem, summariseLedger, type LedgerAuditRow, type Receipt,
} from '../referral-ledger.service';

const T0 = new Date('2026-09-01T00:00:00Z').getTime();
let tick = 0;
const at = () => new Date(T0 + (tick += 1) * 60_000);
const admin = { firstName: 'Priya', lastName: 'Shah', displayName: null };

function row(metadata: Record<string, unknown>, actor = 'admin-1'): LedgerAuditRow {
  return { createdAt: at(), actorUserId: actor, metadata: { area: 'automotive', resourceType: 'CarReferral', ...metadata }, actorUser: admin };
}
const recorded = (referral: string, paymentId: string, amountCents: number, receivedOn: string, reference: string, extra: Record<string, unknown> = {}) =>
  row({ adminAction: LEDGER_VERBS.recorded, resourceId: referral, paymentId, amountCents, receivedOn, method: 'BANK_TRANSFER', reference, ...extra });
const reversed = (referral: string, paymentId: string, reason = 'Recorded against the wrong fee') => row({ adminAction: LEDGER_VERBS.reversed, resourceId: referral, paymentId, reason });
const reconciled = (referral: string, paymentId: string, bankLine: Record<string, unknown>) => row({ adminAction: LEDGER_VERBS.reconciled, resourceId: referral, paymentId, reconciliationId: 'rec-1', statement: 'sept.csv', bankLine });

function receipt(over: Partial<Receipt> & { paymentId: string; amountCents: number }): Receipt {
  const reference = over.reference ?? 'ATH-REF-0001';
  return {
    referralId: 'r1', receivedOn: '2026-09-10', method: 'BANK_TRANSFER', reference, referenceKey: referenceKey(reference), note: null, recordedAt: at(), recordedBy: { id: 'a', name: 'Priya' },
    stripe: null, reversal: null, reconciliation: null, ...over,
  };
}

describe('Reading the ledger from its audit rows', () => {
  it('builds each fee\'s payments, with reversals, reconciliations and who confirmed it', () => {
    const ledger = readLedger([
      row({ adminAction: 'CAR_REFERRAL_UPDATED', resourceId: 'r1', status: { from: 'PENDING', to: 'CONFIRMED' } }),
      recorded('r1', 'p1', 20_000, '2026-09-10', 'INV 1001'),
      recorded('r1', 'p2', 5_000, '2026-09-12', 'INV 1001'),
      reversed('r1', 'p2'),
      reconciled('r1', 'p1', { date: '2026-09-10', amountCents: 20_000, description: 'SUNNY MOTORS INV1001' }),
      recorded('r2', 'p3', 18_000, '2026-09-11', 'POLICY-77', { confirmedByPayment: true }),
      row({ adminAction: 'CAR_LISTING_REVIEWED', resourceType: 'VehicleListing', resourceId: 'l1' }),
    ]);
    const r1 = ledger.receipts.get('r1')!;
    expect(r1.map((p) => p.paymentId)).toEqual(['p1', 'p2']);
    expect(r1[1].reversal).toMatchObject({ reason: 'Recorded against the wrong fee', by: { name: 'Priya Shah' } });
    expect(r1[0].reconciliation?.bankLine).toEqual({ date: '2026-09-10', amountCents: 20_000, description: 'SUNNY MOTORS INV1001' });
    expect(isReconciled(r1[0])).toBe(true);
    expect(ledger.confirmations.get('r1')?.how).toBe('ADMIN');
    expect(ledger.confirmations.get('r2')?.how).toBe('PAYMENT');
    expect(ledger.unreadable).toBe(0);
  });

  it('reads the rows in the order they were written whatever order they arrive in, and keeps the first of a duplicate', () => {
    const first = recorded('r1', 'p1', 10_000, '2026-09-10', 'REF-1');
    const reversal = reversed('r1', 'p1');
    const again = recorded('r1', 'p1', 99_900, '2026-09-10', 'REF-1');
    const ledger = readLedger([again, reversal, first]);
    expect(ledger.receipts.get('r1')).toHaveLength(1);
    expect(ledger.byPayment.get('p1')).toMatchObject({ amountCents: 10_000, reversal: { reason: 'Recorded against the wrong fee' } });
  });

  it('counts an entry it cannot read rather than guessing at it', () => {
    const ledger = readLedger([recorded('r1', 'p1', 12.5 as unknown as number, '2026-09-10', 'REF-1'), reversed('r1', 'nope')]);
    expect(ledger.receipts.size).toBe(0);
    expect(ledger.unreadable).toBe(2);
  });
});

describe('Where a fee stands', () => {
  it('counts only payments that have not been reversed, and knows the day the fee was covered', () => {
    const payments = [receipt({ paymentId: 'a', amountCents: 10_000, receivedOn: '2026-09-02' }), receipt({ paymentId: 'b', amountCents: 50_000, receivedOn: '2026-09-01', reversal: { at: new Date(), by: { id: null, name: null }, reason: 'x' } }), receipt({ paymentId: 'c', amountCents: 32_000, receivedOn: '2026-09-09' })];
    expect(ledgerPosition(420, payments)).toMatchObject({ feeCents: 42_000, receivedCents: 42_000, outstandingCents: 0, overpaidCents: 0, state: 'PAID', paidOn: '2026-09-09' });
    expect(ledgerPosition(500, payments)).toMatchObject({ state: 'PART_PAID', outstandingCents: 8_000, paidOn: null });
    expect(ledgerPosition(400, payments)).toMatchObject({ state: 'OVERPAID', overpaidCents: 2_000, paidOn: '2026-09-09' });
    expect(ledgerPosition(400, [])).toMatchObject({ state: 'UNPAID', receivedCents: 0 });
  });

  it('lets the money decide the status, and never lets a status stand in for money', () => {
    const paid = [receipt({ paymentId: 'a', amountCents: 42_000 })];
    const part = [receipt({ paymentId: 'a', amountCents: 10_000 })];
    const gone = [receipt({ paymentId: 'a', amountCents: 42_000, reversal: { at: new Date(), by: { id: null, name: null }, reason: 'x' } })];
    expect(statusAfterPayments('PENDING', 420, paid)).toBe('PAID');
    expect(statusAfterPayments('PENDING', 420, part)).toBe('CONFIRMED');
    expect(statusAfterPayments('PAID', 420, gone)).toBe('CONFIRMED');
    expect(statusAfterPayments('VOID', 420, paid)).toBe('VOID');
    // A fee the old dropdown marked PAID keeps the status an admin gave it
    // until somebody records the payment; it is not counted as money (below).
    expect(statusAfterPayments('PAID', 420, [])).toBe('PAID');
    expect(statusAfterPayments('PENDING', 420, [])).toBe('PENDING');
  });

  it('dates PAID to the day the money arrived, in Brisbane, and confirms a fee a partner has paid', () => {
    const cols = referralColumnsAfter({ status: 'PENDING', fee: 420, confirmedAt: null }, [receipt({ paymentId: 'a', amountCents: 42_000, receivedOn: '2026-09-10' })], new Date('2026-09-20T00:00:00Z'));
    expect(cols.status).toBe('PAID');
    expect(cols.paidAt?.toISOString()).toBe('2026-09-09T14:00:00.000Z');
    expect(cols.confirmedAt?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    const reversedAll = referralColumnsAfter({ status: 'PAID', fee: 420, confirmedAt: new Date('2026-09-01') }, [receipt({ paymentId: 'a', amountCents: 42_000, reversal: { at: new Date(), by: { id: null, name: null }, reason: 'x' } })]);
    expect(reversedAll).toMatchObject({ status: 'CONFIRMED', paidAt: null });
  });
});

describe('The ledger\'s totals', () => {
  const rows = [
    { id: 'pending', kind: 'INSURANCE', status: 'PENDING', fee: 180 },
    { id: 'part', kind: 'DEALER_SALE', status: 'CONFIRMED', fee: 420 },
    { id: 'paid', kind: 'DEALER_SALE', status: 'PAID', fee: 350 },
    { id: 'legacy', kind: 'WARRANTY', status: 'PAID', fee: 200 },
    { id: 'void', kind: 'FINANCE', status: 'VOID', fee: 300 },
  ];
  const ledger = readLedger([
    recorded('part', 'p1', 10_050, '2026-09-10', 'SUNNY-1'),
    recorded('paid', 'p2', 35_000, '2026-09-11', 'SUNNY-2'),
    reconciled('paid', 'p2', { date: '2026-09-11', amountCents: 35_000, description: 'SUNNY-2' }),
    recorded('void', 'p3', 30_000, '2026-09-12', 'LENDER-9'),
  ]);

  it('sums what was recorded as received, and only that', () => {
    const t = summariseLedger(rows, ledger);
    expect(t).toMatchObject({ pending: 180, confirmed: 319.5, paid: 750.5, reconciled: 350, unreconciled: 400.5, heldOnVoid: 300, partPaid: 1, overpaid: 0 });
    // The fee marked paid by the old dropdown is not money in: it is listed
    // on its own, so the totals still account for every fee.
    expect(t.markedPaidUnrecorded).toEqual({ count: 1, fee: 200 });
    expect(t.byKind.DEALER_SALE).toEqual({ count: 2, fee: 770, paid: 450.5 });
    expect(t.byKind.FINANCE).toBeUndefined();
  });

  it('raises money on a void fee, a paid fee with no payment, and more paid than owed', () => {
    const byId = (id: string) => ledgerAttention(rows.find((r) => r.id === id)!, ledger.receipts.get(id) ?? []).map((a) => a.key);
    expect(byId('void')).toEqual(['MONEY_ON_VOID']);
    expect(byId('legacy')).toEqual(['MARKED_PAID_NO_PAYMENT']);
    expect(ledgerAttention({ id: 'x', status: 'PAID', fee: 100 }, [receipt({ paymentId: 'z', amountCents: 15_000 })]).map((a) => a.key)).toEqual(['OVERPAID']);
    expect(byId('part')).toEqual([]);
  });
});

describe('Recording a payment', () => {
  const now = new Date('2026-09-26T20:00:00Z'); // 6 am on the 27th in Brisbane
  it('takes today in Brisbane, dollars and cents, and a Stripe id that is one', () => {
    expect(brisbaneDay(now)).toBe('2026-09-27');
    const ok = { amount: 180.5, receivedOn: '2026-09-27', method: 'BANK_TRANSFER', reference: 'INV 1001' };
    expect(receiptSchema(now).safeParse(ok).success).toBe(true);
    expect(receiptSchema(now).safeParse({ ...ok, receivedOn: '2026-09-28' }).success).toBe(false);
    expect(receiptSchema(now).safeParse({ ...ok, receivedOn: '2026-02-30' }).success).toBe(false);
    expect(receiptSchema(now).safeParse({ ...ok, amount: 180.505 }).success).toBe(false);
    expect(receiptSchema(now).safeParse({ ...ok, method: 'STRIPE' }).success).toBe(false);
    expect(receiptSchema(now).safeParse({ ...ok, method: 'STRIPE', reference: 'pi_3PqRsTuVwXyZ01' }).success).toBe(true);
  });

  it('holds what is recorded against one Stripe payment to what Stripe says arrived', () => {
    const check = { checked: true as const, object: 'payment_intent' as const, id: 'pi_3PqRsTuVwXyZ01', amountCents: 50_000, currency: 'aud', status: 'succeeded', paid: true };
    expect(stripeProblem(check, 0, 50_000)).toBeNull();
    expect(stripeProblem(check, 30_000, 20_001)).toMatch(/no more than \$200 can be recorded/);
    expect(stripeProblem({ ...check, paid: false, status: 'requires_payment_method' }, 0, 100)).toMatch(/requires payment method, not paid/);
    expect(stripeProblem({ ...check, currency: 'usd' }, 0, 100)).toMatch(/USD/);
    const ledger = readLedger([recorded('r1', 'p1', 30_000, '2026-09-10', 'pi_3PqRsTuVwXyZ01'), recorded('r2', 'p2', 1_000, '2026-09-10', 'PI_3PQRSTUVWXYZ01'), reversed('r2', 'p2')]);
    expect(recordedAgainst(ledger, referenceKey('pi_3PqRsTuVwXyZ01'))).toBe(30_000);
    expect(recordedAgainst(ledger, referenceKey('pi_3PqRsTuVwXyZ01'), 'p1')).toBe(0);
  });
});

describe('Reading a bank statement', () => {
  it('reads the dates and amounts Australian banks write', () => {
    expect(parseBankDate('03/10/2026')).toBe('2026-10-03');
    expect(parseBankDate('3-10-26')).toBe('2026-10-03');
    expect(parseBankDate('2026-10-03')).toBe('2026-10-03');
    expect(parseBankDate('03 Oct 2026')).toBe('2026-10-03');
    expect(parseBankDate('3 Sept 2026')).toBe('2026-09-03');
    expect(parseBankDate('31/02/2026')).toBeNull();
    expect(parseBankDate('3 Octopus 2026')).toBeNull();
    expect(parseBankDate('Closing balance')).toBeNull();
    expect(parseBankAmount('$1,234.56')).toBe(123_456);
    expect(parseBankAmount('-12.00')).toBe(-1_200);
    expect(parseBankAmount('(12.00)')).toBe(-1_200);
    expect(parseBankAmount('12.00 CR')).toBe(1_200);
    expect(parseBankAmount('12.00 DR')).toBe(-1_200);
    expect(parseBankAmount('twelve')).toBeNull();
  });

  it('recognises a header with separate debit and credit columns, and keeps only money in', () => {
    const csv = 'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance\n032000123456,10/09/2026,DEPOSIT SUNNY MOTORS INV1001,,420.00,5420.00\n032000123456,11/09/2026,CARD FEE,5.00,,5415.00\n';
    expect(detectColumns(['Bank Account', 'Date', 'Narrative', 'Debit Amount', 'Credit Amount', 'Balance'])).toEqual({ date: 1, amount: null, credit: 4, description: [2] });
    const read = readStatement(csv);
    expect(read.lines).toEqual([{ line: 2, date: '2026-09-10', amountCents: 42_000, description: 'DEPOSIT SUNNY MOTORS INV1001' }]);
    expect(read.errors).toEqual([]);
  });

  it('reads a headerless export as date, amount, description, and skips the lines that are not transactions', () => {
    const read = readStatement('10/09/2026,+420.00,"Transfer from SUNNY MOTORS INV1001",5420.00\n11/09/2026,-5.00,Card fee,5415.00\nClosing balance,,,5415.00\n');
    expect(read.header).toBeNull();
    expect(read.map).toEqual({ date: 0, amount: 1, credit: null, description: [2] });
    expect(read.lines).toHaveLength(1);
    expect(read.skipped).toBe(1);
  });

  it('asks which column is which when it cannot tell, and uses the answer', () => {
    const csv = 'When,What,How much\n10/09/2026,SUNNY MOTORS INV1001,420.00\n';
    const unsure = readStatement(csv);
    expect(unsure.map).toBeNull();
    expect(unsure.sample[0]).toEqual(['When', 'What', 'How much']);
    const mapped = readStatement(csv, { date: 0, amount: 2, credit: null, description: [1] });
    expect(mapped.lines).toEqual([{ line: 2, date: '2026-09-10', amountCents: 42_000, description: 'SUNNY MOTORS INV1001' }]);
    expect(readStatement(csv, { date: 0, amount: 7, credit: null, description: [1] }).errors[0].message).toMatch(/column 8/);
  });

  it('reports an amount it cannot read by its line', () => {
    const read = readStatement('Date,Amount,Description\n10/09/2026,4two0,SUNNY\n');
    expect(read.errors).toEqual([{ line: 2, message: '"4two0" is not an amount' }]);
  });
});

describe('Matching a statement to the ledger', () => {
  const line = (n: number, date: string, amountCents: number, description: string) => ({ line: n, date, amountCents, description });

  it('matches a payment by its reference, amount and day', () => {
    const plan = planReconciliation([line(2, '2026-09-11', 42_000, 'DEPOSIT SUNNY MOTORS INV-1001')], [receipt({ paymentId: 'a', amountCents: 42_000, reference: 'INV 1001', receivedOn: '2026-09-10' })]);
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0].receipts.map((r) => r.paymentId)).toEqual(['a']);
    expect(plan.unmatchedCredits).toEqual([]);
    expect(plan.unmatchedReceipts).toEqual([]);
  });

  it('takes several fees paid in one transfer under one reference together', () => {
    const payments = [receipt({ paymentId: 'a', referralId: 'r1', amountCents: 30_000, reference: 'LENDER STATEMENT SEP' }), receipt({ paymentId: 'b', referralId: 'r2', amountCents: 12_000, reference: 'LENDER STATEMENT SEP' })];
    const plan = planReconciliation([line(5, '2026-09-10', 42_000, 'LENDER STATEMENT SEP COMMISSIONS')], payments);
    expect(plan.matches[0].receipts.map((r) => r.paymentId).sort()).toEqual(['a', 'b']);
  });

  it('suggests, and does not match, a payment that fits only by amount and day', () => {
    const plan = planReconciliation([line(3, '2026-09-10', 18_000, 'TRANSFER 88123')], [receipt({ paymentId: 'a', amountCents: 18_000, reference: 'POLICY 77' })]);
    expect(plan.matches).toEqual([]);
    expect(plan.suggestions[0].receipts[0].paymentId).toBe('a');
  });

  it('offers a payment two lines could both be to neither of them', () => {
    const plan = planReconciliation([line(3, '2026-09-10', 18_000, 'TRANSFER A'), line(4, '2026-09-11', 18_000, 'TRANSFER B')], [receipt({ paymentId: 'a', amountCents: 18_000, reference: 'POLICY 77' })]);
    expect(plan.suggestions).toEqual([]);
    expect(plan.unmatchedCredits).toHaveLength(2);
    expect(plan.unmatchedReceipts.map((r) => r.paymentId)).toEqual(['a']);
  });

  it('leaves a line two sets of payments could explain to a person', () => {
    const payments = [receipt({ paymentId: 'a', amountCents: 10_000, reference: 'ABCD1' }), receipt({ paymentId: 'b', amountCents: 10_000, reference: 'WXYZ2' })];
    const plan = planReconciliation([line(2, '2026-09-10', 10_000, 'ABCD1 WXYZ2')], payments);
    expect(plan.ambiguous).toHaveLength(1);
    expect(plan.matches).toEqual([]);
  });

  it('says when the ledger records money inside the statement\'s dates that the bank never received', () => {
    const plan = planReconciliation(
      [line(2, '2026-09-01', 5_000, 'INTEREST'), line(9, '2026-09-30', 7_000, 'OTHER')],
      [receipt({ paymentId: 'ghost', amountCents: 42_000, reference: 'INV 2002', receivedOn: '2026-09-15' }), receipt({ paymentId: 'october', amountCents: 1_000, reference: 'INV 3003', receivedOn: '2026-10-15' })],
    );
    expect(plan.unmatchedReceipts.map((r) => r.paymentId)).toEqual(['ghost']);
    expect(plan.unmatchedCredits).toHaveLength(2);
  });

  it('does not match outside the tolerance, a reversed payment, a Stripe payment, or a line already matched', () => {
    const matchedBefore = receipt({ paymentId: 'done', amountCents: 42_000, reference: 'INV 1001', reconciliation: { at: new Date(), by: { id: null, name: null }, reconciliationId: 'x', statement: null, bankLine: { date: '2026-09-10', amountCents: 42_000, description: 'SUNNY INV1001' }, stripe: null } });
    const plan = planReconciliation(
      [line(2, '2026-09-10', 42_000, 'SUNNY INV1001'), line(3, '2026-09-10', 9_000, 'INV 4004'), line(4, '2026-09-10', 8_000, 'INV 5005'), line(5, '2026-09-10', 7_000, 'pi_3PqRsTuVwXyZ01')],
      [matchedBefore, receipt({ paymentId: 'late', amountCents: 9_000, reference: 'INV 4004', receivedOn: '2026-09-20' }), receipt({ paymentId: 'rev', amountCents: 8_000, reference: 'INV 5005', reversal: { at: new Date(), by: { id: null, name: null }, reason: 'x' } }), receipt({ paymentId: 'stripe', amountCents: 7_000, method: 'STRIPE', reference: 'pi_3PqRsTuVwXyZ01' })],
    );
    expect(plan.alreadyReconciled.map((l) => l.line)).toEqual([2]);
    expect(plan.matches).toEqual([]);
    expect(plan.unmatchedCredits.map((l) => l.line)).toEqual([3, 4, 5]);
  });
});

describe('The payments export', () => {
  it('writes every payment, reversals included, with nothing a spreadsheet would run', () => {
    const csv = receiptsToCsv([
      { ...receipt({ paymentId: 'a', amountCents: 42_000, reference: '=HYPERLINK("x")' }), kind: 'Dealership sale', partner: 'Sunny Motors', fee: 420, feeStatus: 'PAID' },
      { ...receipt({ paymentId: 'b', amountCents: 500, reversal: { at: new Date('2026-09-12T00:00:00Z'), by: { id: null, name: null }, reason: 'Twice' } }), kind: 'Parts supplied', partner: null, fee: 5, feeStatus: 'CONFIRMED' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0].split(',')[0]).toBe('receivedOn');
    expect(lines[1]).toContain('420.00');
    expect(lines[1]).toContain('"\'=HYPERLINK(""x"")"');
    expect(lines[2]).toContain('Twice');
  });
});
