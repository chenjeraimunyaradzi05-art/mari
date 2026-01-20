import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { listMoneyTransactions, createMoneyTransaction, updateMoneyTransaction, deleteMoneyTransaction } from '../services/money.service';

const router = Router();

router.get('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const userId = (req as any).user?.id as string | undefined;
    const transactions = await listMoneyTransactions({
      organizationId: organizationId as string | undefined,
      userId,
    });
    res.json({ data: transactions });
  } catch (error: any) {
    logger.error('Failed to list money transactions', { error });
    res.status(500).json({ error: 'Failed to list money transactions' });
  }
});

router.post('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const transaction = await createMoneyTransaction({
      organizationId: req.body.organizationId,
      userId,
      amount: req.body.amount,
      currency: req.body.currency,
      type: req.body.type,
      status: req.body.status,
      provider: req.body.provider,
      reference: req.body.reference,
      metadata: req.body.metadata,
    });
    res.status(201).json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to create money transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create money transaction' });
  }
});

router.patch('/transactions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const transaction = await updateMoneyTransaction(req.params.id, req.body);
    res.json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to update money transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update money transaction' });
  }
});

router.delete('/transactions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteMoneyTransaction(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete money transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete money transaction' });
  }
});

export default router;
