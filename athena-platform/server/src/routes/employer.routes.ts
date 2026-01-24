import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================================================
// MIDDLEWARE: Check organization membership
// ============================================================================

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

  (req as any).membership = membership;
  next();
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
 * GET /employer/organizations/:orgId/jobs
 * Get all jobs for an organization
 */
router.get(
  '/organizations/:orgId/jobs',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res, next) => {
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
    body('type').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'CASUAL']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const membership = (req as any).membership;
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

      // Add skills if provided - batch operations to avoid N+1 queries
      if (skills && Array.isArray(skills)) {
        const normalizedSkills = skills.map((s: string) => s.toLowerCase());
        
        // Find existing skills in one query (case-insensitive)
        const existingSkills = await prisma.skill.findMany({
          where: { name: { in: normalizedSkills, mode: 'insensitive' } },
        });
        const existingSkillNamesLower = new Set(existingSkills.map(s => s.name.toLowerCase()));
        
        // Create missing skills in batch
        const missingSkillNames = normalizedSkills.filter(name => !existingSkillNamesLower.has(name));
        if (missingSkillNames.length > 0) {
          await prisma.skill.createMany({
            data: missingSkillNames.map(name => ({ name })),
            skipDuplicates: true,
          });
        }
        
        // Fetch all skills (including newly created) in one query
        const allSkills = await prisma.skill.findMany({
          where: { name: { in: normalizedSkills, mode: 'insensitive' } },
        });
        
        // Create job-skill associations in batch
        await prisma.jobSkill.createMany({
          data: allSkills.map(skill => ({
            jobId: job.id,
            skillId: skill.id,
          })),
          skipDuplicates: true,
        });
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
 * PATCH /employer/jobs/:jobId
 * Update a job posting
 */
router.patch(
  '/jobs/:jobId',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      // Check ownership
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { organization: true },
      });

      if (!job) {
        throw new ApiError(404, 'Job not found');
      }

      // Check if user has access to this job's organization
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

      const allowedFields = [
        'title', 'description', 'type', 'status', 'city', 'state', 'country',
        'isRemote', 'salaryMin', 'salaryMax', 'salaryType', 'showSalary',
        'experienceMin', 'experienceMax', 'benefits', 'applicationUrl', 'applicationEmail',
      ];

      const updateData: Record<string, any> = {};
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
      const { applicationId } = req.params;
      const { status, notes } = req.body;
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

      const members = await prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { invitedAt: 'asc' },
      });

      res.json({
        success: true,
        data: members,
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
      const membership = (req as any).membership;
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
      const membership = (req as any).membership;
      if (!membership.canManageTeam && membership.role !== 'OWNER') {
        throw new ApiError(403, 'You do not have permission to manage team');
      }

      const { orgId, memberId } = req.params;

      // Cannot remove owner
      const targetMember = await prisma.organizationMember.findUnique({
        where: { id: memberId },
      });

      if (!targetMember) {
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
router.get(
  '/organizations/:orgId/analytics',
  authenticate,
  requireOrgAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const membership = (req as any).membership;
      if (!membership.canViewAnalytics) {
        throw new ApiError(403, 'You do not have permission to view analytics');
      }

      const { orgId } = req.params;
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      // Get application trends by date
      const applications = await prisma.jobApplication.findMany({
        where: {
          job: { organizationId: orgId },
          appliedAt: { gte: startDate },
        },
        select: { appliedAt: true, status: true },
      });

      // Group by date
      const applicationsByDate: Record<string, number> = {};
      applications.forEach((app: any) => {
        const date = app.appliedAt.toISOString().split('T')[0];
        applicationsByDate[date] = (applicationsByDate[date] || 0) + 1;
      });

      // Top performing jobs
      const topJobs = await prisma.job.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          title: true,
          viewCount: true,
          applicationCount: true,
        },
        orderBy: { viewCount: 'desc' },
        take: 5,
      });

      // Conversion funnel
      const funnel = await prisma.jobApplication.groupBy({
        by: ['status'],
        where: { job: { organizationId: orgId } },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          period: { days: daysNum, startDate, endDate: new Date() },
          applicationTrend: Object.entries(applicationsByDate)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          topJobs: topJobs.map(job => ({
            id: job.id,
            title: job.title,
            views: job.viewCount,
            applications: job.applicationCount,
            conversionRate: job.viewCount > 0 
              ? ((job.applicationCount / job.viewCount) * 100).toFixed(1) + '%'
              : '0%',
          })),
          funnel: funnel.reduce((acc: Record<string, number>, item: any) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
