/**
 * Organisations: the public directory (companies, universities, TAFEs,
 * government, NGOs), one organisation by slug, its jobs, and editing by its
 * staff.
 *
 * ## Creating and claiming
 *
 * POST / used to create an organisation with no OrganizationMember at all, so
 * any signed-in member could put anything in the directory and nobody,
 * including her, could edit it afterwards. It now does what
 * POST /api/employer/organizations does: the organisation and an OWNER
 * membership for the caller in one transaction. The employer route remains
 * the door the UI uses (client/src/app/employer/organizations/new); this one
 * exists for older callers of organizationApi.create and behaves the same.
 *
 * An organisation put in by the seed or by an admin has no staff, so the
 * real TAFE or employer would otherwise have to create a duplicate to manage
 * it. POST /:id/claim gives the first member who writes from an address at
 * the organisation's website domain (or an admin) the OWNER membership.
 * Verification is untouched: an admin confirms it separately.
 */

import { Router, Response, NextFunction, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { parsePagination } from '../utils/pagination';

const router = Router();

/** The registrable host of a website: no scheme, no path, no leading www. */
function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function emailDomain(email: string | null | undefined): string | null {
  const at = (email || '').lastIndexOf('@');
  return at > 0 ? (email as string).slice(at + 1).toLowerCase() : null;
}

/** jane@tafeqld.edu.au and jane@staff.tafeqld.edu.au both belong to tafeqld.edu.au. */
function emailMatchesWebsite(email: string | null | undefined, website: string | null | undefined): boolean {
  const from = emailDomain(email);
  const site = websiteDomain(website);
  if (!from || !site) return false;
  return from === site || from.endsWith(`.${site}`);
}

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
    body('website').optional().isURL({ protocols: ['http', 'https'] }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { name, type, description, website, city, state, country, industry, size } = req.body;
      const userId = req.user!.id;

      // Generate slug
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uuidv4().slice(0, 6)}`;

      // The organisation and its owner in one transaction, the same shape as
      // POST /api/employer/organizations: an organisation with no member is
      // one nobody can edit.
      const organization = await prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
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
        await tx.organizationMember.create({
          data: {
            organizationId: created.id,
            userId,
            role: 'OWNER',
            canPostJobs: true,
            canManageTeam: true,
            canViewAnalytics: true,
            acceptedAt: new Date(),
          },
        });
        return created;
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
// CLAIM AN ORGANIZATION NOBODY IS STAFF OF
// ===========================================
// Allowed when the organisation has no members and the caller's email is at
// the organisation's website domain, or the caller is an admin. Creates the
// OWNER membership and nothing else: isVerified stays as it was for an admin
// to confirm.
router.post('/:id/claim', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, website: true, _count: { select: { members: true } } },
    });
    if (!organization) {
      throw new ApiError(404, 'Organization not found');
    }
    if (organization._count.members > 0) {
      throw new ApiError(409, 'This organisation already has staff. Ask them to add you.');
    }

    const isAdmin = req.user!.role === 'ADMIN';
    if (!isAdmin) {
      const site = websiteDomain(organization.website);
      if (!site) {
        throw new ApiError(403, 'This organisation has no website on record to check you against. Ask an admin to add you.');
      }
      if (!emailMatchesWebsite(req.user!.email, organization.website)) {
        throw new ApiError(403, `Claim this organisation from an email address at ${site}`);
      }
    }

    const membership = await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: req.user!.id,
        role: 'OWNER',
        canPostJobs: true,
        canManageTeam: true,
        canViewAnalytics: true,
        acceptedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: `${organization.name} is now yours to manage`,
      data: { organization: { id: organization.id, name: organization.name, slug: organization.slug }, membership },
    });
  } catch (error) {
    next(error);
  }
});

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
