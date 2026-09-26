import { Router, Response, NextFunction, RequestHandler } from 'express';
import { EducationApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parsePagination } from '../utils/pagination';
import { body, validationResult } from 'express-validator';
import { bestEffort } from '../utils/best-effort';
import { notificationService } from '../services/notification.service';

const router = Router();

function parseEducationApplicationStatus(value: unknown): EducationApplicationStatus | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if ((Object.values(EducationApplicationStatus) as string[]).includes(value)) {
    return value as EducationApplicationStatus;
  }
  throw new ApiError(400, 'Invalid education application status');
}

/**
 * Deciding an application is not reading a chart. `canViewAnalytics` defaults
 * to true for every member of an organisation, including a VIEWER, so it can
 * gate the outcomes dashboard and must not gate an admissions decision. This
 * mirrors the permission test the employer job routes already use: the
 * recruiting flag, or a role that owns the organisation outright.
 */
const requireOrgApplicationDecisions: RequestHandler<{ organizationId: string }> = async (
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
        canPostJobs: true,
      },
    });

    if (!membership) {
      throw new ApiError(403, 'Not authorized');
    }
    if (!membership.canPostJobs && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ApiError(403, 'You do not have permission to decide applications');
    }

    next();
  } catch (error) {
    next(error);
  }
};

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
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
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

    // Paged, with the total. This used to return the newest fifty and stop, with
    // no count, so a TAFE with sixty courses listed showed fifty and the page
    // had no way to know — or to say — that there were more. Fifty stays the
    // default page so a caller that asks for nothing gets what it always got.
    const query = req.query as { page?: string; limit?: string };
    const { page, limit } = parsePagination({ page: query.page, limit: query.limit ?? '50' });
    const courseWhere: Prisma.CourseWhereInput = { isActive: true, organizationId: provider.id };
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: courseWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.course.count({ where: courseWhere }),
    ]);

    res.json({
      success: true,
      data: {
        provider,
        courses,
        // Inside `data` as well, because the page reads `data` and nothing else.
        coursesTotal: total,
      },
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
//
// This took whatever arrived. programName and notes had no length limit, and
// the intake date went through `new Date(...)`, so "next February" was stored
// as Invalid Date and came back as a 500. Nothing stopped the same course
// being applied for five times over, and nobody was told anything happened:
// the provider found out only by opening her dashboard, and the applicant
// found out she had been accepted or turned down only by coming back to look.
const applicationValidators = [
  body('organizationId').isString().trim().notEmpty().withMessage('organizationId is required'),
  body('courseId').optional({ values: 'null' }).isString().trim(),
  body('programName').optional({ values: 'null' }).isString().isLength({ max: 200 }).withMessage('programName is limited to 200 characters'),
  body('intakeDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('intakeDate must be a date, such as 2027-02-15'),
  body('notes').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('notes are limited to 2000 characters'),
];

/** The applications still waiting on, or already given, a provider's answer. */
const OPEN_APPLICATION_STATUSES: EducationApplicationStatus[] = [
  EducationApplicationStatus.SUBMITTED,
  EducationApplicationStatus.IN_REVIEW,
  EducationApplicationStatus.ACCEPTED,
];

router.post('/applications', authenticate, applicationValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, errors.array()[0].msg);
    }
    const organizationId = String(req.body.organizationId).trim();
    const courseId = typeof req.body.courseId === 'string' && req.body.courseId.trim() ? req.body.courseId.trim() : null;
    const programName =
      typeof req.body.programName === 'string' && req.body.programName.trim() ? req.body.programName.trim() : null;
    const intakeDate = typeof req.body.intakeDate === 'string' && req.body.intakeDate ? new Date(req.body.intakeDate) : null;
    const notes = typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, type: true, name: true },
    });

    if (!organization || !['university', 'tafe'].includes(organization.type || '')) {
      throw new ApiError(404, 'Provider not found');
    }

    let courseTitle: string | null = null;
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, organizationId: true, isActive: true, title: true },
      });

      if (!course || !course.isActive) {
        throw new ApiError(404, 'Course not found');
      }

      if (course.organizationId && course.organizationId !== organizationId) {
        throw new ApiError(400, 'Course does not belong to provider');
      }
      courseTitle = course.title;
    }

    // One open application per course (or per named programme, or per
    // provider when she names neither). Withdrawn and declined ones do not
    // count, so she can apply again after either.
    const duplicate = await prisma.educationApplication.findFirst({
      where: {
        userId: req.user!.id,
        organizationId,
        courseId,
        ...(courseId ? {} : { programName }),
        status: { in: OPEN_APPLICATION_STATUSES },
      },
      select: { id: true, status: true },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        duplicate.status === EducationApplicationStatus.ACCEPTED
          ? 'This provider has already accepted your application for this.'
          : 'You already have an application in for this. You can follow it, or withdraw it, from My Applications.'
      );
    }

    const created = await prisma.educationApplication.create({
      data: {
        userId: req.user!.id,
        organizationId,
        courseId,
        programName,
        intakeDate,
        notes,
      },
    });

    // Tell the people who can decide it. These are the same people the
    // decision route lets through: the recruiting flag, or an owner or admin
    // of the organisation. It never fails her application — it is already in,
    // and the provider's list shows it whether or not anyone was pinged.
    const what = courseTitle ?? programName ?? 'a place';
    await bestEffort(`education application ${created.id} notice to provider ${organizationId}`, async () => {
      const deciders = await prisma.organizationMember.findMany({
        where: { organizationId, OR: [{ canPostJobs: true }, { role: { in: ['OWNER', 'ADMIN'] } }] },
        select: { userId: true },
        take: 50,
      });
      for (const member of deciders) {
        await notificationService.notify({
          userId: member.userId,
          type: 'APPLICATION_UPDATE',
          title: 'A new application',
          message: `Someone has applied to ${organization.name} for ${what}.`,
          link: `/employer/organizations/${organizationId}/education/applications`,
          data: { kind: 'EDUCATION_APPLICATION_RECEIVED', applicationId: created.id },
        });
      }
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
// WITHDRAW MY APPLICATION, OR EDIT MY OWN NOTES
// ===========================================
//
// The applicant used to be able to PATCH any status onto her own row, so she
// could mark herself ACCEPTED and the provider's dashboard would show it as
// the institution's own decision. Withdrawing is the only status an applicant
// owns; every other transition belongs to the provider route below. The notes
// are hers throughout — they are the field the member page lets her keep her
// own record in.
router.patch('/applications/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const parsedStatus = parseEducationApplicationStatus(status);

    if (parsedStatus !== undefined && parsedStatus !== EducationApplicationStatus.WITHDRAWN) {
      throw new ApiError(
        403,
        'Only the provider can decide an application. You can withdraw it or update your own notes.'
      );
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      throw new ApiError(400, 'notes are limited to 2000 characters');
    }

    const existing = await prisma.educationApplication.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Application not found');
    }

    if (existing.userId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized');
    }

    // Mirrors the apprenticeship rule: once a place has been offered, walking
    // away is a conversation with the provider, not a status change here.
    if (parsedStatus === EducationApplicationStatus.WITHDRAWN && existing.status === 'ACCEPTED') {
      throw new ApiError(400, 'An accepted application cannot be withdrawn here — contact the provider');
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
// PROVIDER: DECIDE AN APPLICATION
// ===========================================
//
// The read side has always assumed this existed: the provider dashboard lists
// applications and the outcomes panel counts them by status, but nothing on
// the server could move one, so every status shown there was written by the
// applicant herself. This is the write the dashboard was built against.
router.patch(
  '/providers/:organizationId/applications/:applicationId',
  authenticate,
  requireOrgApplicationDecisions,
  async (req: AuthRequest, res, next) => {
    try {
      const { organizationId, applicationId } = req.params;
      const parsedStatus = parseEducationApplicationStatus(req.body?.status);

      const decidable: EducationApplicationStatus[] = [
        EducationApplicationStatus.IN_REVIEW,
        EducationApplicationStatus.ACCEPTED,
        EducationApplicationStatus.REJECTED,
      ];

      if (!parsedStatus || !decidable.includes(parsedStatus)) {
        throw new ApiError(400, 'status must be IN_REVIEW, ACCEPTED or REJECTED');
      }

      const existing = await prisma.educationApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, organizationId: true, status: true },
      });

      if (!existing) {
        throw new ApiError(404, 'Application not found');
      }

      // The permission was checked against the organisation in the path, so the
      // application has to belong to that same organisation — otherwise staff at
      // one provider could decide another provider's applications.
      if (existing.organizationId !== organizationId) {
        throw new ApiError(404, 'Application not found');
      }

      // A withdrawn application is the applicant's decision and stays hers.
      if (existing.status === EducationApplicationStatus.WITHDRAWN) {
        throw new ApiError(400, 'This application has been withdrawn');
      }

      const updated = await prisma.educationApplication.update({
        where: { id: applicationId },
        data: { status: parsedStatus },
      });

      // She hears the decision from us, not by happening to reopen the page.
      // Only a real change is news; re-saving the same status tells her nothing.
      // All of it is best-effort: the decision is already saved, and a notice
      // that cannot be written must not turn that into a 500.
      if (existing.status !== parsedStatus) {
        await bestEffort(`education application ${applicationId} decision notice`, async () => {
          const names = await prisma.educationApplication.findUnique({
            where: { id: applicationId },
            select: { programName: true, organization: { select: { name: true } }, course: { select: { title: true } } },
          });
          const provider = names?.organization?.name ?? 'The provider';
          const what = names?.course?.title ?? names?.programName ?? 'your application';
          const notice: Record<string, { title: string; message: string }> = {
            IN_REVIEW: {
              title: 'Your application is being reviewed',
              message: `${provider} has started reviewing your application for ${what}.`,
            },
            ACCEPTED: {
              title: 'Your application was accepted',
              message: `${provider} has accepted your application for ${what}. They will be in touch about next steps.`,
            },
            REJECTED: {
              title: 'An update on your application',
              message: `${provider} has decided not to offer you a place for ${what} this time.`,
            },
          };
          const chosen = notice[parsedStatus];
          if (!chosen) return;
          await notificationService.notify({
            userId: updated.userId,
            type: 'APPLICATION_UPDATE',
            title: chosen.title,
            message: chosen.message,
            link: '/dashboard/learn/applications',
            // In-app only. The email fallback in notification.service puts the
            // provider's own course title into HTML unescaped, and an applicant's
            // inbox is not always hers alone to read.
            channels: ['in-app'],
            data: { kind: 'EDUCATION_APPLICATION_DECIDED', applicationId, status: parsedStatus },
          });
        });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

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

      // Counted and averaged in the database. This used to read every
      // application row and every enrolment row for the organisation's live
      // courses into memory and add them up in JavaScript, which is fine for a
      // pilot and a slow, memory-hungry page for a TAFE with forty thousand
      // enrolments. The figures are the same; only where they are worked out
      // has moved.
      const enrollmentWhere: Prisma.CourseEnrollmentWhereInput = { course: { organizationId, isActive: true } };
      const [statusGroups, totalCourses, enrollmentStats, totalCompleted] = await Promise.all([
        prisma.educationApplication.groupBy({
          by: ['status'],
          where: { organizationId },
          _count: { _all: true },
        }),
        prisma.course.count({ where: { organizationId, isActive: true } }),
        prisma.courseEnrollment.aggregate({
          where: enrollmentWhere,
          _count: { _all: true },
          _avg: { progress: true },
        }),
        prisma.courseEnrollment.count({ where: { ...enrollmentWhere, progress: { gte: 100 } } }),
      ]);

      const byStatus: Record<string, number> = {};
      let totalApplications = 0;
      for (const group of statusGroups) {
        byStatus[group.status] = group._count._all;
        totalApplications += group._count._all;
      }

      const totalEnrollments = enrollmentStats._count._all;
      const avgProgress = totalEnrollments > 0 ? Math.round(enrollmentStats._avg.progress ?? 0) : 0;

      res.json({
        success: true,
        data: {
          applications: {
            total: totalApplications,
            byStatus,
          },
          enrollments: {
            total: totalEnrollments,
            completed: totalCompleted,
            completionRate: totalEnrollments > 0 ? Math.round((totalCompleted / totalEnrollments) * 100) : 0,
            avgProgress,
          },
          courses: {
            total: totalCourses,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
