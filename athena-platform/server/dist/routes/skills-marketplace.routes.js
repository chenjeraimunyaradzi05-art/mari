"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function parseLimit(value, fallback = 20, max = 50) {
    const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
    if (Number.isNaN(parsed) || parsed <= 0)
        return fallback;
    return Math.min(parsed, max);
}
// ===========================================
// LIST SERVICES
// ===========================================
router.get('/services', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const minRate = typeof req.query.minRate === 'string' ? parseInt(req.query.minRate, 10) : undefined;
        const maxRate = typeof req.query.maxRate === 'string' ? parseInt(req.query.maxRate, 10) : undefined;
        const where = {
            status: 'ACTIVE',
            isAvailable: true,
        };
        if (category)
            where.category = category;
        if (minRate)
            where.hourlyRate = { gte: minRate };
        if (maxRate)
            where.hourlyRate = { ...(where.hourlyRate || {}), lte: maxRate };
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [services, total] = await Promise.all([
            prisma_1.prisma.skillService.findMany({
                where,
                orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
                },
            }),
            prisma_1.prisma.skillService.count({ where }),
        ]);
        res.json({
            success: true,
            data: services,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE SERVICE
// ===========================================
router.post('/services', auth_1.authenticate, [
    (0, express_validator_1.body)('title').isString().notEmpty(),
    (0, express_validator_1.body)('description').isString().notEmpty(),
    (0, express_validator_1.body)('category').isIn(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING']),
    (0, express_validator_1.body)('hourlyRate').isInt({ min: 1 }),
    (0, express_validator_1.body)('minimumHours').optional().isFloat({ min: 0.5 }),
    (0, express_validator_1.body)('isAvailable').optional().isBoolean(),
    (0, express_validator_1.body)('availabilityJson').optional(),
    (0, express_validator_1.body)('tags').optional().isArray(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const created = await prisma_1.prisma.skillService.create({
            data: {
                providerId: req.user.id,
                title: req.body.title,
                description: req.body.description,
                category: req.body.category,
                hourlyRate: req.body.hourlyRate,
                minimumHours: req.body.minimumHours,
                isAvailable: req.body.isAvailable ?? true,
                availabilityJson: req.body.availabilityJson,
                tags: req.body.tags || [],
            },
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET SERVICE
// ===========================================
router.get('/services/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const service = await prisma_1.prisma.skillService.findUnique({
            where: { id },
            include: {
                provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
                reviews: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!service) {
            throw new errorHandler_1.ApiError(404, 'Service not found');
        }
        res.json({ success: true, data: service });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE SERVICE
// ===========================================
router.patch('/services/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('category').optional().isIn(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING']),
    (0, express_validator_1.body)('status').optional().isIn(['ACTIVE', 'PAUSED', 'ARCHIVED']),
    (0, express_validator_1.body)('hourlyRate').optional().isInt({ min: 1 }),
    (0, express_validator_1.body)('minimumHours').optional().isFloat({ min: 0.5 }),
    (0, express_validator_1.body)('isAvailable').optional().isBoolean(),
    (0, express_validator_1.body)('availabilityJson').optional(),
    (0, express_validator_1.body)('tags').optional().isArray(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const service = await prisma_1.prisma.skillService.findUnique({ where: { id } });
        if (!service) {
            throw new errorHandler_1.ApiError(404, 'Service not found');
        }
        if (service.providerId !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.skillService.update({
            where: { id },
            data: {
                title: req.body.title,
                description: req.body.description,
                category: req.body.category,
                status: req.body.status,
                hourlyRate: req.body.hourlyRate,
                minimumHours: req.body.minimumHours,
                isAvailable: req.body.isAvailable,
                availabilityJson: req.body.availabilityJson,
                tags: req.body.tags,
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// BOOK SERVICE
// ===========================================
router.post('/services/:id/book', auth_1.authenticate, [
    (0, express_validator_1.body)('scheduledAt').isISO8601(),
    (0, express_validator_1.body)('durationMinutes').isInt({ min: 30 }),
    (0, express_validator_1.body)('clientNotes').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const service = await prisma_1.prisma.skillService.findUnique({ where: { id } });
        if (!service || !service.isAvailable || service.status !== 'ACTIVE') {
            throw new errorHandler_1.ApiError(404, 'Service not available');
        }
        const durationMinutes = req.body.durationMinutes;
        const hours = Math.max(service.minimumHours || 1, durationMinutes / 60);
        const totalAmount = Math.round(service.hourlyRate * hours);
        const platformFee = Math.round(totalAmount * 0.2);
        const providerPayout = totalAmount - platformFee;
        const booking = await prisma_1.prisma.serviceBooking.create({
            data: {
                serviceId: id,
                clientId: req.user.id,
                scheduledAt: new Date(req.body.scheduledAt),
                durationMinutes,
                totalAmount,
                platformFee,
                providerPayout,
                clientNotes: req.body.clientNotes,
            },
        });
        res.status(201).json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// MY BOOKINGS
// ===========================================
router.get('/bookings/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const role = typeof req.query.role === 'string' ? req.query.role : 'all';
        const where = {};
        if (role === 'client') {
            where.clientId = req.user.id;
        }
        else if (role === 'provider') {
            where.service = { providerId: req.user.id };
        }
        else {
            where.OR = [
                { clientId: req.user.id },
                { service: { providerId: req.user.id } },
            ];
        }
        const bookings = await prisma_1.prisma.serviceBooking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                service: { include: { provider: { select: { id: true, displayName: true, avatar: true } } } },
            },
        });
        res.json({ success: true, data: bookings });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE BOOKING STATUS
// ===========================================
router.patch('/bookings/:id', auth_1.authenticate, [(0, express_validator_1.body)('status').isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'])], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const booking = await prisma_1.prisma.serviceBooking.findUnique({
            where: { id },
            include: { service: true },
        });
        if (!booking) {
            throw new errorHandler_1.ApiError(404, 'Booking not found');
        }
        const isClient = booking.clientId === req.user.id;
        const isProvider = booking.service.providerId === req.user.id;
        if (!isClient && !isProvider && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.serviceBooking.update({
            where: { id },
            data: {
                status: req.body.status,
                completedAt: req.body.status === 'COMPLETED' ? new Date() : undefined,
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// REVIEW SERVICE
// ===========================================
router.post('/services/:id/reviews', auth_1.authenticate, [(0, express_validator_1.body)('rating').isInt({ min: 1, max: 5 }), (0, express_validator_1.body)('content').optional().isString(), (0, express_validator_1.body)('bookingId').optional().isString()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const service = await prisma_1.prisma.skillService.findUnique({ where: { id } });
        if (!service) {
            throw new errorHandler_1.ApiError(404, 'Service not found');
        }
        const review = await prisma_1.prisma.serviceReview.create({
            data: {
                serviceId: id,
                clientId: req.user.id,
                rating: req.body.rating,
                content: req.body.content,
                bookingId: req.body.bookingId,
            },
        });
        const stats = await prisma_1.prisma.serviceReview.aggregate({
            where: { serviceId: id, isHidden: false },
            _avg: { rating: true },
            _count: { rating: true },
        });
        await prisma_1.prisma.skillService.update({
            where: { id },
            data: {
                rating: stats._avg.rating ?? undefined,
                reviewCount: stats._count.rating,
            },
        });
        res.status(201).json({ success: true, data: review });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=skills-marketplace.routes.js.map