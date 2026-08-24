import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// ===========================================
// LIST SERVICES
// ===========================================
router.get('/services', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const minRate = typeof req.query.minRate === 'string' ? parseInt(req.query.minRate, 10) : undefined;
    const maxRate = typeof req.query.maxRate === 'string' ? parseInt(req.query.maxRate, 10) : undefined;

    const where: any = {
      status: 'ACTIVE',
      isAvailable: true,
    };

    if (category) where.category = category;
    if (minRate) where.hourlyRate = { gte: minRate };
    if (maxRate) where.hourlyRate = { ...(where.hourlyRate || {}), lte: maxRate };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.skillService.findMany({
        where,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
        },
      }),
      prisma.skillService.count({ where }),
    ]);

    res.json({
      success: true,
      data: services,
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
// CREATE SERVICE
// ===========================================
router.post(
  '/services',
  authenticate,
  [
    body('title').isString().notEmpty().isLength({ max: 200 }),
    body('description').isString().notEmpty().isLength({ max: 5000 }),
    body('category').isIn(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING']),
    body('hourlyRate').isInt({ min: 1 }),
    body('minimumHours').optional().isFloat({ min: 0.5 }),
    body('isAvailable').optional().isBoolean(),
    body('availabilityJson').optional(),
    body('tags').optional().isArray(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const created = await prisma.skillService.create({
        data: {
          providerId: req.user!.id,
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          hourlyRate: req.body.hourlyRate,
          minimumHours: req.body.minimumHours,
          isAvailable: req.body.isAvailable ?? true,
          availabilityJson: req.body.availabilityJson,
          tags: req.body.tags || [],
        },
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// CATEGORIES
// ===========================================
// Every category in the enum is listed, each with a live count, so the filter
// UI can show the full set and still indicate which ones have nothing in them.
const SERVICE_CATEGORIES = ['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING'] as const;

router.get('/categories', optionalAuth, async (_req: AuthRequest, res, next) => {
  try {
    const counts = await prisma.skillService.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE', isAvailable: true },
      _count: { _all: true },
    });

    const countByCategory = new Map(counts.map((c) => [c.category, c._count._all]));

    res.json({
      success: true,
      data: SERVICE_CATEGORIES.map((category) => ({
        category,
        count: countByCategory.get(category) ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MY SERVICES
// ===========================================
// Above '/services/:id', or "me" is read as a service id.
router.get('/services/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // The provider sees their paused and archived listings too, not just the
    // ACTIVE ones the public list route returns.
    const services = await prisma.skillService.findMany({
      where: { providerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true, bookings: true, reviews: true, favorites: true } },
      },
    });

    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET SERVICE
// ===========================================
router.get('/services/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const service = await prisma.skillService.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE SERVICE
// ===========================================
router.patch(
  '/services/:id',
  authenticate,
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('category').optional().isIn(['PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING']),
    body('status').optional().isIn(['ACTIVE', 'PAUSED', 'ARCHIVED']),
    body('hourlyRate').optional().isInt({ min: 1 }),
    body('minimumHours').optional().isFloat({ min: 0.5 }),
    body('isAvailable').optional().isBoolean(),
    body('availabilityJson').optional(),
    body('tags').optional().isArray(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const service = await prisma.skillService.findUnique({ where: { id } });
      if (!service) {
        throw new ApiError(404, 'Service not found');
      }

      if (service.providerId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const updated = await prisma.skillService.update({
        where: { id },
        data: {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          status: req.body.status,
          hourlyRate: req.body.hourlyRate,
          minimumHours: req.body.minimumHours,
          isAvailable: req.body.isAvailable,
          availabilityJson: req.body.availabilityJson,
          tags: req.body.tags,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// BOOK SERVICE
// ===========================================
router.post(
  '/services/:id/book',
  authenticate,
  [
    body('scheduledAt').isISO8601(),
    body('durationMinutes').isInt({ min: 30 }),
    body('clientNotes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const service = await prisma.skillService.findUnique({ where: { id } });
      if (!service || !service.isAvailable || service.status !== 'ACTIVE') {
        throw new ApiError(404, 'Service not available');
      }

      const durationMinutes = req.body.durationMinutes;
      const hours = Math.max(service.minimumHours || 1, durationMinutes / 60);
      const totalAmount = Math.round(service.hourlyRate * hours);
      const platformFee = Math.round(totalAmount * 0.2);
      const providerPayout = totalAmount - platformFee;

      const booking = await prisma.serviceBooking.create({
        data: {
          serviceId: id,
          clientId: req.user!.id,
          scheduledAt: new Date(req.body.scheduledAt),
          durationMinutes,
          totalAmount,
          platformFee,
          providerPayout,
          clientNotes: req.body.clientNotes,
        },
      });

      res.status(201).json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// MY BOOKINGS
// ===========================================
router.get('/bookings/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : 'all';

    const where: any = {};
    if (role === 'client') {
      where.clientId = req.user!.id;
    } else if (role === 'provider') {
      where.service = { providerId: req.user!.id };
    } else {
      where.OR = [
        { clientId: req.user!.id },
        { service: { providerId: req.user!.id } },
      ];
    }

    const bookings = await prisma.serviceBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        service: { include: { provider: { select: { id: true, displayName: true, avatar: true } } } },
      },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE BOOKING STATUS
// ===========================================
router.patch(
  '/bookings/:id',
  authenticate,
  [body('status').isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const booking = await prisma.serviceBooking.findUnique({
        where: { id },
        include: { service: true },
      });

      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      const isClient = booking.clientId === req.user!.id;
      const isProvider = booking.service.providerId === req.user!.id;

      if (!isClient && !isProvider && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const updated = await prisma.serviceBooking.update({
        where: { id },
        data: {
          status: req.body.status,
          completedAt: req.body.status === 'COMPLETED' ? new Date() : undefined,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REVIEW SERVICE
// ===========================================
router.post(
  '/services/:id/reviews',
  authenticate,
  [body('rating').isInt({ min: 1, max: 5 }), body('content').optional().isString(), body('bookingId').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const service = await prisma.skillService.findUnique({ where: { id } });
      if (!service) {
        throw new ApiError(404, 'Service not found');
      }

      const review = await prisma.serviceReview.create({
        data: {
          serviceId: id,
          clientId: req.user!.id,
          rating: req.body.rating,
          content: req.body.content,
          bookingId: req.body.bookingId,
        },
      });

      const stats = await prisma.serviceReview.aggregate({
        where: { serviceId: id, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.skillService.update({
        where: { id },
        data: {
          rating: stats._avg.rating ?? undefined,
          reviewCount: stats._count.rating,
        },
      });

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LIST REVIEWS FOR A SERVICE
// ===========================================
router.get('/services/:id/reviews', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;

    const service = await prisma.skillService.findUnique({
      where: { id },
      select: { id: true, rating: true, reviewCount: true },
    });
    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    const where = { serviceId: id, isHidden: false };
    const [reviews, total] = await Promise.all([
      prisma.serviceReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { client: { select: { id: true, displayName: true, avatar: true } } },
      }),
      prisma.serviceReview.count({ where }),
    ]);

    res.json({
      success: true,
      data: reviews,
      summary: { rating: service.rating, reviewCount: service.reviewCount },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE (ARCHIVE) A SERVICE
// ===========================================
// Archived rather than deleted: orders, bookings and reviews reference the
// service and cascade on delete, so removing the row would erase a provider's
// trading history along with it.
router.delete('/services/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const service = await prisma.skillService.findUnique({ where: { id } });
    if (!service) {
      throw new ApiError(404, 'Service not found');
    }
    if (service.providerId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    const archived = await prisma.skillService.update({
      where: { id },
      data: { status: 'ARCHIVED', isAvailable: false },
    });

    res.json({ success: true, data: archived, message: 'Service archived' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SELLER PROFILE
// ===========================================
router.get('/sellers/:userId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    const seller = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatar: true,
        headline: true,
        bio: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
      },
    });
    if (!seller) {
      throw new ApiError(404, 'Seller not found');
    }

    const services = await prisma.skillService.findMany({
      where: { providerId: userId, status: 'ACTIVE' },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });

    // Rating across every listing, weighted by how many reviews each carries,
    // rather than an unweighted mean of the per-service averages.
    const [ratingStats, completedOrders] = await Promise.all([
      prisma.serviceReview.aggregate({
        where: { service: { providerId: userId }, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.serviceOrder.count({
        where: { service: { providerId: userId }, status: 'COMPLETED' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        seller,
        services,
        stats: {
          serviceCount: services.length,
          rating: ratingStats._avg.rating,
          reviewCount: ratingStats._count.rating,
          completedOrders,
          memberSince: seller.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// FAVOURITES
// ===========================================
router.get('/favorites', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const favorites = await prisma.serviceFavorite.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          include: {
            provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
          },
        },
      },
    });

    res.json({ success: true, data: favorites.map((f) => f.service) });
  } catch (error) {
    next(error);
  }
});

router.post('/services/:id/favorite', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const service = await prisma.skillService.findUnique({ where: { id } });
    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    await prisma.serviceFavorite.upsert({
      where: { serviceId_userId: { serviceId: id, userId: req.user!.id } },
      update: {},
      create: { serviceId: id, userId: req.user!.id },
    });

    res.status(201).json({ success: true, message: 'Service favourited' });
  } catch (error) {
    next(error);
  }
});

router.delete('/services/:id/favorite', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.serviceFavorite.deleteMany({
      where: { serviceId: id, userId: req.user!.id },
    });

    res.json({ success: true, message: 'Favourite removed' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PACKAGE ORDERS
// ===========================================
// Distinct from /services/:id/book. A booking buys a block of the provider's
// time; an order buys one of the fixed-scope packages listed on the service.
interface ServicePackage {
  name?: string;
  price?: number;
  deliveryDays?: number;
}

router.post(
  '/services/:id/order',
  authenticate,
  [
    body('packageIndex').isInt({ min: 0 }),
    body('requirements').optional().isString().isLength({ max: 5000 }),
    body('attachments').optional().isArray({ max: 10 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const service = await prisma.skillService.findUnique({ where: { id } });
      if (!service || !service.isAvailable || service.status !== 'ACTIVE') {
        throw new ApiError(404, 'Service not available');
      }

      if (service.providerId === req.user!.id) {
        throw new ApiError(400, 'You cannot order your own service');
      }

      const packages = Array.isArray(service.packages)
        ? (service.packages as unknown as ServicePackage[])
        : [];
      const packageIndex = Number(req.body.packageIndex);
      const selected = packages[packageIndex];

      if (!selected || typeof selected.price !== 'number') {
        throw new ApiError(400, 'Selected package is not available for this service');
      }

      const totalAmount = Math.round(selected.price);
      const platformFee = Math.round(totalAmount * 0.2);
      const deliveryDays =
        typeof selected.deliveryDays === 'number' ? selected.deliveryDays : null;

      const order = await prisma.serviceOrder.create({
        data: {
          serviceId: id,
          clientId: req.user!.id,
          packageIndex,
          packageName: selected.name ?? null,
          requirements: typeof req.body.requirements === 'string' ? req.body.requirements : null,
          attachments: Array.isArray(req.body.attachments)
            ? req.body.attachments.filter((a: unknown): a is string => typeof a === 'string')
            : [],
          totalAmount,
          platformFee,
          providerPayout: totalAmount - platformFee,
          deliveryDays,
          dueAt: deliveryDays ? new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000) : null,
        },
      });

      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/orders/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const orders = await prisma.serviceOrder.findMany({
      where: { clientId: req.user!.id, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          include: {
            provider: { select: { id: true, displayName: true, avatar: true } },
          },
        },
      },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ORDERS RECEIVED (AS PROVIDER)
// ===========================================
// Above '/orders/:id', or "received" is read as an order id.
router.get('/orders/received', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const orders = await prisma.serviceOrder.findMany({
      where: {
        service: { providerId: req.user!.id },
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, title: true, category: true } },
        client: { select: { id: true, displayName: true, avatar: true } },
      },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ORDER LIFECYCLE
// ===========================================

// PENDING -> ACCEPTED -> DELIVERED -> COMPLETED, with REVISION_REQUESTED
// looping back to ACCEPTED and CANCELLED terminating early. Every transition
// route below checks against this table rather than trusting the caller.
const ORDER_TRANSITIONS: Record<string, { from: string[]; actor: 'client' | 'provider' | 'either' }> = {
  accept: { from: ['PENDING'], actor: 'provider' },
  deliver: { from: ['ACCEPTED', 'REVISION_REQUESTED'], actor: 'provider' },
  revision: { from: ['DELIVERED'], actor: 'client' },
  complete: { from: ['DELIVERED'], actor: 'client' },
  cancel: { from: ['PENDING', 'ACCEPTED', 'REVISION_REQUESTED'], actor: 'either' },
};

// Loads an order and establishes who the caller is to it. A user who is neither
// the buyer nor the provider is told the order does not exist rather than that
// it does but is not theirs.
async function loadOrderForActor(orderId: string, userId: string) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      service: { select: { id: true, title: true, providerId: true } },
      client: { select: { id: true, displayName: true, avatar: true } },
    },
  });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const isClient = order.clientId === userId;
  const isProvider = order.service.providerId === userId;
  if (!isClient && !isProvider) {
    throw new ApiError(404, 'Order not found');
  }

  return { order, isClient, isProvider };
}

function assertTransition(
  action: keyof typeof ORDER_TRANSITIONS,
  status: string,
  isClient: boolean,
  isProvider: boolean
) {
  const rule = ORDER_TRANSITIONS[action];

  const allowed =
    rule.actor === 'either' ? isClient || isProvider : rule.actor === 'client' ? isClient : isProvider;
  if (!allowed) {
    throw new ApiError(403, `Only the ${rule.actor} can ${action} this order`);
  }

  if (!rule.from.includes(status)) {
    throw new ApiError(400, `An order that is ${status} cannot be ${action === 'revision' ? 'sent back for revision' : `${action}ed`}`);
  }
}

router.get('/orders/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
    res.json({ success: true, data: { ...order, viewerRole: isProvider ? 'provider' : isClient ? 'client' : null } });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
    assertTransition('accept', order.status, isClient, isProvider);

    // The clock starts when the provider accepts, not when the order was placed.
    const dueAt = order.deliveryDays
      ? new Date(Date.now() + order.deliveryDays * 24 * 60 * 60 * 1000)
      : order.dueAt;

    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED', dueAt },
    });

    res.json({ success: true, data: updated, message: 'Order accepted' });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/orders/:id/deliver',
  authenticate,
  [
    body('message').optional().isString().isLength({ max: 5000 }),
    body('attachments').optional().isArray({ max: 10 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
      assertTransition('deliver', order.status, isClient, isProvider);

      const attachments = Array.isArray(req.body.attachments)
        ? req.body.attachments.filter((a: unknown): a is string => typeof a === 'string')
        : [];

      const updated = await prisma.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          deliveryMessage: typeof req.body.message === 'string' ? req.body.message : null,
          // Appended, not replaced: the buyer's original brief attachments stay
          // alongside the delivered work.
          ...(attachments.length ? { attachments: { set: [...order.attachments, ...attachments] } } : {}),
        },
      });

      res.json({ success: true, data: updated, message: 'Order delivered' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/orders/:id/revision',
  authenticate,
  [body('reason').isString().notEmpty().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
      assertTransition('revision', order.status, isClient, isProvider);

      const updated = await prisma.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: 'REVISION_REQUESTED',
          deliveredAt: null,
          revisionReason: req.body.reason,
        },
      });

      res.json({ success: true, data: updated, message: 'Revision requested' });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/orders/:id/complete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
    assertTransition('complete', order.status, isClient, isProvider);

    const [updated] = await prisma.$transaction([
      prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      prisma.skillService.update({
        where: { id: order.serviceId },
        data: { completedCount: { increment: 1 } },
      }),
    ]);

    res.json({ success: true, data: updated, message: 'Order completed' });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/orders/:id/cancel',
  authenticate,
  [body('reason').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
      assertTransition('cancel', order.status, isClient, isProvider);

      const updated = await prisma.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          // Records who-said-what without a separate column per side: the
          // status already says it was cancelled, and cancel is open to both.
          cancellationReason: typeof req.body.reason === 'string' ? req.body.reason : null,
        },
      });

      res.json({ success: true, data: updated, message: 'Order cancelled' });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REVIEW AN ORDER
// ===========================================
// Distinct from POST /services/:id/reviews, which takes a bookingId. This one
// is tied to a completed order, which is what actually proves the reviewer
// bought the thing they are rating.
router.post(
  '/orders/:id/review',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('review').optional().isString().isLength({ max: 5000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { order, isClient } = await loadOrderForActor(req.params.id, req.user!.id);
      if (!isClient) {
        throw new ApiError(403, 'Only the buyer can review this order');
      }
      if (order.status !== 'COMPLETED') {
        throw new ApiError(400, 'Only a completed order can be reviewed');
      }

      const existing = await prisma.serviceReview.findFirst({
        where: { serviceId: order.serviceId, clientId: req.user!.id, bookingId: order.id },
      });
      if (existing) {
        throw new ApiError(400, 'You have already reviewed this order');
      }

      const review = await prisma.serviceReview.create({
        data: {
          serviceId: order.serviceId,
          clientId: req.user!.id,
          // ServiceReview has no orderId column; bookingId is the generic
          // "what this review is attached to" slot and is what makes the
          // (serviceId, clientId, bookingId) uniqueness per-order.
          bookingId: order.id,
          rating: req.body.rating,
          content: typeof req.body.review === 'string' ? req.body.review : null,
        },
      });

      const stats = await prisma.serviceReview.aggregate({
        where: { serviceId: order.serviceId, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.skillService.update({
        where: { id: order.serviceId },
        data: {
          rating: stats._avg.rating ?? undefined,
          reviewCount: stats._count.rating,
        },
      });

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// CUSTOM REQUESTS
// ===========================================

// The reverse of a listing: a buyer posts a brief, providers pitch for it.
router.post(
  '/requests',
  authenticate,
  [
    body('title').isString().trim().notEmpty().isLength({ max: 200 }),
    body('description').isString().trim().notEmpty().isLength({ max: 5000 }),
    body('category').isIn(SERVICE_CATEGORIES),
    body('budget.min').isInt({ min: 0 }),
    body('budget.max').isInt({ min: 0 }),
    body('deliveryDays').isInt({ min: 1, max: 365 }),
    body('attachments').optional().isArray({ max: 10 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const budgetMin = Number(req.body.budget.min);
      const budgetMax = Number(req.body.budget.max);
      if (budgetMax < budgetMin) {
        throw new ApiError(400, 'budget.max cannot be below budget.min');
      }

      const request = await prisma.serviceRequest.create({
        data: {
          clientId: req.user!.id,
          title: req.body.title.trim(),
          description: req.body.description.trim(),
          category: req.body.category,
          budgetMin,
          budgetMax,
          deliveryDays: Number(req.body.deliveryDays),
          attachments: Array.isArray(req.body.attachments)
            ? req.body.attachments.filter((a: unknown): a is string => typeof a === 'string')
            : [],
        },
      });

      res.status(201).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  }
);

// Browse open requests to pitch on. The caller's own briefs are excluded —
// this is the sellers' view; buyers use /requests/me.
router.get('/requests', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const where: Record<string, unknown> = {
      status: 'OPEN',
      clientId: { not: req.user!.id },
      ...(category ? { category: category as never } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: { select: { id: true, displayName: true, avatar: true } },
          _count: { select: { proposals: true } },
          // Whether this provider has already pitched, so the UI can show
          // "proposal sent" instead of offering the button again.
          proposals: {
            where: { providerId: req.user!.id },
            select: { id: true, status: true },
          },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: requests.map(({ proposals, ...request }) => ({
        ...request,
        myProposal: proposals[0] ?? null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// Above '/requests/:id'.
router.get('/requests/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { clientId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { proposals: true } } },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

router.get('/requests/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, displayName: true, avatar: true } },
        _count: { select: { proposals: true } },
      },
    });

    if (!request) {
      throw new ApiError(404, 'Request not found');
    }

    // Proposals and their prices are the buyer's to see. A provider gets the
    // brief plus their own pitch, not the competition's.
    const isOwner = request.clientId === req.user!.id;
    const proposals = await prisma.serviceProposal.findMany({
      where: { requestId: request.id, ...(isOwner ? {} : { providerId: req.user!.id }) },
      orderBy: { createdAt: 'asc' },
      include: {
        provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
      },
    });

    res.json({ success: true, data: { ...request, proposals, isOwner } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/requests/:id/proposal',
  authenticate,
  [
    body('message').isString().trim().notEmpty().isLength({ max: 5000 }),
    body('price').isInt({ min: 0 }),
    body('deliveryDays').isInt({ min: 1, max: 365 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
      if (!request) {
        throw new ApiError(404, 'Request not found');
      }
      if (request.clientId === req.user!.id) {
        throw new ApiError(400, 'You cannot pitch for your own request');
      }
      if (request.status !== 'OPEN') {
        throw new ApiError(400, 'This request is no longer accepting proposals');
      }

      const payload = {
        message: req.body.message.trim(),
        price: Number(req.body.price),
        deliveryDays: Number(req.body.deliveryDays),
      };

      // Re-pitching revises the existing proposal rather than failing on the
      // unique constraint, and puts it back in the running if it was declined.
      const proposal = await prisma.serviceProposal.upsert({
        where: { requestId_providerId: { requestId: request.id, providerId: req.user!.id } },
        create: { requestId: request.id, providerId: req.user!.id, ...payload },
        update: { ...payload, status: 'PENDING' },
      });

      res.status(201).json({ success: true, data: proposal });
    } catch (error) {
      next(error);
    }
  }
);

// The buyer picks a winner: that proposal is accepted, the rest are declined,
// and the brief stops taking pitches.
router.post('/requests/:id/proposals/:proposalId/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id, proposalId } = req.params;

    const request = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!request) {
      throw new ApiError(404, 'Request not found');
    }
    if (request.clientId !== req.user!.id) {
      throw new ApiError(403, 'Only the buyer can accept a proposal');
    }
    if (request.status !== 'OPEN') {
      throw new ApiError(400, 'This request has already been settled');
    }

    const proposal = await prisma.serviceProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.requestId !== id) {
      throw new ApiError(404, 'Proposal not found');
    }

    const [accepted] = await prisma.$transaction([
      prisma.serviceProposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.serviceProposal.updateMany({
        where: { requestId: id, id: { not: proposalId }, status: 'PENDING' },
        data: { status: 'DECLINED' },
      }),
      prisma.serviceRequest.update({
        where: { id },
        data: { status: 'AWARDED', closedAt: new Date() },
      }),
    ]);

    res.json({ success: true, data: accepted, message: 'Proposal accepted' });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/close', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
    if (!request) {
      throw new ApiError(404, 'Request not found');
    }
    if (request.clientId !== req.user!.id) {
      throw new ApiError(403, 'Only the buyer can close this request');
    }
    if (request.status !== 'OPEN') {
      return res.json({ success: true, message: 'Request is already closed' });
    }

    const [closed] = await prisma.$transaction([
      prisma.serviceRequest.update({
        where: { id: req.params.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      }),
      prisma.serviceProposal.updateMany({
        where: { requestId: req.params.id, status: 'PENDING' },
        data: { status: 'DECLINED' },
      }),
    ]);

    res.json({ success: true, data: closed, message: 'Request closed' });
  } catch (error) {
    next(error);
  }
});

export default router;
