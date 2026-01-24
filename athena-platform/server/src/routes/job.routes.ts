import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { parsePagination } from '../utils/pagination';
import { indexDocument, deleteDocument, IndexNames } from '../utils/opensearch';
import { getRecommendedJobs, search as searchService } from '../services/search.service';
import { notificationService } from '../services/notification.service';

const router = Router();

// ===========================================
// SEARCH JOBS
// ===========================================
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const search = req.query.search as string;
    const type = req.query.type as string;
    const city = req.query.city as string;
    const state = req.query.state as string;
    const remote = req.query.remote === 'true';
    const salaryMin = parseInt(req.query.salaryMin as string) || undefined;
    const salaryMax = parseInt(req.query.salaryMax as string) || undefined;

    let jobIds: string[] | null = null;
    let totalCount = 0;

    // 1. Try OpenSearch if there is a text query
    if (search) {
      try {
        const searchResult = await searchService({
          query: search,
          type: 'jobs',
          page,
          limit,
          filters: {
            jobType: type,
            salary: { min: salaryMin, max: salaryMax },
            remote,
          },
        });
        jobIds = searchResult.results.map((r) => r.id);
        totalCount = searchResult.total;
      } catch (error) {
        // Fallback will happen in the 'else' logic usually, but here we just proceed with null jobIds
        // effectively falling back to Prisma below if we structure it right.
        logger.error('Search service failed', { error });
      }
    }

    // 2. Build Prisma Query
    const where: any = { status: 'ACTIVE' };

    if (jobIds !== null) {
      // OpenSearch path
      if (jobIds.length === 0) {
        // No results from search
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      where.id = { in: jobIds };
    } else {
      // Prisma path (Browse or Fallback)
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (type) where.type = type;
      if (city) where.city = { contains: city, mode: 'insensitive' };
      if (state) where.state = state;
      if (remote) where.isRemote = true;
      if (salaryMin) where.salaryMin = { gte: salaryMin };
      if (salaryMax) where.salaryMax = { lte: salaryMax };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
              safetyScore: true,
            },
          },
          skills: {
            include: { skill: true },
          },
          _count: {
            select: { applications: true },
          },
        },
        skip: jobIds ? undefined : (page - 1) * limit, // Pagination handled by OS if used
        take: jobIds ? undefined : limit,
        orderBy: jobIds ? undefined : { publishedAt: 'desc' },
      }),
      jobIds ? Promise.resolve(totalCount) : prisma.job.count({ where }),
    ]);

    // 3. Preserve Order if using Search
    let resultJobs = jobs;
    if (jobIds) {
      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      resultJobs = jobIds.map((id) => jobMap.get(id)).filter(Boolean) as any[];
    }

    // Check if user has applied to each job
    let appliedJobIds: string[] = [];
    if (req.user) {
      const applications = await prisma.jobApplication.findMany({
        where: {
          userId: req.user.id,
          jobId: { in: resultJobs.map((j) => j.id) },
        },
        select: { jobId: true },
      });
      appliedJobIds = applications.map((a) => a.jobId);
    }

    const jobsWithApplied = resultJobs.map((job) => ({
      ...job,
      hasApplied: appliedJobIds.includes(job.id),
    }));

    res.json({
      success: true,
      data: jobsWithApplied,
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
// GET JOB BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            description: true,
            website: true,
            city: true,
            state: true,
            industry: true,
            size: true,
            safetyScore: true,
            isVerified: true,
          },
        },
        postedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        skills: {
          include: { skill: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job) {
      throw new ApiError(404, 'Job not found');
    }

    // Increment view count
    await prisma.job.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Check if user has applied
    let hasApplied = false;
    let application = null;
    if (req.user) {
      application = await prisma.jobApplication.findUnique({
        where: {
          jobId_userId: {
            jobId: id,
            userId: req.user.id,
          },
        },
      });
      hasApplied = !!application;
    }

    res.json({
      success: true,
      data: {
        ...job,
        hasApplied,
        application,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE JOB (Employers Only)
// ===========================================
router.post(
  '/',
  authenticate,
  requireRole('EMPLOYER', 'ADMIN'),
  [
    body('title').notEmpty().trim(),
    body('description').notEmpty(),
    body('type').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL', 'INTERNSHIP', 'APPRENTICESHIP']),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('isRemote').optional().isBoolean(),
    body('salaryMin').optional().isInt({ min: 0 }),
    body('salaryMax').optional().isInt({ min: 0 }),
    body('experienceMin').optional().isInt({ min: 0 }),
    body('experienceMax').optional().isInt({ min: 0 }),
    body('skills').optional().isArray(),
    body('deadline').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { skills, ...jobData } = req.body;

      // Generate slug
      const slug = `${jobData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uuidv4().slice(0, 8)}`;

      const job = await prisma.job.create({
        data: {
          ...jobData,
          slug,
          postedById: req.user!.id,
          status: 'DRAFT',
          deadline: jobData.deadline ? new Date(jobData.deadline) : null,
        },
      });

      // Add skills if provided - batch operation to avoid N+1 queries
      if (skills && skills.length > 0) {
        const normalizedSkills = skills.map((s: string) => s.toLowerCase());
        
        // Find existing skills in one query
        const existingSkills = await prisma.skill.findMany({
          where: { name: { in: normalizedSkills } },
        });
        const existingSkillNames = new Set(existingSkills.map(s => s.name));
        
        // Create missing skills in batch
        const missingSkillNames = normalizedSkills.filter((name: string) => !existingSkillNames.has(name));
        if (missingSkillNames.length > 0) {
          await prisma.skill.createMany({
            data: missingSkillNames.map((name: string) => ({ name })),
            skipDuplicates: true,
          });
        }
        
        // Fetch all skills (including newly created ones)
        const allSkills = await prisma.skill.findMany({
          where: { name: { in: normalizedSkills } },
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

      // Index in OpenSearch
      await indexDocument(IndexNames.JOBS, job.id, {
        title: job.title,
        description: job.description,
        jobType: job.type,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        isRemote: job.isRemote,
        isDraft: true,
        companyName: null, // Need to fetch or pass this if available
        city: job.city,
        state: job.state,
        skills: skills || [],
        createdAt: job.createdAt,
      });

      res.status(201).json({
        success: true,
        message: 'Job created as draft',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE JOB
// ===========================================
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existingJob = await prisma.job.findUnique({
      where: { id },
      select: { postedById: true },
    });

    if (!existingJob) {
      throw new ApiError(404, 'Job not found');
    }

    if (existingJob.postedById !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized to update this job');
    }

    const { skills, ...updateData } = req.body;

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: { organization: true, skills: { include: { skill: true } } }
    });

    // Update index
    await indexDocument(IndexNames.JOBS, job.id, {
      title: job.title,
      description: job.description,
      jobType: job.type,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      isRemote: job.isRemote,
      isDraft: job.status === 'DRAFT',
      companyName: job.organization?.name,
      city: job.city,
      state: job.state,
      skills: job.skills.map(js => js.skill.name),
      createdAt: job.createdAt,
    });

    res.json({
      success: true,
      message: 'Job updated',
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PUBLISH JOB
// ===========================================
router.post('/:id/publish', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const existingJob = await prisma.job.findUnique({
      where: { id },
    });

    if (!existingJob) {
      throw new ApiError(404, 'Job not found');
    }

    if (existingJob.postedById !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      include: { organization: true, skills: { include: { skill: true } } }
    });

    // Update index to mark as active
    await indexDocument(IndexNames.JOBS, job.id, {
      title: job.title,
      description: job.description,
      jobType: job.type,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      isRemote: job.isRemote,
      isDraft: false,
      publishedAt: job.publishedAt,
      companyName: job.organization?.name,
      city: job.city,
      state: job.state,
      skills: job.skills.map(js => js.skill.name),
      createdAt: job.createdAt,
    });

    res.json({
      success: true,
      message: 'Job published',
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// APPLY TO JOB
// ===========================================
router.post(
  '/:id/apply',
  authenticate,
  [
    body('coverLetter').optional().trim(),
    body('resumeUrl').optional().isURL(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { coverLetter, resumeUrl } = req.body;

      // Check if job exists and is active
      const job = await prisma.job.findUnique({
        where: { id },
        include: {
          organization: { select: { name: true } },
        },
      });

      if (!job) {
        throw new ApiError(404, 'Job not found');
      }

      if (job.status !== 'ACTIVE') {
        throw new ApiError(400, 'This job is no longer accepting applications');
      }

      // Check if already applied
      const existingApplication = await prisma.jobApplication.findUnique({
        where: {
          jobId_userId: {
            jobId: id,
            userId: req.user!.id,
          },
        },
      });

      if (existingApplication) {
        throw new ApiError(400, 'You have already applied to this job');
      }

      // Create application
      const application = await prisma.jobApplication.create({
        data: {
          jobId: id,
          userId: req.user!.id,
          coverLetter,
          resumeUrl,
        },
      });

      // Update application count
      await prisma.job.update({
        where: { id },
        data: { applicationCount: { increment: 1 } },
      });

      // Create notification for job poster
      await prisma.notification.create({
        data: {
          userId: job.postedById,
          type: 'APPLICATION_UPDATE',
          title: 'New application',
          message: `Someone applied to ${job.title}`,
          link: `/jobs/${id}/applications`,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Application submitted',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET MY APPLICATIONS
// ===========================================
router.get('/me/applications', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const applications = await prisma.jobApplication.findMany({
      where: { userId: req.user!.id },
      include: {
        job: {
          include: {
            organization: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
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
// GET JOB APPLICATIONS (For Employers)
// ===========================================
router.get('/:id/applications', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const job = await prisma.job.findUnique({
      where: { id },
      select: { postedById: true },
    });

    if (!job) {
      throw new ApiError(404, 'Job not found');
    }

    if (job.postedById !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            currentJobTitle: true,
            yearsExperience: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
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
// UPDATE APPLICATION STATUS (For Employers)
// ===========================================
router.patch(
  '/:jobId/applications/:applicationId',
  authenticate,
  [
    body('status').isIn(['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { jobId, applicationId } = req.params;
      const { status } = req.body;

      // Verify job ownership
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { postedById: true, title: true },
      });

      if (!job) {
        throw new ApiError(404, 'Job not found');
      }

      if (job.postedById !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const application = await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status },
        include: { user: { select: { id: true } } },
      });

      // Notify applicant
      await notificationService.notify({
        userId: application.user.id,
        type: 'APPLICATION_UPDATE',
        title: 'Application Status Updated',
        message: `Your application for ${job.title} is now ${status}`,
        link: `/dashboard/applications`,
        channels: ['in-app', 'email'],
        emailTemplate: {
          subject: `Application Update: ${job.title}`,
          html: `
            <h2>Application Status Update</h2>
            <p>Your application for <strong>${job.title}</strong> has moved to: <strong>${status}</strong>.</p>
            <div style="margin: 20px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard/applications" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Applications</a>
            </div>
          `
        }
      });

      res.json({
        success: true,
        message: 'Application status updated',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SAVED JOBS
// ===========================================
router.get('/me/saved', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const savedJobs = await prisma.savedJob.findMany({
      where: { userId: req.user!.id },
      include: {
        job: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                logo: true,
                safetyScore: true,
              },
            },
            skills: {
              include: { skill: true },
            },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    });

    // Flatten the response to return jobs with savedAt
    const jobs = savedJobs.map((saved) => ({
      ...saved.job,
      savedAt: saved.savedAt,
      isSaved: true,
    }));

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new ApiError(404, 'Job not found');
    }

    // Check if already saved
    const existing = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user!.id,
          jobId: id,
        },
      },
    });

    if (existing) {
      throw new ApiError(400, 'Job already saved');
    }

    await prisma.savedJob.create({
      data: {
        userId: req.user!.id,
        jobId: id,
      },
    });

    res.json({
      success: true,
      message: 'Job saved',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.savedJob.deleteMany({
      where: {
        userId: req.user!.id,
        jobId: id,
      },
    });

    res.json({
      success: true,
      message: 'Job removed from saved',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET RECOMMENDED JOBS
// ===========================================
router.get('/recommendations/for-me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // 1. Get IDs from OpenSearch (Selection & Ranking)
    const recommendations = await getRecommendedJobs(req.user!.id, limit);

    if (recommendations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const jobIds = recommendations.map((r) => r.id);

    // 2. Hydrate full job details + relations
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds } },
      include: {
        organization: {
          select: { id: true, name: true, logo: true },
        },
        skills: {
          include: { skill: true },
        },
      },
    });

    const jobMap = new Map(jobs.map((j) => [j.id, j]));

    // 3. Calculate "Visual" Match Score for UI badge
    // We already used the sophisticated scorer definition in OpenSearch for the order,
    // but the UI likes a simple "X% Skills Match" number.
    const userSkills = await prisma.userSkill.findMany({
      where: { userId: req.user!.id },
      select: { skillId: true },
    });
    const userSkillIds = userSkills.map((s) => s.skillId);

    const orderedJobs = recommendations
      .map((rec) => {
        const job = jobMap.get(rec.id);
        if (!job) return null;

        const jobSkillIds = job.skills.map((js) => js.skillId);
        const matchingCount = jobSkillIds.filter((id) => userSkillIds.includes(id)).length;
        const matchScore =
          jobSkillIds.length > 0 ? Math.round((matchingCount / jobSkillIds.length) * 100) : 0;

        return { ...job, matchScore };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: orderedJobs,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
