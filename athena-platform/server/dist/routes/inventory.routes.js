"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const inventory_service_1 = require("../services/inventory.service");
const router = (0, express_1.Router)();
// Items
router.get('/items', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const items = await (0, inventory_service_1.listItems)({ organizationId: organizationId });
        res.json({ data: items });
    }
    catch (error) {
        logger_1.logger.error('Failed to list inventory items', { error });
        res.status(500).json({ error: 'Failed to list inventory items' });
    }
});
router.post('/items', auth_1.authenticate, async (req, res) => {
    try {
        const item = await (0, inventory_service_1.createItem)({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to create inventory item', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory item' });
    }
});
router.patch('/items/:id', auth_1.authenticate, async (req, res) => {
    try {
        const item = await (0, inventory_service_1.updateItem)(req.params.id, req.body);
        res.json({ data: item });
    }
    catch (error) {
        logger_1.logger.error('Failed to update inventory item', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory item' });
    }
});
router.delete('/items/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, inventory_service_1.deleteItem)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete inventory item', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory item' });
    }
});
// Locations
router.get('/locations', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const locations = await (0, inventory_service_1.listLocations)({ organizationId: organizationId });
        res.json({ data: locations });
    }
    catch (error) {
        logger_1.logger.error('Failed to list inventory locations', { error });
        res.status(500).json({ error: 'Failed to list inventory locations' });
    }
});
router.post('/locations', auth_1.authenticate, async (req, res) => {
    try {
        const location = await (0, inventory_service_1.createLocation)({
            organizationId: req.body.organizationId,
            name: req.body.name,
            code: req.body.code,
            address: req.body.address,
        });
        res.status(201).json({ data: location });
    }
    catch (error) {
        logger_1.logger.error('Failed to create inventory location', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory location' });
    }
});
router.patch('/locations/:id', auth_1.authenticate, async (req, res) => {
    try {
        const location = await (0, inventory_service_1.updateLocation)(req.params.id, req.body);
        res.json({ data: location });
    }
    catch (error) {
        logger_1.logger.error('Failed to update inventory location', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory location' });
    }
});
router.delete('/locations/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, inventory_service_1.deleteLocation)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete inventory location', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory location' });
    }
});
// Transactions
router.get('/transactions', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId, itemId } = req.query;
        const transactions = await (0, inventory_service_1.listTransactions)({
            organizationId: organizationId,
            itemId: itemId,
        });
        res.json({ data: transactions });
    }
    catch (error) {
        logger_1.logger.error('Failed to list inventory transactions', { error });
        res.status(500).json({ error: 'Failed to list inventory transactions' });
    }
});
router.post('/transactions', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const transaction = await (0, inventory_service_1.createTransaction)({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to create inventory transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create inventory transaction' });
    }
});
router.patch('/transactions/:id', auth_1.authenticate, async (req, res) => {
    try {
        const transaction = await (0, inventory_service_1.updateTransaction)(req.params.id, {
            locationId: req.body.locationId,
            type: req.body.type,
            quantity: req.body.quantity,
            unitCost: req.body.unitCost,
            totalCost: req.body.totalCost,
            reference: req.body.reference,
            occurredAt: req.body.occurredAt,
        });
        res.json({ data: transaction });
    }
    catch (error) {
        logger_1.logger.error('Failed to update inventory transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update inventory transaction' });
    }
});
router.delete('/transactions/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, inventory_service_1.deleteTransaction)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete inventory transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete inventory transaction' });
    }
});
// Stock levels
router.get('/stock-levels', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const levels = await (0, inventory_service_1.getStockLevels)({ organizationId: organizationId });
        res.json({ data: levels });
    }
    catch (error) {
        logger_1.logger.error('Failed to get stock levels', { error });
        res.status(500).json({ error: 'Failed to get stock levels' });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map