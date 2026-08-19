"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const accounting_service_1 = require("../services/accounting.service");
const router = (0, express_1.Router)();
// Validation schemas
const createAccountSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1).max(200),
    code: zod_1.z.string().min(1).max(50).optional(),
    type: zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
});
const updateAccountSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    code: zod_1.z.string().min(1).max(50).optional(),
    type: zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
    currency: zod_1.z.string().regex(/^[A-Z]{3}$/).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const journalLineSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
    debit: zod_1.z.number().min(0).optional(),
    credit: zod_1.z.number().min(0).optional(),
    description: zod_1.z.string().max(500).optional(),
});
const createJournalSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().min(1).max(500),
    reference: zod_1.z.string().max(100).optional(),
    entryDate: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['DRAFT', 'POSTED']).optional(),
    lines: zod_1.z.array(journalLineSchema).min(1),
});
const updateJournalSchema = zod_1.z.object({
    description: zod_1.z.string().min(1).max(500).optional(),
    reference: zod_1.z.string().max(100).optional(),
    entryDate: zod_1.z.string().datetime().optional(),
});
// Accounts
router.get('/accounts', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const accounts = await (0, accounting_service_1.listAccounts)({
            organizationId: organizationId,
            userId: req.user.id,
        });
        res.json({ data: accounts });
    }
    catch (error) {
        next(error);
    }
});
router.post('/accounts', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createAccountSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const account = await (0, accounting_service_1.createAccount)({
            ...parsed.data,
            userId: req.user.id,
        });
        res.status(201).json({ data: account });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/accounts/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateAccountSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const account = await (0, accounting_service_1.updateAccount)(req.params.id, req.user.id, parsed.data);
        res.json({ data: account });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/accounts/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        await (0, accounting_service_1.deleteAccount)(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Journal Entries
router.get('/journals', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId, status } = req.query;
        const entries = await (0, accounting_service_1.listJournalEntries)({
            organizationId: organizationId,
            userId: req.user.id,
            status: status,
        });
        res.json({ data: entries });
    }
    catch (error) {
        next(error);
    }
});
router.post('/journals', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = createJournalSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const entry = await (0, accounting_service_1.createJournalEntry)({
            ...parsed.data,
            userId: req.user.id,
        });
        res.status(201).json({ data: entry });
    }
    catch (error) {
        next(error);
    }
});
router.get('/journals/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const entry = await (0, accounting_service_1.getJournalEntry)(req.params.id, req.user.id);
        res.json({ data: entry });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/journals/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = updateJournalSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        }
        const entry = await (0, accounting_service_1.updateJournalEntry)(req.params.id, req.user.id, parsed.data);
        res.json({ data: entry });
    }
    catch (error) {
        next(error);
    }
});
router.post('/journals/:id/post', auth_1.authenticate, async (req, res, next) => {
    try {
        const entry = await (0, accounting_service_1.postJournalEntry)(req.params.id, req.user.id);
        res.json({ data: entry });
    }
    catch (error) {
        next(error);
    }
});
router.post('/journals/:id/void', auth_1.authenticate, async (req, res, next) => {
    try {
        const entry = await (0, accounting_service_1.voidJournalEntry)(req.params.id, req.user.id);
        res.json({ data: entry });
    }
    catch (error) {
        next(error);
    }
});
// Reports
router.get('/reports/trial-balance', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const report = await (0, accounting_service_1.getTrialBalance)({
            organizationId: organizationId,
            userId: req.user.id,
        });
        res.json({ data: report });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=accounting.routes.js.map