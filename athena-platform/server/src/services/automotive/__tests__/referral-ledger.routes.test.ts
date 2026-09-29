/**
 * The referral ledger through the router: recording what a partner paid,
 * reversing a mistake, checking a Stripe payment, matching a bank statement,
 * and the totals and statuses that follow from all of it.
 *
 * The double below answers the Json `path` filters the ledger reads with, and
 * runs both forms of $transaction all-or-nothing, putting the store back when
 * anything inside fails — which is what lets these tests show that a payment
 * and the change to its fee land together or not at all. It is not Postgres:
 * the Serializable isolation the routes ask for, and the retry on a
 * serialization failure, are only shown here in the sense that the retry path
 * is exercised; the integration project is where the real database answers.
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;
const store: { referrals: Row[]; audits: Row[] } = { referrals: [], audits: [] };
const failures: { auditCreate: number; serialization: number } = { auditCreate: 0, serialization: 0 };
const users: Record<string, Row> = { admin: { id: 'admin', firstName: 'Priya', lastName: 'Shah', displayName: null, email: 'priya@athena.test' }, admin2: { id: 'admin2', firstName: 'Jo', lastName: 'Park', displayName: null, email: 'jo@athena.test' }, member: { id: 'member', firstName: 'Mei', lastName: 'Lin', displayName: null, email: 'mei@athena.test' } };
const stripeState: { configured: boolean; objects: Record<string, Row>; down: boolean } = { configured: false, objects: {}, down: false };

jest.mock('../../../utils/prisma', () => {
  const { randomUUID } = jest.requireActual<typeof import('crypto')>('crypto');
  const { Prisma } = jest.requireActual<typeof import('@prisma/client')>('@prisma/client');
  const valueAt = (v: unknown, path: string[]) => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Row)[k] : undefined), v);
  const matches = (row: Row, where: Row | undefined): boolean => !where || Object.entries(where).every(([k, v]) => {
    if (k === 'AND') return (v as Row[]).every((w) => matches(row, w));
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      if ('path' in v) return valueAt(row[k], v.path as string[]) === v.equals;
      if ('in' in v) return (v.in as unknown[]).includes(row[k]);
      if ('not' in v) return row[k] !== v.not;
      throw new Error(`the double does not know ${JSON.stringify(v)}`);
    }
    return row[k] === v;
  });
  /** A thenable that does nothing until awaited, like a PrismaPromise. */
  const lazy = <T>(run: () => T) => {
    let started: Promise<T> | null = null;
    const go = () => (started ??= Promise.resolve().then(run));
    return { then: <A, B>(ok?: (v: T) => A, ko?: (e: unknown) => B) => go().then(ok, ko), catch: <B>(ko: (e: unknown) => B) => go().catch(ko) };
  };
  const relate = (r: Row, args: Row = {}) => {
    const out: Row = { ...r };
    if (args.include) { out.user = r.userId ? users[r.userId] ?? null : null; out.dealership = null; }
    if (args.select) {
      const picked: Row = {};
      for (const key of Object.keys(args.select)) picked[key] = key === 'dealership' ? null : r[key];
      return picked;
    }
    return out;
  };
  const client: Row = {
    carReferral: {
      findUnique: (args: Row) => lazy(() => { const r = store.referrals.find((x) => matches(x, args.where)); return r ? relate(r, args) : null; }),
      findMany: (args: Row = {}) => lazy(() => store.referrals.filter((x) => matches(x, args.where)).slice(0, args.take ?? undefined).map((r) => relate(r, args))),
      create: (args: Row) => lazy(() => {
        const row = { id: randomUUID(), status: 'PENDING', userId: null, dealershipId: null, referenceId: null, partner: null, note: null, createdById: null, confirmedAt: null, paidAt: null, feePercent: 0, createdAt: new Date(), updatedAt: new Date(), ...args.data };
        store.referrals.push(row);
        return relate(row, args);
      }),
      update: (args: Row) => lazy(() => {
        const row = store.referrals.find((x) => matches(x, args.where));
        if (!row) throw new Error('not found');
        for (const [k, v] of Object.entries(args.data as Row)) if (v !== undefined) row[k] = v;
        row.updatedAt = new Date();
        return relate(row, args);
      }),
    },
    auditLog: {
      create: ({ data }: Row) => lazy(() => {
        if (failures.auditCreate > 0) { failures.auditCreate -= 1; throw new Error('audit insert failed'); }
        const row = { id: randomUUID(), createdAt: new Date(Date.now() + store.audits.length), ...data };
        store.audits.push(row);
        return row;
      }),
      findMany: ({ where }: Row) => lazy(() => store.audits.filter((r) => matches(r, where)).map((r) => ({ ...r, actorUser: r.actorUserId ? users[r.actorUserId] ?? null : null }))),
    },
    user: { findMany: () => lazy(() => []) },
    notification: { create: () => lazy(() => null) },
  };
  const snapshot = () => ({ referrals: store.referrals.map((r) => ({ ...r })), audits: store.audits.map((r) => ({ ...r })) });
  const restore = (s: ReturnType<typeof snapshot>) => { store.referrals = s.referrals; store.audits = s.audits; };
  /** Both forms, all or nothing; the interactive form can be told to fail as Postgres does under contention. */
  client.$transaction = async (arg: unknown) => {
    const before = snapshot();
    try {
      if (typeof arg === 'function') {
        if (failures.serialization > 0) { failures.serialization -= 1; throw new Prisma.PrismaClientKnownRequestError('could not serialize access', { code: 'P2034', clientVersion: 'test' }); }
        return await (arg as (tx: Row) => Promise<unknown>)(client);
      }
      const out: unknown[] = [];
      for (const op of arg as Array<PromiseLike<unknown>>) out.push(await op);
      return out;
    } catch (error) {
      restore(before);
      throw error;
    }
  };
  return { prisma: client };
});

jest.mock('../../../utils/stripe', () => {
  const missing = () => Object.assign(new Error('No such payment'), { code: 'resource_missing', statusCode: 404 });
  const retrieve = (id: string) => {
    if (stripeState.down) throw Object.assign(new Error('connection reset'), { type: 'StripeConnectionError' });
    const o = stripeState.objects[id];
    if (!o) throw missing();
    return o;
  };
  return {
    isStripeConfigured: () => stripeState.configured,
    getStripe: () => ({ paymentIntents: { retrieve: async (id: string) => retrieve(id) }, charges: { retrieve: async (id: string) => retrieve(id) }, invoices: { retrieve: async (id: string) => retrieve(id) } }),
  };
});
jest.mock('../../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.test' }; next(); },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }, redactSensitive: (v: unknown) => v }));

import automotiveRoutes from '../../../routes/automotive.routes';
import { errorHandler } from '../../../middleware/errorHandler';
import { resetMemoryRateLimits } from '../../../middleware/rateLimiter';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/automotive', automotiveRoutes);
app.use(errorHandler);

const admin = { 'x-test-user': 'admin', 'x-test-role': 'ADMIN' };
const admin2 = { 'x-test-user': 'admin2', 'x-test-role': 'ADMIN' };
const member = { 'x-test-user': 'member' };
const base = '/api/automotive/admin/referrals';
const verbs = () => store.audits.map((a) => a.metadata.adminAction);

function fee(over: Row = {}): Row {
  const row = { id: `ref-${store.referrals.length + 1}`, kind: 'DEALER_SALE', status: 'PENDING', userId: 'member', dealershipId: null, referenceId: null, partner: 'Sunny Motors', basisAmount: 42_000, feePercent: 1, fee: 420, note: null, createdById: null, confirmedAt: null, paidAt: null, createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01'), ...over };
  store.referrals.push(row);
  return row;
}
const bank = (amount: number, receivedOn: string, reference: string) => ({ amount, receivedOn, method: 'BANK_TRANSFER', reference });
const pay = (id: string, body: Row, who: Record<string, string> = admin) => request(app).post(`${base}/${id}/payments`).set(who).send(body);

beforeEach(() => {
  resetMemoryRateLimits();
  store.referrals = [];
  store.audits = [];
  failures.auditCreate = 0;
  failures.serialization = 0;
  stripeState.configured = false;
  stripeState.objects = {};
  stripeState.down = false;
});

describe('The referral ledger', () => {
  it('is for admins only', async () => {
    const r = fee();
    await request(app).get(base).set(member).expect(403);
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001'), member).expect(403);
    await request(app).post(`${base}/reconcile`).set(member).send({ csv: 'x' }).expect(403);
    await request(app).get(`${base}/payments/export`).set(member).expect(403);
  });

  it('will not let anyone mark a fee paid by hand, on the way in or afterwards', async () => {
    const r = fee();
    const patched = await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'PAID' }).expect(400);
    expect(patched.body.message).toMatch(/Record the payment/);
    await request(app).post(base).set(admin).send({ kind: 'INSURANCE', partner: 'An insurer', basisAmount: 1200, status: 'PAID' }).expect(400);
    expect(store.referrals[0].status).toBe('PENDING');
    expect(store.audits).toEqual([]);
  });

  it('confirms a fee a partner pays, counts part of it, and marks it paid when the payments cover it', async () => {
    const r = fee();
    const part = await pay(r.id, { ...bank(100.5, '2026-09-10', 'SUNNY INV-1001'), note: 'First instalment' }).expect(201);
    expect(part.body.data.status).toBe('CONFIRMED');
    expect(part.body.data.ledger).toMatchObject({ feeCents: 42_000, receivedCents: 10_050, outstandingCents: 31_950, state: 'PART_PAID', paidOn: null, confirmedBy: { by: 'Priya Shah', how: 'PAYMENT' } });
    expect(part.body.data.ledger.payments[0]).toMatchObject({ amountCents: 10_050, methodLabel: 'Bank transfer', reference: 'SUNNY INV-1001', recordedBy: 'Priya Shah', note: 'First instalment', reconciled: false });
    expect(store.referrals[0].paidAt).toBeNull();

    const rest = await pay(r.id, bank(319.5, '2026-09-14', 'SUNNY INV-1001'), admin2).expect(201);
    expect(rest.body.data.status).toBe('PAID');
    expect(rest.body.data.ledger).toMatchObject({ state: 'PAID', outstandingCents: 0, paidOn: '2026-09-14' });
    // The day the money arrived, in Brisbane, not the moment someone clicked.
    expect(store.referrals[0].paidAt.toISOString()).toBe('2026-09-13T14:00:00.000Z');

    expect(verbs()).toEqual(['CAR_REFERRAL_PAYMENT_RECORDED', 'CAR_REFERRAL_PAYMENT_RECORDED']);
    expect(store.audits[0]).toMatchObject({ action: 'ADMIN_CONTENT_UPDATE', actorUserId: 'admin', targetUserId: null, metadata: { resourceType: 'CarReferral', resourceId: r.id, amountCents: 10_050, receivedOn: '2026-09-10', method: 'BANK_TRANSFER', status: { from: 'PENDING', to: 'CONFIRMED' }, confirmedByPayment: true } });
    expect(store.audits[1]).toMatchObject({ actorUserId: 'admin2', metadata: { status: { from: 'CONFIRMED', to: 'PAID' } } });

    const list = await request(app).get(base).set(admin).expect(200);
    expect(list.body.data.totals).toMatchObject({ pending: 0, confirmed: 0, paid: 420, reconciled: 0, unreconciled: 420 });
  });

  it('refuses the same payment twice, money against a void fee, and a fee with no amount', async () => {
    const r = fee();
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    const twice = await pay(r.id, bank(420, '2026-09-10', 'inv-1001'), admin2).expect(409);
    expect(twice.body.message).toMatch(/already recorded against this fee by Priya Shah/);
    const voided = fee({ status: 'VOID' });
    await pay(voided.id, bank(420, '2026-09-10', 'INV 2002')).expect(409);
    const unpriced = fee({ fee: 0, basisAmount: 0 });
    await pay(unpriced.id, bank(420, '2026-09-10', 'INV 3003')).expect(409);
    await pay(r.id, bank(420, '2099-01-01', 'INV 1001')).expect(400);
    expect(store.audits).toHaveLength(1);
  });

  it('reverses a payment with a reason, once, and the fee is owed again', async () => {
    const r = fee({ status: 'CONFIRMED', confirmedAt: new Date('2026-09-02') });
    const paid = await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    const paymentId = paid.body.data.ledger.payments[0].paymentId;
    await request(app).post(`${base}/${r.id}/payments/${paymentId}/reverse`).set(admin).send({ reason: 'no' }).expect(400);
    const back = await request(app).post(`${base}/${r.id}/payments/${paymentId}/reverse`).set(admin2).send({ reason: 'Recorded against the wrong dealership' }).expect(200);
    expect(back.body.data.status).toBe('CONFIRMED');
    expect(back.body.data.ledger).toMatchObject({ receivedCents: 0, state: 'UNPAID' });
    expect(back.body.data.ledger.payments[0].reversal).toMatchObject({ by: 'Jo Park', reason: 'Recorded against the wrong dealership' });
    expect(store.referrals[0].paidAt).toBeNull();
    const again = await request(app).post(`${base}/${r.id}/payments/${paymentId}/reverse`).set(admin).send({ reason: 'Again, by mistake' }).expect(409);
    expect(again.body.message).toMatch(/already reversed by Jo Park/);
    await request(app).post(`${base}/${r.id}/payments/not-a-payment/reverse`).set(admin).send({ reason: 'Recorded against the wrong dealership' }).expect(404);
    // Nothing is deleted: the payment and its reversal are both on the ledger.
    expect(verbs()).toEqual(['CAR_REFERRAL_PAYMENT_RECORDED', 'CAR_REFERRAL_PAYMENT_REVERSED']);
  });

  it('will not void a fee, or send it back to pending, while money is recorded against it', async () => {
    const r = fee({ status: 'CONFIRMED' });
    const paid = await pay(r.id, bank(100, '2026-09-10', 'INV 1001')).expect(201);
    const refused = await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'VOID' }).expect(409);
    expect(refused.body.message).toMatch(/\$100 has been recorded/);
    await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'PENDING' }).expect(409);
    await request(app).post(`${base}/${r.id}/payments/${paid.body.data.ledger.payments[0].paymentId}/reverse`).set(admin).send({ reason: 'The dealership says it was a deposit on something else' }).expect(200);
    const voided = await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'VOID' }).expect(200);
    expect(voided.body.data.status).toBe('VOID');
  });

  it('raises money held against a void fee, and restoring the fee brings it back as the money makes it', async () => {
    const r = fee({ status: 'CONFIRMED' });
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    // The finance retraction sweep voids fees by status alone; money already
    // recorded against one is shown, not hidden.
    store.referrals[0].status = 'VOID';
    const listed = await request(app).get(base).set(admin).expect(200);
    expect(listed.body.data.totals).toMatchObject({ paid: 420, heldOnVoid: 420 });
    expect(listed.body.data.attention.map((a: Row) => a.key)).toEqual(['MONEY_ON_VOID']);
    await pay(r.id, bank(10, '2026-09-11', 'INV 1002')).expect(409);
    const restored = await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'CONFIRMED' }).expect(200);
    expect(restored.body.data.status).toBe('PAID');
  });

  it('tells an admin the payments decide, rather than quietly overruling her', async () => {
    const r = fee();
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    const refused = await request(app).patch(`${base}/${r.id}`).set(admin).send({ status: 'CONFIRMED' }).expect(409);
    expect(refused.body.message).toMatch(/make it paid/);
    // Lowering the fee under what was paid keeps it paid and says it is overpaid.
    const lowered = await request(app).patch(`${base}/${r.id}`).set(admin).send({ fee: 400 }).expect(200);
    expect(lowered.body.data.status).toBe('PAID');
    expect(lowered.body.data.attention.map((a: Row) => a.key)).toEqual(['OVERPAID']);
    // Raising it over what was paid makes it owed again.
    const raised = await request(app).patch(`${base}/${r.id}`).set(admin).send({ fee: 500 }).expect(200);
    expect(raised.body.data).toMatchObject({ status: 'CONFIRMED', paidAt: null, ledger: { outstandingCents: 8_000, state: 'PART_PAID' } });
    const updated = store.audits.filter((a) => a.metadata.adminAction === 'CAR_REFERRAL_UPDATED');
    expect(updated.map((a) => a.metadata.fee)).toEqual([{ from: 420, to: 400 }, { from: 400, to: 500 }]);
    expect(updated[1].metadata.status).toEqual({ from: 'PAID', to: 'CONFIRMED' });
  });

  it('shows a fee the old dropdown marked paid as having no payment, and counts none of it', async () => {
    const legacy = fee({ status: 'PAID', confirmedAt: new Date('2026-08-01'), paidAt: new Date('2026-08-05') });
    const before = await request(app).get(base).set(admin).expect(200);
    expect(before.body.data.totals).toMatchObject({ paid: 0, confirmed: 0, markedPaidUnrecorded: { count: 1, fee: 420 } });
    expect(before.body.data.attention).toEqual([expect.objectContaining({ referralId: legacy.id, key: 'MARKED_PAID_NO_PAYMENT', partner: 'Sunny Motors', kindLabel: 'Dealership sale' })]);
    // A note edit leaves it as it was, the day it was marked included.
    await request(app).patch(`${base}/${legacy.id}`).set(admin).send({ note: 'Looking for it on the August statement' }).expect(200);
    expect(store.referrals[0]).toMatchObject({ status: 'PAID', paidAt: new Date('2026-08-05') });
    await pay(legacy.id, bank(420, '2026-08-04', 'SUNNY AUG')).expect(201);
    const after = await request(app).get(base).set(admin).expect(200);
    expect(after.body.data.totals).toMatchObject({ paid: 420, markedPaidUnrecorded: { count: 0, fee: 0 } });
    expect(after.body.data.attention).toEqual([]);
    expect(store.referrals[0].paidAt.toISOString()).toBe('2026-08-03T14:00:00.000Z');
  });

  it('keeps a payment and the change to its fee together: if the entry cannot be written, neither is the change', async () => {
    const r = fee();
    failures.auditCreate = 1;
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(500);
    expect(store.referrals[0]).toMatchObject({ status: 'PENDING', paidAt: null, confirmedAt: null });
    expect(store.audits).toEqual([]);
    // A serialization failure is retried, and the second attempt lands once.
    failures.serialization = 1;
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    expect(store.audits).toHaveLength(1);
    expect(store.referrals[0].status).toBe('PAID');
  });

  it('refuses a status or kind filter that is not one', async () => {
    await request(app).get(`${base}?status=SETTLED`).set(admin).expect(400);
    await request(app).get(`${base}?kind=BRIBE`).set(admin).expect(400);
    fee({ status: 'PAID' });
    fee();
    const paid = await request(app).get(`${base}?status=PAID`).set(admin).expect(200);
    expect(paid.body.data.referrals).toHaveLength(1);
  });
});

describe('Stripe payments', () => {
  const PI = 'pi_3PqRsTuVwXyZ0123';

  it('records one as unchecked when this server has no Stripe key, says so, and checks it once there is one', async () => {
    const r = fee();
    const recorded = await pay(r.id, { amount: 420, receivedOn: '2026-09-10', method: 'STRIPE', reference: PI }).expect(201);
    const payment = recorded.body.data.ledger.payments[0];
    expect(payment.stripe).toEqual({ checked: false, reason: expect.stringMatching(/No Stripe key/) });
    expect(recorded.body.data.attention.map((a: Row) => a.key)).toEqual(['STRIPE_UNCHECKED']);
    await request(app).post(`${base}/${r.id}/payments/${payment.paymentId}/check-stripe`).set(admin).expect(409);

    stripeState.configured = true;
    stripeState.objects[PI] = { amount_received: 42_000, currency: 'aud', status: 'succeeded' };
    const checked = await request(app).post(`${base}/${r.id}/payments/${payment.paymentId}/check-stripe`).set(admin).expect(200);
    expect(checked.body.data.ledger.payments[0]).toMatchObject({ reconciled: true, reconciliation: { stripe: { checked: true, id: PI, amountCents: 42_000 } } });
    expect(checked.body.data.attention).toEqual([]);
    await request(app).post(`${base}/${r.id}/payments/${payment.paymentId}/check-stripe`).set(admin).expect(409);
  });

  it('checks with Stripe as it records, and refuses what Stripe does not bear out', async () => {
    stripeState.configured = true;
    stripeState.objects[PI] = { amount_received: 50_000, currency: 'aud', status: 'succeeded' };
    stripeState.objects.pi_unpaid00000000 = { amount_received: 0, currency: 'aud', status: 'requires_payment_method' };
    const a = fee();
    const b = fee({ partner: 'Coast Motors' });
    const first = await pay(a.id, { amount: 420, receivedOn: '2026-09-10', method: 'STRIPE', reference: PI }).expect(201);
    expect(first.body.data.ledger.payments[0]).toMatchObject({ reconciled: true, stripe: { checked: true, paid: true } });
    // One Stripe payment can settle two fees, but not for more than arrived.
    const over = await pay(b.id, { amount: 100, receivedOn: '2026-09-10', method: 'STRIPE', reference: PI }).expect(400);
    expect(over.body.message).toMatch(/no more than \$80 can be recorded/);
    await pay(b.id, { amount: 80, receivedOn: '2026-09-10', method: 'STRIPE', reference: PI }).expect(201);
    await pay(b.id, { amount: 10, receivedOn: '2026-09-10', method: 'STRIPE', reference: 'pi_unpaid00000000' }).expect(400);
    const unknown = await pay(b.id, { amount: 10, receivedOn: '2026-09-10', method: 'STRIPE', reference: 'pi_nosuchthing000' }).expect(400);
    expect(unknown.body.message).toMatch(/Stripe has no payment/);
    stripeState.down = true;
    const down = await pay(b.id, { amount: 10, receivedOn: '2026-09-11', method: 'STRIPE', reference: PI }).expect(503);
    expect(down.body.message).toMatch(/nothing was recorded/);
    expect(verbs()).toEqual(['CAR_REFERRAL_PAYMENT_RECORDED', 'CAR_REFERRAL_PAYMENT_RECORDED']);
  });
});

describe('Matching a bank statement', () => {
  const statement = [
    'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance',
    '032000123456,10/09/2026,DEPOSIT SUNNY MOTORS INV1001,,420.00,5420.00',
    '032000123456,11/09/2026,TRANSFER 88123 COAST,,180.00,5600.00',
    '032000123456,12/09/2026,MERCHANT FEES,35.00,,5565.00',
    '032000123456,13/09/2026,INTEREST,,2.10,5567.10',
  ].join('\n');

  it('previews what it would match, then writes it, and knows the line the next time', async () => {
    const sunny = fee();
    const coast = fee({ partner: 'Coast Insurance', kind: 'INSURANCE', fee: 180 });
    const ghost = fee({ partner: 'Nobody', fee: 300 });
    await pay(sunny.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    await pay(coast.id, bank(180, '2026-09-11', 'POLICY 77')).expect(201);
    await pay(ghost.id, bank(300, '2026-09-12', 'INV 9999')).expect(201);
    const recorded = store.audits.length;

    const preview = await request(app).post(`${base}/reconcile`).set(admin).send({ csv: statement, statement: 'westpac-september.csv' }).expect(200);
    expect(preview.body.data).toMatchObject({ applied: false, needsMapping: false, credits: 3, from: '2026-09-10', to: '2026-09-13' });
    expect(preview.body.data.matches.map((m: Row) => m.line)).toEqual([2]);
    expect(preview.body.data.suggestions.map((m: Row) => [m.line, m.receipts[0].referralId])).toEqual([[3, coast.id]]);
    expect(preview.body.data.unmatchedCredits.map((m: Row) => m.line)).toEqual([5]);
    // The ledger says $300 arrived on the 12th; the bank has no such line.
    expect(preview.body.data.unmatchedReceipts.map((m: Row) => m.referralId)).toEqual([ghost.id]);
    expect(store.audits).toHaveLength(recorded);

    // The suggestion is written only because it was ticked.
    const applied = await request(app).post(`${base}/reconcile`).set(admin).send({ csv: statement, statement: 'westpac-september.csv', apply: true, accept: [3] }).expect(200);
    expect(applied.body.data).toMatchObject({ applied: true, reconciled: 2 });
    const entries = store.audits.slice(recorded);
    expect(entries.map((a) => a.metadata.adminAction)).toEqual(['CAR_REFERRAL_PAYMENT_RECONCILED', 'CAR_REFERRAL_PAYMENT_RECONCILED']);
    expect(entries[0].metadata).toMatchObject({ resourceId: sunny.id, statement: 'westpac-september.csv', bankLine: { date: '2026-09-10', amountCents: 42_000, description: 'DEPOSIT SUNNY MOTORS INV1001' } });
    expect(entries[1].metadata).toMatchObject({ resourceId: coast.id, suggested: true });

    const list = await request(app).get(base).set(admin).expect(200);
    expect(list.body.data.totals).toMatchObject({ paid: 900, reconciled: 600, unreconciled: 300 });

    const again = await request(app).post(`${base}/reconcile`).set(admin).send({ csv: statement }).expect(200);
    expect(again.body.data.alreadyReconciled.map((l: Row) => l.line)).toEqual([2, 3]);
    expect(again.body.data.matches).toEqual([]);
  });

  it('asks which column is which when the header is not one a bank writes, and matches once told', async () => {
    const r = fee();
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    const csv = 'When,What,How much\n10/09/2026,SUNNY MOTORS INV1001,420.00\n';
    const unsure = await request(app).post(`${base}/reconcile`).set(admin).send({ csv }).expect(200);
    expect(unsure.body.data).toMatchObject({ needsMapping: true, columns: 3, sample: [['When', 'What', 'How much'], ['10/09/2026', 'SUNNY MOTORS INV1001', '420.00']] });
    const mapped = await request(app).post(`${base}/reconcile`).set(admin).send({ csv, map: { date: 0, amount: 2, credit: null, description: [1] } }).expect(200);
    expect(mapped.body.data.matches).toHaveLength(1);
    await request(app).post(`${base}/reconcile`).set(admin).send({ csv, map: { date: 0, amount: 2, credit: 1, description: [1] } }).expect(400);
  });

  it('matches nothing from a statement it could not wholly read', async () => {
    const r = fee();
    await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    const csv = 'Date,Amount,Description\n10/09/2026,420.00,SUNNY INV1001\n11/09/2026,4two0,SOMETHING\n';
    const preview = await request(app).post(`${base}/reconcile`).set(admin).send({ csv }).expect(200);
    expect(preview.body.data.errors).toEqual([{ line: 3, message: '"4two0" is not an amount' }]);
    const before = store.audits.length;
    await request(app).post(`${base}/reconcile`).set(admin).send({ csv, apply: true }).expect(400);
    expect(store.audits).toHaveLength(before);
  });
});

describe('The payments export', () => {
  it('lists every payment ever recorded, reversals included, as a CSV', async () => {
    const r = fee();
    const paid = await pay(r.id, bank(420, '2026-09-10', 'INV 1001')).expect(201);
    await request(app).post(`${base}/${r.id}/payments/${paid.body.data.ledger.payments[0].paymentId}/reverse`).set(admin).send({ reason: 'Recorded twice by mistake' }).expect(200);
    await pay(r.id, bank(420, '2026-09-11', 'INV 1001')).expect(201);
    const res = await request(app).get(`${base}/payments/export`).set(admin).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^2026-09-10,420\.00,Bank transfer,INV 1001,Dealership sale,Sunny Motors,420,PAID,.*Priya Shah.*Recorded twice by mistake/);
    expect(lines[2]).toMatch(/^2026-09-11,420\.00/);
  });
});
