"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const accounting_service_1 = require("../services/accounting.service");
const router = (0, express_1.Router)();
// Accounts
router.get('/accounts', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const userId = req.user?.id;
        const accounts = await (0, accounting_service_1.listAccounts)({
            organizationId: organizationId,
            userId,
        });
        res.json({ data: accounts });
    }
    catch (error) {
        logger_1.logger.error('Failed to list accounts', { error });
        res.status(500).json({ error: 'Failed to list accounts' });
    }
});
router.post('/accounts', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const account = await (0, accounting_service_1.createAccount)({
            organizationId: req.body.organizationId,
            userId,
            name: req.body.name,
            code: req.body.code,
            type: req.body.type,
            currency: req.body.currency,
        });
        res.status(201).json({ data: account });
    }
    catch (error) {
        logger_1.logger.error('Failed to create account', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create account' });
    }
});
router.patch('/accounts/:id', auth_1.authenticate, async (req, res) => {
    try {
        const account = await (0, accounting_service_1.updateAccount)(req.params.id, req.body);
        res.json({ data: account });
    }
    catch (error) {
        logger_1.logger.error('Failed to update account', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update account' });
    }
});
router.delete('/accounts/:id', auth_1.authenticate, async (req, res) => {
    try {
        await (0, accounting_service_1.deleteAccount)(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Failed to delete account', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete account' });
    }
});
// Journal Entries
router.get('/journals', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId, status } = req.query;
        const userId = req.user?.id;
        const entries = await (0, accounting_service_1.listJournalEntries)({
            organizationId: organizationId,
            userId,
            status: status,
        });
        res.json({ data: entries });
    }
    catch (error) {
        logger_1.logger.error('Failed to list journal entries', { error });
        res.status(500).json({ error: 'Failed to list journal entries' });
    }
});
router.post('/journals', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const entry = await (0, accounting_service_1.createJournalEntry)({
            organizationId: req.body.organizationId,
            userId,
            description: req.body.description,
            reference: req.body.reference,
            entryDate: req.body.entryDate,
            status: req.body.status,
            lines: req.body.lines || [],
        });
        res.status(201).json({ data: entry });
    }
    catch (error) {
        logger_1.logger.error('Failed to create journal entry', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create journal entry' });
    }
});
router.get('/journals/:id', auth_1.authenticate, async (req, res) => {
    try {
        const entry = await (0, accounting_service_1.getJournalEntry)(req.params.id);
        res.json({ data: entry });
    }
    catch (error) {
        logger_1.logger.error('Failed to get journal entry', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get journal entry' });
    }
});
router.patch('/journals/:id', auth_1.authenticate, async (req, res) => {
    try {
        const entry = await (0, accounting_service_1.updateJournalEntry)(req.params.id, {
            description: req.body.description,
            reference: req.body.reference,
            entryDate: req.body.entryDate,
        });
        res.json({ data: entry });
    }
    catch (error) {
        logger_1.logger.error('Failed to update journal entry', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update journal entry' });
    }
});
router.post('/journals/:id/post', auth_1.authenticate, async (req, res) => {
    try {
        const entry = await (0, accounting_service_1.postJournalEntry)(req.params.id);
        res.json({ data: entry });
    }
    catch (error) {
        logger_1.logger.error('Failed to post journal entry', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to post journal entry' });
    }
});
router.post('/journals/:id/void', auth_1.authenticate, async (req, res) => {
    try {
        const entry = await (0, accounting_service_1.voidJournalEntry)(req.params.id);
        res.json({ data: entry });
    }
    catch (error) {
        logger_1.logger.error('Failed to void journal entry', { error });
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to void journal entry' });
    }
});
// Reports
router.get('/reports/trial-balance', auth_1.authenticate, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const userId = req.user?.id;
        const report = await (0, accounting_service_1.getTrialBalance)({
            organizationId: organizationId,
            userId,
        });
        res.json({ data: report });
    }
    catch (error) {
        logger_1.logger.error('Failed to get trial balance', { error });
        res.status(500).json({ error: 'Failed to get trial balance' });
    }
});
exports.default = router;
//# sourceMappingURL=accounting.routes.js.map