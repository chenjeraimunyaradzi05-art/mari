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
// GET CURRENT USER BADGES
// ===========================================
router.get('/badges', auth_1.authenticate, async (req, res, next) => {
    try {
        const badges = await prisma_1.prisma.verificationBadge.findMany({
            where: { userId: req.user.id },
            orderBy: { submittedAt: 'desc' },
        });
        res.json({
            success: true,
            data: badges,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SUBMIT VERIFICATION REQUEST
// ===========================================
router.post('/badges', auth_1.authenticate, [(0, express_validator_1.body)('type').isIn(['IDENTITY', 'EMPLOYER', 'EDUCATOR', 'MENTOR', 'CREATOR']), (0, express_validator_1.body)('metadata').optional()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { type, metadata } = req.body;
        const badge = await prisma_1.prisma.verificationBadge.create({
            data: {
                userId: req.user.id,
                type,
                status: 'PENDING',
                metadata: metadata ?? undefined,
            },
        });
        await (0, audit_1.logAudit)({
            action: 'USER_VERIFICATION_SUBMIT',
            actorUserId: req.user?.id ?? null,
            targetUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { badgeId: badge.id, type },
        });
        res.status(201).json({
            success: true,
            data: badge,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// REVIEW VERIFICATION REQUEST (ADMIN)
// ===========================================
router.patch('/badges/:id', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), [(0, express_validator_1.body)('status').isIn(['APPROVED', 'REJECTED']), (0, express_validator_1.body)('reason').optional().isString()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const { status, reason } = req.body;
        const badge = await prisma_1.prisma.verificationBadge.update({
            where: { id },
            data: {
                status,
                reason: reason ?? null,
                reviewedAt: new Date(),
                reviewedById: req.user.id,
            },
        });
        if (status === 'APPROVED' && badge.type === 'IDENTITY') {
            await prisma_1.prisma.user.update({
                where: { id: badge.userId },
                data: { isVerified: true },
            });
        }
        await (0, audit_1.logAudit)({
            action: status === 'APPROVED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
            actorUserId: req.user?.id ?? null,
            targetUserId: badge.userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { badgeId: badge.id, type: badge.type, reason },
        });
        res.json({
            success: true,
            data: badge,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=verification.routes.js.map