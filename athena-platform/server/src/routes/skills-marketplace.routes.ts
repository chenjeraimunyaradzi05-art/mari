import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditAfterCommit } from '../services/admin-audit.service';
import { notifyAdmins } from '../services/admin-notify.service';
import {
  cancelEscrowPayment,
  captureEscrowPayment,
  createEscrowPayment,
  getEscrowClientSecret,
  openCardDisputeOn,
} from '../services/stripe-connect.service';
import { answerOrderDispute, forMember, openOrderDispute } from '../services/service-disputes.service';
import { bestEffort } from '../utils/best-effort';
import { parsePagination } from '../utils/pagination';
import { startingAPayment } from '../middleware/moneyLimits';
import { askBuyerToRenew, describeOrderHold, startOrderReauthorisation } from '../services/escrow-renewal.service';
import { holdDeadlineOf } from '../services/escrow-deadline';
import { idempotencyWindow } from '../utils/idempotency';

const router = Router();

// The browse routes keep the tighter ceiling they have always had; a member
// reading her own orders, bookings or briefs gets the platform-wide one.
const BROWSE_PAGE_MAX = 50;

/**
 * Who is signed in. Every route that calls it sits behind authenticate, which has
 * already refused a request with no member; this says so to the compiler by
 * checking, where `req.user!` said it by assertion and would have gone on saying it
 * for a handler registered without the middleware.
 */
function signedIn(req: AuthRequest): NonNullable<AuthRequest['user']> {
  if (!req.user) throw new ApiError(401, 'Sign in to continue');
  return req.user;
}

/** A row refused because another already holds the unique value it carries. */
function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002';
}

/**
 * Marks which of these services the viewer has saved.
 *
 * The card renders a heart toggle, so without this every service came back
 * looking unsaved and the icon reset on each load. One query for the page
 * rather than one per row.
 */
async function withFavoriteState<T extends { id: string }>(items: T[], userId?: string) {
  if (!userId || items.length === 0) {
    return items.map((item) => ({ ...item, isFavorite: false }));
  }

  const favorites = await prisma.serviceFavorite.findMany({
    where: { userId, serviceId: { in: items.map((i) => i.id) } },
    select: { serviceId: true },
  });
  const favorited = new Set(favorites.map((f) => f.serviceId));

  return items.map((item) => ({ ...item, isFavorite: favorited.has(item.id) }));
}

// ===========================================
// LIST SERVICES
// ===========================================
router.get('/services', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string }, BROWSE_PAGE_MAX);
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
        skip,
        take: limit,
        include: {
          provider: { select: { id: true, displayName: true, avatar: true, headline: true } },
        },
      }),
      prisma.skillService.count({ where }),
    ]);

    res.json({
      success: true,
      data: await withFavoriteState(services, req.user?.id),
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
// SERVICE PACKAGES
// ===========================================
// `SkillService.packages` is the fixed-scope side of the marketplace, and it is
// what `POST /services/:id/order` reads to price the escrow hold. Neither the
// create nor the update route used to accept it, so the column was null on
// every listing and the whole order path answered "Selected package is not
// available for this service" no matter what a buyer clicked. A seller can now
// put packages on her listing; a listing with none is still perfectly valid and
// simply sells by the hour.
//
// It is a Json column, so what a caller sends is rebuilt field by field rather
// than stored as given: an unrecognised key on a package would otherwise sit in
// the payload the buyer's order is priced against.
const MAX_PACKAGES = 5;

interface StoredPackage {
  name: string;
  description: string | null;
  price: number;
  deliveryDays: number;
  revisions: number | null;
  features: string[];
}

function normalisePackages(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value)) return [];

  const packages: StoredPackage[] = value.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const revisions = Number(entry.revisions);

    return {
      name: String(entry.name).trim(),
      description: typeof entry.description === 'string' ? entry.description.trim() : null,
      price: Math.round(Number(entry.price)),
      deliveryDays: Math.round(Number(entry.deliveryDays)),
      revisions: Number.isFinite(revisions) ? Math.round(revisions) : null,
      features: Array.isArray(entry.features)
        ? entry.features.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).slice(0, 10)
        : [],
    };
  });

  // Prisma types a Json column as its own union rather than as the object
  // being stored, so the shape has to be handed over as plain JSON.
  return packages as unknown as Prisma.InputJsonValue;
}

/**
 * Rejects the package list the buyer would otherwise be quoted from. Prices are
 * whole dollars because the order route multiplies by 100 for Stripe, and a
 * delivery window has to be a real number of days because it becomes the
 * order's due date.
 */
function assertPackagesAreSellable(value: unknown): true {
  if (!Array.isArray(value)) {
    throw new Error('Packages must be a list');
  }
  if (value.length > MAX_PACKAGES) {
    throw new Error(`A service can offer at most ${MAX_PACKAGES} packages`);
  }

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Each package must be an object');
    }
    const entry = item as Record<string, unknown>;

    if (typeof entry.name !== 'string' || entry.name.trim().length === 0 || entry.name.length > 120) {
      throw new Error('Each package needs a name of up to 120 characters');
    }
    if (typeof entry.description === 'string' && entry.description.length > 2000) {
      throw new Error('A package description can be up to 2000 characters');
    }
    const price = Number(entry.price);
    if (!Number.isInteger(price) || price < 1) {
      throw new Error('Each package needs a price of at least $1, in whole dollars');
    }
    const deliveryDays = Number(entry.deliveryDays);
    if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
      throw new Error('Each package needs a delivery time between 1 and 365 days');
    }
    if (entry.revisions !== undefined && entry.revisions !== null) {
      const revisions = Number(entry.revisions);
      if (!Number.isInteger(revisions) || revisions < 0 || revisions > 20) {
        throw new Error('Revisions must be a whole number between 0 and 20');
      }
    }
    if (entry.features !== undefined && !Array.isArray(entry.features)) {
      throw new Error('Package features must be a list');
    }
  }

  return true;
}

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
    body('packages').optional().custom(assertPackagesAreSellable),
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
          packages: req.body.packages === undefined ? undefined : normalisePackages(req.body.packages),
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
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    // The provider sees their paused and archived listings too, not just the
    // ACTIVE ones the public list route returns.
    const services = await prisma.skillService.findMany({
      where: { providerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
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
        // The listing shows the latest few underneath the description; the
        // whole history is read a page at a time from /services/:id/reviews.
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
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
    body('packages').optional().custom(assertPackagesAreSellable),
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
          packages: req.body.packages === undefined ? undefined : normalisePackages(req.body.packages),
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
// A booking is paid the way a package order is: the money is held on the
// buyer's card when the time is asked for, the provider can confirm only once
// the hold is real, and it is taken only when the buyer says the time was
// given. Until this the booking recorded a total and a payout that no money
// ever backed, and either side could mark it COMPLETED.

// A card authorisation lives about seven days, and the booking's money sits on
// the buyer's card until the buyer releases it. A session that would end after the
// authorisation has gone would leave the provider with nothing to be paid
// from, so a booking has to be over inside this window, with room left for the
// buyer to release it.
const BOOKING_HORIZON_DAYS = 5;

const LONGEST_BOOKING_MINUTES = 480;

router.post(
  '/services/:id/book',
  authenticate,
  startingAPayment,
  [
    body('scheduledAt').isISO8601(),
    body('durationMinutes').isInt({ min: 30, max: LONGEST_BOOKING_MINUTES }),
    body('clientNotes').optional().isString().isLength({ max: 2000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const me = signedIn(req);
      const { id } = req.params;
      const service = await prisma.skillService.findUnique({ where: { id } });
      if (!service || !service.isAvailable || service.status !== 'ACTIVE') {
        throw new ApiError(404, 'Service not available');
      }

      if (service.providerId === me.id) {
        throw new ApiError(400, 'You cannot book your own service');
      }

      const durationMinutes = Number(req.body.durationMinutes);
      const scheduledAt = new Date(req.body.scheduledAt);
      const hours = Math.max(service.minimumHours || 1, durationMinutes / 60);
      const totalAmount = Math.round(service.hourlyRate * hours);

      if (!(totalAmount >= 1)) {
        throw new ApiError(400, 'This listing has no hourly rate, so it cannot be booked by the hour');
      }

      if (scheduledAt.getTime() <= Date.now()) {
        throw new ApiError(400, 'Pick a time in the future');
      }

      // The end of the time actually billed, which the listing's minimum can
      // stretch beyond the length that was asked for.
      const endsAt = scheduledAt.getTime() + Math.round(hours * 60) * 60 * 1000;
      if (endsAt > Date.now() + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
        throw new ApiError(
          400,
          `Bookings can be made for a time within the next ${BOOKING_HORIZON_DAYS} days. The payment is held on your card until the session is done, and a card only holds money for about a week.`
        );
      }

      // The same buyer asking twice for the same time, which is a double tap or a
      // retry after a timeout, is one booking. Without this each press holds the
      // price on the buyer's card again.
      const alreadyAsked = await prisma.serviceBooking.findFirst({
        where: { serviceId: id, clientId: me.id, scheduledAt, status: { in: ['PENDING', 'CONFIRMED'] } },
        select: { id: true },
      });
      if (alreadyAsked) {
        throw new ApiError(409, 'You have already asked for that time. You will find it in your bookings.');
      }

      // The money is held on the buyer's card now. A provider who has not set
      // up payouts cannot be paid, so cannot be booked yet. Prices are whole
      // dollars; Stripe wants cents.
      let hold: Awaited<ReturnType<typeof createEscrowPayment>>;
      try {
        hold = await createEscrowPayment({
          buyerId: me.id,
          sellerId: service.providerId,
          amount: totalAmount * 100,
          currency: 'aud',
          description: `${service.title} (${durationMinutes} minute booking)`,
          sessionType: 'service_booking',
          metadata: { serviceId: id },
          // The check above catches a second ask that arrives after the first
          // is saved; two that arrive together both read nothing and both
          // reach Stripe. Keyed on the buyer, the listing, the time asked for
          // and the minute, those two are handed one hold, and the one whose
          // insert loses below is answered with the booking the other saved.
          idempotencyKey: `service-booking-hold-${me.id}-${id}-${scheduledAt.getTime()}-${idempotencyWindow()}`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 400) {
          throw new ApiError(409, 'This provider has not finished setting up payouts, so bookings cannot be made yet');
        }
        throw error;
      }
      // ATHENA's cut is the marketplace one, from the hold, the same as for a
      // package order. A booking used to carry a 20 per cent of its own, which
      // was not what the price book or the Terms say a marketplace sale costs. The
      // fee the hold carries is what is recorded, so the booking and the hold cannot
      // disagree about what the provider is paid.
      const platformFee = Math.round(hold.platformFee / 100);

      let booking;
      try {
        booking = await prisma.serviceBooking.create({
          data: {
            serviceId: id,
            clientId: me.id,
            scheduledAt,
            durationMinutes,
            totalAmount,
            platformFee,
            providerPayout: totalAmount - platformFee,
            clientNotes: typeof req.body.clientNotes === 'string' ? req.body.clientNotes : undefined,
            escrowPaymentId: hold.escrowId,
            stripePaymentIntentId: hold.paymentIntentId,
          },
        });
      } catch (error) {
        // Two requests that shared a key were handed one hold, and the first
        // to save its booking owns it: the second's insert is refused on the
        // escrowPaymentId the first already wrote. That is this buyer's own
        // booking, made a moment ago, so it is answered with that booking —
        // and the hold is not cancelled, because it is the hold behind the
        // booking that was saved.
        const twin = isUniqueViolation(error)
          ? await prisma.serviceBooking.findFirst({ where: { clientId: me.id, escrowPaymentId: hold.escrowId } })
          : null;
        if (twin) {
          booking = twin;
        } else {
          // The hold exists at Stripe and no booking points at it. Given back at
          // once, so a card is never left holding money for a booking that was
          // not made.
          await cancelEscrowPayment(hold.paymentIntentId, { id: me.id, role: me.role }, 'The booking could not be saved').catch(
            () => undefined
          );
          throw error;
        }
      }

      res.status(201).json({
        success: true,
        data: {
          ...booking,
          payment: {
            paymentIntentId: hold.paymentIntentId,
            clientSecret: hold.clientSecret,
            amount: hold.amount,
            platformFee: hold.platformFee,
            currency: 'aud',
          },
        },
      });
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
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

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
      skip,
      take: limit,
      include: {
        service: { include: { provider: { select: { id: true, displayName: true, avatar: true } } } },
        // Whether the buyer's money is held, so neither side is shown a payout
        // for a booking nothing has been paid into.
        escrow: { select: { status: true, amount: true, currency: true, paymentIntentId: true } },
      },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

// The buyer's way back into a card step that was left: the client secret for a hold
// still waiting to be authorised, or just its state once it is past that.
router.get('/bookings/:id/payment', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const booking = await prisma.serviceBooking.findUnique({
      where: { id: req.params.id },
      select: {
        clientId: true,
        totalAmount: true,
        escrow: { select: { status: true, amount: true, currency: true, paymentIntentId: true } },
      },
    });
    // Anyone but the buyer is told the booking does not exist, the same answer a
    // booking that does not exist gets.
    if (!booking || booking.clientId !== signedIn(req).id) {
      throw new ApiError(404, 'Booking not found');
    }
    if (!booking.escrow) {
      res.json({ success: true, data: { status: 'NONE', clientSecret: null, amount: booking.totalAmount * 100, currency: 'aud' } });
      return;
    }
    const clientSecret =
      booking.escrow.status === 'PENDING' && booking.escrow.paymentIntentId
        ? await getEscrowClientSecret(booking.escrow.paymentIntentId)
        : null;
    res.json({
      success: true,
      data: {
        status: booking.escrow.status,
        clientSecret,
        amount: booking.escrow.amount,
        currency: booking.escrow.currency,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// BOOKING LIFECYCLE
// ===========================================
// PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED. A booking is CANCELLED before
// it has been given, and DISPUTED when the buyer says it was not. Every move is
// checked against this table and against the hold behind the booking; the
// status a caller asks for is a request, not an instruction. It used to be an
// instruction: either side could write any status, COMPLETED included, on a
// booking no money was behind.
type BookingAction = 'confirm' | 'start' | 'complete' | 'cancel' | 'dispute';

const BOOKING_TRANSITIONS: Record<BookingAction, { to: string; from: string[]; actor: 'client' | 'provider' | 'either' }> = {
  // The provider says yes to the time, once the money is held.
  confirm: { to: 'CONFIRMED', from: ['PENDING'], actor: 'provider' },
  start: { to: 'IN_PROGRESS', from: ['CONFIRMED'], actor: 'provider' },
  // Only the buyer says the time was given, because that is what takes the buyer's money.
  complete: { to: 'COMPLETED', from: ['CONFIRMED', 'IN_PROGRESS'], actor: 'client' },
  // Not once it is under way: what has been given is not given back by pressing
  // a button, it is settled by completing or disputing.
  cancel: { to: 'CANCELLED', from: ['PENDING', 'CONFIRMED'], actor: 'either' },
  dispute: { to: 'DISPUTED', from: ['CONFIRMED', 'IN_PROGRESS'], actor: 'client' },
};

const BOOKING_ACTION_FOR_STATUS: Record<string, BookingAction | undefined> = {
  CONFIRMED: 'confirm',
  IN_PROGRESS: 'start',
  COMPLETED: 'complete',
  CANCELLED: 'cancel',
  DISPUTED: 'dispute',
};

function assertBookingTransition(action: BookingAction, status: string, isClient: boolean, isProvider: boolean): void {
  const rule = BOOKING_TRANSITIONS[action];
  const allowed = rule.actor === 'either' ? isClient || isProvider : rule.actor === 'client' ? isClient : isProvider;
  if (!allowed) {
    throw new ApiError(403, `Only the ${rule.actor === 'either' ? 'buyer or the provider' : rule.actor} can ${action} this booking`);
  }
  if (!rule.from.includes(status)) {
    throw new ApiError(400, `A booking that is ${status.toLowerCase().replace('_', ' ')} cannot be ${rule.to.toLowerCase().replace('_', ' ')}`);
  }
}

/** Tells somebody about a booking or a proposal. Never fails the move that raised it. */
async function tellMarketplaceParty(
  userId: string,
  title: string,
  message: string,
  link = '/skills-marketplace/bookings'
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type: 'SYSTEM', title, message, link },
    });
  } catch {
    // The booking has moved; a notification that did not write is not a reason to say it did not.
  }
}

router.patch(
  '/bookings/:id',
  authenticate,
  [body('status').isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED']), body('reason').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const booking = await prisma.serviceBooking.findUnique({
        where: { id },
        include: {
          service: { select: { id: true, title: true, providerId: true } },
          escrow: { select: { id: true, status: true, paymentIntentId: true } },
        },
      });

      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      const me = signedIn(req);
      const actor = { id: me.id, role: me.role };
      const isClient = booking.clientId === actor.id;
      const isProvider = booking.service.providerId === actor.id;

      // The two people it is between. Staff settle a booking that is in dispute
      // from their own route (POST /admin/bookings/:id/settle), which asks for the
      // staff role and the second factor; they have no business moving one here.
      if (!isClient && !isProvider) {
        throw new ApiError(403, 'Not authorized');
      }

      const action = BOOKING_ACTION_FOR_STATUS[String(req.body.status)];
      if (!action) {
        throw new ApiError(400, 'A booking cannot be put back to pending');
      }

      assertBookingTransition(action, booking.status, isClient, isProvider);

      const reason = typeof req.body.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : null;
      const escrow = booking.escrow;
      const title = booking.service.title;

      if (action === 'confirm') {
        // Nothing starts until the buyer's money is actually held.
        if (!booking.escrowPaymentId) {
          throw new ApiError(
            409,
            'This booking was made before bookings were paid through ATHENA, so there is nothing to pay you from. Ask the buyer to book again.'
          );
        }
        if (!escrowHeld(escrow)) {
          throw new ApiError(409, 'The buyer has not completed payment yet');
        }
      }

      if (action === 'complete') {
        if (booking.scheduledAt.getTime() > Date.now()) {
          throw new ApiError(400, 'The session has not started yet. Once it has, you can say it was given.');
        }
        if (!escrow?.paymentIntentId) {
          throw new ApiError(
            409,
            'This booking was made before bookings were paid through ATHENA, so there is no payment to release. It can only be cancelled.'
          );
        }
        if (escrow.status === 'CANCELED' || escrow.status === 'FAILED') {
          throw new ApiError(
            409,
            'The hold on the buyer’s card has ended, so there is nothing to release. The booking can be cancelled.'
          );
        }
        // Taken here, so that if Stripe refuses the booking stays as it was and
        // the buyer sees why, rather than being marked complete with the money
        // still sitting on the card. A hold the expiry sweep or staff already
        // captured is not captured twice.
        if (escrow.status !== 'CAPTURED') {
          await captureEscrowPayment(escrow.paymentIntentId, actor);
        }
      }

      // "The session was not given" is only true of a session whose time has come.
      // Before that the buyer's way out is to cancel, which releases the hold at
      // once; a dispute would freeze the provider's booking and send it to the team
      // for something that has not happened yet.
      if (action === 'dispute' && booking.scheduledAt.getTime() > Date.now()) {
        throw new ApiError(
          400,
          'The session has not started yet. If you no longer want it, cancel the booking and the hold on your card is released.'
        );
      }

      if (action === 'cancel') {
        if (escrow?.status === 'CAPTURED') {
          throw new ApiError(409, 'The payment for this booking has already been released, so it cannot be cancelled.');
        }
        // The hold goes back to the buyer's card, whoever cancelled.
        if (escrow?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(escrow.status)) {
          await cancelEscrowPayment(escrow.paymentIntentId, actor, reason ?? undefined);
        }
      }

      const now = new Date();
      // Conditional on the status just read, so two presses, or the buyer and the
      // provider at once, move a booking one way and not both.
      const moved = await prisma.serviceBooking.updateMany({
        where: { id, status: booking.status },
        data: {
          status: BOOKING_TRANSITIONS[action].to as never,
          ...(action === 'complete' ? { completedAt: now, paidAt: now } : {}),
          // What the team reads to decide it. The payment stays held meanwhile.
          ...(action === 'dispute' ? { disputedAt: now, disputeReason: reason } : {}),
        },
      });
      if (moved.count !== 1) {
        throw new ApiError(409, 'This booking has just changed. Reload it and try again.');
      }
      const updated = await prisma.serviceBooking.findUnique({ where: { id } });

      if (action === 'confirm') {
        await tellMarketplaceParty(booking.clientId, 'Your booking is confirmed', `${title}: the provider has confirmed your time. Your card is held, not charged, until you say the session was given.`);
      } else if (action === 'cancel') {
        const other = isClient ? booking.service.providerId : booking.clientId;
        await tellMarketplaceParty(other, 'A booking was cancelled', `${title}: the booking was cancelled and nothing has been taken from the buyer’s card.`);
      } else if (action === 'dispute') {
        await tellMarketplaceParty(booking.service.providerId, 'A booking is in dispute', `${title}: the buyer says the session was not given. The payment stays held while ATHENA’s team looks at it.`);
        await notifyAdmins({
          title: 'A booking is in dispute',
          message: `${title}: a buyer says a paid booking was not given. The payment is held on the buyer’s card. ${reason ? `The buyer said: ${reason}` : 'The buyer did not say why.'}`,
          link: BOOKING_DISPUTES_LINK,
          data: { kind: 'BOOKING_DISPUTED', bookingId: id },
        });
      } else if (action === 'complete') {
        await tellMarketplaceParty(booking.service.providerId, 'You have been paid for a booking', `${title}: the buyer has released the payment.`);
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Staff: a booking the buyer says was not given
// ---------------------------------------------------------------------------

/** Where the team lands from a notice about a booking in dispute. */
const BOOKING_DISPUTES_LINK = '/admin/booking-disputes';

// The bookings waiting on a decision, oldest first: a hold on a card lasts about
// a week, and the one that has waited longest is the one nearest to lapsing.
router.get('/admin/bookings/disputed', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const bookings = await prisma.serviceBooking.findMany({
      where: { status: 'DISPUTED' },
      orderBy: [{ disputedAt: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        totalAmount: true,
        platformFee: true,
        providerPayout: true,
        clientNotes: true,
        disputedAt: true,
        disputeReason: true,
        service: {
          select: { id: true, title: true, provider: { select: { id: true, displayName: true } } },
        },
        client: { select: { id: true, displayName: true } },
        escrow: { select: { status: true, createdAt: true, metadata: true } },
      },
    });

    res.json({
      success: true,
      data: bookings.map(({ escrow, ...booking }) => ({
        ...booking,
        // Whether there is still money to move, and until when. The team can only
        // release or give back a hold that is live; after that the booking can
        // only be closed.
        hold: escrow
          ? {
              status: escrow.status,
              lapsesAt: ['PENDING', 'AUTHORIZED'].includes(escrow.status) ? holdDeadlineOf(escrow).toISOString() : null,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// The team's decision on a booking in dispute: the money goes to the provider, or
// back to the buyer's card. Staff only, with the second factor; the two people
// the booking is between cannot settle it themselves. Written to the audit log
// against who decided.
router.post(
  '/admin/bookings/:id/settle',
  authenticate,
  requireRole('ADMIN'),
  [body('outcome').isIn(['release', 'return']), body('note').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const me = signedIn(req);
      // The route has already checked the staff role and the second factor
      // (requireRole('ADMIN') lets a SUPER_ADMIN through too). The escrow service
      // only recognises the literal 'ADMIN' as staff, so a SUPER_ADMIN passed
      // along as herself was told the hold did not exist and could settle nothing.
      const actor = { id: me.id, role: 'ADMIN' };
      const { id } = req.params;
      const release = req.body.outcome === 'release';
      const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;

      const booking = await prisma.serviceBooking.findUnique({
        where: { id },
        include: {
          service: { select: { id: true, title: true, providerId: true } },
          escrow: { select: { id: true, status: true, paymentIntentId: true } },
        },
      });
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }
      if (booking.status !== 'DISPUTED') {
        throw new ApiError(409, 'Only a booking that is in dispute is settled here.');
      }

      const escrow = booking.escrow;
      if (release) {
        if (!escrow?.paymentIntentId) {
          throw new ApiError(409, 'There is no payment held for this booking, so there is nothing to release.');
        }
        if (escrow.status === 'CANCELED' || escrow.status === 'FAILED' || escrow.status === 'REFUNDED') {
          throw new ApiError(
            409,
            'The hold on the buyer’s card has ended, so there is nothing to release. Give it back to close the booking.'
          );
        }
        // Taken first, so that if Stripe refuses the booking stays in dispute and
        // the reason is shown, rather than being closed with the money unmoved.
        if (escrow.status !== 'CAPTURED') {
          await captureEscrowPayment(escrow.paymentIntentId, actor);
        }
      } else {
        if (escrow?.status === 'CAPTURED') {
          throw new ApiError(
            409,
            'The payment has already been released to the provider, so it cannot be given back here. Refund it in Stripe if it should be.'
          );
        }
        if (escrow?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(escrow.status)) {
          await cancelEscrowPayment(escrow.paymentIntentId, actor, note ?? 'Booking dispute settled in the buyer’s favour');
        }
      }

      const now = new Date();
      // Conditional on its still being in dispute, so two members of staff
      // settling it at once decide it once.
      const moved = await prisma.serviceBooking.updateMany({
        where: { id, status: 'DISPUTED' },
        data: release ? { status: 'COMPLETED', completedAt: now, paidAt: now } : { status: 'CANCELLED' },
      });
      if (moved.count !== 1) {
        throw new ApiError(409, 'This booking has just been settled by somebody else.');
      }

      const title = booking.service.title;
      await tellMarketplaceParty(
        booking.clientId,
        'Your booking has been settled',
        release
          ? `${title}: ATHENA’s team looked at it and released the payment to the provider.`
          : `${title}: ATHENA’s team looked at it and the hold on your card was released. Nothing was taken.`
      );
      await tellMarketplaceParty(
        booking.service.providerId,
        release ? 'You have been paid for a booking' : 'A booking in dispute was settled',
        release
          ? `${title}: ATHENA’s team looked at it and released the payment to you.`
          : `${title}: ATHENA’s team looked at it and gave the payment back to the buyer.`
      );

      await auditAfterCommit({
        action: AuditAction.ADMIN_CONFIG_UPDATE,
        actorUserId: actor.id,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') || null,
        metadata: {
          adminAction: 'BOOKING_DISPUTE_SETTLED',
          resourceType: 'ServiceBooking',
          resourceId: id,
          outcome: release ? 'released_to_provider' : 'returned_to_buyer',
        },
      });

      res.json({ success: true, data: await prisma.serviceBooking.findUnique({ where: { id } }) });
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

      // A rating moves the listing up the marketplace, so it has to come from
      // someone who actually bought the work. Either a completed hourly
      // booking or a completed fixed-price order will do; without one this is
      // refused rather than quietly recorded.
      const clientId = req.user!.id;
      const requestedBookingId = typeof req.body.bookingId === 'string' && req.body.bookingId ? req.body.bookingId : null;

      if (requestedBookingId) {
        const booking = await prisma.serviceBooking.findUnique({ where: { id: requestedBookingId } });
        if (!booking || booking.serviceId !== id || booking.clientId !== clientId) {
          throw new ApiError(404, 'No booking of yours matches that id for this service');
        }
        if (booking.status !== 'COMPLETED') {
          throw new ApiError(403, 'You can review a booking once it is complete');
        }
      } else {
        const [completedBooking, completedOrder] = await Promise.all([
          prisma.serviceBooking.findFirst({ where: { serviceId: id, clientId, status: 'COMPLETED' } }),
          prisma.serviceOrder.findFirst({ where: { serviceId: id, clientId, status: 'COMPLETED' } }),
        ]);
        if (!completedBooking && !completedOrder) {
          throw new ApiError(403, 'Only a client who has completed a booking or an order with this seller can review it');
        }
      }

      // One review per booking; one per service where the work was an order.
      // The unique index treats a null bookingId as its own slot, so the
      // existing row is checked for rather than left to a constraint error.
      const existing = await prisma.serviceReview.findFirst({ where: { serviceId: id, clientId, bookingId: requestedBookingId } });
      if (existing) {
        throw new ApiError(409, 'You have already reviewed this');
      }

      const review = await prisma.serviceReview.create({
        data: {
          serviceId: id,
          clientId,
          rating: req.body.rating,
          content: req.body.content,
          bookingId: requestedBookingId,
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
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string }, BROWSE_PAGE_MAX);

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
        skip,
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
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const favorites = await prisma.serviceFavorite.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
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
  startingAPayment,
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

      const me = signedIn(req);
      if (service.providerId === me.id) {
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
      // The platform's cut comes from the escrow hold, so the two never disagree.
      const deliveryDays =
        typeof selected.deliveryDays === 'number' ? selected.deliveryDays : null;

      // The money is held on the buyer's card now and taken only when they
      // approve the delivery. A provider who has not set up payouts cannot be
      // paid, so cannot be ordered from yet. Prices are whole dollars; Stripe
      // wants cents.
      let hold: Awaited<ReturnType<typeof createEscrowPayment>>;
      try {
        hold = await createEscrowPayment({
          buyerId: me.id,
          sellerId: service.providerId,
          amount: totalAmount * 100,
          currency: 'aud',
          description: `${service.title}${selected.name ? ` — ${selected.name}` : ''}`,
          sessionType: 'service_order',
          metadata: { serviceId: id, packageIndex: String(packageIndex) },
          // No order row exists yet to key from, so the buyer, the listing,
          // the package and the minute: two taps on Order are one hold, where
          // each used to hold her card again. A second order of the same
          // package a minute later is a new one.
          idempotencyKey: `service-order-hold-${me.id}-${id}-${packageIndex}-${idempotencyWindow()}`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 400) {
          throw new ApiError(409, 'This provider has not finished setting up payouts, so orders cannot be placed yet');
        }
        throw error;
      }
      const platformFee = Math.round(hold.platformFee / 100);

      let order;
      try {
        order = await prisma.serviceOrder.create({
          data: {
            serviceId: id,
            clientId: me.id,
            escrowPaymentId: hold.escrowId,
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
      } catch (error) {
        // The twin of this request saved the order behind the shared hold
        // first, and the unique escrowPaymentId refuses a second. That order
        // is this buyer's own, so it is what she is answered with.
        const twin = isUniqueViolation(error)
          ? await prisma.serviceOrder.findFirst({ where: { clientId: me.id, escrowPaymentId: hold.escrowId } })
          : null;
        if (!twin) throw error;
        order = twin;
      }

      res.status(201).json({
        success: true,
        data: {
          ...order,
          payment: {
            paymentIntentId: hold.paymentIntentId,
            clientSecret: hold.clientSecret,
            amount: hold.amount,
            platformFee: hold.platformFee,
            currency: 'aud',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/orders/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const orders = await prisma.serviceOrder.findMany({
      where: { clientId: req.user!.id, ...(status ? { status: status as never } : {}) },
      // Who on the team decided a dispute is the team's business.
      omit: { disputeResolvedById: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        service: {
          include: {
            provider: { select: { id: true, displayName: true, avatar: true } },
          },
        },
        escrow: { select: { status: true, amount: true, currency: true, paymentIntentId: true } },
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
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const orders = await prisma.serviceOrder.findMany({
      where: {
        service: { providerId: req.user!.id },
        ...(status ? { status: status as never } : {}),
      },
      omit: { disputeResolvedById: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        service: { select: { id: true, title: true, category: true } },
        client: { select: { id: true, displayName: true, avatar: true } },
        escrow: { select: { status: true, amount: true, currency: true, paymentIntentId: true } },
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
// A hold counts once Stripe has authorised it. The mock client (no Stripe key,
// outside production) never gets a webhook, so its holds count as soon as made.
function escrowHeld(escrow: { status: string; paymentIntentId: string | null } | null | undefined): boolean {
  if (!escrow) return false;
  if (escrow.status === 'AUTHORIZED' || escrow.status === 'CAPTURED') return true;
  return escrow.status === 'PENDING' && Boolean(escrow.paymentIntentId?.startsWith('pi_mock_'));
}

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
      escrow: {
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          paymentIntentId: true,
          capturedAt: true,
          canceledAt: true,
          // What the hold's deadline is worked out from. Not sent to the browser.
          createdAt: true,
          metadata: true,
        },
      },
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

// The buyer's way back into a checkout they left: the client secret for a hold
// still waiting to be authorised, or just the state once it is past that.
router.get('/orders/:id/payment', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient } = await loadOrderForActor(req.params.id, req.user!.id);
    if (!isClient) {
      throw new ApiError(403, 'Only the buyer sees the payment');
    }
    if (!order.escrow) {
      res.json({ success: true, data: { status: 'NONE', clientSecret: null, amount: order.totalAmount * 100, currency: 'aud' } });
      return;
    }
    const clientSecret =
      order.escrow.status === 'PENDING' && order.escrow.paymentIntentId
        ? await getEscrowClientSecret(order.escrow.paymentIntentId)
        : null;
    res.json({
      success: true,
      data: {
        status: order.escrow.status,
        clientSecret,
        amount: order.escrow.amount,
        currency: order.escrow.currency,
        ...describeOrderHold(order.escrow, order.status),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Paying again, for a hold that has run out or is about to. A card hold lasts
// about a week and a package can take longer, so the buyer is asked to renew it
// in the last two days; this starts a fresh hold for the same amount and hands
// back the card step for it. Nothing is taken. The order moves onto the new hold
// only once it is authorised, and the old one is released then (see
// services/escrow-renewal.service and the Stripe webhook).
router.post('/orders/:id/payment/renew', authenticate, startingAPayment, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Sign in to pay for an order');
    const hold = await startOrderReauthorisation(req.params.id, userId);
    res.status(hold.resumed ? 200 : 201).json({
      success: true,
      data: {
        status: 'PENDING',
        clientSecret: hold.clientSecret,
        paymentIntentId: hold.paymentIntentId,
        amount: hold.amount,
        platformFee: hold.platformFee,
        currency: hold.currency,
        resumed: hold.resumed,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
    // The hold's own metadata is how its deadline is worked out and is not the
    // browser's business; what the page needs is the answer.
    const { metadata: _holdNotes, ...escrow } = order.escrow ?? ({} as NonNullable<typeof order.escrow>);
    // Whether the buyer's bank has also disputed the payment, which is separate
    // from the buyer telling ATHENA the delivery was wrong. Both people are told,
    // so neither is left to wonder why a paid order is not being paid on. A lookup
    // that fails says nothing rather than failing the page.
    const intent = order.escrow?.paymentIntentId ?? null;
    const cardDisputeOpen = intent
      ? await bestEffort('order.card-dispute', async () => Boolean(await openCardDisputeOn(intent)), false)
      : false;
    res.json({
      success: true,
      data: {
        ...forMember(order),
        escrow: order.escrow ? escrow : null,
        hold: describeOrderHold(order.escrow, order.status),
        cardDisputeOpen,
        viewerRole: isProvider ? 'provider' : isClient ? 'client' : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { order, isClient, isProvider } = await loadOrderForActor(req.params.id, req.user!.id);
    assertTransition('accept', order.status, isClient, isProvider);

    // Nothing starts until the buyer's money is actually held.
    if (!escrowHeld(order.escrow)) {
      throw new ApiError(409, 'The buyer has not completed payment yet');
    }

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

      // Nothing is delivered against a hold that is not there. A hold on a card
      // runs out after about a week, a package can take longer, and work handed
      // over after the hold has gone is work the provider may never be paid for:
      // the buyer's approval would fail at Stripe with the money on nobody's
      // side. The buyer is asked to renew it, and the provider can deliver as
      // soon as the buyer has.
      if (!escrowHeld(order.escrow)) {
        // The sentence below is true because of this: the buyer is asked now.
        await askBuyerToRenew({ ...order, service: { title: order.service.title } }, 'provider_waiting');
        throw new ApiError(
          409,
          'The hold on the buyer’s card has ended, so there is nothing to pay you from yet. We have asked the buyer to renew it; you can deliver as soon as they have.'
        );
      }

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

    // A hold that has ended has nothing left to release. Said plainly, with the
    // way out, instead of as a payment error from Stripe.
    if (order.escrow && (order.escrow.status === 'CANCELED' || order.escrow.status === 'FAILED')) {
      throw new ApiError(
        409,
        'The hold on your card has ended, so there is nothing to release yet. Renew it from this page, then approve the delivery.'
      );
    }

    // Approval releases the hold to the provider. If Stripe refuses, the order
    // stays delivered and the buyer sees why, rather than being marked complete
    // with the money still sitting on their card.
    if (order.escrow?.paymentIntentId && order.escrow.status !== 'CAPTURED') {
      await captureEscrowPayment(order.escrow.paymentIntentId, { id: req.user!.id, role: req.user!.role });
    }

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

      // The hold goes back to the buyer's card, whoever cancelled.
      if (order.escrow?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(order.escrow.status)) {
        await cancelEscrowPayment(
          order.escrow.paymentIntentId,
          { id: req.user!.id, role: req.user!.role },
          typeof req.body.reason === 'string' ? req.body.reason : undefined
        );
      }

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
// AN ORDER IN DISPUTE
// ===========================================
// The buyer says the delivery was not what was agreed, or that nothing came by its
// due date. The hold stays on her card and every button on the order closes
// (approve, revision, cancel, deliver) until ATHENA's team decides: release the
// payment to the provider, or give it back. The provider may answer once.
// service-disputes.service holds the rules and the team's side.
router.post(
  '/orders/:id/dispute',
  authenticate,
  [body('reason').isString().trim().isLength({ min: 5, max: 2000 }).withMessage('Tell us what went wrong, in 5 to 2000 characters')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const order = await openOrderDispute(req.params.id, signedIn(req).id, req.body.reason);
      res.status(201).json({ success: true, data: forMember(order), message: 'ATHENA’s team has been told' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/orders/:id/dispute/respond',
  authenticate,
  [body('response').isString().trim().isLength({ min: 5, max: 2000 }).withMessage('Write your answer, in 5 to 2000 characters')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const order = await answerOrderDispute(req.params.id, signedIn(req).id, req.body.response);
      res.json({ success: true, data: forMember(order), message: 'Your answer has been recorded' });
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
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string }, BROWSE_PAGE_MAX);
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
        skip,
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
    const { limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const requests = await prisma.serviceRequest.findMany({
      where: { clientId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
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
        // Whether the accepted proposal's money is held, so the page can offer the
        // card step, the release, or neither.
        escrow: { select: { status: true, amount: true, currency: true } },
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
// the brief stops taking pitches, and the proposal's price is held on the buyer's card.
//
// Accepting used to flip three statuses and nothing else, so a brief could be
// awarded to somebody who then had no money behind the job. Now the hold is made
// first, in the same way a package order's is, and the card step the response
// asks for is what makes the provider's work safe to start. Nothing is taken
// until the buyer releases it.
router.post('/requests/:id/proposals/:proposalId/accept', authenticate, startingAPayment, async (req: AuthRequest, res, next) => {
  try {
    const me = signedIn(req);
    const { id, proposalId } = req.params;

    const request = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!request) {
      throw new ApiError(404, 'Request not found');
    }
    if (request.clientId !== me.id) {
      throw new ApiError(403, 'Only the buyer can accept a proposal');
    }
    if (request.status !== 'OPEN') {
      throw new ApiError(400, 'This request has already been settled');
    }

    const proposal = await prisma.serviceProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.requestId !== id) {
      throw new ApiError(404, 'Proposal not found');
    }
    // A pitch the provider took back, or the buyer turned down, is not one the
    // buyer can be held to.
    if (proposal.status !== 'PENDING') {
      throw new ApiError(400, 'This proposal is no longer open to accept');
    }
    if (proposal.providerId === me.id) {
      throw new ApiError(400, 'You cannot accept your own proposal');
    }
    if (!(proposal.price >= 1)) {
      throw new ApiError(400, 'This proposal has no price, so there is nothing to hold. Ask the provider to quote one.');
    }

    // Prices are whole dollars; Stripe wants cents. The key is the proposal's own
    // and moves when the proposal does, so a double tap, or a retry after a
    // timeout, is one hold, while a proposal that was cancelled and has been
    // pitched and accepted again is a new one: Stripe would otherwise hand back
    // the intent that was cancelled.
    let hold: Awaited<ReturnType<typeof createEscrowPayment>>;
    try {
      hold = await createEscrowPayment({
        buyerId: me.id,
        sellerId: proposal.providerId,
        amount: proposal.price * 100,
        currency: 'aud',
        description: request.title,
        sessionType: 'custom_request',
        metadata: { requestId: id, proposalId },
        idempotencyKey: `custom-request-hold-${proposal.id}-${proposal.updatedAt.getTime()}`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        throw new ApiError(409, 'This provider has not finished setting up payouts, so the proposal cannot be accepted yet');
      }
      throw error;
    }

    // Awarding is conditional on the brief still being open, so two accepts
    // arriving together award it once. The loser's hold is given back below.
    const accepted = await prisma.$transaction(async (tx) => {
      const awarded = await tx.serviceRequest.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'AWARDED', closedAt: new Date() },
      });
      if (awarded.count !== 1) return null;

      const chosen = await tx.serviceProposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED', escrowPaymentId: hold.escrowId },
      });
      await tx.serviceProposal.updateMany({
        where: { requestId: id, id: { not: proposalId }, status: 'PENDING' },
        data: { status: 'DECLINED' },
      });
      return chosen;
    });

    // A double tap is handed the same hold by Stripe, so the second request finds
    // the proposal already accepted with it. That is the first request's accept
    // and not a lost race: its hold is the buyer's live one and is not given back.
    let won = accepted;
    if (!won) {
      const current = await prisma.serviceProposal.findUnique({ where: { id: proposalId } });
      if (current?.status === 'ACCEPTED' && current.escrowPaymentId === hold.escrowId) {
        won = current;
      }
    }

    if (!won) {
      await cancelEscrowPayment(hold.paymentIntentId, { id: me.id, role: me.role }, 'The request was settled first').catch(
        () => undefined
      );
      throw new ApiError(409, 'This request has just been settled. Reload it to see what happened.');
    }

    res.json({
      success: true,
      data: {
        ...won,
        payment: {
          paymentIntentId: hold.paymentIntentId,
          clientSecret: hold.clientSecret,
          amount: hold.amount,
          platformFee: hold.platformFee,
          currency: 'aud',
        },
      },
      message: 'Proposal accepted',
    });
  } catch (error) {
    next(error);
  }
});

// What the buyer and the chosen provider each do once a proposal is accepted.
// Loads the proposal with its hold and says who the caller is to it; anybody
// else is told it does not exist.
async function loadAcceptedProposal(requestId: string, proposalId: string, userId: string) {
  const proposal = await prisma.serviceProposal.findUnique({
    where: { id: proposalId },
    include: {
      request: { select: { id: true, clientId: true, title: true, status: true } },
      escrow: { select: { id: true, status: true, paymentIntentId: true, amount: true, currency: true } },
    },
  });
  if (!proposal || proposal.requestId !== requestId) {
    throw new ApiError(404, 'Proposal not found');
  }
  const isBuyer = proposal.request.clientId === userId;
  const isProvider = proposal.providerId === userId;
  if (!isBuyer && !isProvider) {
    throw new ApiError(404, 'Proposal not found');
  }
  if (proposal.status !== 'ACCEPTED') {
    throw new ApiError(400, 'This proposal has not been accepted');
  }
  return { proposal, isBuyer, isProvider };
}

// The buyer's way back into a card step that was left, as for an order or a booking.
router.get('/requests/:id/proposals/:proposalId/payment', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const me = signedIn(req);
    const { proposal, isBuyer } = await loadAcceptedProposal(req.params.id, req.params.proposalId, me.id);
    if (!isBuyer) {
      throw new ApiError(403, 'Only the buyer sees the payment');
    }
    if (!proposal.escrow) {
      res.json({ success: true, data: { status: 'NONE', clientSecret: null, amount: proposal.price * 100, currency: 'aud' } });
      return;
    }
    const clientSecret =
      proposal.escrow.status === 'PENDING' && proposal.escrow.paymentIntentId
        ? await getEscrowClientSecret(proposal.escrow.paymentIntentId)
        : null;
    res.json({
      success: true,
      data: {
        status: proposal.escrow.status,
        clientSecret,
        amount: proposal.escrow.amount,
        currency: proposal.escrow.currency,
      },
    });
  } catch (error) {
    next(error);
  }
});

// The buyer says the work was done, which is what takes the money and pays the
// provider. A brief has no delivery step of its own, so this is the only thing
// that releases the hold, and nothing else will: not the provider, not the
// expiry sweep.
router.post('/requests/:id/proposals/:proposalId/release', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const me = signedIn(req);
    const { proposal, isBuyer } = await loadAcceptedProposal(req.params.id, req.params.proposalId, me.id);
    if (!isBuyer) {
      throw new ApiError(403, 'Only the buyer can release the payment');
    }
    const escrow = proposal.escrow;
    if (!escrow?.paymentIntentId) {
      throw new ApiError(409, 'There is no payment held for this proposal, so there is nothing to release.');
    }
    if (escrow.status === 'CANCELED' || escrow.status === 'FAILED') {
      throw new ApiError(409, 'The hold on your card has ended, so there is nothing to release.');
    }
    if (escrow.status === 'CAPTURED') {
      res.json({ success: true, data: proposal, message: 'This payment has already been released' });
      return;
    }
    if (!escrowHeld(escrow)) {
      throw new ApiError(409, 'Your card has not been held for this proposal yet. Finish the payment first.');
    }

    await captureEscrowPayment(escrow.paymentIntentId, { id: me.id, role: me.role });

    await tellMarketplaceParty(
      proposal.providerId,
      'You have been paid for a request',
      `${proposal.request.title}: the buyer has released the payment.`,
      '/skills-marketplace'
    );
    res.json({ success: true, message: 'Payment released' });
  } catch (error) {
    next(error);
  }
});

// Either side backs out before the money has been released. The hold goes back
// to the buyer's card, the proposal stops being the chosen one, and the brief
// is open again for the buyer to choose another.
router.post('/requests/:id/proposals/:proposalId/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const me = signedIn(req);
    const { proposal, isBuyer } = await loadAcceptedProposal(req.params.id, req.params.proposalId, me.id);
    const escrow = proposal.escrow;
    if (escrow?.status === 'CAPTURED') {
      throw new ApiError(409, 'The payment has already been released, so this cannot be cancelled.');
    }
    if (escrow?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(escrow.status)) {
      await cancelEscrowPayment(escrow.paymentIntentId, { id: me.id, role: me.role }, 'The proposal was cancelled');
    }

    await prisma.$transaction([
      prisma.serviceProposal.update({
        where: { id: proposal.id },
        data: { status: isBuyer ? 'DECLINED' : 'WITHDRAWN' },
      }),
      prisma.serviceRequest.update({
        where: { id: proposal.requestId },
        data: { status: 'OPEN', closedAt: null },
      }),
    ]);

    await tellMarketplaceParty(
      isBuyer ? proposal.providerId : proposal.request.clientId,
      'A proposal was cancelled',
      `${proposal.request.title}: the accepted proposal was cancelled and nothing has been taken from the buyer’s card.`,
      '/skills-marketplace'
    );
    res.json({ success: true, message: 'Cancelled' });
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
