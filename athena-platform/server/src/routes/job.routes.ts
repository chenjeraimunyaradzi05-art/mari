import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { JobType, Prisma } from '@prisma/client';
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

/**
 * The bands behind the "Experience Level" filter, in years. A job is not filed
 * under one level — it advertises a range, and a posting asking for three to
 * six years belongs to more than one band — so a band matches whenever the two
 * ranges overlap. `max: null` is the open-ended top band.
 */
interface ExperienceBand {
  min: number;
  max: number | null;
}

const EXPERIENCE_BANDS: Record<string, ExperienceBand> = {
  entry: { min: 0, max: 2 },
  mid: { min: 2, max: 5 },
  senior: { min: 5, max: 8 },
  lead: { min: 8, max: 12 },
  executive: { min: 12, max: null },
};

/**
 * Relevance is the search index's own ordering, so it has no entry here; it is
 * what a request gets when it asks for nothing else.
 */
const JOB_SORT_ORDERS: Record<string, Prisma.JobOrderByWithRelationInput> = {
  recent: { publishedAt: 'desc' },
  salary_high: { salaryMax: { sort: 'desc', nulls: 'last' } },
  salary_low: { salaryMin: { sort: 'asc', nulls: 'last' } },
};

/**
 * `type` arrives as a comma-separated list because the filter panel lets her
 * tick more than one. Anything that is not a real job type is dropped here
 * rather than handed to Prisma, which answers an unknown enum value with a
 * 500 — which is what ticking two boxes used to do.
 */
function parseJobTypes(raw: string): JobType[] {
  const known = new Set<string>(Object.values(JobType));
  return raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is JobType => known.has(value));
}

function parseExperienceBands(raw: string): ExperienceBand[] {
  return raw
    .split(',')
    .map((value) => EXPERIENCE_BANDS[value.trim().toLowerCase()])
    .filter((band): band is ExperienceBand => Boolean(band));
}

function experienceBandWhere(band: ExperienceBand): Prisma.JobWhereInput {
  const clauses: Prisma.JobWhereInput[] = [
    // A posting that names no ceiling is open-ended above, so it reaches up
    // into this band from wherever it starts.
    { OR: [{ experienceMax: null }, { experienceMax: { gte: band.min } }] },
  ];
  if (band.max !== null) {
    clauses.push({ OR: [{ experienceMin: null }, { experienceMin: { lte: band.max } }] });
  }
  return { AND: clauses };
}

router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const typeParam = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const experienceParam = typeof req.query.experience === 'string' ? req.query.experience.trim() : '';
    const types = parseJobTypes(typeParam);
    const bands = parseExperienceBands(experienceParam);
    const city = req.query.city as string;
    const state = req.query.state as string;
    const remote = req.query.remote === 'true';
    const salaryMin = parseInt(req.query.salaryMin as string) || undefined;
    const salaryMax = parseInt(req.query.salaryMax as string) || undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'relevance';

    const emptyPage = {
      success: true,
      data: [],
      pagination: { page, limit, total: 0, pages: 0 },
    };

    // A filter that names only values which do not exist matches nothing, and
    // that is a different answer from no filter at all — the second would hand
    // her the whole board back when she had asked for one kind of work.
    if ((typeParam && types.length === 0) || (experienceParam && bands.length === 0)) {
      return res.json(emptyPage);
    }

    // The search index and the database do not know the same things. The index
    // can match free text and rank it; it has never heard of a city or of years
    // of experience, and it reads a salary filter as a range the job must sit
    // inside rather than one it has to overlap. Handing it half the query is
    // what left the location box on the member's job search doing nothing the
    // moment she typed a keyword beside it. So the index answers plain keyword
    // browsing in relevance order, and as soon as she narrows or re-sorts,
    // every condition is applied together in the one place that knows them all.
    const hasStructuredFilter =
      types.length > 0 ||
      bands.length > 0 ||
      Boolean(city) ||
      Boolean(state) ||
      remote ||
      salaryMin !== undefined ||
      salaryMax !== undefined;
    const useSearchIndex = Boolean(search) && sort === 'relevance' && !hasStructuredFilter;

    let jobIds: string[] | null = null;
    let totalCount = 0;

    if (useSearchIndex) {
      try {
        const searchResult = await searchService({
          query: search,
          type: 'jobs',
          page,
          limit,
        });
        jobIds = searchResult.results.map((r) => r.id);
        totalCount = searchResult.total;
      } catch (error) {
        // Losing the index is not losing the search: jobIds stays null and the
        // database answers the same question below.
        logger.error('Search service failed', { error });
      }
    }

    const conditions: Prisma.JobWhereInput[] = [];

    if (jobIds !== null) {
      if (jobIds.length === 0) {
        return res.json(emptyPage);
      }
      conditions.push({ id: { in: jobIds } });
    } else {
      if (search) {
        conditions.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
      if (types.length > 0) conditions.push({ type: { in: types } });
      if (city) conditions.push({ city: { contains: city, mode: 'insensitive' } });
      if (state) conditions.push({ state });
      if (remote) conditions.push({ isRemote: true });
      // A salary filter is the range she would accept, so a job qualifies when
      // its advertised range overlaps hers. Read the other way round — the
      // job's floor above her floor and its ceiling below her ceiling — it
      // threw away every listing whose band was merely wider than the one she
      // picked, which is most of the good ones.
      if (salaryMin !== undefined) conditions.push({ salaryMax: { gte: salaryMin } });
      if (salaryMax !== undefined) conditions.push({ salaryMin: { lte: salaryMax } });
      if (bands.length > 0) conditions.push({ OR: bands.map(experienceBandWhere) });
    }

    const where: Prisma.JobWhereInput = { status: 'ACTIVE', AND: conditions };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
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
        orderBy: jobIds ? undefined : JOB_SORT_ORDERS[sort] ?? { publishedAt: 'desc' },
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
            // Organization.safetyScore is not served here. Nothing on the
            // platform computes one — safety-score.service.ts only ever scores
            // a User — so the only value the column has ever held is the random
            // number the demo seed wrote into it. A score about an employer,
            // published by a women's safety platform, has to be measured before
            // it is shown.
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
    body('resumeUrl').optional().isURL({ protocols: ['http', 'https'] }),
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
// CANDIDATE'S OWN APPLICATION ACTIONS
// ===========================================

// The employer-side route is PATCH /:jobId/applications/:applicationId, which
// checks job ownership and so 403s for the candidate. This is the other side of
// it: the two actions an applicant takes on their own application.
//
// Two segments deeper than '/me/applications' and scoped under /me, so it
// cannot collide with the employer route.
const CANDIDATE_TRANSITIONS: Record<string, string[]> = {
  // Withdrawable right up until a decision has been recorded either way.
  WITHDRAWN: ['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'],
  // Only an actual offer can be accepted.
  ACCEPTED: ['OFFERED'],
};

router.patch(
  '/me/applications/:applicationId',
  authenticate,
  [body('status').isIn(['WITHDRAWN', 'ACCEPTED'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { applicationId } = req.params;
      const { status } = req.body;

      const application = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: { job: { select: { id: true, title: true, postedById: true } } },
      });

      // Someone else's application is reported as absent rather than forbidden.
      if (!application || application.userId !== req.user!.id) {
        throw new ApiError(404, 'Application not found');
      }

      if (application.status === status) {
        return res.json({ success: true, data: application, message: 'No change' });
      }

      const allowedFrom = CANDIDATE_TRANSITIONS[status];
      if (!allowedFrom.includes(application.status)) {
        throw new ApiError(
          400,
          `An application that is ${application.status} cannot be ${status.toLowerCase()}`
        );
      }

      const updated = await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { status },
      });

      // The employer needs to know, the same way the candidate is notified when
      // the employer moves the application.
      await notificationService.notify({
        userId: application.job.postedById,
        type: 'APPLICATION_UPDATE',
        title: status === 'ACCEPTED' ? 'Offer accepted' : 'Application withdrawn',
        message:
          status === 'ACCEPTED'
            ? `A candidate accepted your offer for ${application.job.title}.`
            : `A candidate withdrew their application for ${application.job.title}.`,
        link: `/dashboard/jobs/${application.job.id}/applications`,
        channels: ['in-app', 'email'],
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

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

    // A listing that does well collects hundreds of applications, and this
    // route used to load and serialise every one of them into a single
    // response. The page is 50 rather than the platform-wide 20 of
    // parsePagination because the employer screen is a long scrolling list.
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const [applications, total] = await Promise.all([
      prisma.jobApplication.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobApplication.count({ where: { jobId: id } }),
    ]);

    // `data` is still the plain array of applications, so a caller that only
    // reads it is unaffected; the counts it needs to page sit beside it.
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
