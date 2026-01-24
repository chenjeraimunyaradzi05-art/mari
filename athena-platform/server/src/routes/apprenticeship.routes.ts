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
      data: items,
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
      const existing = await prisma.apprenticeship.findUnique({ where: { id } });
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
    const existing = await prisma.apprenticeship.findUnique({ where: { id } });
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
// LIST APPLICATIONS FOR APPRENTICESHIP
// ===========================================
router.get('/:id/applications', authenticate, requireRole('EMPLOYER', 'EDUCATION_PROVIDER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
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

export default router;
