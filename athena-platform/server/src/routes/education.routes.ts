import { Router, Response, NextFunction, RequestHandler } from 'express';
import { EducationApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function parseEducationApplicationStatus(value: unknown): EducationApplicationStatus | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if ((Object.values(EducationApplicationStatus) as string[]).includes(value)) {
    return value as EducationApplicationStatus;
  }
  throw new ApiError(400, 'Invalid education application status');
}

const requireOrgAnalyticsAccess: RequestHandler<{ organizationId: string }> = async (
  req,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = req.params.organizationId;

    if (!authReq.user?.id) {
      throw new ApiError(401, 'Unauthorized');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: authReq.user.id,
        },
      },
      select: {
        role: true,
        canViewAnalytics: true,
      },
    });

    if (!membership || !membership.canViewAnalytics) {
      throw new ApiError(403, 'Not authorized');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ===========================================
// LIST EDUCATION PROVIDERS (TAFE/UNIVERSITY)
// ===========================================
router.get('/providers', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const type = (req.query.type as string) || ''; // 'university' | 'tafe'

    const where: Prisma.OrganizationWhereInput = {
      type: type ? type : { in: ['university', 'tafe'] },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [providers, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logo: true,
          website: true,
          city: true,
          state: true,
          country: true,
          type: true,
          isVerified: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({
      success: true,
      data: providers,
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
// GET PROVIDER DETAILS + COURSES
// ===========================================
router.get('/providers/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const provider = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        banner: true,
        website: true,
        city: true,
        state: true,
        country: true,
        type: true,
        isVerified: true,
      },
    });

    if (!provider || !['university', 'tafe'].includes(provider.type || '')) {
      throw new ApiError(404, 'Provider not found');
    }

    const courses = await prisma.course.findMany({
      where: {
        isActive: true,
        organizationId: provider.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        provider,
        courses,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MY EDUCATION APPLICATIONS
// ===========================================
router.get('/applications/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const applications = await prisma.educationApplication.findMany({
      where: { userId: req.user!.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            type: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE EDUCATION APPLICATION
// ===========================================
router.post('/applications', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { organizationId, courseId, programName, intakeDate, notes } = req.body;

    if (!organizationId) {
      throw new ApiError(400, 'organizationId is required');
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, type: true },
    });

    if (!organization || !['university', 'tafe'].includes(organization.type || '')) {
      throw new ApiError(404, 'Provider not found');
    }

    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, organizationId: true, isActive: true },
      });

      if (!course || !course.isActive) {
        throw new ApiError(404, 'Course not found');
      }

      if (course.organizationId && course.organizationId !== organizationId) {
        throw new ApiError(400, 'Course does not belong to provider');
      }
    }

    const created = await prisma.educationApplication.create({
      data: {
        userId: req.user!.id,
        organizationId,
        courseId: courseId || null,
        programName: programName || null,
        intakeDate: intakeDate ? new Date(intakeDate) : null,
        notes: notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE MY APPLICATION (STATUS/NOTES)
// ===========================================
router.patch('/applications/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const parsedStatus = parseEducationApplicationStatus(status);

    const existing = await prisma.educationApplication.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Application not found');
    }

    if (existing.userId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized');
    }

    const updated = await prisma.educationApplication.update({
      where: { id },
      data: {
        status: parsedStatus,
        notes: typeof notes === 'string' ? notes : undefined,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PROVIDER: LIST APPLICATIONS
// ===========================================
router.get(
  '/providers/:organizationId/applications',
  authenticate,
  requireOrgAnalyticsAccess,
  async (req: AuthRequest, res, next) => {
    try {
      const { organizationId } = req.params;
      const status = (req.query.status as string) || '';

      const parsedStatus = parseEducationApplicationStatus(status);
      const where: Prisma.EducationApplicationWhereInput = {
        organizationId,
        ...(parsedStatus ? { status: parsedStatus } : {}),
      };

      const applications = await prisma.educationApplication.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              headline: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              type: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// PROVIDER: OUTCOMES DASHBOARD
// ===========================================
router.get(
  '/providers/:organizationId/outcomes',
  authenticate,
  requireOrgAnalyticsAccess,
  async (req: AuthRequest, res, next) => {
    try {
      const { organizationId } = req.params;

      const [applications, courses] = await Promise.all([
        prisma.educationApplication.findMany({
          where: { organizationId },
          select: { status: true },
        }),
        prisma.course.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, title: true },
        }),
      ]);

      const byStatus = applications.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});

      const courseIds = courses.map((c) => c.id);
      const enrollments = courseIds.length
        ? await prisma.courseEnrollment.findMany({
            where: { courseId: { in: courseIds } },
            select: { courseId: true, progress: true },
          })
        : [];

      const totalEnrollments = enrollments.length;
      const totalCompleted = enrollments.filter((e) => e.progress >= 100).length;
      const avgProgress =
        totalEnrollments > 0
          ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / totalEnrollments)
          : 0;

      res.json({
        success: true,
        data: {
          applications: {
            total: applications.length,
            byStatus,
          },
          enrollments: {
            total: totalEnrollments,
            completed: totalCompleted,
            completionRate: totalEnrollments > 0 ? Math.round((totalCompleted / totalEnrollments) * 100) : 0,
            avgProgress,
          },
          courses: {
            total: courses.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
