"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const inventory_service_1 = require("../services/inventory.service");
const router = (0, express_1.Router)();
// Validation schemas
const createItemSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    sku: zod_1.z.string().min(1).max(50),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(1000).optional(),
    unit: zod_1.z.string().max(20).optional(),
    valuationMethod: zod_1.z.enum(['FIFO', 'LIFO', 'AVERAGE']).optional(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
    cost: zod_1.z.number().min(0).optional(),
    price: zod_1.z.number().min(0).optional(),
});
const updateItemSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(50).optional(),
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).optional(),
    unit: zod_1.z.string().max(20).optional(),
    valuationMethod: zod_1.z.enum(['FIFO', 'LIFO', 'AVERAGE']).optional(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
    cost: zod_1.z.number().min(0).optional(),
    price: zod_1.z.number().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createLocationSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1).max(200),
    code: zod_1.z.string().min(1).max(50),
    address: zod_1.z.string().max(500).optional(),
});
const updateLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    code: zod_1.z.string().min(1).max(50).optional(),
    address: zod_1.z.string().max(500).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createTransactionSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    locationId: zod_1.z.string().uuid().optional(),
    type: zod_1.z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN']),
    quantity: zod_1.z.number().refine(val => val !== 0, { message: 'Quantity must be non-zero' }),
    unitCost: zod_1.z.number().min(0).optional(),
    totalCost: zod_1.z.number().min(0).optional(),
    reference: zod_1.z.string().max(100).optional(),
    occurredAt: zod_1.z.string().datetime().optional(),
});
const updateTransactionSchema = zod_1.z.object({
    locationId: zod_1.z.string().uuid().optional(),
    type: zod_1.z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN']).optional(),
    quantity: zod_1.z.number().refine(val => val !== 0, { message: 'Quantity must be non-zero' }).optional(),
    unitCost: zod_1.z.number().min(0).optional(),
    totalCost: zod_1.z.number().min(0).optional(),
    reference: zod_1.z.string().max(100).optional(),
    occurredAt: zod_1.z.string().datetime().optional(),
});
// Items
router.get('/items', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const items = await (0, inventory_service_1.listItems)({ organizationId: organizationId });
        res.json({ data: items });
    }
    catch (error) {
        next(error);
    }
});
router.post('/items', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createItemSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const item = await (0, inventory_service_1.createItem)(parsed.data);
        res.status(201).json({ data: item });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/items/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateItemSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const item = await (0, inventory_service_1.updateItem)(req.params.id, req.user.id, parsed.data);
        res.json({ data: item });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/items/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, inventory_service_1.deleteItem)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Locations
router.get('/locations', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const locations = await (0, inventory_service_1.listLocations)({ organizationId: organizationId });
        res.json({ data: locations });
    }
    catch (error) {
        next(error);
    }
});
router.post('/locations', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createLocationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const location = await (0, inventory_service_1.createLocation)(parsed.data);
        res.status(201).json({ data: location });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/locations/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateLocationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const location = await (0, inventory_service_1.updateLocation)(req.params.id, req.user.id, parsed.data);
        res.json({ data: location });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/locations/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, inventory_service_1.deleteLocation)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Transactions
router.get('/transactions', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId, itemId } = req.query;
        const transactions = await (0, inventory_service_1.listTransactions)({
            organizationId: organizationId,
            itemId: itemId,
        });
        res.json({ data: transactions });
    }
    catch (error) {
        next(error);
    }
});
router.post('/transactions', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createTransactionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const transaction = await (0, inventory_service_1.createTransaction)({
            ...parsed.data,
            createdByUserId: req.user.id,
        });
        res.status(201).json({ data: transaction });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/transactions/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateTransactionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const transaction = await (0, inventory_service_1.updateTransaction)(req.params.id, req.user.id, parsed.data);
        res.json({ data: transaction });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/transactions/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, inventory_service_1.deleteTransaction)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Stock levels
router.get('/stock-levels', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const levels = await (0, inventory_service_1.getStockLevels)({ organizationId: organizationId });
        res.json({ data: levels });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map