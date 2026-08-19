"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ===========================================
// HOUSING LISTINGS
// ===========================================
// GET /api/housing/listings - List available housing
router.get('/listings', async (req, res, next) => {
    try {
        const { type, city, state, minRent, maxRent, bedrooms, dvSafe, petFriendly, accessible, page = '1', limit = '20', } = req.query;
        const where = {
            status: 'ACTIVE',
        };
        if (type)
            where.type = type;
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (state)
            where.state = state;
        if (minRent || maxRent) {
            where.rentWeekly = {};
            if (minRent)
                where.rentWeekly.gte = Number(minRent);
            if (maxRent)
                where.rentWeekly.lte = Number(maxRent);
        }
        if (bedrooms)
            where.bedrooms = { gte: Number(bedrooms) };
        if (dvSafe === 'true')
            where.dvSafe = true;
        if (petFriendly === 'true')
            where.petFriendly = true;
        if (accessible === 'true')
            where.accessibleUnit = true;
        const skip = (Number(page) - 1) * Number(limit);
        const [listings, total] = await Promise.all([
            prisma_1.prisma.housingListing.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma_1.prisma.housingListing.count({ where }),
        ]);
        res.json({
            success: true,
            data: listings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/housing/listings/:id - Get listing details
router.get('/listings/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await prisma_1.prisma.housingListing.findUnique({
            where: { id },
        });
        if (!listing) {
            throw new errorHandler_1.ApiError(404, 'Housing listing not found');
        }
        res.json({
            success: true,
            data: listing,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/housing/listings/:id/inquire - Inquire about a listing
router.post('/listings/:id/inquire', auth_1.authenticate, [(0, express_validator_1.body)('message').optional().isString().isLength({ max: 2000 })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const userId = req.user.id;
        const { message } = req.body;
        const listing = await prisma_1.prisma.housingListing.findUnique({ where: { id } });
        if (!listing) {
            throw new errorHandler_1.ApiError(404, 'Housing listing not found');
        }
        if (listing.status !== 'ACTIVE') {
            throw new errorHandler_1.ApiError(400, 'This listing is no longer available');
        }
        // Check existing inquiry
        const existing = await prisma_1.prisma.housingInquiry.findUnique({
            where: { listingId_userId: { listingId: id, userId } },
        });
        if (existing) {
            throw new errorHandler_1.ApiError(409, 'You have already inquired about this listing');
        }
        const inquiry = await prisma_1.prisma.housingInquiry.create({
            data: {
                listingId: id,
                userId,
                message,
                status: 'PENDING',
            },
            include: {
                listing: true,
            },
        });
        logger_1.logger.info(`User ${userId} inquired about housing listing ${id}`);
        res.status(201).json({
            success: true,
            data: inquiry,
            message: 'Inquiry submitted successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/housing/my/inquiries - Get user's housing inquiries
router.get('/my/inquiries', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const inquiries = await prisma_1.prisma.housingInquiry.findMany({
            where: { userId },
            include: {
                listing: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: inquiries,
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/housing/inquiries/:id - Update inquiry status
router.patch('/inquiries/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('status').optional().isIn(['PENDING', 'CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED', 'DECLINED', 'WITHDRAWN']),
    (0, express_validator_1.body)('viewingDate').optional().isISO8601(),
    (0, express_validator_1.body)('notes').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const userId = req.user.id;
        const { status, viewingDate, notes } = req.body;
        const inquiry = await prisma_1.prisma.housingInquiry.findUnique({ where: { id } });
        if (!inquiry) {
            throw new errorHandler_1.ApiError(404, 'Inquiry not found');
        }
        if (inquiry.userId !== userId) {
            throw new errorHandler_1.ApiError(403, 'Not authorized to update this inquiry');
        }
        const updated = await prisma_1.prisma.housingInquiry.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(viewingDate && { viewingDate: new Date(viewingDate) }),
                ...(notes !== undefined && { notes }),
            },
            include: {
                listing: true,
            },
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
// ADMIN: CREATE LISTINGS (for agents/admins)
// ===========================================
router.post('/listings', auth_1.authenticate, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('description').notEmpty().withMessage('Description is required'),
    (0, express_validator_1.body)('type').isIn(['RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL']),
    (0, express_validator_1.body)('rentWeekly').optional().isNumeric(),
    (0, express_validator_1.body)('bedrooms').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('bathrooms').optional().isInt({ min: 0 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const userId = req.user.id;
        const { title, description, type, address, suburb, city, state, postcode, country, rentWeekly, bondAmount, bedrooms, bathrooms, parking, features, safetyVerified, dvSafe, petFriendly, accessibleUnit, availableFrom, minLeaseTerm, flexibleLease, images, } = req.body;
        const listing = await prisma_1.prisma.housingListing.create({
            data: {
                agentId: userId,
                title,
                description,
                type,
                address,
                suburb,
                city,
                state,
                postcode,
                country: country || 'Australia',
                rentWeekly: rentWeekly ? Number(rentWeekly) : undefined,
                bondAmount: bondAmount ? Number(bondAmount) : undefined,
                bedrooms: bedrooms ? Number(bedrooms) : undefined,
                bathrooms: bathrooms ? Number(bathrooms) : undefined,
                parking: parking ? Number(parking) : undefined,
                features: features || [],
                safetyVerified: safetyVerified || false,
                dvSafe: dvSafe || false,
                petFriendly: petFriendly || false,
                accessibleUnit: accessibleUnit || false,
                availableFrom: availableFrom ? new Date(availableFrom) : undefined,
                minLeaseTerm: minLeaseTerm ? Number(minLeaseTerm) : undefined,
                flexibleLease: flexibleLease || false,
                images,
                status: 'ACTIVE',
            },
        });
        logger_1.logger.info(`Housing listing created: ${listing.id}`);
        res.status(201).json({
            success: true,
            data: listing,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=housing.routes.js.map