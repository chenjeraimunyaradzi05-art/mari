import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getStockLevels,
} from '../services/inventory.service';

const router = Router();

// Validation schemas
const createItemSchema = z.object({
  organizationId: z.string().uuid().optional(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  unit: z.string().max(20).optional(),
  valuationMethod: z.enum(['FIFO', 'LIFO', 'AVERAGE']).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
});

const updateItemSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  unit: z.string().max(20).optional(),
  valuationMethod: z.enum(['FIFO', 'LIFO', 'AVERAGE']).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createLocationSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  address: z.string().max(500).optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const createTransactionSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN']),
  quantity: z.number().refine(val => val !== 0, { message: 'Quantity must be non-zero' }),
  unitCost: z.number().min(0).optional(),
  totalCost: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
  occurredAt: z.string().datetime().optional(),
});

const updateTransactionSchema = z.object({
  locationId: z.string().uuid().optional(),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN']).optional(),
  quantity: z.number().refine(val => val !== 0, { message: 'Quantity must be non-zero' }).optional(),
  unitCost: z.number().min(0).optional(),
  totalCost: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
  occurredAt: z.string().datetime().optional(),
});

// Items
router.get('/items', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const items = await listItems({ organizationId: organizationId as string | undefined });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
});

router.post('/items', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const item = await createItem(parsed.data);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
});

router.patch('/items/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const item = await updateItem(req.params.id, req.user!.id, parsed.data);
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
});

router.delete('/items/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteItem(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Locations
router.get('/locations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const locations = await listLocations({ organizationId: organizationId as string | undefined });
    res.json({ data: locations });
  } catch (error) {
    next(error);
  }
});

router.post('/locations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const location = await createLocation(parsed.data);
    res.status(201).json({ data: location });
  } catch (error) {
    next(error);
  }
});

router.patch('/locations/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const location = await updateLocation(req.params.id, req.user!.id, parsed.data);
    res.json({ data: location });
  } catch (error) {
    next(error);
  }
});

router.delete('/locations/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteLocation(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Transactions
router.get('/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, itemId } = req.query;
    const transactions = await listTransactions({
      organizationId: organizationId as string | undefined,
      itemId: itemId as string | undefined,
    });
    res.json({ data: transactions });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const transaction = await createTransaction({
      ...parsed.data,
      createdByUserId: req.user!.id,
    });
    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

router.patch('/transactions/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const transaction = await updateTransaction(req.params.id, req.user!.id, parsed.data);
    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

router.delete('/transactions/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteTransaction(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Stock levels
router.get('/stock-levels', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const levels = await getStockLevels({ organizationId: organizationId as string | undefined });
    res.json({ data: levels });
  } catch (error) {
    next(error);
  }
});

export default router;
