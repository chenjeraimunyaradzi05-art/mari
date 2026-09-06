import { Router, Response, NextFunction } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
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
import { computeBas, lodgeBas, parsePeriod } from '../services/bas.service';

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
//
// Rates are platform configuration that every organization's invoicing reads
// from, so anyone signed in may look them up but only an admin may change them.
router.get('/rates', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, region } = req.query;
    const rates = await listTaxRates({
      organizationId: organizationId as string | undefined,
      region: region as string | undefined,
    });
    res.json({ data: rates });
  } catch (error) {
    next(error);
  }
});

router.post('/rates', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createTaxRateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const rate = await createTaxRate(parsed.data);
    res.status(201).json({ data: rate });
  } catch (error) {
    next(error);
  }
});

router.patch('/rates/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTaxRateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const rate = await updateTaxRate(req.params.id, parsed.data);
    res.json({ data: rate });
  } catch (error) {
    next(error);
  }
});

router.delete('/rates/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteTaxRate(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Tax Returns
router.get('/returns', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const returns = await listTaxReturns({
      organizationId: organizationId as string | undefined,
      userId: req.user!.id,
    });
    res.json({ data: returns });
  } catch (error) {
    next(error);
  }
});

router.post('/returns', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

router.patch('/returns/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTaxReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const record = await updateTaxReturn(req.params.id, req.user!.id, parsed.data);
    res.json({ data: record });
  } catch (error) {
    next(error);
  }
});

router.post('/returns/:id/submit', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await submitTaxReturn(req.params.id, req.user!.id);
    res.json({ data: record });
  } catch (error) {
    next(error);
  }
});

router.delete('/returns/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteTaxReturn(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/tax/bas?from=YYYY-MM-DD&to=YYYY-MM-DD[&organizationId=]: the worksheet, counted from the ledger
router.get('/bas', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { from, to } = parsePeriod(req.query.from, req.query.to);
    const organizationId = typeof req.query.organizationId === 'string' && req.query.organizationId ? req.query.organizationId : undefined;
    const worksheet = await computeBas({ userId: req.user!.id, organizationId, from, to });
    res.json({ success: true, data: worksheet });
  } catch (error) {
    next(error);
  }
});

const lodgeBasSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
  organizationId: z.string().uuid().optional(),
  w1: z.number().min(0).optional(),
  w2: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
  lodgedVia: z.string().max(120).optional(),
});

// POST /api/tax/bas/lodge: record a BAS lodged through the ATO, worksheet attached
router.post('/bas/lodge', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = lodgeBasSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid BAS lodgement' });
    }
    const { from, to } = parsePeriod(parsed.data.from, parsed.data.to);
    const record = await lodgeBas({
      userId: req.user!.id,
      organizationId: parsed.data.organizationId,
      from,
      to,
      w1: parsed.data.w1,
      w2: parsed.data.w2,
      reference: parsed.data.reference,
      lodgedVia: parsed.data.lodgedVia,
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

export default router;
