import { Router, Response, NextFunction, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { parsePagination } from '../utils/pagination';

const router = Router();

// ===========================================
// GET ALL ORGANIZATIONS
// ===========================================
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const type = req.query.type as string;
    const search = req.query.search as string;

    const where: any = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { followerCount: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
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
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET ORGANIZATION BY SLUG
// ===========================================
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const organization = await prisma.organization.findUnique({
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
      throw new ApiError(404, 'Organization not found');
    }

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE ORGANIZATION
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['company', 'university', 'tafe', 'government', 'ngo']),
    body('description').optional().trim(),
    body('website').optional().isURL(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { name, type, description, website, city, state, country, industry, size } = req.body;

      // Generate slug
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uuidv4().slice(0, 6)}`;

      const organization = await prisma.organization.create({
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
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE ORGANIZATION
// ===========================================
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
    });
    
    if (!organization) {
      throw new ApiError(404, 'Organization not found');
    }
    
    // Check if user is admin or organization owner/admin
    const isSystemAdmin = req.user!.role === 'ADMIN';
    const membership = await prisma.organizationMember.findUnique({
      where: { 
        organizationId_userId: { organizationId: id, userId: req.user!.id } 
      },
    });
    
    const isOrgOwnerOrAdmin = membership && ['OWNER', 'ADMIN'].includes(membership.role);
    
    if (!isSystemAdmin && !isOrgOwnerOrAdmin) {
      throw new ApiError(403, 'Not authorized to update this organization');
    }
    
    const allowedFields = ['name', 'description', 'logo', 'banner', 'website', 'city', 'state', 'country', 'industry', 'size'];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Organization updated',
      data: updatedOrganization,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET ORGANIZATION JOBS
// ===========================================
router.get('/:slug/jobs', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!organization) {
      throw new ApiError(404, 'Organization not found');
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
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
      prisma.job.count({
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
  } catch (error) {
    next(error);
  }
});

export default router;
