import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { ApplicationStatus, type OrganizationMember } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================================================
// MIDDLEWARE: Check organization membership
// ============================================================================

/**
 * The request carries the caller's membership row from requireOrgAccess down to
 * whichever handler runs next. Declaring the extra property in one place keeps
 * every handler reading it through `callerMembership` below, instead of each
 * one casting the request to `any` and losing the permission flags' types.
 */
type OrgScopedRequest = AuthRequest & { membership?: OrganizationMember };

async function requireOrgAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const orgId = req.params.orgId || req.body.organizationId;
  const userId = req.user!.id;

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
  });

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this organization' });
  }

  (req as OrgScopedRequest).membership = membership;
  next();
}

/**
 * Only reachable behind requireOrgAccess, which refuses the request outright
 * when the caller has no membership row, so by the time a handler asks there is
 * always one to hand back.
 */
function callerMembership(req: AuthRequest): OrganizationMember {
  const membership = (req as OrgScopedRequest).membership;
  if (!membership) {
    throw new ApiError(403, 'Not a member of this organization');
  }
  return membership;
}

// ============================================================================
// GET MY ORGANIZATIONS
// ============================================================================

/**
 * GET /employer/organizations
 * Get all organizations the user is a member of
 */
router.get('/organizations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                jobs: true,
                members: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: memberships.map(m => ({
        ...m.organization,
        role: m.role,
        canPostJobs: m.canPostJobs,
        canManageTeam: m.canManageTeam,
        jobCount: m.organization._count.jobs,
        memberCount: m.organization._count.members,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CREATE ORGANIZATION (Employer signup)
// ============================================================================

/**
 * POST /employer/organizations
 * Create a new organization and become the owner
 */
router.post(
  '/organizations',
  authenticate,
  [
    body('name').notEmpty().trim().withMessage('Company name is required'),
    body('type').isIn(['company', 'university', 'tafe', 'government', 'ngo']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const { name, type, description, website, city, state, country, industry, size, logo, brandColor } = req.body;

      // Generate slug
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create organization with owner membership in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
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
            logo,
            brandColor,
          },
        });

        // Create owner membership
        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId,
            role: 'OWNER',
            canPostJobs: true,
            canManageTeam: true,
            canViewAnalytics: true,
            acceptedAt: new Date(),
          },
        });

        return organization;
      });

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// ORGANIZATION DASHBOARD
// ============================================================================

/**
 * GET /employer/organizations/:orgId/dashboard
 * Get organization dashboard with stats
 */
router.get(
  '/organizations/:orgId/dashboard',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        organization,
        activeJobs,
        totalApplications,
        recentApplications,
        applicationsByStatus,
        jobViews,
      ] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          include: { _count: { select: { jobs: true, members: true } } },
        }),
        prisma.job.count({
          where: { organizationId: orgId, status: 'ACTIVE' },
        }),
        prisma.jobApplication.count({
          where: { job: { organizationId: orgId } },
        }),
        prisma.jobApplication.count({
          where: {
            job: { organizationId: orgId },
            appliedAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.jobApplication.groupBy({
          by: ['status'],
          where: { job: { organizationId: orgId } },
          _count: true,
        }),
        prisma.job.aggregate({
          where: { organizationId: orgId },
          _sum: { viewCount: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          organization,
          stats: {
            activeJobs,
            totalJobs: organization?._count.jobs || 0,
            teamMembers: organization?._count.members || 0,
            totalApplications,
            recentApplications,
            totalViews: jobViews._sum.viewCount || 0,
            applicationsByStatus: applicationsByStatus.reduce((acc: Record<string, number>, item: any) => {
              acc[item.status] = item._count;
              return acc;
            }, {} as Record<string, number>),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Make the job's skill list match exactly what the employer submitted. Skills
 * are shared rows, so unfamiliar names are created once and then attached; the
 * lookups are batched because a listing can name a dozen of them and a query
 * each would be a dozen round trips.
 *
 * An edit is a replacement, not an addition — a skill she removed from the form
 * has to leave the listing, or a typo could never be taken back off a live ad.
 */
async function syncJobSkills(jobId: string, skills: string[]) {
  const names = [...new Set(skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))];

  if (names.length === 0) {
    await prisma.jobSkill.deleteMany({ where: { jobId } });
    return;
  }

  const existing = await prisma.skill.findMany({
    where: { name: { in: names, mode: 'insensitive' } },
  });
  const existingNames = new Set(existing.map((skill) => skill.name.toLowerCase()));
  const missing = names.filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    await prisma.skill.createMany({
      data: missing.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  const allSkills = await prisma.skill.findMany({
    where: { name: { in: names, mode: 'insensitive' } },
  });

  await prisma.$transaction([
    prisma.jobSkill.deleteMany({
      where: { jobId, skillId: { notIn: allSkills.map((skill) => skill.id) } },
    }),
    prisma.jobSkill.createMany({
      data: allSkills.map((skill) => ({ jobId, skillId: skill.id })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * GET /employer/organizations/:orgId/jobs
 * Get all jobs for an organization
 */
router.get(
  '/organizations/:orgId/jobs',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      const status = req.query.status as string;

      const where: any = { organizationId: orgId };
      if (status) where.status = status;

      const jobs = await prisma.job.findMany({
        where,
        include: {
          _count: { select: { applications: true } },
          skills: { include: { skill: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: jobs.map(job => ({
          ...job,
          applicationCount: job._count.applications,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /employer/organizations/:orgId/jobs
 * Create a new job posting
 */
router.post(
  '/organizations/:orgId/jobs',
  authenticate,
  requireOrgAccess,
  [
    body('title').notEmpty().trim().withMessage('Job title is required'),
    body('description').notEmpty().withMessage('Job description is required'),
    // APPRENTICESHIP is a JobType like any other, and leaving it off this list
    // meant an employer could not post one at all — on a platform whose own
    // apprenticeship pages invite her to.
    body('type').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'CASUAL', 'APPRENTICESHIP']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const membership = callerMembership(req);
      if (!membership.canPostJobs && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ApiError(403, 'You do not have permission to post jobs');
      }

      const { orgId } = req.params;
      const userId = req.user!.id;
      const {
        title, description, type, city, state, country, isRemote,
        salaryMin, salaryMax, salaryType, showSalary,
        experienceMin, experienceMax, skills, status,
      } = req.body;

      // Generate slug
      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.job.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const job = await prisma.job.create({
        data: {
          title,
          slug,
          description,
          type,
          status: status || 'DRAFT',
          organizationId: orgId,
          postedById: userId,
          city,
          state,
          country: country || 'Australia',
          isRemote: isRemote || false,
          salaryMin,
          salaryMax,
          salaryType,
          showSalary: showSalary ?? true,
          experienceMin,
          experienceMax,
          publishedAt: status === 'ACTIVE' ? new Date() : null,
        },
      });

      if (Array.isArray(skills)) {
        await syncJobSkills(job.id, skills);
      }

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * A job belongs to whoever runs the organisation that posted it, or — for a
 * listing posted outside any organisation — to the person who posted it.
 * Reading a draft and editing one answer to the same rule, so both ask here.
 */
async function requireJobAccess(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      _count: { select: { applications: true } },
      skills: { include: { skill: true } },
    },
  });

  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  if (job.organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: job.organizationId, userId },
      },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  } else if (job.postedById !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  return job;
}

/**
 * GET /employer/jobs/:jobId
 * Read one of the organisation's own postings, draft or live.
 *
 * The public GET /api/jobs/:id would serve this too, but it counts a view every
 * time it is asked, so an employer opening her own edit form would inflate the
 * figure her analytics page then reports back to her.
 */
router.get(
  '/jobs/:jobId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const job = await requireJobAccess(req.params.jobId, req.user!.id);

      res.json({
        success: true,
        data: { ...job, applicationCount: job._count.applications },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /employer/jobs/:jobId
 * Update a job posting
 */
router.patch(
  '/jobs/:jobId',
  authenticate,
  [
    body('title').optional().notEmpty().trim().withMessage('Job title cannot be empty'),
    body('description').optional().notEmpty().withMessage('Job description cannot be empty'),
    body('type').optional().isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'CASUAL', 'APPRENTICESHIP']),
    body('status').optional().isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'FILLED']),
    body('isRemote').optional().isBoolean(),
    body('showSalary').optional().isBoolean(),
    body('salaryMin').optional({ nullable: true }).isInt({ min: 0 }),
    body('salaryMax').optional({ nullable: true }).isInt({ min: 0 }),
    body('experienceMin').optional({ nullable: true }).isInt({ min: 0 }),
    body('experienceMax').optional({ nullable: true }).isInt({ min: 0 }),
    body('skills').optional().isArray(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // The handler used to hand whatever arrived straight to Prisma, so a
      // status or type outside the enum came back as a 500 rather than as the
      // 400 it is.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { jobId } = req.params;
      const userId = req.user!.id;

      const job = await requireJobAccess(jobId, userId);

      // Job has no benefits, applicationUrl or applicationEmail column. They
      // were on this list, so an employer who filled any of them in had her
      // whole edit rejected by Prisma as an unknown field — a 500 on a form
      // that looked complete.
      const allowedFields = [
        'title', 'description', 'type', 'status', 'city', 'state', 'country',
        'isRemote', 'salaryMin', 'salaryMax', 'salaryType', 'showSalary',
        'experienceMin', 'experienceMax',
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      // Set publishedAt if status changes to ACTIVE
      if (updateData.status === 'ACTIVE' && job.status !== 'ACTIVE') {
        updateData.publishedAt = new Date();
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });

      if (Array.isArray(req.body.skills)) {
        await syncJobSkills(jobId, req.body.skills);
      }

      res.json({
        success: true,
        message: 'Job updated successfully',
        data: updatedJob,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// APPLICATION MANAGEMENT
// ============================================================================

/**
 * GET /employer/organizations/:orgId/applications
 * Get all applications for organization's jobs
 */
router.get(
  '/organizations/:orgId/applications',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      const { jobId, status, page = '1', limit = '20' } = req.query;

      const where: any = { job: { organizationId: orgId } };
      if (jobId) where.jobId = jobId;
      if (status) where.status = status;

      // The pipeline shows a face and a headline, not a bare name.
      const [applications, total] = await Promise.all([
        prisma.jobApplication.findMany({
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
            job: {
              select: { id: true, title: true, slug: true },
            },
          },
          orderBy: { appliedAt: 'desc' },
          skip: (parseInt(page as string) - 1) * parseInt(limit as string),
          take: parseInt(limit as string),
        }),
        prisma.jobApplication.count({ where }),
      ]);

      res.json({
        success: true,
        data: applications,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /employer/applications/:applicationId/status
 * Update application status
 */
router.patch(
  '/applications/:applicationId/status',
  authenticate,
  [
    body('status').isIn(['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // The validator was declared but never read, so any status reached Prisma.
      // Accepting an offer is the candidate's move, not the employer's.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'That is not a stage an employer can set');
      }
      const { applicationId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      // Get application with job and org
      const application = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: { job: true },
      });

      if (!application) {
        throw new ApiError(404, 'Application not found');
      }

      // Check access
      if (application.job.organizationId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: { organizationId: application.job.organizationId, userId },
          },
        });
        if (!membership) {
          throw new ApiError(403, 'Access denied');
        }
      }

      const updatedApplication = await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status },
      });

      // Send notification to applicant
      await prisma.notification.create({
        data: {
          userId: application.userId,
          type: 'JOB_MATCH',
          title: `Application ${status === 'SHORTLISTED' ? 'Shortlisted! 🎉' : status === 'REJECTED' ? 'Update' : 'Status Updated'}`,
          message: `Your application for ${application.job.title} has been updated to: ${status}`,
          link: `/dashboard/applications`,
        },
      });

      res.json({
        success: true,
        message: 'Application status updated',
        data: updatedApplication,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * GET /employer/organizations/:orgId/team
 * Get organization team members
 */
router.get(
  '/organizations/:orgId/team',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params;
      const membership = callerMembership(req);

      const members = await prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { invitedAt: 'asc' },
      });

      // The console needs three things this response used to leave out, and
      // every one of them showed up as a blank team page rather than an error:
      // the rows under a named key, each member's permissions grouped instead
      // of flat beside the role, and the caller's own permissions, which are
      // what decide whether the Invite button and the per-row Remove menu are
      // drawn at all. The three caller flags below mirror exactly what the
      // handlers underneath enforce, so the console never offers a control the
      // server is going to refuse: posting jobs is open to an owner or an admin
      // whatever the flag says, managing the team is open to an owner, and
      // analytics is the flag and nothing else.
      res.json({
        success: true,
        data: {
          members: members.map((member) => ({
            id: member.id,
            role: member.role,
            createdAt: member.invitedAt,
            acceptedAt: member.acceptedAt,
            user: member.user,
            permissions: {
              canPostJobs: member.canPostJobs,
              canManageTeam: member.canManageTeam,
              canViewAnalytics: member.canViewAnalytics,
            },
          })),
          currentUserPermissions: {
            canPostJobs:
              membership.canPostJobs || membership.role === 'OWNER' || membership.role === 'ADMIN',
            canManageTeam: membership.canManageTeam || membership.role === 'OWNER',
            canViewAnalytics: membership.canViewAnalytics,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /employer/organizations/:orgId/team/invite
 * Invite a team member
 */
router.post(
  '/organizations/:orgId/team/invite',
  authenticate,
  requireOrgAccess,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('role').isIn(['ADMIN', 'RECRUITER', 'VIEWER']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const membership = callerMembership(req);
      if (!membership.canManageTeam && membership.role !== 'OWNER') {
        throw new ApiError(403, 'You do not have permission to manage team');
      }

      const { orgId } = req.params;
      const { email, role, canPostJobs, canManageTeam, canViewAnalytics } = req.body;

      // Find user by email
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ApiError(404, 'User not found. They must have an ATHENA account first.');
      }

      // Check if already a member
      const existing = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });
      if (existing) {
        throw new ApiError(400, 'User is already a member');
      }

      const member = await prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role,
          canPostJobs: canPostJobs ?? (role === 'ADMIN' || role === 'RECRUITER'),
          canManageTeam: canManageTeam ?? (role === 'ADMIN'),
          canViewAnalytics: canViewAnalytics ?? true,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Notify the invited user
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'You\'ve been invited to a team!',
          message: `You've been added to an organization. View your employer dashboard.`,
          link: '/employer',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Team member invited',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /employer/organizations/:orgId/team/:memberId
 * Remove a team member
 */
router.delete(
  '/organizations/:orgId/team/:memberId',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const membership = callerMembership(req);
      if (!membership.canManageTeam && membership.role !== 'OWNER') {
        throw new ApiError(403, 'You do not have permission to manage team');
      }

      const { orgId, memberId } = req.params;

      // Cannot remove owner
      const targetMember = await prisma.organizationMember.findUnique({
        where: { id: memberId },
      });

      // The middleware proves the caller manages :orgId; this proves the row
      // belongs to it. Without the second half, a manager of one organisation
      // could delete memberships of any other by putting her own org in the
      // URL and someone else's member id beside it. A foreign row answers the
      // same 404 a missing one does, so ids cannot be probed.
      if (!targetMember || targetMember.organizationId !== orgId) {
        throw new ApiError(404, 'Member not found');
      }

      if (targetMember.role === 'OWNER') {
        throw new ApiError(400, 'Cannot remove organization owner');
      }

      await prisma.organizationMember.delete({
        where: { id: memberId },
      });

      res.json({
        success: true,
        message: 'Team member removed',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /employer/organizations/:orgId/analytics
 * Get detailed analytics for an organization
 */
/**
 * The stages an application moves through, in the order the console draws
 * them. The two terminal outcomes sit at the end so the bars still add up to
 * every application the organisation has received.
 */
const FUNNEL_STAGES: { status: ApplicationStatus; label: string }[] = [
  { status: ApplicationStatus.PENDING, label: 'Applied' },
  { status: ApplicationStatus.REVIEWED, label: 'Reviewed' },
  { status: ApplicationStatus.SHORTLISTED, label: 'Shortlisted' },
  { status: ApplicationStatus.INTERVIEW, label: 'Interview' },
  { status: ApplicationStatus.OFFERED, label: 'Offer made' },
  { status: ApplicationStatus.ACCEPTED, label: 'Offer accepted' },
  { status: ApplicationStatus.REJECTED, label: 'Not progressed' },
  { status: ApplicationStatus.WITHDRAWN, label: 'Withdrawn' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A percentage change needs something to divide by. When the previous window
 * held nothing, the honest answer is that there is no comparison to make, not
 * that hiring grew by a hundred per cent, so the console is told null and
 * leaves the arrow off.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

router.get(
  '/organizations/:orgId/analytics',
  authenticate,
  requireOrgAccess,
  [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Choose a window between 1 and 365 days'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Without this, days=whenever parsed to NaN, the window start became an
      // invalid date, and the whole page failed on a query string nobody would
      // notice was malformed.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const membership = callerMembership(req);
      if (!membership.canViewAnalytics) {
        throw new ApiError(403, 'You do not have permission to view analytics');
      }

      const { orgId } = req.params;
      const daysNum = parseInt((req.query.days as string) || '30', 10);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysNum * MS_PER_DAY);
      const previousStart = new Date(startDate.getTime() - daysNum * MS_PER_DAY);
      const orgJobs = { job: { organizationId: orgId } };

      // An acceptance leaves no timestamp of its own — JobApplication records
      // when it was submitted and when it was last touched, nothing in
      // between — so the last write on an accepted row is the closest thing
      // there is to the moment the offer was taken. It is the right answer in
      // almost every case and an overestimate in the rest; a `hiredAt` column
      // set on the status change is what would make it exact.
      const [
        applicationsInWindow,
        applicationsPrevious,
        hiresInWindow,
        hiresPrevious,
        viewTotals,
        topJobs,
        funnel,
        acceptedApplications,
      ] = await Promise.all([
        prisma.jobApplication.count({
          where: { ...orgJobs, appliedAt: { gte: startDate } },
        }),
        prisma.jobApplication.count({
          where: { ...orgJobs, appliedAt: { gte: previousStart, lt: startDate } },
        }),
        prisma.jobApplication.count({
          where: { ...orgJobs, status: ApplicationStatus.ACCEPTED, updatedAt: { gte: startDate } },
        }),
        prisma.jobApplication.count({
          where: {
            ...orgJobs,
            status: ApplicationStatus.ACCEPTED,
            updatedAt: { gte: previousStart, lt: startDate },
          },
        }),
        prisma.job.aggregate({
          where: { organizationId: orgId },
          _sum: { viewCount: true },
        }),
        prisma.job.findMany({
          where: { organizationId: orgId },
          select: {
            id: true,
            title: true,
            viewCount: true,
            applicationCount: true,
          },
          orderBy: { viewCount: 'desc' },
          take: 5,
        }),
        prisma.jobApplication.groupBy({
          by: ['status'],
          where: orgJobs,
          _count: true,
        }),
        prisma.jobApplication.findMany({
          where: { ...orgJobs, status: ApplicationStatus.ACCEPTED },
          select: { appliedAt: true, updatedAt: true },
        }),
      ]);

      const funnelCounts = new Map<ApplicationStatus, number>(
        funnel.map((row) => [row.status, row._count]),
      );
      const totalApplications = funnel.reduce((sum, row) => sum + row._count, 0);
      const applicationFunnel =
        totalApplications === 0
          ? []
          : FUNNEL_STAGES.map(({ status, label }) => {
              const count = funnelCounts.get(status) ?? 0;
              return {
                stage: label,
                count,
                percentage: roundToTenth((count / totalApplications) * 100),
              };
            });

      const daysToAcceptance = acceptedApplications.map((application) =>
        Math.max(0, (application.updatedAt.getTime() - application.appliedAt.getTime()) / MS_PER_DAY),
      );

      res.json({
        success: true,
        data: {
          period: { days: daysNum, startDate, endDate },
          trends: {
            // Job.viewCount is a running total with no date on it, so there is
            // no previous window to set beside it. Reporting a previous of zero
            // would read as a collapse in interest that never happened; null
            // tells the console to present it as an all-time figure instead.
            views: { current: viewTotals._sum.viewCount ?? 0, previous: null, change: null },
            applications: {
              current: applicationsInWindow,
              previous: applicationsPrevious,
              change: percentChange(applicationsInWindow, applicationsPrevious),
            },
            hires: {
              current: hiresInWindow,
              previous: hiresPrevious,
              change: percentChange(hiresInWindow, hiresPrevious),
            },
          },
          applicationFunnel,
          topJobs: topJobs.map((job) => ({
            id: job.id,
            title: job.title,
            views: job.viewCount,
            applications: job.applicationCount,
            // A number, not a formatted string: the console decides how many
            // decimal places to show, and used to crash calling toFixed on the
            // '12.5%' this once sent.
            conversionRate:
              job.viewCount > 0 ? roundToTenth((job.applicationCount / job.viewCount) * 100) : 0,
          })),
          timeToHire:
            daysToAcceptance.length === 0
              ? null
              : {
                  average: roundToTenth(
                    daysToAcceptance.reduce((sum, days) => sum + days, 0) / daysToAcceptance.length,
                  ),
                  fastest: roundToTenth(Math.min(...daysToAcceptance)),
                  slowest: roundToTenth(Math.max(...daysToAcceptance)),
                  sampleSize: daysToAcceptance.length,
                },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
