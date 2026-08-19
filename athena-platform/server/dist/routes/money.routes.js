"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const money_service_1 = require("../services/money.service");
const router = (0, express_1.Router)();
// Validation schemas
const createMoneyTransactionSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).default('USD'),
    type: zod_1.z.enum(['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT']),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']).default('PENDING'),
    provider: zod_1.z.string().max(100).optional(),
    reference: zod_1.z.string().max(200).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const updateMoneyTransactionSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']).optional(),
    provider: zod_1.z.string().max(100).optional(),
    reference: zod_1.z.string().max(200).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
router.get('/transactions', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const transactions = await (0, money_service_1.listMoneyTransactions)({
            organizationId: organizationId,
            userId: req.user.id,
        });
        res.json({ data: transactions });
    }
    catch (error) {
        next(error);
    }
});
router.post('/transactions', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createMoneyTransactionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const transaction = await (0, money_service_1.createMoneyTransaction)({
            ...parsed.data,
            userId: req.user.id,
        });
        res.status(201).json({ data: transaction });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/transactions/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateMoneyTransactionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const transaction = await (0, money_service_1.updateMoneyTransaction)(req.params.id, req.user.id, parsed.data);
        res.json({ data: transaction });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/transactions/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, money_service_1.deleteMoneyTransaction)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=money.routes.js.map