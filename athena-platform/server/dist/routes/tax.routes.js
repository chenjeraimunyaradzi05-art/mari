"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const tax_service_1 = require("../services/tax.service");
const router = (0, express_1.Router)();
// Validation schemas
const createTaxRateSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1).max(200),
    type: zod_1.z.enum(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING']),
    rate: zod_1.z.number().min(0).max(100),
    region: zod_1.z.string().min(1).max(100).optional(),
    effectiveFrom: zod_1.z.string().datetime().optional(),
    effectiveTo: zod_1.z.string().datetime().optional(),
});
const updateTaxRateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    type: zod_1.z.enum(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING']).optional(),
    rate: zod_1.z.number().min(0).max(100).optional(),
    region: zod_1.z.string().min(1).max(100).optional(),
    effectiveFrom: zod_1.z.string().datetime().optional(),
    effectiveTo: zod_1.z.string().datetime().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createTaxReturnSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    periodStart: zod_1.z.string().datetime(),
    periodEnd: zod_1.z.string().datetime(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
    totalSales: zod_1.z.number().min(0),
    totalTax: zod_1.z.number().min(0),
    reference: zod_1.z.string().max(100).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const updateTaxReturnSchema = zod_1.z.object({
    periodStart: zod_1.z.string().datetime().optional(),
    periodEnd: zod_1.z.string().datetime().optional(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
    totalSales: zod_1.z.number().min(0).optional(),
    totalTax: zod_1.z.number().min(0).optional(),
    reference: zod_1.z.string().max(100).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// Tax Rates
router.get('/rates', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId, region } = req.query;
        const rates = await (0, tax_service_1.listTaxRates)({
            organizationId: organizationId,
            region: region,
        });
        res.json({ data: rates });
    }
    catch (error) {
        next(error);
    }
});
router.post('/rates', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createTaxRateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const rate = await (0, tax_service_1.createTaxRate)(parsed.data);
        res.status(201).json({ data: rate });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/rates/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateTaxRateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const rate = await (0, tax_service_1.updateTaxRate)(req.params.id, parsed.data);
        res.json({ data: rate });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/rates/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, tax_service_1.deleteTaxRate)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Tax Returns
router.get('/returns', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const returns = await (0, tax_service_1.listTaxReturns)({
            organizationId: organizationId,
            userId: req.user.id,
        });
        res.json({ data: returns });
    }
    catch (error) {
        next(error);
    }
});
router.post('/returns', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createTaxReturnSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const record = await (0, tax_service_1.createTaxReturn)({
            ...parsed.data,
            userId: req.user.id,
        });
        res.status(201).json({ data: record });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/returns/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateTaxReturnSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const record = await (0, tax_service_1.updateTaxReturn)(req.params.id, req.user.id, parsed.data);
        res.json({ data: record });
    }
    catch (error) {
        next(error);
    }
});
router.post('/returns/:id/submit', auth_1.authenticate, async (req, res, next) => {
    try {
        const record = await (0, tax_service_1.submitTaxReturn)(req.params.id, req.user.id);
        res.json({ data: record });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/returns/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, tax_service_1.deleteTaxReturn)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=tax.routes.js.map