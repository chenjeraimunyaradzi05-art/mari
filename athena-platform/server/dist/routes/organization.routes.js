"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// ===========================================
// GET ALL ORGANIZATIONS
// ===========================================
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type;
        const search = req.query.search;
        const where = {};
        if (type)
            where.type = type;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } },
            ];
        }
        const [organizations, total] = await Promise.all([
            prisma_1.prisma.organization.findMany({
                where,
                orderBy: { followerCount: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.organization.count({ where }),
        ]);
        res.json({
            success: true,
            data: organizations,
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
// GET ORGANIZATION BY SLUG
// ===========================================
router.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const organization = await prisma_1.prisma.organization.findUnique({
            where: { slug },
            include: {
                jobs: {
                    where: { status: 'ACTIVE' },
                    take: 5,
                    orderBy: { publishedAt: 'desc' },
                },
                courses: {
                    where: { isActive: true },
                    take: 5,
                },
            },
        });
        if (!organization) {
            throw new errorHandler_1.ApiError(404, 'Organization not found');
        }
        res.json({
            success: true,
            data: organization,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE ORGANIZATION
// ===========================================
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().trim(),
    (0, express_validator_1.body)('type').isIn(['company', 'university', 'tafe', 'government', 'ngo']),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('website').optional().isURL(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { name, type, description, website, city, state, country, industry, size } = req.body;
        // Generate slug
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(0, uuid_1.v4)().slice(0, 6)}`;
        const organization = await prisma_1.prisma.organization.create({
            data: {
                name,
                slug,
                type,
                description,
                website,
                city,
                state,
                country: country || 'Australia',
                industry,
                size,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Organization created',
            data: organization,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE ORGANIZATION
// ===========================================
router.patch('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const allowedFields = ['name', 'description', 'logo', 'banner', 'website', 'city', 'state', 'country', 'industry', 'size'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        const organization = await prisma_1.prisma.organization.update({
            where: { id },
            data: updateData,
        });
        res.json({
            success: true,
            message: 'Organization updated',
            data: organization,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET ORGANIZATION JOBS
// ===========================================
router.get('/:slug/jobs', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const organization = await prisma_1.prisma.organization.findUnique({
            where: { slug },
            select: { id: true },
        });
        if (!organization) {
            throw new errorHandler_1.ApiError(404, 'Organization not found');
        }
        const [jobs, total] = await Promise.all([
            prisma_1.prisma.job.findMany({
                where: {
                    organizationId: organization.id,
                    status: 'ACTIVE',
                },
                include: {
                    skills: { include: { skill: true } },
                },
                orderBy: { publishedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.job.count({
                where: {
                    organizationId: organization.id,
                    status: 'ACTIVE',
                },
            }),
        ]);
        res.json({
            success: true,
            data: jobs,
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
exports.default = router;
//# sourceMappingURL=organization.routes.js.map