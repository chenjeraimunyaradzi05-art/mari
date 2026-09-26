import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';
import {
  ACCEPTED_MEMBER_WHERE,
  HIRING_MEMBER_WHERE,
  POSTING_MEMBER_WHERE,
  assertOwnResumeUpload,
  hiringStaff,
  hiringStaffUserIds,
} from '../services/hiring-access.service';
import { bestEffort } from '../utils/best-effort';
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

/**
 * What the caller is about to do with the listing, which decides which of the
 * owning organisation's members may do it.
 *
 * `listing` is writing the listing itself — editing, publishing, defining its
 * competencies — and needs posting rights. `applicants` is anything that shows
 * or decides a person who applied, and needs a hiring role. Both need an
 * accepted membership. See hiring-access.service for the rule and its history.
 */
type StaffAccess = 'listing' | 'applicants';

// An apprenticeship belongs to the RTO and the host employer named on it, so
// staff reach it through membership of one of those organizations. The staff
// routes used to also require the EMPLOYER or EDUCATION_PROVIDER account role,
// which nothing on the site ever grants (registration stores a persona, and
// creating an organization makes an OWNER membership, not a role), so every
// self-registered TAFE or host employer got a 403 on her first listing. The
// role is no longer checked; ADMIN still bypasses the membership test.
//
// Membership then meant any OrganizationMember row at all: a VIEWER, and an
// invitation the invitee had never answered, as well as the hiring team. The
// applicant list behind this check returns every applicant's email address,
// cover letter, résumé link and answers, and apprenticeship ids are public, so
// anyone an RTO's owner had ever typed an email address for could read the
// lot. The membership has to be accepted now, and has to carry the rights the
// action needs.
//
// Returns null both for "no such apprenticeship" and "not yours", so callers
// answer 404 either way: a 403 would confirm an unpublished listing exists to a
// competitor who guessed its id.
async function findApprenticeshipForStaff(apprenticeshipId: string, user: StaffUser, access: StaffAccess) {
  const apprenticeship = await prisma.apprenticeship.findUnique({ where: { id: apprenticeshipId } });

  if (!apprenticeship) return null;
  if (user.role === 'ADMIN') return apprenticeship;

  const orgIds = [apprenticeship.rtoId, apprenticeship.hostEmployerId].filter(
    (orgId): orgId is string => Boolean(orgId)
  );

  if (orgIds.length === 0) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      organizationId: { in: orgIds },
      ...(access === 'applicants' ? HIRING_MEMBER_WHERE : POSTING_MEMBER_WHERE),
    },
    select: { id: true },
  });

  return membership ? apprenticeship : null;
}

/**
 * Every organization this member is staff of, for scoping their own listings.
 * An invitation she has not accepted does not make her staff.
 */
async function staffOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, ...ACCEPTED_MEMBER_WHERE },
    select: { organizationId: true },
  });
  return memberships.map((m) => m.organizationId);
}

/**
 * Whether anyone can receive an application to this listing.
 *
 * The seeded catalogue names TAFE Queensland, TAFE NSW and RMIT as the RTO and
 * no host employer, and nobody from those institutions has an account here.
 * An application to one of those listings used to be accepted with a 201 and
 * then seen by no one but a platform admin, while the applicant waited for an
 * answer that could not come. A listing is open to applications through
 * ATHENA only while someone on its hiring team can read them.
 */
async function listingHasHiringStaff(apprenticeship: { rtoId: string | null; hostEmployerId: string | null }) {
  const orgIds = [apprenticeship.rtoId, apprenticeship.hostEmployerId].filter(
    (orgId): orgId is string => Boolean(orgId)
  );
  const staff = await hiringStaffUserIds(orgIds, 1);
  return staff.length > 0;
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

/**
 * Listing in an organisation's name needs posting rights there, the same rule
 * the employer console applies before a job is created: an accepted owner or
 * admin, or a member given canPostJobs.
 */
async function requireOrgMembership(organizationIds: string[], user: StaffUser) {
  if (user.role === 'ADMIN' || organizationIds.length === 0) return;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, organizationId: { in: organizationIds }, ...POSTING_MEMBER_WHERE },
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

    // Only OPEN listings are public. `status` used to be taken straight from
    // the query, so anyone could read another provider's drafts with
    // `?status=DRAFT` — the same thing `findApprenticeshipForStaff` refuses to
    // confirm on the detail route. A caller asking for anything else is
    // narrowed to listings their own organizations own; `/mine` is the
    // intended door for that.
    if (!status || status === 'OPEN') {
      where.status = 'OPEN';
    } else if (req.user?.role === 'ADMIN') {
      where.status = status;
    } else if (req.user) {
      const orgIds = await staffOrganizationIds(req.user.id);
      if (orgIds.length === 0) {
        where.status = 'OPEN';
      } else {
        where.status = status;
        where.OR = [{ rtoId: { in: orgIds } }, { hostEmployerId: { in: orgIds } }];
      }
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
// A PROVIDER'S OWN APPRENTICESHIPS
// ===========================================
// Drafts included, which is the point: a listing created through POST / starts
// as a draft and there was no route that could find it again. Declared before
// '/:id' so Express does not hand "mine" to the id route. Any member may ask;
// one who is staff of nothing gets an empty list, not a refusal.
router.get('/mine', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const orgIds = await staffOrganizationIds(req.user!.id);

    if (orgIds.length === 0 && req.user!.role !== 'ADMIN') {
      return res.json({ success: true, data: [], organizations: [] });
    }

    const where = req.user!.role === 'ADMIN' && orgIds.length === 0
      ? {}
      : { OR: [{ rtoId: { in: orgIds } }, { hostEmployerId: { in: orgIds } }] };

    const items = await prisma.apprenticeship.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        rto: { select: { id: true, name: true, logo: true } },
        hostEmployer: { select: { id: true, name: true, logo: true } },
        _count: { select: { applications: true } },
      },
    });

    res.json({ success: true, data: items });
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

    // The page draws its Apply button from this, so a listing nobody can
    // receive applications for says so before she writes a cover letter,
    // rather than after. See listingHasHiringStaff.
    const acceptsApplications = await listingHasHiringStaff(apprenticeship);

    res.json({ success: true, data: { ...apprenticeship, acceptsApplications } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE APPRENTICESHIP
// ===========================================
// Membership of the named RTO or host employer (requireOrgMembership below) is
// the authorisation; no account role is needed.
router.post(
  '/',
  authenticate,
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
      const existing = await findApprenticeshipForStaff(id, req.user!, 'listing');
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
router.post('/:id/publish', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await findApprenticeshipForStaff(id, req.user!, 'listing');
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
  [
    body('coverLetter').optional().isString().isLength({ max: 20000 }).withMessage('That cover letter is too long. Keep it under 20,000 characters.'),
    body('resumeUrl').optional({ values: 'falsy' }).isString().isLength({ max: 2048 }),
    body('answers').optional(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const resumeUrl: string | undefined = req.body.resumeUrl || undefined;
      assertResumeLinkIsHers(resumeUrl, req.user!.id);

      const { id } = req.params;
      const apprenticeship = await prisma.apprenticeship.findUnique({ where: { id } });
      if (!apprenticeship) {
        throw new ApiError(404, 'Apprenticeship not found');
      }

      if (apprenticeship.status !== 'OPEN') {
        throw new ApiError(400, 'Apprenticeship is not open');
      }

      const orgIds = [apprenticeship.rtoId, apprenticeship.hostEmployerId].filter(
        (orgId): orgId is string => Boolean(orgId)
      );
      const staff = await hiringStaff(orgIds);

      // Refused before anything is written, and said plainly. See
      // listingHasHiringStaff: an application nobody can read is worse than no
      // application, because she waits on it.
      if (staff.length === 0) {
        throw new ApiError(
          409,
          'This provider has not set up its ATHENA account yet, so an application sent here would not reach anyone. Contact the provider directly to apply.'
        );
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
          resumeUrl,
          answers: req.body.answers,
        },
      });

      // Nobody used to be told anything. The row was written and the 201
      // returned, and the provider found out only if someone happened to open
      // the applicant list; the applicant had no record beyond the toast.
      // The application is already saved, so a notice that fails is logged
      // and does not turn her successful application into an error.
      await Promise.all(
        staff.map((member) =>
          bestEffort('notification.apprenticeship-application-staff', () =>
            notificationService.notify({
              userId: member.userId,
              type: 'APPLICATION_UPDATE',
              title: 'New apprenticeship application',
              message: `Someone has applied for ${apprenticeship.title}.`,
              link: `/employer/organizations/${member.organizationId}/apprenticeships`,
              channels: ['in-app', 'email'],
            })
          )
        )
      );

      await bestEffort('notification.apprenticeship-application-applicant', () =>
        notificationService.notify({
          userId: req.user!.id,
          type: 'APPLICATION_UPDATE',
          title: 'Application sent',
          message: `Your application for ${apprenticeship.title} has been sent to the provider. You will be told here when they respond.`,
          link: `/apprenticeships/${apprenticeship.id}`,
          channels: ['in-app'],
        })
      );

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * A résumé link on an apprenticeship application must not point at somebody
 * else's upload.
 *
 * The job application route requires the résumé to be the applicant's own
 * upload. This form still asks for a link to a document held elsewhere (Google
 * Drive and the like), so requiring an upload here would refuse every
 * application that followed the form's own instructions. What is refused is the
 * part that did harm: a path into ATHENA's own résumé store that belongs to a
 * different member, which would attach her résumé to an application in
 * someone else's name. Anything else must be an https link, not an arbitrary
 * string.
 */
function assertResumeLinkIsHers(resumeUrl: string | undefined, userId: string): void {
  if (!resumeUrl) return;

  const path = resumeUrl.split(/[?#]/)[0];
  if (/(^|\/)resumes\//.test(path)) {
    assertOwnResumeUpload(resumeUrl, userId);
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(resumeUrl);
  } catch {
    throw new ApiError(400, 'That résumé link is not a web address. Paste the full link, starting with https://.');
  }
  if (parsed.protocol !== 'https:') {
    throw new ApiError(400, 'That résumé link is not a web address. Paste the full link, starting with https://.');
  }
}

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
      : await findApprenticeshipForStaff(application.apprenticeshipId, req.user!, 'applicants');

    if (!isApplicant && !staffAccess) {
      throw new ApiError(404, 'Application not found');
    }

    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DECIDE AN APPLICATION
// ===========================================
// The provider's half of the conversation, and it was missing. Until this
// existed the only writes to `ApprenticeshipApplication.status` were the row's
// own SUBMITTED default and the candidate's WITHDRAWN below, so five of the
// seven values in `ApprenticeshipApplicationStatus` were unreachable. Because
// `requirePlacement` gates progress, evidence and the certificate on ACCEPTED,
// nothing under this listing's competency stack could ever answer anything but
// 403: an RTO could publish a placement and read its applicants, and then the
// pipeline stopped for good.
//
// WITHDRAWN is deliberately not offered here. That is the candidate's own word
// about her own application and it stays with her at the DELETE below; a
// provider who no longer wants her rejects her under its own name instead of
// recording it as though she walked away.
const PROVIDER_DECISIONS = ['SCREENING', 'INTERVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED'] as const;

type ProviderDecision = (typeof PROVIDER_DECISIONS)[number];

/** What the applicant is told, in her words rather than the enum's. */
const DECISION_NOTICE: Record<ProviderDecision, { title: string; message: (title: string) => string }> = {
  SCREENING: {
    title: 'Your application is being reviewed',
    message: (title) => `Your application for ${title} has moved to screening.`,
  },
  INTERVIEW: {
    title: 'You have been shortlisted for an interview',
    message: (title) => `The provider would like to interview you for ${title}.`,
  },
  OFFERED: {
    title: 'You have been offered a placement',
    message: (title) => `You have been offered the ${title} placement.`,
  },
  ACCEPTED: {
    title: 'Your placement is confirmed',
    message: (title) =>
      `Your placement on ${title} is confirmed. You can now track your competencies and upload evidence.`,
  },
  REJECTED: {
    title: 'An update on your application',
    message: (title) => `Your application for ${title} was not successful this time.`,
  },
};

router.patch(
  '/applications/:applicationId',
  authenticate,
  [body('status').isIn(PROVIDER_DECISIONS)],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { applicationId } = req.params;
      const status = req.body.status as ProviderDecision;

      const application = await prisma.apprenticeshipApplication.findUnique({
        where: { id: applicationId },
      });
      if (!application) {
        throw new ApiError(404, 'Application not found');
      }

      // The same gate the applicant list and the assessor review already use,
      // and it reports someone else's application as absent rather than
      // forbidden so ids cannot be probed.
      const apprenticeship = await findApprenticeshipForStaff(application.apprenticeshipId, req.user!, 'applicants');
      if (!apprenticeship) {
        throw new ApiError(404, 'Application not found');
      }

      if (application.status === 'WITHDRAWN') {
        throw new ApiError(400, 'This candidate withdrew her application');
      }
      if (application.status === status) {
        return res.json({ success: true, data: application, message: 'No change' });
      }

      // Seats are claimed before the decision is recorded, and claimed with a
      // conditional update rather than a read followed by a write, so two
      // coordinators accepting at the same moment cannot both pass a check
      // against the same stale count and overfill the placement.
      if (status === 'ACCEPTED') {
        const claimed = await prisma.apprenticeship.updateMany({
          where: { id: apprenticeship.id, positionsFilled: { lt: apprenticeship.positions } },
          data: { positionsFilled: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new ApiError(409, 'Every position on this apprenticeship is already filled');
        }
      }

      let updated;
      try {
        updated = await prisma.apprenticeshipApplication.update({
          where: { id: applicationId },
          data: { status },
        });
      } catch (error) {
        // The seat was taken a moment ago and the placement it was taken for
        // never happened, so give it back rather than leaving the listing
        // permanently one apprentice short.
        if (status === 'ACCEPTED') {
          await prisma.apprenticeship.update({
            where: { id: apprenticeship.id },
            data: { positionsFilled: { decrement: 1 } },
          });
        }
        throw error;
      }

      // Releasing a seat when a confirmed placement is later withdrawn by the
      // provider is the mirror of claiming one above.
      if (application.status === 'ACCEPTED') {
        await prisma.apprenticeship.update({
          where: { id: apprenticeship.id },
          data: { positionsFilled: { decrement: 1 } },
        });
      }

      const notice = DECISION_NOTICE[status];
      await notificationService.notify({
        userId: application.userId,
        type: 'APPLICATION_UPDATE',
        title: notice.title,
        message: notice.message(apprenticeship.title),
        // There is no /dashboard/apprenticeships page for this to have pointed
        // at; the listing is the one page she can open from here.
        link: `/apprenticeships/${apprenticeship.id}`,
        channels: ['in-app', 'email'],
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

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
router.get('/:id/applications', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const apprenticeship = await findApprenticeshipForStaff(id, req.user!, 'applicants');
    if (!apprenticeship) {
      throw new ApiError(404, 'Apprenticeship not found');
    }

    // Paged, with the same ceiling of 100 as the employer console's applicant
    // list. This returned every application the listing had ever received —
    // email addresses, cover letters, résumés and answers — in one response.
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = parseLimit(req.query.limit, 50, 100);
    const where = { apprenticeshipId: id };

    const [applications, total] = await Promise.all([
      prisma.apprenticeshipApplication.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.apprenticeshipApplication.count({ where }),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
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

      const apprenticeship = await findApprenticeshipForStaff(req.params.id, req.user!, 'listing');
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

      // Only the provider running the placement signs its competencies off,
      // and signing off is a decision about the apprentice, so it takes the
      // same hiring role as reading her application.
      const apprenticeship = await findApprenticeshipForStaff(
        submission.milestone.apprenticeshipId,
        req.user!,
        'applicants'
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
