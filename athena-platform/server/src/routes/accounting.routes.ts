import { Router, Response } from 'express';
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
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.query;
    const accounts = await listAccounts({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: accounts });
  } catch (error: any) {
    logger.error('Failed to list accounts', { error });
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

router.post('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    logger.error('Failed to create account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create account' });
  }
});

router.patch('/accounts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const account = await updateAccount(req.params.id, req.user!.id, parsed.data);
    res.json({ data: account });
  } catch (error: any) {
    logger.error('Failed to update account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update account' });
  }
});

router.delete('/accounts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await deleteAccount(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete account' });
  }
});

// Journal Entries
router.get('/journals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, status } = req.query;
    const entries = await listJournalEntries({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
      status: status as any,
    });
    res.json({ data: entries });
  } catch (error: any) {
    logger.error('Failed to list journal entries', { error });
    res.status(500).json({ error: 'Failed to list journal entries' });
  }
});

router.post('/journals', authenticate, async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    logger.error('Failed to create journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create journal entry' });
  }
});

router.get('/journals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await getJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to get journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to get journal entry' });
  }
});

router.patch('/journals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateJournalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const entry = await updateJournalEntry(req.params.id, req.user!.id, parsed.data);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to update journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update journal entry' });
  }
});

router.post('/journals/:id/post', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await postJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to post journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to post journal entry' });
  }
});

router.post('/journals/:id/void', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await voidJournalEntry(req.params.id, req.user!.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to void journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to void journal entry' });
  }
});

// Reports
router.get('/reports/trial-balance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.query;
    const report = await getTrialBalance({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: report });
  } catch (error: any) {
    logger.error('Failed to get trial balance', { error });
    res.status(500).json({ error: 'Failed to get trial balance' });
  }
});

export default router;
