import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ===========================================
// SAVINGS GOALS
// ===========================================

// GET /api/finance/savings-goals - Get user's savings goals
router.get(
  '/savings-goals',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const goals = await prisma.savingsGoal.findMany({
        where: { userId },
        include: {
          contributions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: goals.map((goal) => ({
          ...goal,
          progressPct: goal.targetAmount.toNumber() > 0
            ? Math.round((goal.currentAmount.toNumber() / goal.targetAmount.toNumber()) * 100)
            : 0,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/finance/savings-goals - Create savings goal
router.post(
  '/savings-goals',
  authenticate,
  [
    body('name').notEmpty().withMessage('Goal name is required'),
    body('type').isIn(['EMERGENCY_FUND', 'HOME_DEPOSIT', 'EDUCATION', 'BUSINESS', 'TRAVEL', 'OTHER']),
    body('targetAmount').isNumeric().withMessage('Target amount is required'),
    body('targetDate').optional().isISO8601(),
    body('monthlyTarget').optional().isNumeric(),
    body('autoSaveEnabled').optional().isBoolean(),
    body('autoSaveAmount').optional().isNumeric(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const {
        name,
        type,
        targetAmount,
        targetDate,
        monthlyTarget,
        autoSaveEnabled,
        autoSaveAmount,
      } = req.body;

      const goal = await prisma.savingsGoal.create({
        data: {
          userId,
          name,
          type,
          targetAmount: Number(targetAmount),
          targetDate: targetDate ? new Date(targetDate) : undefined,
          monthlyTarget: monthlyTarget ? Number(monthlyTarget) : undefined,
          autoSaveEnabled: autoSaveEnabled || false,
          autoSaveAmount: autoSaveAmount ? Number(autoSaveAmount) : undefined,
          status: 'ACTIVE',
        },
      });

      logger.info(`User ${userId} created savings goal: ${goal.id}`);

      res.status(201).json({
        success: true,
        data: goal,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/finance/savings-goals/:id/contribute - Add contribution
router.post(
  '/savings-goals/:id/contribute',
  authenticate,
  [
    body('amount').isNumeric().withMessage('Amount is required'),
    body('source').optional().isString(),
    body('note').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { amount, source, note } = req.body;

      const goal = await prisma.savingsGoal.findUnique({ where: { id } });
      if (!goal) {
        throw new ApiError(404, 'Savings goal not found');
      }

      if (goal.userId !== userId) {
        throw new ApiError(403, 'Not authorized');
      }

      if (goal.status !== 'ACTIVE') {
        throw new ApiError(400, 'This goal is not active');
      }

      const contribution = await prisma.savingsContribution.create({
        data: {
          goalId: id,
          amount: Number(amount),
          source,
          note,
        },
      });

      const newAmount = goal.currentAmount.toNumber() + Number(amount);
      const isCompleted = newAmount >= goal.targetAmount.toNumber();

      await prisma.savingsGoal.update({
        where: { id },
        data: {
          currentAmount: newAmount,
          ...(isCompleted && { status: 'COMPLETED' }),
        },
      });

      logger.info(`Contribution of ${amount} added to savings goal ${id}`);

      res.status(201).json({
        success: true,
        data: contribution,
        message: isCompleted ? 'Congratulations! Goal completed!' : 'Contribution added',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/finance/savings-goals/:id - Update goal
router.patch(
  '/savings-goals/:id',
  authenticate,
  [
    body('name').optional().isString(),
    body('targetAmount').optional().isNumeric(),
    body('targetDate').optional().isISO8601(),
    body('monthlyTarget').optional().isNumeric(),
    body('autoSaveEnabled').optional().isBoolean(),
    body('autoSaveAmount').optional().isNumeric(),
    body('status').optional().isIn(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;

      const goal = await prisma.savingsGoal.findUnique({ where: { id } });
      if (!goal) {
        throw new ApiError(404, 'Savings goal not found');
      }

      if (goal.userId !== userId) {
        throw new ApiError(403, 'Not authorized');
      }

      const {
        name,
        targetAmount,
        targetDate,
        monthlyTarget,
        autoSaveEnabled,
        autoSaveAmount,
        status,
      } = req.body;

      const updated = await prisma.savingsGoal.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(targetAmount && { targetAmount: Number(targetAmount) }),
          ...(targetDate && { targetDate: new Date(targetDate) }),
          ...(monthlyTarget !== undefined && { monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null }),
          ...(autoSaveEnabled !== undefined && { autoSaveEnabled }),
          ...(autoSaveAmount !== undefined && { autoSaveAmount: autoSaveAmount ? Number(autoSaveAmount) : null }),
          ...(status && { status }),
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
// INSURANCE PRODUCTS
// ===========================================

// GET /api/finance/insurance - List insurance products
router.get('/insurance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;

    const where: any = {
      isActive: true,
    };

    if (type) where.type = type;

    const products = await prisma.insuranceProduct.findMany({
      where,
      orderBy: { premiumMonthly: 'asc' },
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/finance/insurance/:id - Get product details
router.get('/insurance/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await prisma.insuranceProduct.findUnique({
      where: { id },
    });

    if (!product) {
      throw new ApiError(404, 'Insurance product not found');
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/finance/insurance/:id/apply - Apply for insurance
router.post(
  '/insurance/:id/apply',
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

      const product = await prisma.insuranceProduct.findUnique({ where: { id } });
      if (!product) {
        throw new ApiError(404, 'Insurance product not found');
      }

      if (!product.isActive) {
        throw new ApiError(400, 'This product is no longer available');
      }

      // Check existing application
      const existing = await prisma.insuranceApplication.findUnique({
        where: { productId_userId: { productId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already applied for this product');
      }

      const application = await prisma.insuranceApplication.create({
        data: {
          productId: id,
          userId,
          status: 'DRAFT',
          applicationData,
          premiumQuoted: product.premiumMonthly,
          coverageAmount: product.coverageAmount,
        },
        include: {
          product: true,
        },
      });

      logger.info(`User ${userId} started insurance application for product ${id}`);

      res.status(201).json({
        success: true,
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/finance/insurance/my/applications - Get user's applications
router.get(
  '/insurance/my/applications',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const applications = await prisma.insuranceApplication.findMany({
        where: { userId },
        include: {
          product: true,
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

// ===========================================
// SUPERANNUATION
// ===========================================

// GET /api/finance/super - Get user's super accounts
router.get(
  '/super',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const accounts = await prisma.superannuationAccount.findMany({
        where: { userId },
        orderBy: { balance: 'desc' },
      });

      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance.toNumber(), 0);

      res.json({
        success: true,
        data: {
          accounts,
          totalBalance,
          currency: 'AUD',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/finance/super - Add super account
router.post(
  '/super',
  authenticate,
  [
    body('fundName').notEmpty().withMessage('Fund name is required'),
    body('memberNumber').optional().isString(),
    body('balance').optional().isNumeric(),
    body('investmentOpt').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const { fundName, memberNumber, balance, investmentOpt, insuranceInc } = req.body;

      const account = await prisma.superannuationAccount.create({
        data: {
          userId,
          fundName,
          memberNumber,
          balance: balance ? Number(balance) : 0,
          investmentOpt,
          insuranceInc: insuranceInc || false,
        },
      });

      logger.info(`User ${userId} added super account: ${account.id}`);

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/finance/super/:id - Update super account
router.patch(
  '/super/:id',
  authenticate,
  [
    body('balance').optional().isNumeric(),
    body('employerContr').optional().isNumeric(),
    body('personalContr').optional().isNumeric(),
    body('investmentOpt').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;

      const account = await prisma.superannuationAccount.findUnique({ where: { id } });
      if (!account) {
        throw new ApiError(404, 'Super account not found');
      }

      if (account.userId !== userId) {
        throw new ApiError(403, 'Not authorized');
      }

      const { balance, employerContr, personalContr, investmentOpt, insuranceInc } = req.body;

      const updated = await prisma.superannuationAccount.update({
        where: { id },
        data: {
          ...(balance !== undefined && { balance: Number(balance) }),
          ...(employerContr !== undefined && { employerContr: Number(employerContr) }),
          ...(personalContr !== undefined && { personalContr: Number(personalContr) }),
          ...(investmentOpt && { investmentOpt }),
          ...(insuranceInc !== undefined && { insuranceInc }),
          lastSyncAt: new Date(),
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
// FINANCIAL HEALTH SCORE
// ===========================================

// GET /api/finance/health-score - Get or calculate financial health score
router.get(
  '/health-score',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Get existing score or calculate new one
      let score = await prisma.financialHealthScore.findUnique({
        where: { userId },
      });

      if (!score) {
        // Calculate initial score based on user data
        const [savingsGoals, superAccounts, insuranceApps] = await Promise.all([
          prisma.savingsGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
          prisma.superannuationAccount.findMany({ where: { userId } }),
          prisma.insuranceApplication.findMany({ where: { userId, status: 'ACTIVE' } }),
        ]);

        // Simple scoring algorithm
        let emergencyFundScore = 0;
        const emergencyGoal = savingsGoals.find((g) => g.type === 'EMERGENCY_FUND');
        if (emergencyGoal) {
          const progress = emergencyGoal.currentAmount.toNumber() / emergencyGoal.targetAmount.toNumber();
          emergencyFundScore = Math.min(100, Math.round(progress * 100));
        }

        const superScore = superAccounts.length > 0 ? 60 : 20;
        const insuranceScore = insuranceApps.length > 0 ? 70 : 30;
        const savingsRateScore = savingsGoals.length > 0 ? 50 : 20;

        const overallScore = Math.round(
          (emergencyFundScore * 0.3) +
          (superScore * 0.25) +
          (insuranceScore * 0.25) +
          (savingsRateScore * 0.2)
        );

        score = await prisma.financialHealthScore.create({
          data: {
            userId,
            overallScore,
            emergencyFundScore,
            superScore,
            insuranceScore,
            savingsRateScore,
            recommendations: {
              items: [
                emergencyFundScore < 50 && 'Build your emergency fund to cover 3-6 months of expenses',
                superScore < 70 && 'Consider salary sacrificing into your super',
                insuranceScore < 50 && 'Review your income protection options',
                savingsRateScore < 50 && 'Set up automatic savings transfers',
              ].filter(Boolean),
            },
          },
        });
      }

      res.json({
        success: true,
        data: score,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/finance/health-score/recalculate - Force recalculation
router.post(
  '/health-score/recalculate',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Delete existing and recalculate
      await prisma.financialHealthScore.deleteMany({ where: { userId } });

      // Redirect to GET which will create new score
      const [savingsGoals, superAccounts, insuranceApps] = await Promise.all([
        prisma.savingsGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
        prisma.superannuationAccount.findMany({ where: { userId } }),
        prisma.insuranceApplication.findMany({ where: { userId, status: 'ACTIVE' } }),
      ]);

      let emergencyFundScore = 0;
      const emergencyGoal = savingsGoals.find((g) => g.type === 'EMERGENCY_FUND');
      if (emergencyGoal) {
        const progress = emergencyGoal.currentAmount.toNumber() / emergencyGoal.targetAmount.toNumber();
        emergencyFundScore = Math.min(100, Math.round(progress * 100));
      }

      const superScore = superAccounts.length > 0 ? 60 : 20;
      const insuranceScore = insuranceApps.length > 0 ? 70 : 30;
      const savingsRateScore = savingsGoals.length > 0 ? 50 : 20;

      const overallScore = Math.round(
        (emergencyFundScore * 0.3) +
        (superScore * 0.25) +
        (insuranceScore * 0.25) +
        (savingsRateScore * 0.2)
      );

      const score = await prisma.financialHealthScore.create({
        data: {
          userId,
          overallScore,
          emergencyFundScore,
          superScore,
          insuranceScore,
          savingsRateScore,
          recommendations: {
            items: [
              emergencyFundScore < 50 && 'Build your emergency fund to cover 3-6 months of expenses',
              superScore < 70 && 'Consider salary sacrificing into your super',
              insuranceScore < 50 && 'Review your income protection options',
              savingsRateScore < 50 && 'Set up automatic savings transfers',
            ].filter(Boolean),
          },
        },
      });

      res.json({
        success: true,
        data: score,
        message: 'Financial health score recalculated',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
