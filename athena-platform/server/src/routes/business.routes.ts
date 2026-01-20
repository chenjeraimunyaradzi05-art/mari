import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ===========================================
// ACCELERATOR COHORTS
// ===========================================

// GET /api/business/accelerators - List all accelerator cohorts
router.get('/accelerators', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, upcoming } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (upcoming === 'true') {
      where.startDate = { gte: new Date() };
    }

    const cohorts = await prisma.acceleratorCohort.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: { enrollments: true, sessions: true },
        },
      },
    });

    res.json({
      success: true,
      data: cohorts.map((c) => ({
        ...c,
        enrollmentCount: c._count.enrollments,
        sessionCount: c._count.sessions,
        spotsRemaining: c.maxParticipants - c._count.enrollments,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/accelerators/:id - Get cohort details
router.get('/accelerators/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const cohort = await prisma.acceleratorCohort.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { weekNumber: 'asc' },
        },
        enrollments: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!cohort) {
      throw new ApiError(404, 'Accelerator cohort not found');
    }

    res.json({
      success: true,
      data: {
        ...cohort,
        spotsRemaining: cohort.maxParticipants - cohort._count.enrollments,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/accelerators/:id/enroll - Enroll in cohort
router.post(
  '/accelerators/:id/enroll',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const cohort = await prisma.acceleratorCohort.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      });

      if (!cohort) {
        throw new ApiError(404, 'Accelerator cohort not found');
      }

      if (cohort.status !== 'ENROLLING' && cohort.status !== 'UPCOMING') {
        throw new ApiError(400, 'This cohort is no longer accepting enrollments');
      }

      if (cohort._count.enrollments >= cohort.maxParticipants) {
        throw new ApiError(400, 'This cohort is full');
      }

      // Check existing enrollment
      const existing = await prisma.acceleratorEnrollment.findUnique({
        where: { cohortId_userId: { cohortId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You are already enrolled in this cohort');
      }

      const enrollment = await prisma.acceleratorEnrollment.create({
        data: {
          cohortId: id,
          userId,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
        include: {
          cohort: true,
        },
      });

      logger.info(`User ${userId} enrolled in accelerator cohort ${id}`);

      res.status(201).json({
        success: true,
        data: enrollment,
        message: 'Enrollment created. Please complete payment to confirm your spot.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/accelerators/my/enrollments - Get user's enrollments
router.get(
  '/accelerators/my/enrollments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const enrollments = await prisma.acceleratorEnrollment.findMany({
        where: { userId },
        include: {
          cohort: {
            include: {
              sessions: {
                orderBy: { weekNumber: 'asc' },
              },
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
      });

      res.json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GRANTS
// ===========================================

// GET /api/business/grants - List grants
router.get('/grants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { providerType, industry, region, active } = req.query;

    const where: any = {};
    if (providerType) {
      where.providerType = providerType;
    }
    if (industry) {
      where.industries = { has: industry as string };
    }
    if (region) {
      where.regions = { has: region as string };
    }
    if (active !== 'false') {
      where.isActive = true;
    }

    const grants = await prisma.grant.findMany({
      where,
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: grants,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/grants/:id - Get grant details
router.get('/grants/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const grant = await prisma.grant.findUnique({
      where: { id },
    });

    if (!grant) {
      throw new ApiError(404, 'Grant not found');
    }

    res.json({
      success: true,
      data: grant,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/grants/:id/apply - Apply for grant
router.post(
  '/grants/:id/apply',
  authenticate,
  [body('applicationData').optional().isObject()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { applicationData } = req.body;

      const grant = await prisma.grant.findUnique({ where: { id } });
      if (!grant) {
        throw new ApiError(404, 'Grant not found');
      }

      if (!grant.isActive) {
        throw new ApiError(400, 'This grant is no longer accepting applications');
      }

      // Check existing application
      const existing = await prisma.grantApplication.findUnique({
        where: { grantId_userId: { grantId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already applied for this grant');
      }

      const application = await prisma.grantApplication.create({
        data: {
          grantId: id,
          userId,
          status: 'DRAFT',
          applicationData,
        },
        include: {
          grant: true,
        },
      });

      logger.info(`User ${userId} started grant application for ${id}`);

      res.status(201).json({
        success: true,
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/grants/my/applications - Get user's grant applications
router.get(
  '/grants/my/applications',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const applications = await prisma.grantApplication.findMany({
        where: { userId },
        include: {
          grant: true,
        },
        orderBy: { createdAt: 'desc' },
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

// PATCH /api/business/grants/applications/:id - Update grant application
router.patch(
  '/grants/applications/:id',
  authenticate,
  [
    body('applicationData').optional().isObject(),
    body('status').optional().isIn(['DRAFT', 'SUBMITTED', 'WITHDRAWN']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { applicationData, status } = req.body;

      const application = await prisma.grantApplication.findUnique({
        where: { id },
      });

      if (!application) {
        throw new ApiError(404, 'Application not found');
      }

      if (application.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this application');
      }

      if (application.status !== 'DRAFT' && status !== 'WITHDRAWN') {
        throw new ApiError(400, 'Cannot modify a submitted application');
      }

      const updated = await prisma.grantApplication.update({
        where: { id },
        data: {
          ...(applicationData && { applicationData }),
          ...(status && { status }),
          ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
        },
        include: {
          grant: true,
        },
      });

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
// INVESTORS
// ===========================================

// GET /api/business/investors - List investors
router.get('/investors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, industry, stage, region, minCheck, maxCheck } = req.query;

    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }
    if (industry) {
      where.industries = { has: industry as string };
    }
    if (stage) {
      where.stages = { has: stage as string };
    }
    if (region) {
      where.regions = { has: region as string };
    }

    const investors = await prisma.investor.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: investors,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/investors/:id - Get investor details
router.get('/investors/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const investor = await prisma.investor.findUnique({
      where: { id },
    });

    if (!investor) {
      throw new ApiError(404, 'Investor not found');
    }

    res.json({
      success: true,
      data: investor,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/investors/:id/request-intro - Request introduction
router.post(
  '/investors/:id/request-intro',
  authenticate,
  [body('message').optional().isString().isLength({ max: 1000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { message } = req.body;

      const investor = await prisma.investor.findUnique({ where: { id } });
      if (!investor) {
        throw new ApiError(404, 'Investor not found');
      }

      if (!investor.isActive) {
        throw new ApiError(400, 'This investor is not currently accepting introductions');
      }

      // Check existing introduction
      const existing = await prisma.investorIntroduction.findUnique({
        where: { investorId_userId: { investorId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already requested an introduction to this investor');
      }

      const introduction = await prisma.investorIntroduction.create({
        data: {
          investorId: id,
          userId,
          message,
          status: 'REQUESTED',
        },
        include: {
          investor: true,
        },
      });

      logger.info(`User ${userId} requested intro to investor ${id}`);

      res.status(201).json({
        success: true,
        data: introduction,
        message: 'Introduction request submitted. We will review and connect you soon.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/investors/my/introductions - Get user's investor introductions
router.get(
  '/investors/my/introductions',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const introductions = await prisma.investorIntroduction.findMany({
        where: { userId },
        include: {
          investor: true,
        },
        orderBy: { requestedAt: 'desc' },
      });

      res.json({
        success: true,
        data: introductions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// VENDORS
// ===========================================

// GET /api/business/vendors - List vendors
router.get('/vendors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, partner, verified, minRating } = req.query;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (partner === 'true') {
      where.isPartner = true;
    }
    if (verified === 'true') {
      where.isVerified = true;
    }
    if (minRating) {
      where.avgRating = { gte: parseFloat(minRating as string) };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: [
        { isPartner: 'desc' },
        { avgRating: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/vendors/:id - Get vendor details
router.get('/vendors/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!vendor) {
      throw new ApiError(404, 'Vendor not found');
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/vendors/:id/reviews - Add vendor review
router.post(
  '/vendors/:id/reviews',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('title').optional().isString().isLength({ max: 100 }),
    body('content').optional().isString().isLength({ max: 2000 }),
    body('projectType').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { rating, title, content, projectType } = req.body;

      const vendor = await prisma.vendor.findUnique({ where: { id } });
      if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
      }

      // Check existing review
      const existing = await prisma.vendorReview.findUnique({
        where: { vendorId_userId: { vendorId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already reviewed this vendor');
      }

      // Create review and update vendor stats in transaction
      const [review] = await prisma.$transaction([
        prisma.vendorReview.create({
          data: {
            vendorId: id,
            userId,
            rating,
            title,
            content,
            projectType,
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        }),
        prisma.vendor.update({
          where: { id },
          data: {
            reviewCount: { increment: 1 },
            avgRating: {
              set: await prisma.vendorReview
                .aggregate({
                  where: { vendorId: id },
                  _avg: { rating: true },
                })
                .then((r) => r._avg.rating || 0),
            },
          },
        }),
      ]);

      logger.info(`User ${userId} reviewed vendor ${id}`);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// RFPs (Request for Proposals)
// ===========================================

// GET /api/business/rfps - List RFPs
router.get('/rfps', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, status } = req.query;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    } else {
      where.status = 'OPEN';
    }

    const rfps = await prisma.rfp.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: rfps.map((r) => ({
        ...r,
        responseCount: r._count.responses,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/rfps - Create RFP
router.post(
  '/rfps',
  authenticate,
  [
    body('title').notEmpty().trim().isLength({ max: 200 }),
    body('description').notEmpty().trim(),
    body('category').isIn([
      'ACCOUNTING_TAX',
      'LEGAL',
      'DESIGN_MARKETING',
      'TECH_DEVELOPMENT',
      'HR_COMPLIANCE',
      'BUSINESS_COACHING',
      'PHOTOGRAPHY_VIDEO',
      'COPYWRITING',
      'VIRTUAL_ASSISTANT',
      'OTHER',
    ]),
    body('budget').optional().isString(),
    body('deadline').optional().isISO8601(),
    body('requirements').optional().isObject(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const { title, description, category, budget, deadline, requirements } = req.body;

      const rfp = await prisma.rfp.create({
        data: {
          userId,
          title,
          description,
          category,
          budget,
          deadline: deadline ? new Date(deadline) : undefined,
          requirements,
          status: 'OPEN',
        },
      });

      logger.info(`User ${userId} created RFP ${rfp.id}`);

      res.status(201).json({
        success: true,
        data: rfp,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/rfps/my - Get user's RFPs
router.get(
  '/rfps/my',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const rfps = await prisma.rfp.findMany({
        where: { userId },
        include: {
          responses: {
            include: {
              vendor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: rfps,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/rfps/:id - Get RFP details
router.get('/rfps/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const rfp = await prisma.rfp.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        responses: {
          include: {
            vendor: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!rfp) {
      throw new ApiError(404, 'RFP not found');
    }

    res.json({
      success: true,
      data: rfp,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/business/rfps/:id - Update RFP status
router.patch(
  '/rfps/:id',
  authenticate,
  [body('status').isIn(['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { status } = req.body;

      const rfp = await prisma.rfp.findUnique({ where: { id } });

      if (!rfp) {
        throw new ApiError(404, 'RFP not found');
      }

      if (rfp.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this RFP');
      }

      const updated = await prisma.rfp.update({
        where: { id },
        data: { status },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
