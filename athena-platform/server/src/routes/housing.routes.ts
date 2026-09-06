import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ===========================================
// HOUSING LISTINGS
// ===========================================

// GET /api/housing/listings - List available housing
router.get('/listings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      type,
      city,
      state,
      minRent,
      maxRent,
      bedrooms,
      dvSafe,
      petFriendly,
      accessible,
      page = '1',
      limit = '20',
    } = req.query;

    const where: any = {
      status: 'ACTIVE',
    };

    if (type) where.type = type;
    if (city) where.city = { contains: city as string, mode: 'insensitive' };
    if (state) where.state = state;
    if (minRent || maxRent) {
      where.rentWeekly = {};
      if (minRent) where.rentWeekly.gte = Number(minRent);
      if (maxRent) where.rentWeekly.lte = Number(maxRent);
    }
    if (bedrooms) where.bedrooms = { gte: Number(bedrooms) };
    if (dvSafe === 'true') where.dvSafe = true;
    if (petFriendly === 'true') where.petFriendly = true;
    if (accessible === 'true') where.accessibleUnit = true;

    const skip = (Number(page) - 1) * Number(limit);

    const [listings, total] = await Promise.all([
      prisma.housingListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.housingListing.count({ where }),
    ]);

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/housing/listings/:id - Get listing details
router.get('/listings/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const listing = await prisma.housingListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new ApiError(404, 'Housing listing not found');
    }

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/housing/listings/:id/inquire - Inquire about a listing
router.post(
  '/listings/:id/inquire',
  authenticate,
  [body('message').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { message } = req.body;

      const listing = await prisma.housingListing.findUnique({ where: { id } });
      if (!listing) {
        throw new ApiError(404, 'Housing listing not found');
      }

      if (listing.status !== 'ACTIVE') {
        throw new ApiError(400, 'This listing is no longer available');
      }

      // Check existing inquiry
      const existing = await prisma.housingInquiry.findUnique({
        where: { listingId_userId: { listingId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already inquired about this listing');
      }

      const inquiry = await prisma.housingInquiry.create({
        data: {
          listingId: id,
          userId,
          message,
          status: 'PENDING',
        },
        include: {
          listing: true,
        },
      });

      logger.info(`User ${userId} inquired about housing listing ${id}`);

      res.status(201).json({
        success: true,
        data: inquiry,
        message: 'Inquiry submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/housing/my/inquiries - Get user's housing inquiries
router.get(
  '/my/inquiries',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const inquiries = await prisma.housingInquiry.findMany({
        where: { userId },
        include: {
          listing: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: inquiries,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/housing/inquiries/:id - Update inquiry status
router.patch(
  '/inquiries/:id',
  authenticate,
  [
    // The person asking can say they have applied, or withdraw. The outcome
    // is the agent's to record, on the route below.
    body('status').optional().isIn(['APPLICATION_SUBMITTED', 'WITHDRAWN']),
    body('viewingDate').optional().isISO8601(),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { status, viewingDate, notes } = req.body;

      const inquiry = await prisma.housingInquiry.findUnique({ where: { id } });
      if (!inquiry) {
        throw new ApiError(404, 'Inquiry not found');
      }

      if (inquiry.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this inquiry');
      }

      const updated = await prisma.housingInquiry.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(viewingDate && { viewingDate: new Date(viewingDate) }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          listing: true,
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
// ADMIN: CREATE LISTINGS (for agents/admins)
// ===========================================

router.post(
  '/listings',
  authenticate,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('type').isIn(['RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL']),
    body('rentWeekly').optional().isNumeric(),
    body('bedrooms').optional().isInt({ min: 0 }),
    body('bathrooms').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const {
        title,
        description,
        type,
        address,
        suburb,
        city,
        state,
        postcode,
        country,
        rentWeekly,
        bondAmount,
        bedrooms,
        bathrooms,
        parking,
        features,
        safetyVerified,
        dvSafe,
        petFriendly,
        accessibleUnit,
        availableFrom,
        minLeaseTerm,
        flexibleLease,
        images,
      } = req.body;

      const listing = await prisma.housingListing.create({
        data: {
          agentId: userId,
          title,
          description,
          type,
          address,
          suburb,
          city,
          state,
          postcode,
          country: country || 'Australia',
          rentWeekly: rentWeekly ? Number(rentWeekly) : undefined,
          bondAmount: bondAmount ? Number(bondAmount) : undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          bathrooms: bathrooms ? Number(bathrooms) : undefined,
          parking: parking ? Number(parking) : undefined,
          features: features || [],
          safetyVerified: safetyVerified || false,
          dvSafe: dvSafe || false,
          petFriendly: petFriendly || false,
          accessibleUnit: accessibleUnit || false,
          availableFrom: availableFrom ? new Date(availableFrom) : undefined,
          minLeaseTerm: minLeaseTerm ? Number(minLeaseTerm) : undefined,
          flexibleLease: flexibleLease || false,
          images,
          status: 'ACTIVE',
        },
      });

      logger.info(`Housing listing created: ${listing.id}`);

      res.status(201).json({
        success: true,
        data: listing,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// THE AGENT'S SIDE: YOUR LISTINGS AND THEIR INQUIRIES
// ===========================================
// The member who listed a place answers the people asking about it, and the
// asker is told in the app the moment something changes.

// GET /api/housing/my/listings
router.get('/my/listings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listings = await prisma.housingListing.findMany({
      where: { agentId: req.user!.id },
      include: {
        inquiries: {
          include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: listings });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/housing/listings/:id - Change a listing you made (status, price, availability)
router.patch(
  '/listings/:id',
  authenticate,
  [
    body('status').optional().isIn(['ACTIVE', 'PENDING', 'LEASED', 'WITHDRAWN']),
    body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('rentWeekly').optional().isNumeric(),
    body('availableFrom').optional({ values: 'falsy' }).isISO8601(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { id } = req.params;
      const listing = await prisma.housingListing.findUnique({ where: { id }, select: { id: true, agentId: true } });
      if (!listing) {
        throw new ApiError(404, 'Housing listing not found');
      }
      if (listing.agentId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Only the person who listed this place can change it');
      }

      const { status, title, description, rentWeekly, availableFrom, dvSafe, petFriendly, accessibleUnit } = req.body;
      const updated = await prisma.housingListing.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(typeof title === 'string' && { title: title.trim() }),
          ...(typeof description === 'string' && { description }),
          ...(rentWeekly !== undefined && rentWeekly !== '' && { rentWeekly: Number(rentWeekly) }),
          ...(availableFrom && { availableFrom: new Date(availableFrom) }),
          ...(typeof dvSafe === 'boolean' && { dvSafe }),
          ...(typeof petFriendly === 'boolean' && { petFriendly }),
          ...(typeof accessibleUnit === 'boolean' && { accessibleUnit }),
        },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/housing/listings/:listingId/inquiries/:id - Answer someone asking about your place
router.patch(
  '/listings/:listingId/inquiries/:id',
  authenticate,
  [
    body('status').isIn(['CONTACTED', 'VIEWING_SCHEDULED', 'APPROVED', 'DECLINED']),
    body('viewingDate').optional({ values: 'falsy' }).isISO8601(),
    body('message').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { listingId, id } = req.params;
      const { status, viewingDate, message } = req.body as { status: string; viewingDate?: string; message?: string };

      const inquiry = await prisma.housingInquiry.findUnique({
        where: { id },
        include: { listing: { select: { id: true, title: true, agentId: true } } },
      });
      if (!inquiry || inquiry.listingId !== listingId) {
        throw new ApiError(404, 'Inquiry not found');
      }
      if (inquiry.listing.agentId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Only the person who listed this place can answer inquiries');
      }
      if (status === 'VIEWING_SCHEDULED' && !viewingDate) {
        throw new ApiError(400, 'A viewing needs a date');
      }

      const updated = await prisma.housingInquiry.update({
        where: { id },
        data: {
          status: status as any,
          ...(viewingDate && { viewingDate: new Date(viewingDate) }),
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true } } },
      });

      const when = viewingDate
        ? new Date(viewingDate).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Brisbane' })
        : '';
      const said: Record<string, string> = {
        CONTACTED: `The agent has been in touch about "${inquiry.listing.title}".`,
        VIEWING_SCHEDULED: `A viewing of "${inquiry.listing.title}" is booked for ${when}.`,
        APPROVED: `Your application for "${inquiry.listing.title}" was approved.`,
        DECLINED: `Your inquiry about "${inquiry.listing.title}" was not successful.`,
      };
      await prisma.notification.create({
        data: {
          userId: inquiry.userId,
          type: 'SYSTEM',
          title: 'Housing update',
          message: `${said[status]}${message ? ` ${message.trim()}` : ''}`,
          link: '/dashboard/housing',
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
