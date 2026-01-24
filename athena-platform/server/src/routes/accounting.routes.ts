import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
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

// Accounts
router.get('/accounts', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const userId = (req as any).user?.id as string | undefined;
    const accounts = await listAccounts({
      organizationId: organizationId as string | undefined,
      userId,
    });
    res.json({ data: accounts });
  } catch (error: any) {
    logger.error('Failed to list accounts', { error });
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

router.post('/accounts', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const account = await createAccount({
      organizationId: req.body.organizationId,
      userId,
      name: req.body.name,
      code: req.body.code,
      type: req.body.type,
      currency: req.body.currency,
    });
    res.status(201).json({ data: account });
  } catch (error: any) {
    logger.error('Failed to create account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create account' });
  }
});

router.patch('/accounts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const account = await updateAccount(req.params.id, req.body);
    res.json({ data: account });
  } catch (error: any) {
    logger.error('Failed to update account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update account' });
  }
});

router.delete('/accounts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete account', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete account' });
  }
});

// Journal Entries
router.get('/journals', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId, status } = req.query;
    const userId = (req as any).user?.id as string | undefined;
    const entries = await listJournalEntries({
      organizationId: organizationId as string | undefined,
      userId,
      status: status as any,
    });
    res.json({ data: entries });
  } catch (error: any) {
    logger.error('Failed to list journal entries', { error });
    res.status(500).json({ error: 'Failed to list journal entries' });
  }
});

router.post('/journals', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const entry = await createJournalEntry({
      organizationId: req.body.organizationId,
      userId,
      description: req.body.description,
      reference: req.body.reference,
      entryDate: req.body.entryDate,
      status: req.body.status,
      lines: req.body.lines || [],
    });
    res.status(201).json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to create journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create journal entry' });
  }
});

router.get('/journals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await getJournalEntry(req.params.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to get journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to get journal entry' });
  }
});

router.patch('/journals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await updateJournalEntry(req.params.id, {
      description: req.body.description,
      reference: req.body.reference,
      entryDate: req.body.entryDate,
    });
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to update journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update journal entry' });
  }
});

router.post('/journals/:id/post', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await postJournalEntry(req.params.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to post journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to post journal entry' });
  }
});

router.post('/journals/:id/void', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await voidJournalEntry(req.params.id);
    res.json({ data: entry });
  } catch (error: any) {
    logger.error('Failed to void journal entry', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to void journal entry' });
  }
});

// Reports
router.get('/reports/trial-balance', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const userId = (req as any).user?.id as string | undefined;
    const report = await getTrialBalance({
      organizationId: organizationId as string | undefined,
      userId,
    });
    res.json({ data: report });
  } catch (error: any) {
    logger.error('Failed to get trial balance', { error });
    res.status(500).json({ error: 'Failed to get trial balance' });
  }
});

export default router;
