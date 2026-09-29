/**
 * The payment-operations routes ATHENA's team works from: the last comparison
 * against Stripe, running one now, and the list of holds still held. Each is
 * staff-only, and running a comparison — which moves rows that were behind and
 * files missing invoices — is written to the audit log against who asked.
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
  checked: { paymentIntents: 3, escrowRows: 2, paymentRows: 1, creatorPayouts: 0, subscriptions: 4 },
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
    ]);

    for (const res of responses) expect(res.status).toBe(403);
    expect(reconcileAndRecord).not.toHaveBeenCalled();
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
