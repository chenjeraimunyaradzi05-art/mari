"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../utils/audit");
const router = (0, express_1.Router)();
// ===========================================
// SUBMIT APPEAL
// ===========================================
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('type').isIn(['CONTENT_MODERATION', 'ACCOUNT_SUSPENSION', 'VERIFICATION_DECISION', 'OTHER']),
    (0, express_validator_1.body)('reason').isString().notEmpty(),
    (0, express_validator_1.body)('metadata').optional(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { type, reason, metadata } = req.body;
        const appeal = await prisma_1.prisma.appeal.create({
            data: {
                userId: req.user.id,
                type,
                reason,
                metadata: metadata ?? undefined,
                status: 'PENDING',
            },
        });
        await (0, audit_1.logAudit)({
            action: 'USER_APPEAL_SUBMIT',
            actorUserId: req.user?.id ?? null,
            targetUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { appealId: appeal.id, type },
        });
        res.status(201).json({
            success: true,
            data: appeal,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// LIST CURRENT USER APPEALS
// ===========================================
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const appeals = await prisma_1.prisma.appeal.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: appeals,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// ADMIN LIST APPEALS
// ===========================================
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), [(0, express_validator_1.query)('status').optional().isIn(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'])], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { status } = req.query;
        const where = status ? { status } : {};
        const appeals = await prisma_1.prisma.appeal.findMany({
            where: where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        res.json({
            success: true,
            data: appeals,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// ADMIN REVIEW APPEAL
// ===========================================
router.patch('/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), [(0, express_validator_1.body)('status').isIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED']), (0, express_validator_1.body)('decisionNote').optional().isString()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const { status, decisionNote } = req.body;
        const appeal = await prisma_1.prisma.appeal.update({
            where: { id },
            data: {
                status,
                decisionNote: decisionNote ?? null,
                reviewedAt: new Date(),
                reviewedById: req.user.id,
            },
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_APPEAL_DECISION',
            actorUserId: req.user?.id ?? null,
            targetUserId: appeal.userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { appealId: appeal.id, status, decisionNote },
        });
        res.json({
            success: true,
            data: appeal,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=appeal.routes.js.map