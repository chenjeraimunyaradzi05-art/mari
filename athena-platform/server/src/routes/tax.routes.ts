import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
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

// Validation schemas
const createTaxRateSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING']),
  rate: z.number().min(0).max(100),
  region: z.string().min(1).max(100).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});

const updateTaxRateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING']).optional(),
  rate: z.number().min(0).max(100).optional(),
  region: z.string().min(1).max(100).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

const createTaxReturnSchema = z.object({
  organizationId: z.string().uuid().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  totalSales: z.number().min(0),
  totalTax: z.number().min(0),
  reference: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateTaxReturnSchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  totalSales: z.number().min(0).optional(),
  totalTax: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Tax Rates
router.get('/rates', authenticate, async (req: AuthRequest, res: Response) => {
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

router.post('/rates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createTaxRateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const rate = await createTaxRate(parsed.data);
    res.status(201).json({ data: rate });
  } catch (error: any) {
    logger.error('Failed to create tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create tax rate' });
  }
});

router.patch('/rates/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateTaxRateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const rate = await updateTaxRate(req.params.id, parsed.data);
    res.json({ data: rate });
  } catch (error: any) {
    logger.error('Failed to update tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update tax rate' });
  }
});

router.delete('/rates/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await deleteTaxRate(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete tax rate', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete tax rate' });
  }
});

// Tax Returns
router.get('/returns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.query;
    const returns = await listTaxReturns({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: returns });
  } catch (error: any) {
    logger.error('Failed to list tax returns', { error });
    res.status(500).json({ error: 'Failed to list tax returns' });
  }
});

router.post('/returns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createTaxReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const record = await createTaxReturn({
      ...parsed.data,
      userId: req.user!.id,
    });
    res.status(201).json({ data: record });
  } catch (error: any) {
    logger.error('Failed to create tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to create tax return' });
  }
});

router.patch('/returns/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateTaxReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const record = await updateTaxReturn(req.params.id, req.user!.id, parsed.data);
    res.json({ data: record });
  } catch (error: any) {
    logger.error('Failed to update tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to update tax return' });
  }
});

router.post('/returns/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const record = await submitTaxReturn(req.params.id, req.user!.id);
    res.json({ data: record });
  } catch (error: any) {
    logger.error('Failed to submit tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to submit tax return' });
  }
});

router.delete('/returns/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await deleteTaxReturn(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete tax return', { error });
    res.status(error.statusCode || 500).json({ error: 'Failed to delete tax return' });
  }
});

export default router;
