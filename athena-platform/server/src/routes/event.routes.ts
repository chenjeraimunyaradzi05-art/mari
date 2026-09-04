import { Router } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';

const router = Router();

type EventType = 'webinar' | 'workshop' | 'networking' | 'conference' | 'meetup';
type EventFormat = 'virtual' | 'in-person' | 'hybrid';

function dbEventTypeFromParam(type: string): string | null {
  const t = String(type || '').toLowerCase();
  switch (t) {
    case 'webinar':
      return 'WEBINAR';
    case 'workshop':
      return 'WORKSHOP';
    case 'networking':
      return 'NETWORKING';
    case 'conference':
      return 'CONFERENCE';
    case 'meetup':
      return 'MEETUP';
    default:
      return null;
  }
}

function apiEventTypeFromDb(type: string): EventType {
  switch (String(type).toUpperCase()) {
    case 'WORKSHOP':
      return 'workshop';
    case 'NETWORKING':
      return 'networking';
    case 'CONFERENCE':
      return 'conference';
    case 'MEETUP':
      return 'meetup';
    default:
      return 'webinar';
  }
}

function dbEventFormatFromParam(format: EventFormat): string {
  const f = String(format).toLowerCase();
  if (f === 'in-person') return 'IN_PERSON';
  if (f === 'hybrid') return 'HYBRID';
  return 'VIRTUAL';
}

function apiEventFormatFromDb(format: string): EventFormat {
  const f = String(format).toUpperCase();
  if (f === 'IN_PERSON') return 'in-person';
  if (f === 'HYBRID') return 'hybrid';
  return 'virtual';
}

function eventView(dbEvent: any, userId?: string) {
  const isRegistered = userId ? (dbEvent.registrations?.length || 0) > 0 : false;
  const isSaved = userId ? (dbEvent.saves?.length || 0) > 0 : false;
  const regCount = dbEvent._count?.registrations ?? 0;

  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    type: apiEventTypeFromDb(dbEvent.type),
    format: apiEventFormatFromDb(dbEvent.format),
    date: (dbEvent.date as Date).toISOString?.() ?? dbEvent.date,
    startTime: dbEvent.startTime,
    endTime: dbEvent.endTime,
    location: dbEvent.location,
    link: dbEvent.link,
    image: dbEvent.image,
    host: {
      name: dbEvent.hostName,
      title: dbEvent.hostTitle,
      avatar: dbEvent.hostAvatar,
    },
    attendees: (dbEvent.baseAttendees ?? 0) + regCount,
    maxAttendees: dbEvent.maxAttendees,
    // Passed through rather than coerced to 0: null means the organiser has
    // not published a price, which the card shows differently from "Free".
    price: dbEvent.price ?? null,
    tags: Array.isArray(dbEvent.tags) ? dbEvent.tags : [],
    isRegistered,
    isSaved,
  };
}

async function getEventView(eventId: string, userId?: string, viewerRole?: string) {
  const include: any = {
    _count: { select: { registrations: true } },
  };
  if (userId) {
    include.registrations = { where: { userId }, select: { id: true } };
    include.saves = { where: { userId }, select: { id: true } };
  }

  const event = await (prisma as any).event.findUnique({ where: { id: eventId }, include });
  if (!event) throw new ApiError(404, 'Event not found');
  if (event.isHidden && String(viewerRole).toUpperCase() !== 'ADMIN') {
    throw new ApiError(404, 'Event not found');
  }
  return eventView(event, userId);
}

/**
 * GET /api/events
 * Query params: type, q
 */
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const dbType = type === 'all' ? null : dbEventTypeFromParam(type);
    const where: any = {
      ...(String(req.user?.role).toUpperCase() === 'ADMIN' ? {} : { isHidden: false }),
      ...(dbType ? { type: dbType } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              // Best-effort tag match when q equals a tag.
              { tags: { has: q } },
            ],
          }
        : {}),
    };

    const include: any = { _count: { select: { registrations: true } } };
    if (req.user?.id) {
      include.registrations = { where: { userId: req.user.id }, select: { id: true } };
      include.saves = { where: { userId: req.user.id }, select: { id: true } };
    }

    const events = await (prisma as any).event.findMany({
      where,
      include,
      orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { date: 'asc' }],
      take: 100,
    });

    res.json({ success: true, data: (events || []).map((e: any) => eventView(e, req.user?.id)) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await getEventView(req.params.id, req.user?.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events/:id/register
 */
router.post('/:id/register', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Ensure event exists
    await getEventView(req.params.id, undefined, req.user?.role);

    await (prisma as any).eventRegistration.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
      update: {},
      create: { eventId: req.params.id, userId: req.user!.id },
    });

    res.json({ success: true, data: await getEventView(req.params.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:id/register
 */
router.delete('/:id/register', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Ensure event exists
    await getEventView(req.params.id, undefined, req.user?.role);

    try {
      await (prisma as any).eventRegistration.delete({
        where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
      });
    } catch (err: any) {
      if (err?.code !== 'P2025') throw err;
    }

    res.json({ success: true, data: await getEventView(req.params.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events/:id/save
 */
router.post('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Ensure event exists
    await getEventView(req.params.id, undefined, req.user?.role);

    await (prisma as any).eventSave.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
      update: {},
      create: { eventId: req.params.id, userId: req.user!.id },
    });

    res.json({ success: true, data: await getEventView(req.params.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:id/save
 */
router.delete('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Ensure event exists
    await getEventView(req.params.id, undefined, req.user?.role);

    try {
      await (prisma as any).eventSave.delete({
        where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
      });
    } catch (err: any) {
      if (err?.code !== 'P2025') throw err;
    }

    res.json({ success: true, data: await getEventView(req.params.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events
 * Host an event. The host details come from the member's own profile; the
 * event is listed straight away. "Host Event" on the events page had no
 * handler and there was no route for it to call.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;

    const title = normalizeUserText(b.title, { field: 'title', maxLength: 120 });
    const description = normalizeUserText(b.description, { field: 'description', maxLength: 4000 });

    const type = dbEventTypeFromParam(String(b.type ?? ''));
    if (!type) throw new ApiError(400, 'type must be webinar, workshop, networking, conference or meetup');
    const format = dbEventFormatFromParam(String(b.format ?? 'virtual') as EventFormat);

    const date = new Date(String(b.date ?? ''));
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'date must be a valid date');
    if (date.getTime() < Date.now() - 24 * 60 * 60 * 1000) throw new ApiError(400, 'The event date has already passed');

    const startTime = String(b.startTime ?? '');
    const endTime = String(b.endTime ?? '');
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      throw new ApiError(400, 'startTime and endTime must be HH:MM');
    }
    if (endTime <= startTime) throw new ApiError(400, 'endTime must be after startTime');

    const location = normalizeOptionalUserText(b.location, { field: 'location', maxLength: 200, allowEmpty: true }) || null;
    const link = b.link ? normalizeSafeUrl(b.link, { field: 'link' }) : null;
    if (format === 'VIRTUAL' && !link) throw new ApiError(400, 'A virtual event needs a link to join');
    if (format === 'IN_PERSON' && !location) throw new ApiError(400, 'An in-person event needs a location');
    if (format === 'HYBRID' && !link && !location) throw new ApiError(400, 'A hybrid event needs a link or a location');

    const image = b.image
      ? normalizeSafeUrl(b.image, { field: 'image', allowRelativeUploads: true })
      : '/icon.svg';

    const maxAttendees = b.maxAttendees === undefined || b.maxAttendees === null || b.maxAttendees === ''
      ? null
      : Number(b.maxAttendees);
    if (maxAttendees !== null && (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 100000)) {
      throw new ApiError(400, 'maxAttendees must be a whole number');
    }

    const price = b.price === undefined || b.price === null || b.price === '' ? 0 : Number(b.price);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
      throw new ApiError(400, 'price must be a whole number of dollars');
    }

    const tags = Array.isArray(b.tags)
      ? b.tags
          .map((tag) => String(tag).trim().replace(/^#+/, '').toLowerCase())
          .filter((tag) => tag.length >= 2 && tag.length <= 30)
          .slice(0, 8)
      : [];

    const host = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, firstName: true, lastName: true, headline: true, avatar: true },
    });
    const hostName =
      host?.displayName?.trim() || [host?.firstName, host?.lastName].filter(Boolean).join(' ').trim() || 'ATHENA member';

    const created = await (prisma as any).event.create({
      data: {
        title,
        description,
        type,
        format,
        date,
        startTime,
        endTime,
        location,
        link,
        image,
        hostName,
        hostTitle: host?.headline?.trim() || 'Community host',
        hostAvatar: host?.avatar || '',
        maxAttendees,
        price,
        tags,
      },
      include: { _count: { select: { registrations: true } } },
    });

    res.status(201).json({ success: true, data: eventView(created, req.user!.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
