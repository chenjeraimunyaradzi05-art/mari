import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
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

// Items
router.get('/items', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const items = await listItems({ organizationId: organizationId as string | undefined });
    res.json({ data: items });
  } catch (error: any) {
    logger.error('Failed to list inventory items', { error });
    res.status(500).json({ error: 'Failed to list inventory items' });
  }
});

router.post('/items', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await createItem({
      organizationId: req.body.organizationId,
      sku: req.body.sku,
      name: req.body.name,
      description: req.body.description,
      unit: req.body.unit,
      valuationMethod: req.body.valuationMethod,
      currency: req.body.currency,
      cost: req.body.cost,
      price: req.body.price,
    });
    res.status(201).json({ data: item });
  } catch (error: any) {
    logger.error('Failed to create inventory item', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory item' });
  }
});

router.patch('/items/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await updateItem(req.params.id, req.body);
    res.json({ data: item });
  } catch (error: any) {
    logger.error('Failed to update inventory item', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory item' });
  }
});

router.delete('/items/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteItem(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete inventory item', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory item' });
  }
});

// Locations
router.get('/locations', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const locations = await listLocations({ organizationId: organizationId as string | undefined });
    res.json({ data: locations });
  } catch (error: any) {
    logger.error('Failed to list inventory locations', { error });
    res.status(500).json({ error: 'Failed to list inventory locations' });
  }
});

router.post('/locations', authenticate, async (req: Request, res: Response) => {
  try {
    const location = await createLocation({
      organizationId: req.body.organizationId,
      name: req.body.name,
      code: req.body.code,
      address: req.body.address,
    });
    res.status(201).json({ data: location });
  } catch (error: any) {
    logger.error('Failed to create inventory location', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory location' });
  }
});

router.patch('/locations/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const location = await updateLocation(req.params.id, req.body);
    res.json({ data: location });
  } catch (error: any) {
    logger.error('Failed to update inventory location', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory location' });
  }
});

router.delete('/locations/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteLocation(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete inventory location', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory location' });
  }
});

// Transactions
router.get('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId, itemId } = req.query;
    const transactions = await listTransactions({
      organizationId: organizationId as string | undefined,
      itemId: itemId as string | undefined,
    });
    res.json({ data: transactions });
  } catch (error: any) {
    logger.error('Failed to list inventory transactions', { error });
    res.status(500).json({ error: 'Failed to list inventory transactions' });
  }
});

router.post('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const transaction = await createTransaction({
      itemId: req.body.itemId,
      locationId: req.body.locationId,
      createdByUserId: userId,
      type: req.body.type,
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      totalCost: req.body.totalCost,
      reference: req.body.reference,
      occurredAt: req.body.occurredAt,
    });
    res.status(201).json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to create inventory transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory transaction' });
  }
});

router.patch('/transactions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const transaction = await updateTransaction(req.params.id, {
      locationId: req.body.locationId,
      type: req.body.type,
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      totalCost: req.body.totalCost,
      reference: req.body.reference,
      occurredAt: req.body.occurredAt,
    });
    res.json({ data: transaction });
  } catch (error: any) {
    logger.error('Failed to update inventory transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory transaction' });
  }
});

router.delete('/transactions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteTransaction(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Failed to delete inventory transaction', { error });
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory transaction' });
  }
});

// Stock levels
router.get('/stock-levels', authenticate, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const levels = await getStockLevels({ organizationId: organizationId as string | undefined });
    res.json({ data: levels });
  } catch (error: any) {
    logger.error('Failed to get stock levels', { error });
    res.status(500).json({ error: 'Failed to get stock levels' });
  }
});

export default router;
