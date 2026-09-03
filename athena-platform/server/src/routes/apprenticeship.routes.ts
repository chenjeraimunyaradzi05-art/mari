import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  const existing = await prisma.apprenticeship.findUnique({ where: { slug: base } });
  if (!existing) return base;
  return `${base}-${uuidv4().slice(0, 6)}`;
}

type StaffUser = { id: string; role: string };

// An apprenticeship belongs to the RTO and the host employer named on it, so
// staff reach it through membership of one of those organizations. Holding the
// EMPLOYER or EDUCATION_PROVIDER role is not by itself entitlement to another
// provider's listing, its applicants or their evidence.
//
// Returns null both for "no such apprenticeship" and "not yours", so callers
// answer 404 either way: a 403 would confirm an unpublished listing exists to a
// competitor who guessed its id.
async function findApprenticeshipForStaff(apprenticeshipId: string, user: StaffUser) {
  const apprenticeship = await prisma.apprenticeship.findUnique({ where: { id: apprenticeshipId } });

  if (!apprenticeship) return null;
  if (user.role === 'ADMIN') return apprenticeship;

  const orgIds = [apprenticeship.rtoId, apprenticeship.hostEmployerId].filter(
    (orgId): orgId is string => Boolean(orgId)
  );

  if (orgIds.length === 0) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: { in: orgIds } },
    select: { id: true },
  });

  return membership ? apprenticeship : null;
}

/**
 * Marks which of these listings the viewer has bookmarked.
 *
 * The card renders a bookmark toggle, so without this every listing came back
 * looking un-bookmarked and the icon reset on each page load. One query for the
 * whole page rather than one per row.
 */
async function withBookmarkState<T extends { id: string }>(items: T[], userId?: string) {
  if (!userId || items.length === 0) {
    return items.map((item) => ({ ...item, isBookmarked: false }));
  }

  const bookmarks = await prisma.apprenticeshipBookmark.findMany({
    where: { userId, apprenticeshipId: { in: items.map((i) => i.id) } },
    select: { apprenticeshipId: true },
  });
  const bookmarked = new Set(bookmarks.map((b) => b.apprenticeshipId));

  return items.map((item) => ({ ...item, isBookmarked: bookmarked.has(item.id) }));
}

async function requireOrgMembership(organizationIds: string[], user: StaffUser) {
  if (user.role === 'ADMIN' || organizationIds.length === 0) return;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, organizationId: { in: organizationIds } },
    select: { organizationId: true },
  });

  const joined = new Set(memberships.map((m) => m.organizationId));
  if (organizationIds.some((orgId) => !joined.has(orgId))) {
    throw new ApiError(403, 'You can only list an apprenticeship for an organization you belong to');
  }
}

// ===========================================
// LIST APPRENTICESHIPS
// ===========================================
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const level = typeof req.query.level === 'string' ? req.query.level : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const framework = typeof req.query.framework === 'string' ? req.query.framework : undefined;
    const country = typeof req.query.country === 'string' ? req.query.country : undefined;
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const remote = req.query.remote === 'true';

    const where: any = {};

    if (status) {
      where.status = status;
    } else {
      where.status = 'OPEN';
    }

    if (level) where.level = level;
    if (framework) where.framework = { contains: framework, mode: 'insensitive' };
    if (country) where.country = country;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (remote) where.isRemote = true;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.apprenticeship.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          rto: { select: { id: true, name: true, logo: true } },
          hostEmployer: { select: { id: true, name: true, logo: true } },
        },
      }),
      prisma.apprenticeship.count({ where }),
    ]);

    res.json({
      success: true,
      data: await withBookmarkState(items, req.user?.id),
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
// FEATURED APPRENTICESHIPS
// ===========================================
// Declared before '/:id' on purpose: Express matches in order, so a later
// '/featured' would be swallowed by the id route and 404 as "not found".
router.get('/featured', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 6, 20);

    const apprenticeships = await prisma.apprenticeship.findMany({
      where: { isFeatured: true, status: 'OPEN' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        rto: { select: { id: true, name: true, logo: true } },
        hostEmployer: { select: { id: true, name: true, logo: true } },
      },
    });

    res.json({ success: true, data: await withBookmarkState(apprenticeships, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CATEGORIES
// ===========================================
// Also above '/:id', for the same ordering reason as '/featured'.
//
// An Apprenticeship has no category column; `framework` is the training package
// it sits under, which is what the filter UI offers. Levels come from the enum,
// counted so the UI can grey out the empty ones.
router.get('/categories', optionalAuth, async (_req: AuthRequest, res, next) => {
  try {
    const [frameworks, levels] = await Promise.all([
      prisma.apprenticeship.groupBy({
        by: ['framework'],
        where: { status: 'OPEN' },
        _count: { _all: true },
        orderBy: { _count: { framework: 'desc' } },
      }),
      prisma.apprenticeship.groupBy({
        by: ['level'],
        where: { status: 'OPEN' },
        _count: { _all: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        frameworks: frameworks.map((f) => ({ name: f.framework, count: f._count._all })),
        levels: levels.map((l) => ({ level: l.level, count: l._count._all })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RECOMMENDED
// ===========================================
// There is no apprenticeship search index, so this is deliberately a simple
// content-based match rather than a pretend ML ranking: prefer the frameworks
// and levels the viewer has already bookmarked or applied to, then their
// location, and fall back to featured openings for a viewer with no history.
router.get('/recommended', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 10, 20);

    const [bookmarks, applications, user] = await Promise.all([
      prisma.apprenticeshipBookmark.findMany({
        where: { userId: req.user!.id },
        select: { apprenticeship: { select: { framework: true, level: true } } },
      }),
      prisma.apprenticeshipApplication.findMany({
        where: { userId: req.user!.id },
        select: { apprenticeshipId: true, apprenticeship: { select: { framework: true, level: true } } },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { city: true, state: true, country: true },
      }),
    ]);

    const history = [...bookmarks.map((b) => b.apprenticeship), ...applications.map((a) => a.apprenticeship)];
    const frameworks = [...new Set(history.map((h) => h.framework))];
    const levels = [...new Set(history.map((h) => h.level))];

    // Never recommend something already applied to.
    const excludeIds = applications.map((a) => a.apprenticeshipId);

    const baseWhere: Record<string, unknown> = {
      status: 'OPEN',
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    };

    const preferences: Record<string, unknown>[] = [];
    if (frameworks.length) preferences.push({ framework: { in: frameworks } });
    if (levels.length) preferences.push({ level: { in: levels } });
    if (user?.city) preferences.push({ city: user.city });
    if (user?.state) preferences.push({ state: user.state });

    const matched = preferences.length
      ? await prisma.apprenticeship.findMany({
          where: { ...baseWhere, OR: preferences },
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          take: limit,
          include: {
            rto: { select: { id: true, name: true, logo: true } },
            hostEmployer: { select: { id: true, name: true, logo: true } },
          },
        })
      : [];

    // Top up with featured openings so the rail is never half empty.
    let results = matched;
    if (results.length < limit) {
      const seen = new Set(results.map((r) => r.id));
      const filler = await prisma.apprenticeship.findMany({
        where: {
          ...baseWhere,
          id: { notIn: [...excludeIds, ...seen] },
        },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        take: limit - results.length,
        include: {
          rto: { select: { id: true, name: true, logo: true } },
          hostEmployer: { select: { id: true, name: true, logo: true } },
        },
      });
      results = [...results, ...filler];
    }

    res.json({ success: true, data: results, personalized: preferences.length > 0 });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// BOOKMARKS
// ===========================================
router.get('/bookmarked', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const bookmarks = await prisma.apprenticeshipBookmark.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        apprenticeship: {
          include: {
            rto: { select: { id: true, name: true, logo: true } },
            hostEmployer: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });

    res.json({ success: true, data: bookmarks.map((b) => b.apprenticeship) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/bookmark', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const apprenticeship = await prisma.apprenticeship.findUnique({ where: { id } });
    if (!apprenticeship) {
      throw new ApiError(404, 'Apprenticeship not found');
    }

    // Upsert keeps a repeated bookmark idempotent instead of a unique-constraint error.
    await prisma.apprenticeshipBookmark.upsert({
      where: { apprenticeshipId_userId: { apprenticeshipId: id, userId: req.user!.id } },
      update: {},
      create: { apprenticeshipId: id, userId: req.user!.id },
    });

    res.status(201).json({ success: true, message: 'Apprenticeship bookmarked' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/bookmark', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.apprenticeshipBookmark.deleteMany({
      where: { apprenticeshipId: id, userId: req.user!.id },
    });

    res.json({ success: true, message: 'Bookmark removed' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET APPRENTICESHIP
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const apprenticeship = await prisma.apprenticeship.findUnique({
      where: { id },
      include: {
        rto: { select: { id: true, name: true, logo: true } },
        hostEmployer: { select: { id: true, name: true, logo: true } },
      },
    });

    if (!apprenticeship) {
      throw new ApiError(404, 'Apprenticeship not found');
    }

    res.json({ success: true, data: apprenticeship });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE APPRENTICESHIP
// ===========================================
router.post(
  '/',
  authenticate,
  requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'),
  [
    body('title').isString().notEmpty().isLength({ max: 200 }).withMessage('Title max 200 characters'),
    body('description').isString().notEmpty().isLength({ max: 10000 }).withMessage('Description max 10000 characters'),
    body('framework').isString().notEmpty().isLength({ max: 100 }).withMessage('Framework max 100 characters'),
    body('level').isIn(['CERTIFICATE_I', 'CERTIFICATE_II', 'CERTIFICATE_III', 'CERTIFICATE_IV', 'DIPLOMA', 'ADVANCED_DIPLOMA']),
    body('durationMonths').isInt({ min: 1 }),
    body('wageMin').optional().isInt({ min: 0 }),
    body('wageMax').optional().isInt({ min: 0 }),
    body('country').optional().isString(),
    body('city').optional().isString(),
    body('state').optional().isString(),
    body('isRemote').optional().isBoolean(),
    body('rtoId').optional().isString(),
    body('hostEmployerId').optional().isString(),
    body('competencies').optional(),
    body('positions').optional().isInt({ min: 1 }),
    body('startDate').optional().isISO8601(),
    body('applicationDeadline').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const orgIds = [req.body.rtoId, req.body.hostEmployerId].filter(
        (orgId: unknown): orgId is string => typeof orgId === 'string' && orgId.length > 0
      );

      // Without an owning organization the listing would be unreachable for
      // everyone but an admin afterwards, and its applicants unscopable.
      if (orgIds.length === 0 && req.user!.role !== 'ADMIN') {
        throw new ApiError(400, 'An apprenticeship must name its RTO or its host employer');
      }

      await requireOrgMembership(orgIds, req.user!);

      const baseSlug = slugify(req.body.title);
      const slug = await uniqueSlug(baseSlug);

      const created = await prisma.apprenticeship.create({
        data: {
          title: req.body.title,
          slug,
          description: req.body.description,
          framework: req.body.framework,
          level: req.body.level,
          durationMonths: req.body.durationMonths,
          wageMin: req.body.wageMin,
          wageMax: req.body.wageMax,
          wagePostCompletion: req.body.wagePostCompletion,
          rtoId: req.body.rtoId,
          hostEmployerId: req.body.hostEmployerId,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country,
          isRemote: req.body.isRemote,
          competencies: req.body.competencies,
          positions: req.body.positions,
          startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
          applicationDeadline: req.body.applicationDeadline ? new Date(req.body.applicationDeadline) : undefined,
          status: req.body.status || 'DRAFT',
        },
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE APPRENTICESHIP
// ===========================================
router.patch(
  '/:id',
  authenticate,
  requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'),
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('framework').optional().isString(),
    body('level').optional().isIn(['CERTIFICATE_I', 'CERTIFICATE_II', 'CERTIFICATE_III', 'CERTIFICATE_IV', 'DIPLOMA', 'ADVANCED_DIPLOMA']),
    body('durationMonths').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['OPEN', 'FILLED', 'CLOSED', 'DRAFT']),
    body('positions').optional().isInt({ min: 1 }),
    body('positionsFilled').optional().isInt({ min: 0 }),
    body('wageMin').optional().isInt({ min: 0 }),
    body('wageMax').optional().isInt({ min: 0 }),
    body('wagePostCompletion').optional().isInt({ min: 0 }),
    body('city').optional().isString(),
    body('state').optional().isString(),
    body('country').optional().isString(),
    body('isRemote').optional().isBoolean(),
    body('startDate').optional().isISO8601(),
    body('applicationDeadline').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const existing = await findApprenticeshipForStaff(id, req.user!);
      if (!existing) {
        throw new ApiError(404, 'Apprenticeship not found');
      }

      const updated = await prisma.apprenticeship.update({
        where: { id },
        data: {
          title: req.body.title,
          description: req.body.description,
          framework: req.body.framework,
          level: req.body.level,
          durationMonths: req.body.durationMonths,
          status: req.body.status,
          positions: req.body.positions,
          positionsFilled: req.body.positionsFilled,
          wageMin: req.body.wageMin,
          wageMax: req.body.wageMax,
          wagePostCompletion: req.body.wagePostCompletion,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country,
          isRemote: req.body.isRemote,
          startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
          applicationDeadline: req.body.applicationDeadline ? new Date(req.body.applicationDeadline) : undefined,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// PUBLISH APPRENTICESHIP
// ===========================================
router.post('/:id/publish', authenticate, requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await findApprenticeshipForStaff(id, req.user!);
    if (!existing) {
      throw new ApiError(404, 'Apprenticeship not found');
    }

    const updated = await prisma.apprenticeship.update({
      where: { id },
      data: { status: 'OPEN', publishedAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// APPLY TO APPRENTICESHIP
// ===========================================
router.post(
  '/:id/apply',
  authenticate,
  [body('coverLetter').optional().isString(), body('resumeUrl').optional().isString(), body('answers').optional()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const apprenticeship = await prisma.apprenticeship.findUnique({ where: { id } });
      if (!apprenticeship) {
        throw new ApiError(404, 'Apprenticeship not found');
      }

      if (apprenticeship.status !== 'OPEN') {
        throw new ApiError(400, 'Apprenticeship is not open');
      }

      const existing = await prisma.apprenticeshipApplication.findUnique({
        where: { apprenticeshipId_userId: { apprenticeshipId: id, userId: req.user!.id } },
      });

      if (existing) {
        throw new ApiError(400, 'Already applied');
      }

      const created = await prisma.apprenticeshipApplication.create({
        data: {
          apprenticeshipId: id,
          userId: req.user!.id,
          coverLetter: req.body.coverLetter,
          resumeUrl: req.body.resumeUrl,
          answers: req.body.answers,
        },
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// MY APPLICATIONS
// ===========================================
router.get('/applications/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const applications = await prisma.apprenticeshipApplication.findMany({
      where: { userId: req.user!.id },
      orderBy: { submittedAt: 'desc' },
      include: {
        apprenticeship: {
          select: { id: true, title: true, slug: true, status: true },
        },
      },
    });

    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// A SINGLE APPLICATION
// ===========================================
// Registered after '/applications/me' so that literal path keeps winning.
//
// Visible to the applicant, and to the staff who can already list the
// apprenticeship's applications.
router.get('/applications/:applicationId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { applicationId } = req.params;

    const application = await prisma.apprenticeshipApplication.findUnique({
      where: { id: applicationId },
      include: {
        apprenticeship: {
          select: { id: true, title: true, slug: true, status: true, level: true, framework: true },
        },
        user: { select: { id: true, displayName: true, avatar: true } },
      },
    });

    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    const isApplicant = application.userId === req.user!.id;
    const staffAccess = isApplicant
      ? null
      : await findApprenticeshipForStaff(application.apprenticeshipId, req.user!);

    if (!isApplicant && !staffAccess) {
      throw new ApiError(404, 'Application not found');
    }

    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// WITHDRAW AN APPLICATION
// ===========================================
// Withdrawing marks the row WITHDRAWN rather than deleting it: the unique
// constraint on (apprenticeshipId, userId) means a deleted row would silently
// let someone re-apply, and providers need the audit trail.
router.delete('/applications/:applicationId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { applicationId } = req.params;

    const application = await prisma.apprenticeshipApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new ApiError(404, 'Application not found');
    }
    if (application.userId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized to withdraw this application');
    }
    if (application.status === 'WITHDRAWN') {
      return res.json({ success: true, message: 'Application already withdrawn' });
    }
    if (application.status === 'ACCEPTED') {
      throw new ApiError(400, 'An accepted application cannot be withdrawn here — contact the provider');
    }

    const updated = await prisma.apprenticeshipApplication.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN' },
    });

    res.json({ success: true, data: updated, message: 'Application withdrawn' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LIST APPLICATIONS FOR APPRENTICESHIP
// ===========================================
router.get('/:id/applications', authenticate, requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const apprenticeship = await findApprenticeshipForStaff(id, req.user!);
    if (!apprenticeship) {
      throw new ApiError(404, 'Apprenticeship not found');
    }

    const applications = await prisma.apprenticeshipApplication.findMany({
      where: { apprenticeshipId: id },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MILESTONES, PROGRESS AND COMPLETION
// ===========================================

// Progress is tracked against the *application*, not the user: the application
// is the placement, and its ACCEPTED status is what says this person actually
// holds the position. Someone who only applied has no progress to report.
async function requirePlacement(apprenticeshipId: string, userId: string) {
  const application = await prisma.apprenticeshipApplication.findUnique({
    where: { apprenticeshipId_userId: { apprenticeshipId, userId } },
  });

  if (!application) {
    throw new ApiError(404, 'You have not applied for this apprenticeship');
  }
  if (application.status !== 'ACCEPTED') {
    throw new ApiError(403, 'Progress is only tracked once your placement is accepted');
  }

  return application;
}

router.get('/:id/milestones', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const milestones = await prisma.apprenticeshipMilestone.findMany({
      where: { apprenticeshipId: req.params.id },
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ success: true, data: milestones });
  } catch (error) {
    next(error);
  }
});

// Providers define the competencies for their own apprenticeship.
router.post(
  '/:id/milestones',
  authenticate,
  requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'),
  [
    body('title').isString().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('orderIndex').isInt({ min: 0 }),
    body('competencyCode').optional().isString().isLength({ max: 50 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const apprenticeship = await findApprenticeshipForStaff(req.params.id, req.user!);
      if (!apprenticeship) {
        throw new ApiError(404, 'Apprenticeship not found');
      }

      const milestone = await prisma.apprenticeshipMilestone.create({
        data: {
          apprenticeshipId: req.params.id,
          title: req.body.title.trim(),
          description: req.body.description ?? null,
          orderIndex: Number(req.body.orderIndex),
          competencyCode: req.body.competencyCode ?? null,
        },
      });

      res.status(201).json({ success: true, data: milestone });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// PROGRESS
// ===========================================
router.get('/:id/progress', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const application = await requirePlacement(id, req.user!.id);

    const [milestones, submissions] = await Promise.all([
      prisma.apprenticeshipMilestone.findMany({
        where: { apprenticeshipId: id },
        orderBy: { orderIndex: 'asc' },
      }),
      prisma.apprenticeshipMilestoneSubmission.findMany({
        where: { applicationId: application.id },
      }),
    ]);

    const byMilestone = new Map(submissions.map((s) => [s.milestoneId, s]));
    const steps = milestones.map((milestone) => {
      const submission = byMilestone.get(milestone.id);
      return {
        ...milestone,
        // NOT_STARTED is the honest state for a milestone with no evidence yet,
        // rather than pretending it was submitted and is awaiting review.
        status: submission?.status ?? 'NOT_STARTED',
        submission: submission
          ? {
              id: submission.id,
              notes: submission.notes,
              attachments: submission.attachments,
              submittedAt: submission.submittedAt,
              reviewedAt: submission.reviewedAt,
              reviewNotes: submission.reviewNotes,
            }
          : null,
      };
    });

    const approved = steps.filter((s) => s.status === 'APPROVED').length;

    res.json({
      success: true,
      data: {
        applicationId: application.id,
        milestones: steps,
        summary: {
          total: milestones.length,
          approved,
          awaitingReview: steps.filter((s) => s.status === 'SUBMITTED').length,
          rejected: steps.filter((s) => s.status === 'REJECTED').length,
          notStarted: steps.filter((s) => s.status === 'NOT_STARTED').length,
          // A programme with no milestones defined yet is 0% complete, not 100%.
          percentComplete: milestones.length ? Math.round((approved / milestones.length) * 100) : 0,
          isComplete: milestones.length > 0 && approved === milestones.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SUBMIT EVIDENCE FOR A MILESTONE
// ===========================================
router.post(
  '/:id/milestones/:milestoneId/submit',
  authenticate,
  [
    body('notes').optional().isString().isLength({ max: 5000 }),
    body('attachments').optional().isArray({ max: 10 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id, milestoneId } = req.params;
      const application = await requirePlacement(id, req.user!.id);

      const milestone = await prisma.apprenticeshipMilestone.findUnique({
        where: { id: milestoneId },
      });
      if (!milestone || milestone.apprenticeshipId !== id) {
        throw new ApiError(404, 'Milestone not found');
      }

      const existing = await prisma.apprenticeshipMilestoneSubmission.findUnique({
        where: { milestoneId_applicationId: { milestoneId, applicationId: application.id } },
      });
      // Once signed off, evidence is not reopened by the apprentice.
      if (existing?.status === 'APPROVED') {
        throw new ApiError(400, 'This milestone has already been approved');
      }

      const payload = {
        notes: typeof req.body.notes === 'string' ? req.body.notes : null,
        attachments: Array.isArray(req.body.attachments)
          ? req.body.attachments.filter((a: unknown): a is string => typeof a === 'string')
          : [],
      };

      // Resubmitting after a rejection updates the row and clears the previous
      // review, so the assessor sees a fresh submission rather than a stale
      // rejection attached to new evidence.
      const submission = await prisma.apprenticeshipMilestoneSubmission.upsert({
        where: { milestoneId_applicationId: { milestoneId, applicationId: application.id } },
        create: { milestoneId, applicationId: application.id, ...payload },
        update: {
          ...payload,
          status: 'SUBMITTED',
          reviewerId: null,
          reviewNotes: null,
          reviewedAt: null,
          submittedAt: new Date(),
        },
      });

      res.status(201).json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REVIEW A SUBMISSION
// ===========================================
router.patch(
  '/milestones/submissions/:submissionId',
  authenticate,
  requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'),
  [
    body('status').isIn(['APPROVED', 'REJECTED']),
    body('reviewNotes').optional().isString().isLength({ max: 2000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const submission = await prisma.apprenticeshipMilestoneSubmission.findUnique({
        where: { id: req.params.submissionId },
        include: { milestone: { select: { apprenticeshipId: true } } },
      });
      if (!submission) {
        throw new ApiError(404, 'Submission not found');
      }

      // Only the provider running the placement signs its competencies off.
      const apprenticeship = await findApprenticeshipForStaff(
        submission.milestone.apprenticeshipId,
        req.user!
      );
      if (!apprenticeship) {
        throw new ApiError(404, 'Submission not found');
      }

      const updated = await prisma.apprenticeshipMilestoneSubmission.update({
        where: { id: req.params.submissionId },
        data: {
          status: req.body.status,
          reviewerId: req.user!.id,
          reviewNotes: req.body.reviewNotes ?? null,
          reviewedAt: new Date(),
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// CERTIFICATE
// ===========================================

// Issued only when every defined milestone is approved. This returns the
// certificate's data, not a rendered document — and it is deliberately not a
// nationally recognised AQF certificate, which only the RTO can award. It
// records completion of this placement's competencies on ATHENA.
router.get('/:id/certificate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const application = await requirePlacement(id, req.user!.id);

    const [apprenticeship, milestones, approvedSubmissions, holder] = await Promise.all([
      prisma.apprenticeship.findUnique({
        where: { id },
        include: {
          rto: { select: { id: true, name: true } },
          hostEmployer: { select: { id: true, name: true } },
        },
      }),
      prisma.apprenticeshipMilestone.findMany({
        where: { apprenticeshipId: id },
        orderBy: { orderIndex: 'asc' },
      }),
      prisma.apprenticeshipMilestoneSubmission.findMany({
        where: { applicationId: application.id, status: 'APPROVED' },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, displayName: true },
      }),
    ]);

    if (!apprenticeship) {
      throw new ApiError(404, 'Apprenticeship not found');
    }
    if (milestones.length === 0) {
      throw new ApiError(409, 'This apprenticeship has no milestones defined yet');
    }

    const approvedIds = new Set(approvedSubmissions.map((s) => s.milestoneId));
    const outstanding = milestones.filter((m) => !approvedIds.has(m.id));

    if (outstanding.length > 0) {
      throw new ApiError(409, `${outstanding.length} milestone(s) still to be approved`);
    }

    // The last sign-off is the completion date.
    const issuedAt = approvedSubmissions.reduce<Date | null>((latest, s) => {
      const reviewed = s.reviewedAt;
      if (!reviewed) return latest;
      return !latest || reviewed > latest ? reviewed : latest;
    }, null);

    res.json({
      success: true,
      data: {
        certificateId: application.id,
        holder,
        apprenticeship: {
          id: apprenticeship.id,
          title: apprenticeship.title,
          framework: apprenticeship.framework,
          level: apprenticeship.level,
          durationMonths: apprenticeship.durationMonths,
        },
        rto: apprenticeship.rto,
        hostEmployer: apprenticeship.hostEmployer,
        competencies: milestones.map((m) => ({
          title: m.title,
          competencyCode: m.competencyCode,
        })),
        issuedAt: issuedAt ?? new Date(),
        // Says plainly what this is, so nothing downstream mistakes it for an
        // AQF qualification.
        statement: 'Record of completion on ATHENA. Not a nationally recognised AQF qualification.',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
