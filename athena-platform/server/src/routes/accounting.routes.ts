import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
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
