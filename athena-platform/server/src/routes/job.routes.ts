import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { JobType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { parsePagination } from '../utils/pagination';
import { getRecommendedJobs, search as searchService } from '../services/search.service';
import { notificationService, type NotificationChannel } from '../services/notification.service';
import { assertOwnResumeUpload, hiringStaffUserIds } from '../services/hiring-access.service';
import { claimJobView } from '../services/job-view-count.service';
import { bestEffort } from '../utils/best-effort';

const router = Router();

/**
 * ## The employer-side job routes are gone from this file
 *
 * POST /api/jobs, PATCH /api/jobs/:id, POST /api/jobs/:id/publish,
 * GET /api/jobs/:id/applications and PATCH /api/jobs/:jobId/applications/:id
 * used to live here as a second employer API beside the console's
 * (employer.routes.ts). Nothing on the web or in the app called any of them,
 * and they had drifted from the console's rules: the applicant list and the
 * status route authorised on `postedById` alone, a fact that never changes,
 * so a recruiter taken off a company's team — or whose posting rights were
 * turned off — could still read the cover letters and résumé links of every
 * candidate for every job she had ever posted, and could still move those
 * candidates through the pipeline in the company's name. Two copies of a
 * permission rule is how one of them ends up wrong, so the copy nobody used
 * was removed rather than patched. The employer console is the one door:
 * GET /api/employer/organizations/:orgId/applications,
 * PATCH /api/employer/applications/:applicationId/status and the job routes
 * beside them, all behind hiring-access.service.
 *
 * What remains here is the candidate's side: search, a listing, applying,
 * her own applications, saved jobs and recommendations.
 */

/**
 * Tells the people hiring for a job that something happened to one of its
 * applications.
 *
 * These notices used to go to `postedById`, the person who happened to create
 * the listing, and linked to /jobs/:id/applications and
 * /dashboard/jobs/:id/applications, neither of which has ever been a page. A
 * listing under an organisation belongs to its hiring team, so the team is told
 * and sent to the console's applicant board. A listing with no organisation
 * (only the removed POST /api/jobs ever made those) has nobody but its poster,
 * and no applicant board; the notice sends her to the listing itself.
 *
 * Best effort per recipient: the candidate's action has already been saved,
 * and one undeliverable notice must not turn it into an error for her.
 */
async function notifyHiringTeam(
  job: { id: string; organizationId: string | null; postedById: string },
  notice: { title: string; message: string; channels?: NotificationChannel[] }
): Promise<void> {
  const recipients = job.organizationId ? await hiringStaffUserIds([job.organizationId]) : [job.postedById];
  const link = job.organizationId
    ? `/employer/organizations/${job.organizationId}/applications`
    : `/dashboard/jobs/${job.id}`;

  await Promise.all(
    recipients.map((userId) =>
      bestEffort('notification.job-hiring-team', () =>
        notificationService.notify({
          userId,
          type: 'APPLICATION_UPDATE',
          title: notice.title,
          message: notice.message,
          link,
          channels: notice.channels ?? ['in-app'],
        })
      )
    )
  );
}

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

    // Counted once per viewer per day, for a live listing, and not for the
    // company looking at its own ad. See job-view-count.service for what this
    // figure feeds and why every request used to move it.
    const viewerIsStaff = req.user
      ? job.postedById === req.user.id ||
        (job.organizationId
          ? Boolean(
              await prisma.organizationMember.findFirst({
                where: { organizationId: job.organizationId, userId: req.user.id },
                select: { id: true },
              })
            )
          : false)
      : false;

    const counts = await claimJobView({
      jobId: id,
      jobStatus: job.status,
      viewerId: req.user?.id,
      viewerIsStaff,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (counts) {
      // The listing is already in hand, so a failed counter write is a lost
      // view, not a failed page.
      await bestEffort('job.view-count', () =>
        prisma.job.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        })
      );
    }

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
      // A withdrawn application can be reopened (see the apply route), so it
      // does not count as having applied: the page draws its Apply button from
      // this, and "Applied" on a job she withdrew from would be a door shut
      // that is in fact open.
      hasApplied = !!application && application.status !== 'WITHDRAWN';
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
// APPLY TO JOB
// ===========================================
router.post(
  '/:id/apply',
  authenticate,
  [
    body('coverLetter')
      .optional()
      .trim()
      .isLength({ max: 20000 })
      .withMessage('That cover letter is too long. Keep it under 20,000 characters.'),
    body('resumeUrl')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('That résumé link is not a file this platform is holding for you.'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // The validators above were declared and never read, so a malformed
      // résumé link reached Prisma as-is.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { coverLetter, resumeUrl } = req.body;

      assertOwnResumeUpload(resumeUrl, req.user!.id);

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

      // One application per person per job is a database constraint, and
      // withdrawing keeps the row so the employer's pipeline keeps its history.
      // Together those used to make a withdrawal final: a woman who pulled out
      // by mistake, or who applied with the wrong résumé and withdrew to fix
      // it, was told she had "already applied" for ever. A withdrawn
      // application is reopened in place, with what she sends now, as a fresh
      // application. Anything else is still an application in progress.
      if (existingApplication && existingApplication.status !== 'WITHDRAWN') {
        throw new ApiError(400, 'You have already applied to this job');
      }

      const application = existingApplication
        ? await prisma.jobApplication.update({
            where: { id: existingApplication.id },
            data: {
              status: 'PENDING',
              coverLetter: coverLetter ?? null,
              resumeUrl: resumeUrl ?? null,
              appliedAt: new Date(),
            },
          })
        : await prisma.jobApplication.create({
            data: {
              jobId: id,
              userId: req.user!.id,
              coverLetter,
              resumeUrl,
            },
          });

      // The count is of people who applied, and she was counted the first
      // time.
      if (!existingApplication) {
        await prisma.job.update({
          where: { id },
          data: { applicationCount: { increment: 1 } },
        });
      }

      // The hiring team hears about it, not whoever happened to create the
      // listing: a recruiter who has since left the company should not keep
      // receiving its candidates. The link used to be /jobs/:id/applications,
      // a page that has never existed; the console's applicant board is where
      // the team reads applications.
      await notifyHiringTeam(job, {
        title: existingApplication ? 'Application resubmitted' : 'New application',
        message: existingApplication
          ? `A candidate who had withdrawn has applied again to ${job.title}`
          : `Someone applied to ${job.title}`,
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
    // Paged. This returned every application she had ever made in one
    // response, and the tracker reads `pagination.total` to say how many there
    // are and to fetch the rest. With no limit asked for, a page is the
    // ceiling of 100 rather than the platform default of 20: the dashboard
    // home and the app both count this list's length today, and a default of
    // 20 would have told a woman with thirty applications she had twenty.
    const { page, limit } = parsePagination({
      page: req.query.page as string | undefined,
      limit: (req.query.limit as string | undefined) ?? '100',
    });
    const where = { userId: req.user!.id };

    const [applications, total, byStatus] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        include: {
          job: {
            include: {
              organization: {
                // `slug` because the tracker links to the company page, and
                // without it every link resolved to /dashboard/organizations/undefined.
                select: {
                  name: true,
                  logo: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobApplication.count({ where }),
      // The tracker's "Interviews" and "Offers" figures, over every
      // application rather than the page in hand.
      prisma.jobApplication.groupBy({ by: ['status'], where, _count: { _all: true } }),
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
      summary: {
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      },
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
        include: { job: { select: { id: true, title: true, postedById: true, organizationId: true } } },
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
      await notifyHiringTeam(
        { ...application.job, organizationId: application.job.organizationId ?? null },
        {
          title: status === 'ACCEPTED' ? 'Offer accepted' : 'Application withdrawn',
          message:
            status === 'ACCEPTED'
              ? `A candidate accepted your offer for ${application.job.title}.`
              : `A candidate withdrew their application for ${application.job.title}.`,
          channels: ['in-app', 'email'],
        }
      );

      res.json({ success: true, data: updated });
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
