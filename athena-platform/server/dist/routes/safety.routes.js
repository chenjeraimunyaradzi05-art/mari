"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const moderation_service_1 = require("../services/moderation.service");
const trust_service_1 = require("../services/trust.service");
const prisma_1 = require("../utils/prisma");
const safety_store_1 = require("../utils/safety-store");
const crypto_1 = require("crypto");
const router = (0, express_1.Router)();
// ===========================================
// SAFETY SCORE (Full Launch)
// ===========================================
router.post('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || typeof content !== 'string') {
            throw new errorHandler_1.ApiError(400, 'Content is required');
        }
        const data = await (0, moderation_service_1.evaluateSafetyScore)(content);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SAFETY REPORTS
// ===========================================
router.get('/reports', auth_1.authenticate, async (req, res, next) => {
    try {
        const store = await (0, safety_store_1.readSafetyStore)();
        const reports = store.reports.filter((report) => report.userId === req.user.id);
        res.json({ success: true, data: reports });
    }
    catch (error) {
        next(error);
    }
});
router.post('/reports', auth_1.authenticate, [
    (0, express_validator_1.body)('targetType').notEmpty().isIn(['post', 'video', 'user', 'message', 'channel', 'other']),
    (0, express_validator_1.body)('reason').notEmpty().isString(),
    (0, express_validator_1.body)('targetId').optional().isString(),
    (0, express_validator_1.body)('details').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { targetType, targetId, reason, details } = req.body;
        const now = new Date().toISOString();
        const report = {
            id: (0, crypto_1.randomUUID)(),
            userId: req.user.id,
            targetType,
            targetId,
            reason,
            details,
            status: 'SUBMITTED',
            createdAt: now,
            updatedAt: now,
        };
        const store = await (0, safety_store_1.readSafetyStore)();
        store.reports.unshift(report);
        await (0, safety_store_1.writeSafetyStore)(store);
        if (targetType === 'post' && targetId) {
            await prisma_1.prisma.post.update({
                where: { id: targetId },
                data: { reportCount: { increment: 1 } },
            });
        }
        if (targetType === 'video' && targetId) {
            await prisma_1.prisma.video.update({
                where: { id: targetId },
                data: { reportCount: { increment: 1 } },
            });
        }
        const reportedUserId = targetType === 'user' && targetId
            ? targetId
            : targetType === 'post' && targetId
                ? (await prisma_1.prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId
                : targetType === 'video' && targetId
                    ? (await prisma_1.prisma.video.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId
                    : null;
        if (reportedUserId) {
            await (0, trust_service_1.recordSafetyReport)(req.user.id, reportedUserId);
            await prisma_1.prisma.contentReport.create({
                data: {
                    reporterId: req.user.id,
                    contentType: targetType.toUpperCase(),
                    contentId: targetId || 'unknown',
                    reportedUserId,
                    reason,
                    description: details,
                    status: 'PENDING',
                },
            });
        }
        res.status(201).json({ success: true, data: report });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// BLOCKED USERS
// ===========================================
router.get('/blocks', auth_1.authenticate, async (req, res, next) => {
    try {
        const store = await (0, safety_store_1.readSafetyStore)();
        const blocks = store.blocks.filter((block) => block.userId === req.user.id);
        const users = await prisma_1.prisma.user.findMany({
            where: { id: { in: blocks.map((block) => block.blockedUserId) } },
            select: { id: true, displayName: true, avatar: true, headline: true },
        });
        const enriched = blocks.map((block) => ({
            ...block,
            user: users.find((user) => user.id === block.blockedUserId) || null,
        }));
        res.json({ success: true, data: enriched });
    }
    catch (error) {
        next(error);
    }
});
router.post('/blocks', auth_1.authenticate, [(0, express_validator_1.body)('blockedUserId').notEmpty().isString(), (0, express_validator_1.body)('reason').optional().isString()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { blockedUserId, reason } = req.body;
        const store = await (0, safety_store_1.readSafetyStore)();
        const exists = store.blocks.find((block) => block.userId === req.user.id && block.blockedUserId === blockedUserId);
        if (exists) {
            return res.json({ success: true, data: exists });
        }
        const block = {
            id: (0, crypto_1.randomUUID)(),
            userId: req.user.id,
            blockedUserId,
            reason,
            createdAt: new Date().toISOString(),
        };
        store.blocks.unshift(block);
        await (0, safety_store_1.writeSafetyStore)(store);
        await (0, trust_service_1.recordUserBlock)(blockedUserId);
        res.status(201).json({ success: true, data: block });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/blocks/:blockedUserId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { blockedUserId } = req.params;
        const store = await (0, safety_store_1.readSafetyStore)();
        store.blocks = store.blocks.filter((block) => !(block.userId === req.user.id && block.blockedUserId === blockedUserId));
        await (0, safety_store_1.writeSafetyStore)(store);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SAFETY SETTINGS
// ===========================================
router.get('/settings', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { allowMessages: true },
        });
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { userId: req.user.id },
            select: { isSafeMode: true, hideFromSearch: true },
        });
        res.json({
            success: true,
            data: {
                allowMessages: user?.allowMessages ?? true,
                isSafeMode: profile?.isSafeMode ?? false,
                hideFromSearch: profile?.hideFromSearch ?? false,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/settings', auth_1.authenticate, [
    (0, express_validator_1.body)('allowMessages').optional().isBoolean(),
    (0, express_validator_1.body)('isSafeMode').optional().isBoolean(),
    (0, express_validator_1.body)('hideFromSearch').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { allowMessages, isSafeMode, hideFromSearch } = req.body;
        if (typeof allowMessages === 'boolean') {
            await prisma_1.prisma.user.update({
                where: { id: req.user.id },
                data: { allowMessages },
            });
        }
        if (typeof isSafeMode === 'boolean' || typeof hideFromSearch === 'boolean') {
            await prisma_1.prisma.profile.upsert({
                where: { userId: req.user.id },
                update: {
                    ...(typeof isSafeMode === 'boolean' ? { isSafeMode } : {}),
                    ...(typeof hideFromSearch === 'boolean' ? { hideFromSearch } : {}),
                },
                create: {
                    userId: req.user.id,
                    isSafeMode: typeof isSafeMode === 'boolean' ? isSafeMode : false,
                    hideFromSearch: typeof hideFromSearch === 'boolean' ? hideFromSearch : false,
                },
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=safety.routes.js.map