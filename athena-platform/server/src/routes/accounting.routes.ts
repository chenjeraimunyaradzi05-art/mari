import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { z } from 'zod';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  createJournalEntry,
  listJournalEntries,
  getJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  updateJournalEntry,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
} from '../services/accounting.service';

const router = Router();

// Validation schemas
const createAccountSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50).optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  isActive: z.boolean().optional(),
});

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
});

const createJournalSchema = z.object({
  organizationId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  entryDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'POSTED']).optional(),
  lines: z.array(journalLineSchema).min(1),
});

const updateJournalSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).optional(),
  entryDate: z.string().datetime().optional(),
});

// Accounts
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const accounts = await listAccounts({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: accounts });
  } catch (error) {
    next(error);
  }
});

router.post('/accounts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const account = await createAccount({
      ...parsed.data,
      userId: req.user!.id,
    });
    res.status(201).json({ data: account });
  } catch (error) {
    next(error);
  }
});

router.patch('/accounts/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const account = await updateAccount(req.params.id, req.user!.id, parsed.data);
    res.json({ data: account });
  } catch (error) {
    next(error);
  }
});

router.delete('/accounts/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteAccount(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Journal Entries
router.get('/journals', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, status } = req.query;
    const entries = await listJournalEntries({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
      status: status as any,
    });
    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

router.post('/journals', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createJournalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const entry = await createJournalEntry({
      ...parsed.data,
      userId: req.user!.id,
    });
    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
});

router.get('/journals/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await getJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

router.patch('/journals/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateJournalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const entry = await updateJournalEntry(req.params.id, req.user!.id, parsed.data);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

router.post('/journals/:id/post', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await postJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

router.post('/journals/:id/void', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await voidJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

// Reports
// A date in the query string, or nothing; anything else is a 400 rather than
// a silent "Invalid Date" that would quietly report the wrong period.
function dateParam(value: unknown, name: string): Date | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `${name} must be a date`);
  }
  return parsed;
}

router.get('/reports/profit-and-loss', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, from, to } = req.query;
    const report = await getProfitAndLoss({
      organizationId: typeof organizationId === 'string' ? organizationId : undefined,
      userId: req.user!.id,
      from: dateParam(from, 'from'),
      to: dateParam(to, 'to'),
    });
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/balance-sheet', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, asOf } = req.query;
    const report = await getBalanceSheet({
      organizationId: typeof organizationId === 'string' ? organizationId : undefined,
      userId: req.user!.id,
      asOf: dateParam(asOf, 'asOf'),
    });
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/trial-balance', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const report = await getTrialBalance({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

export default router;
