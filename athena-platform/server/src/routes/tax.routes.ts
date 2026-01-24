import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  listTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  listTaxReturns,
  createTaxReturn,
  updateTaxReturn,
  submitTaxReturn,
  deleteTaxReturn,
} from '../services/tax.service';

const router = Router();

// Tax Rates
router.get('/rates', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId, region } = req.query;
    const rates = await listTaxRates({
      organizationId: organizationId as string | undefined,
      region: region as string | undefined,
    });
    res.json({ data: rates });
  } catch (error: any) {
    logger.error('Failed to list tax rates', { error });
    res.status(500).json({ error: 'Failed to list tax rates' });
  }
});

router.post('/rates', authenticate, async (req: Request, res: Response) => {
  try {
    const rate = await createTaxRate({
      organizationId: req.body.organizationId,
      name: req.body.name,
      type: req.body.type,
      rate: req.body.rate,
      region: req.body.region,
      effectiveFrom: req.body.effectiveFrom,
      effectiveTo: req.body.effectiveTo,
    });
    res.status(201).json({ data: rate });
  } catch (error: any) {
    logger.error('Failed to create tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create tax rate' });
  }
});

router.patch('/rates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const rate = await updateTaxRate(req.params.id, req.body);
    res.json({ data: rate });
  } catch (error: any) {
    logger.error('Failed to update tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update tax rate' });
  }
});

router.delete('/rates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteTaxRate(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete tax rate' });
  }
});

// Tax Returns
router.get('/returns', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const userId = (req as any).user?.id as string | undefined;
    const returns = await listTaxReturns({
      organizationId: organizationId as string | undefined,
      userId,
    });
    res.json({ data: returns });
  } catch (error: any) {
    logger.error('Failed to list tax returns', { error });
    res.status(500).json({ error: 'Failed to list tax returns' });
  }
});

router.post('/returns', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const record = await createTaxReturn({
      organizationId: req.body.organizationId,
      userId,
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      currency: req.body.currency,
      totalSales: req.body.totalSales,
      totalTax: req.body.totalTax,
      reference: req.body.reference,
      metadata: req.body.metadata,
    });
    res.status(201).json({ data: record });
  } catch (error: any) {
    logger.error('Failed to create tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create tax return' });
  }
});

router.patch('/returns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const record = await updateTaxReturn(req.params.id, userId, {
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      currency: req.body.currency,
      totalSales: req.body.totalSales,
      totalTax: req.body.totalTax,
      reference: req.body.reference,
      metadata: req.body.metadata,
    });
    res.json({ data: record });
  } catch (error: any) {
    logger.error('Failed to update tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update tax return' });
  }
});

router.post('/returns/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const record = await submitTaxReturn(req.params.id, userId);
    res.json({ data: record });
  } catch (error: any) {
    logger.error('Failed to submit tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to submit tax return' });
  }
});

router.delete('/returns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    await deleteTaxReturn(req.params.id, userId);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete tax return' });
  }
});

export default router;
