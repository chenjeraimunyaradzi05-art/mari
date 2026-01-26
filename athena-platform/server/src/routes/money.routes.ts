import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { listMoneyTransactions, createMoneyTransaction, updateMoneyTransaction, deleteMoneyTransaction } from '../services/money.service';

const router = Router();

// Validation schemas
const createMoneyTransactionSchema = z.object({
  organizationId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  type: z.enum(['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT']),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']).default('PENDING'),
  provider: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateMoneyTransactionSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']).optional(),
  provider: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.query;
    const transactions = await listMoneyTransactions({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: transactions });
  } catch (error: any) {
    logger.error('Failed to list money transactions', { error });
    res.status(500).json({ error: 'Failed to list money transactions' });
  }
});

router.post('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createMoneyTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const transaction = await createMoneyTransaction({
      ...parsed.data,
      userId: req.user!.id,
    });
    res.status(201).json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to create money transaction', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create money transaction' });
  }
});

router.patch('/transactions/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateMoneyTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const transaction = await updateMoneyTransaction(req.params.id, req.user!.id, parsed.data);
    res.json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to update money transaction', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update money transaction' });
  }
});

router.delete('/transactions/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await deleteMoneyTransaction(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete money transaction', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete money transaction' });
  }
});

export default router;
