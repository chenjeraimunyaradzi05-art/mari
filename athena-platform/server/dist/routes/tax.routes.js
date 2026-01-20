"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const tax_service_1 = require("../services/tax.service");
const router = (0, express_1.Router)();
// Tax Rates
router.get('/rates', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId, region } = req.query;
        const rates = await (0, tax_service_1.listTaxRates)({
            organizationId: organizationId,
            region: region,
        });
        res.json({ data: rates });
    }
    catch (error) {
        logger_1.logger.error('Failed to list tax rates', { error });
        res.status(500).json({ error: 'Failed to list tax rates' });
    }
});
router.post('/rates', auth_1.authenticate, async (req, res) => {
    try {
        const rate = await (0, tax_service_1.createTaxRate)({
            organizationId: req.body.organizationId,
            name: req.body.name,
            type: req.body.type,
            rate: req.body.rate,
            region: req.body.region,
            effectiveFrom: req.body.effectiveFrom,
            effectiveTo: req.body.effectiveTo,
        });
        res.status(201).json({ data: rate });
    }
    catch (error) {
        logger_1.logger.error('Failed to create tax rate', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create tax rate' });
    }
});
router.patch('/rates/:id', auth_1.authenticate, async (req, res) => {
    try {
        const rate = await (0, tax_service_1.updateTaxRate)(req.params.id, req.body);
        res.json({ data: rate });
    }
    catch (error) {
        logger_1.logger.error('Failed to update tax rate', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update tax rate' });
    }
});
router.delete('/rates/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, tax_service_1.deleteTaxRate)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete tax rate', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete tax rate' });
    }
});
// Tax Returns
router.get('/returns', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const userId = req.user?.id;
        const returns = await (0, tax_service_1.listTaxReturns)({
            organizationId: organizationId,
            userId,
        });
        res.json({ data: returns });
    }
    catch (error) {
        logger_1.logger.error('Failed to list tax returns', { error });
        res.status(500).json({ error: 'Failed to list tax returns' });
    }
});
router.post('/returns', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const record = await (0, tax_service_1.createTaxReturn)({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to create tax return', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create tax return' });
    }
});
router.patch('/returns/:id', auth_1.authenticate, async (req, res) => {
    try {
        const record = await (0, tax_service_1.updateTaxReturn)(req.params.id, {
            periodStart: req.body.periodStart,
            periodEnd: req.body.periodEnd,
            currency: req.body.currency,
            totalSales: req.body.totalSales,
            totalTax: req.body.totalTax,
            reference: req.body.reference,
            metadata: req.body.metadata,
        });
        res.json({ data: record });
    }
    catch (error) {
        logger_1.logger.error('Failed to update tax return', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update tax return' });
    }
});
router.post('/returns/:id/submit', auth_1.authenticate, async (req, res) => {
    try {
        const record = await (0, tax_service_1.submitTaxReturn)(req.params.id);
        res.json({ data: record });
    }
    catch (error) {
        logger_1.logger.error('Failed to submit tax return', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to submit tax return' });
    }
});
router.delete('/returns/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, tax_service_1.deleteTaxReturn)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete tax return', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete tax return' });
    }
});
exports.default = router;
//# sourceMappingURL=tax.routes.js.map