import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { listMoneyTransactions, createMoneyTransaction, updateMoneyTransaction, deleteMoneyTransaction } from '../services/money.service';

const router = Router();

/**
 * What this router is, so nothing downstream mistakes it for something else.
 *
 * MoneyTransaction rows are entered by the member. Nothing in the payment,
 * escrow, subscription, payout or webhook paths writes one — a grep for
 * `prisma.moneyTransaction` outside money.service finds only the GDPR export —
 * so this is a book she keeps herself, not a record of what ATHENA did. The
 * status and provider fields are hers to set for the same reason.
 *
 * That is a legitimate thing for a small business owner to want, and it is what
 * the page now says it is. What it must not be called is a ledger of her
 * ATHENA payments, because it can contradict every one of them. The record of
 * what ATHENA actually charged is /api/invoices, which is written by the Stripe
 * webhook.
 */

// Validation schemas
const createMoneyTransactionSchema = z.object({
  organizationId: z.string().uuid().optional(),
  amount: z.number().positive(),
  // AUD, not USD. This is a Queensland platform and the default currency of a
  // row typed in by a member here is her own.
  currency: z.string().regex(/^[A-Z]{3}$/).default('AUD'),
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

router.get('/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const transactions = await listMoneyTransactions({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: transactions });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

router.patch('/transactions/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateMoneyTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const transaction = await updateMoneyTransaction(req.params.id, req.user!.id, parsed.data);
    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

router.delete('/transactions/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteMoneyTransaction(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
