import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { ApplicationStatus, type OrganizationMember } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  EMPLOYER_SETTABLE_STATUSES,
  assertEmployerStatusMove,
} from '../services/application-status.service';

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

  // An invitation that has not been accepted is not a membership. See the
  // invite route below: the row is created the moment someone types an email
  // address, and until this check existed that row was indistinguishable from
  // a membership the person had agreed to.
  if (!membership.acceptedAt) {
    return res.status(403).json({
      error: 'You have a pending invitation to this organisation. Accept it before using its console.',
    });
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

/**
 * Whether this member may see who applied.
 *
 * An applicant's row carries her full name, her email address, her avatar, her
 * headline, her cover letter and her résumé link. The woman who applied was
 * told her details go to "the employer"; she was not told they go to everyone
 * the employer has ever added to a company page. VIEWER is the schema default
 * for OrganizationMember, so until this existed the applicant list and the
 * pipeline PATCH were open to every member of the organisation while the
 * analytics route beside them — which shows nothing but counts — correctly
 * asked for canViewAnalytics.
 *
 * Hiring roles see applicants. A VIEWER does not, unless she has explicitly
 * been given posting rights, which is the closest thing the current schema has
 * to "this person works on hiring": the invite route only ever grants
 * canPostJobs to an ADMIN or a RECRUITER by default.
 */
function canViewApplicants(membership: OrganizationMember): boolean {
  return (
    membership.role === 'OWNER' ||
    membership.role === 'ADMIN' ||
    membership.role === 'RECRUITER' ||
    membership.canPostJobs
  );
}

function assertCanViewApplicants(membership: OrganizationMember): void {
  if (!canViewApplicants(membership)) {
    throw new ApiError(403, 'You do not have permission to view applicants for this organisation');
  }
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

    // Pending invitations are deliberately excluded. requireOrgAccess refuses
    // them, so listing them here would put an organisation in the console's
    // switcher that answers 403 to everything the console then asks it. They
    // are served by GET /employer/invitations instead, where she can answer.
    const memberships = await prisma.organizationMember.findMany({
      where: { userId, acceptedAt: { not: null } },
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
    if (!membership || !membership.acceptedAt) {
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
    // FILLED was on this list and EXPIRED was missing, but JobStatus has
    // neither the first nor a gap for the second: an employer who chose
    // "Filled" in the console had her edit accepted by the validator and then
    // rejected by Prisma as an unknown enum value — a 500 on a dropdown the
    // console itself drew.
    body('status').optional().isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED']),
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
      assertCanViewApplicants(callerMembership(req));

      const { orgId } = req.params;
      const { jobId, status } = req.query;

      // `limit` used to go straight into `take` with no ceiling, so
      // `?limit=100000` returned every applicant the organisation has ever
      // had — names, email addresses, cover letters and résumé links — in one
      // response. 100 is the same ceiling the job-scoped applicant list uses.
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

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
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.jobApplication.count({ where }),
      ]);

      res.json({
        success: true,
        data: applications,
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
    // WITHDRAWN used to be on this list. Accepting an offer had already been
    // taken off it because accepting is the candidate's move; withdrawing is
    // the same move in the other direction and was simply missed, so an
    // employer could record that a woman had pulled out of a process she was
    // still in. The stages an employer may set, and the order she may move
    // through them, now live in one place shared with the job-scoped twin of
    // this route.
    body('status').isIn(EMPLOYER_SETTABLE_STATUSES),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // The validator was declared but never read, so any status reached Prisma.
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

      // Check access.
      //
      // This used to be an `if` with no `else`: the membership check ran only
      // when the job belonged to an organisation, and Job.organizationId is
      // nullable — every listing created through POST /api/jobs has none. So
      // for an application against an org-less job, any authenticated account
      // on the platform could reject a candidate, shortlist her, or tell her
      // she had an offer, in the employer's name. The job-update handler above
      // has always had the else branch; this one did not.
      if (application.job.organizationId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: { organizationId: application.job.organizationId, userId },
          },
        });
        if (!membership) {
          throw new ApiError(403, 'Access denied');
        }
        assertCanViewApplicants(membership);
      } else if (application.job.postedById !== userId) {
        throw new ApiError(403, 'Access denied');
      }

      // Dropping a card back into the column it came from is a routine
      // kanban miss. It is not a stage change, and the candidate should not be
      // emailed a second time about a stage she is already at.
      const { changed } = assertEmployerStatusMove(application.status, status);
      if (!changed) {
        return res.json({
          success: true,
          message: 'Application already at that stage',
          data: application,
        });
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
            // An invited person is on the roster but has not agreed to be
            // there yet, and the console has to say so rather than presenting
            // her as staff.
            pending: member.acceptedAt === null,
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
            canViewApplicants: canViewApplicants(membership),
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
        throw new ApiError(400, existing.acceptedAt ? 'User is already a member' : 'That person already has a pending invitation');
      }

      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });

      // The row is created with acceptedAt left null, which is what makes it
      // an invitation rather than a membership.
      //
      // This route used to create the membership outright, with full
      // permissions, and then tell the person afterwards that she had "been
      // added to an organization". Anyone with canManageTeam on any company
      // could therefore attach a stranger's ATHENA account to that company
      // without asking her, and the account appeared on the public roster and
      // — before the applicant-visibility check above existed — could read
      // every applicant's email address, cover letter and résumé link. On a
      // platform where a woman's employer may be exactly who she is hiding
      // from, being silently listed as staff somewhere is not a small thing.
      //
      // requireOrgAccess refuses a row with no acceptedAt, so the invitation
      // grants nothing until she answers it.
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
          title: 'You have been invited to a team',
          message: `${organization?.name ?? 'An organisation'} has invited you to join their hiring team. You choose whether to accept.`,
          link: '/employer/invitations',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Invitation sent',
        data: { ...member, pending: true },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /employer/invitations
 * The invitations waiting for the caller to answer.
 *
 * Nothing used to read `acceptedAt` anywhere in the codebase, because nothing
 * ever asked the invitee. These three routes are the other half of the invite
 * above: she can see who has asked for her, and she can say yes or no.
 */
router.get('/invitations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.organizationMember.findMany({
      where: { userId: req.user!.id, acceptedAt: null },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logo: true, city: true, state: true },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    res.json({
      success: true,
      data: invitations.map((invitation) => ({
        id: invitation.id,
        invitedAt: invitation.invitedAt,
        role: invitation.role,
        permissions: {
          canPostJobs: invitation.canPostJobs,
          canManageTeam: invitation.canManageTeam,
          canViewAnalytics: invitation.canViewAnalytics,
        },
        organization: invitation.organization,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employer/invitations/:memberId/accept
 * Take up an invitation. Only the invited account can do this.
 */
router.post('/invitations/:memberId/accept', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitation = await prisma.organizationMember.findUnique({
      where: { id: req.params.memberId },
      include: { organization: { select: { name: true } } },
    });

    // An invitation belonging to someone else answers the same 404 a missing
    // one does, so membership ids cannot be probed.
    if (!invitation || invitation.userId !== req.user!.id) {
      throw new ApiError(404, 'Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new ApiError(400, 'You have already accepted this invitation');
    }

    const member = await prisma.organizationMember.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    res.json({
      success: true,
      message: `You have joined ${invitation.organization.name}`,
      data: member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /employer/invitations/:memberId/decline
 * Say no. The row is removed rather than flagged, so the company can ask again
 * later and so declining leaves nothing on her record.
 */
router.post('/invitations/:memberId/decline', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitation = await prisma.organizationMember.findUnique({
      where: { id: req.params.memberId },
    });

    if (!invitation || invitation.userId !== req.user!.id) {
      throw new ApiError(404, 'Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new ApiError(400, 'You have already joined this organisation. Ask the team to remove you instead.');
    }

    await prisma.organizationMember.delete({ where: { id: invitation.id } });

    res.json({
      success: true,
      message: 'Invitation declined',
    });
  } catch (error) {
    next(error);
  }
});

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
