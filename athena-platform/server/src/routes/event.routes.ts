import { Router } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';

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
    price: dbEvent.price ?? 0,
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

export default router;
