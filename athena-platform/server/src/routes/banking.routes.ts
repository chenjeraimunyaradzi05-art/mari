/**
 * Bank feeds: connect a bank by consent, or paste a statement; then
 * categorise the lines and post them to the ledger.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as Banking from '../services/open-banking.service';

const router = Router();

const invalid = (res: Response, error: z.ZodError) => res.status(400).json({ success: false, message: error.issues[0]?.message || 'Invalid request' });

const importSchema = z.object({
  accountName: z.string().min(1).max(120),
  organizationId: z.string().uuid().optional(),
  rows: z
    .array(
      z.object({
        date: z.union([z.string(), z.number()]),
        description: z.string().max(500),
        amount: z.union([z.string(), z.number()]),
        balance: z.union([z.string(), z.number()]).optional(),
      })
    )
    .min(1)
    .max(Banking.MAX_IMPORT_ROWS),
});

const categoriseSchema = z.object({
  ledgerAccountId: z.string().min(1).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(['IGNORED', 'UNREVIEWED']).optional(),
});

const linkSchema = z.object({ ledgerAccountId: z.string().min(1).nullable() });

const dateParam = (value: unknown, endOfDay: boolean): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(value.length === 10 ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

// GET /api/banking/status
router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const connections = await Banking.listConnections(req.user!.id);
    res.json({ success: true, data: { configured: Banking.isBasiqConfigured(), connections } });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/connect: a consent link on the provider's page
router.post('/connect', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await Banking.startBasiqConsent(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/sync
router.post('/sync', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await Banking.syncBasiq(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/import: rows from a statement export
router.post('/import', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    res.status(201).json({ success: true, data: await Banking.importStatement(req.user!.id, parsed.data) });
  } catch (error) {
    next(error);
  }
});

// GET /api/banking/transactions?accountId&status&from&to&limit
router.get('/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const transactions = await Banking.listTransactions(req.user!.id, {
      accountId: typeof q.accountId === 'string' && q.accountId ? q.accountId : undefined,
      status: typeof q.status === 'string' && ['UNREVIEWED', 'CATEGORISED', 'POSTED', 'IGNORED'].includes(q.status) ? q.status : undefined,
      from: dateParam(q.from, false),
      to: dateParam(q.to, true),
      limit: typeof q.limit === 'string' ? Number(q.limit) || undefined : undefined,
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/banking/transactions/:id: choose the account, add a note, or ignore the line
router.patch('/transactions/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = categoriseSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    res.json({ success: true, data: await Banking.categoriseTransaction(req.user!.id, req.params.id, parsed.data) });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/transactions/post-all
router.post('/transactions/post-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const accountId = typeof req.body?.accountId === 'string' && req.body.accountId ? req.body.accountId : undefined;
    res.json({ success: true, data: await Banking.postAllCategorised(req.user!.id, accountId) });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/transactions/:id/post
router.post('/transactions/:id/post', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await Banking.postTransaction(req.user!.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

// POST /api/banking/accounts/:id/link: which ledger account this bank account is
router.post('/accounts/:id/link', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    res.json({ success: true, data: await Banking.linkLedgerAccount(req.user!.id, req.params.id, parsed.data.ledgerAccountId) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/banking/connections/:id
router.delete('/connections/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await Banking.removeConnection(req.user!.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

export default router;
