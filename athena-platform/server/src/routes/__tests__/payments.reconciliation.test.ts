/**
 * The payment-operations routes ATHENA's team works from: the last comparison
 * against Stripe, running one now, the list of holds still held, and the card
 * disputes with the one thing that can be done to them. Each is staff-only, and
 * running a comparison — which moves rows that were behind and files missing
 * invoices — and ending a pause on creators' withdrawals are written to the audit
 * log against who asked.
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

let currentUser: Record<string, unknown> = { id: 'admin-1', role: 'ADMIN', twoFactorEnabled: true };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

jest.mock('../../services/stripe-reconciliation.service', () => ({
  getLastReconciliationReport: jest.fn(async () => null),
  reconcileAndRecord: jest.fn(),
}));

jest.mock('../../services/escrow-holds.service', () => ({
  listHeldEscrowForAdmin: jest.fn(async () => ({ holds: [], nextCursor: null })),
}));

jest.mock('../../services/payment-disputes.service', () => ({
  listDisputesForAdmin: jest.fn(async () => ({ disputes: [], nextCursor: null })),
  releaseDisputeHolds: jest.fn(async () => 0),
}));

jest.mock('../../services/admin-audit.service', () => ({
  auditAfterCommit: jest.fn(async () => undefined),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import paymentsRoutes from '../payments.routes';
import { getLastReconciliationReport, reconcileAndRecord } from '../../services/stripe-reconciliation.service';
import { listHeldEscrowForAdmin } from '../../services/escrow-holds.service';
import { listDisputesForAdmin, releaseDisputeHolds } from '../../services/payment-disputes.service';
import { auditAfterCommit } from '../../services/admin-audit.service';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/payments', paymentsRoutes);
  server.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message });
  });
  return server;
}

const report = {
  ranAt: '2026-09-20T00:00:00.000Z',
  windowStart: '2026-09-10T00:00:00.000Z',
  windowEnd: '2026-09-19T23:00:00.000Z',
  checked: { paymentIntents: 3, escrowRows: 2, paymentRows: 1, creatorPayouts: 0, subscriptions: 4, disputes: 0 },
  repaired: 1,
  needsAttention: 1,
  findings: [],
  incomplete: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { id: 'admin-1', role: 'ADMIN', twoFactorEnabled: true };
});

describe('Payment operations', () => {
  it('keeps every route to staff', async () => {
    currentUser = { id: 'member-1', role: 'USER' };

    const responses = await Promise.all([
      request(app()).get('/api/payments/reconciliation'),
      request(app()).post('/api/payments/reconciliation/run'),
      request(app()).get('/api/payments/holds'),
      request(app()).get('/api/payments/admin/disputes'),
      request(app()).post('/api/payments/admin/disputes/pd-1/release-holds'),
    ]);

    for (const res of responses) expect(res.status).toBe(403);
    expect(reconcileAndRecord).not.toHaveBeenCalled();
    expect(listDisputesForAdmin).not.toHaveBeenCalled();
    expect(releaseDisputeHolds).not.toHaveBeenCalled();
  });

  it('returns the last report', async () => {
    (getLastReconciliationReport as jest.Mock).mockResolvedValue(report as never);

    const res = await request(app()).get('/api/payments/reconciliation');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(report);
  });

  it('runs one now and writes who asked to the audit log', async () => {
    (reconcileAndRecord as jest.Mock).mockResolvedValue(report as never);

    const res = await request(app()).post('/api/payments/reconciliation/run');

    expect(res.status).toBe(200);
    expect(auditAfterCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        metadata: expect.objectContaining({ adminAction: 'PAYMENT_RECONCILIATION_RUN', repaired: 1, needsAttention: 1 }),
      })
    );
  });

  it('says so when another run already holds the lock, rather than reporting nothing found', async () => {
    (reconcileAndRecord as jest.Mock).mockResolvedValue(null as never);

    const res = await request(app()).post('/api/payments/reconciliation/run');

    expect(res.status).toBe(409);
    expect(auditAfterCommit).not.toHaveBeenCalled();
  });

  it('lists the holds still held, a page at a time', async () => {
    const res = await request(app()).get('/api/payments/holds?limit=25&cursor=escrow-9');

    expect(res.status).toBe(200);
    expect(listHeldEscrowForAdmin).toHaveBeenCalledWith({ cursor: 'escrow-9', limit: 25 });
  });
});

describe('Card disputes', () => {
  it('lists them a page at a time, narrowed to the outcome asked for', async () => {
    (listDisputesForAdmin as jest.Mock).mockResolvedValue({ disputes: [{ id: 'pd-1', stripeDisputeId: 'dp_1' }], nextCursor: 'pd-1' } as never);

    const res = await request(app()).get('/api/payments/admin/disputes?outcome=open&limit=25&cursor=pd-0');

    expect(res.status).toBe(200);
    expect(res.body.data.disputes).toHaveLength(1);
    expect(res.body.data.nextCursor).toBe('pd-1');
    // Upper-cased here, so `?outcome=open` is the same as OPEN.
    expect(listDisputesForAdmin).toHaveBeenCalledWith({ outcome: 'OPEN', cursor: 'pd-0', limit: 25 });
  });

  it('lists every dispute when no outcome is given', async () => {
    await request(app()).get('/api/payments/admin/disputes').expect(200);

    expect(listDisputesForAdmin).toHaveBeenCalledWith(expect.objectContaining({ outcome: undefined }));
  });

  it('ends the pause on creators and writes who did it, and how many, to the audit log', async () => {
    (releaseDisputeHolds as jest.Mock).mockResolvedValue(2 as never);

    const res = await request(app()).post('/api/payments/admin/disputes/pd-1/release-holds');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ released: 2 });
    expect(releaseDisputeHolds).toHaveBeenCalledWith('pd-1');
    expect(auditAfterCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        metadata: expect.objectContaining({ adminAction: 'PAYMENT_DISPUTE_HOLDS_RELEASED', resourceId: 'pd-1', released: 2 }),
      })
    );
  });

  it('says a dispute that is not there is not there, and writes nothing to the audit log', async () => {
    (releaseDisputeHolds as jest.Mock).mockResolvedValue(null as never);

    const res = await request(app()).post('/api/payments/admin/disputes/pd-nope/release-holds');

    expect(res.status).toBe(404);
    expect(auditAfterCommit).not.toHaveBeenCalled();
  });

  it('refuses an id that is not shaped like one before looking anything up', async () => {
    const res = await request(app()).post('/api/payments/admin/disputes/' + encodeURIComponent('a b;c') + '/release-holds');

    expect(res.status).toBe(400);
    expect(releaseDisputeHolds).not.toHaveBeenCalled();
  });
});
