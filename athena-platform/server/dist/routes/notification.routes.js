"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const defaultNotificationPreferences = {
    email: {
        jobMatches: true,
        applications: true,
        messages: true,
        mentions: true,
        newsletter: true,
    },
    push: {
        jobMatches: true,
        applications: true,
        messages: true,
        mentions: true,
    },
    inApp: {
        all: true,
    },
};
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function validatePreferences(input) {
    if (!isPlainObject(input))
        return {};
    const result = {};
    const coerceSection = (section, allowed) => {
        if (!isPlainObject(section))
            return undefined;
        const out = {};
        for (const key of allowed) {
            if (section[key] === undefined)
                continue;
            if (typeof section[key] !== 'boolean') {
                throw new errorHandler_1.ApiError(400, 'Invalid notification preferences');
            }
            out[key] = section[key];
        }
        return out;
    };
    const email = coerceSection(input.email, ['jobMatches', 'applications', 'messages', 'mentions', 'newsletter']);
    const push = coerceSection(input.push, ['jobMatches', 'applications', 'messages', 'mentions']);
    const inApp = coerceSection(input.inApp, ['all']);
    if (email)
        result.email = email;
    if (push)
        result.push = push;
    if (inApp)
        result.inApp = inApp;
    return result;
}
function mergeNotificationPreferences(base, overrides) {
    const o = overrides || {};
    return {
        email: {
            ...base.email,
            ...(o.email || {}),
        },
        push: {
            ...base.push,
            ...(o.push || {}),
        },
        inApp: {
            ...base.inApp,
            ...(o.inApp || {}),
        },
    };
}
// ===========================================
// GET ALL NOTIFICATIONS
// ===========================================
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = {
            userId: req.user.id,
        };
        if (unreadOnly === 'true') {
            where.readAt = null;
        }
        const [notifications, total] = await Promise.all([
            prisma_1.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_1.prisma.notification.count({ where }),
        ]);
        const unreadCount = await prisma_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                readAt: null,
            },
        });
        res.json({
            success: true,
            data: {
                notifications,
                unreadCount,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// MARK NOTIFICATION AS READ
// ===========================================
router.patch('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findUnique({
            where: { id },
        });
        if (!notification) {
            throw new errorHandler_1.ApiError(404, 'Notification not found');
        }
        if (notification.userId !== req.user.id) {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// MARK ALL NOTIFICATIONS AS READ
// ===========================================
router.patch('/read-all', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                readAt: null,
            },
            data: { readAt: new Date() },
        });
        res.json({
            success: true,
            message: 'All notifications marked as read',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// DELETE ALL READ NOTIFICATIONS
// ===========================================
router.delete('/clear-read', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.prisma.notification.deleteMany({
            where: {
                userId: req.user.id,
                readAt: { not: null },
            },
        });
        res.json({
            success: true,
            message: 'Read notifications cleared',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// DELETE NOTIFICATION
// ===========================================
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findUnique({
            where: { id },
        });
        if (!notification) {
            throw new errorHandler_1.ApiError(404, 'Notification not found');
        }
        if (notification.userId !== req.user.id) {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        await prisma_1.prisma.notification.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: 'Notification deleted',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET NOTIFICATION PREFERENCES
// ===========================================
router.get('/preferences', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            // Cast to any so this compiles even if Prisma client isn't regenerated yet.
            select: { notificationPreferences: true },
        });
        const stored = isPlainObject(user?.notificationPreferences)
            ? user.notificationPreferences
            : null;
        const preferences = mergeNotificationPreferences(defaultNotificationPreferences, stored);
        res.json({
            success: true,
            data: preferences,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE NOTIFICATION PREFERENCES
// ===========================================
router.patch('/preferences', auth_1.authenticate, async (req, res, next) => {
    try {
        const input = (req.body && (req.body.preferences ?? req.body)) ?? {};
        const updateParsed = validatePreferences(input);
        const current = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { notificationPreferences: true },
        });
        const currentStored = isPlainObject(current?.notificationPreferences)
            ? current.notificationPreferences
            : null;
        const base = mergeNotificationPreferences(defaultNotificationPreferences, currentStored);
        const merged = mergeNotificationPreferences(base, updateParsed);
        await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: { notificationPreferences: merged },
        });
        res.json({
            success: true,
            message: 'Notification preferences updated',
            data: merged,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map