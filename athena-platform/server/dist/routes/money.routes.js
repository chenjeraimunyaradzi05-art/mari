"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const money_service_1 = require("../services/money.service");
const router = (0, express_1.Router)();
router.get('/transactions', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const userId = req.user?.id;
        const transactions = await (0, money_service_1.listMoneyTransactions)({
            organizationId: organizationId,
            userId,
        });
        res.json({ data: transactions });
    }
    catch (error) {
        logger_1.logger.error('Failed to list money transactions', { error });
        res.status(500).json({ error: 'Failed to list money transactions' });
    }
});
router.post('/transactions', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const transaction = await (0, money_service_1.createMoneyTransaction)({
            organizationId: req.body.organizationId,
            userId,
            amount: req.body.amount,
            currency: req.body.currency,
            type: req.body.type,
            status: req.body.status,
            provider: req.body.provider,
            reference: req.body.reference,
            metadata: req.body.metadata,
        });
        res.status(201).json({ data: transaction });
    }
    catch (error) {
        logger_1.logger.error('Failed to create money transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create money transaction' });
    }
});
router.patch('/transactions/:id', auth_1.authenticate, async (req, res) => {
    try {
        const transaction = await (0, money_service_1.updateMoneyTransaction)(req.params.id, req.body);
        res.json({ data: transaction });
    }
    catch (error) {
        logger_1.logger.error('Failed to update money transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update money transaction' });
    }
});
router.delete('/transactions/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, money_service_1.deleteMoneyTransaction)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete money transaction', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete money transaction' });
    }
});
exports.default = router;
//# sourceMappingURL=money.routes.js.map