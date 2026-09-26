import { Router } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { Prisma, type Event as DbEvent, type EventType as DbEventType, type EventFormat as DbEventFormat } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';
import { notifyAdmins } from '../services/admin-notify.service';
import { notificationService } from '../services/notification.service';
import { bestEffort } from '../utils/best-effort';
import { getBlockedRelationshipIds } from '../utils/safety-store';
import { logger } from '../utils/logger';

const router = Router();

type EventType = 'webinar' | 'workshop' | 'networking' | 'conference' | 'meetup';
type EventFormat = 'virtual' | 'in-person' | 'hybrid';

// The return types are the Prisma enums rather than bare strings, so the value
// that ends up in a `where` or a `create` is checked against the schema here
// instead of failing in the database.
function dbEventTypeFromParam(type: string): DbEventType | null {
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

function dbEventFormatFromParam(format: EventFormat): DbEventFormat {
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

function isAdminRole(viewerRole?: string): boolean {
  return String(viewerRole).toUpperCase() === 'ADMIN';
}

function eventView(dbEvent: any, userId?: string, viewerRole?: string) {
  const isRegistered = userId ? (dbEvent.registrations?.length || 0) > 0 : false;
  const isSaved = userId ? (dbEvent.saves?.length || 0) > 0 : false;
  const regCount = dbEvent._count?.registrations ?? 0;

  // A null hostUserId means ATHENA curated the listing; a set one means a
  // member published it. The distinction decides who may see the link.
  const memberHosted = Boolean(dbEvent.hostUserId);
  const isHost = Boolean(userId && dbEvent.hostUserId && dbEvent.hostUserId === userId);
  const isAdmin = isAdminRole(viewerRole);

  // A curated listing's link is a public booking page that staff checked before
  // it went up, so it stays public. A member's link is the way into her
  // gathering — the dialog asks for "Link to join" and the route refuses a
  // virtual event without one — and until 2026-09 that address was handed to
  // every anonymous caller of GET /api/events. Anyone who found the page could
  // walk into a room full of women without ever telling us they were coming.
  // Now the RSVP is the price of the address: she registers, we know she is
  // there, and the host has a list.
  const showLink = !memberHosted || isRegistered || isHost || isAdmin;

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
    link: showLink ? dbEvent.link ?? null : null,
    // So the card can say "register to get the joining link" rather than
    // quietly showing nothing where a button used to be.
    linkRequiresRegistration: memberHosted && !showLink && Boolean(dbEvent.link),
    image: dbEvent.image,
    host: {
      name: dbEvent.hostName,
      title: dbEvent.hostTitle,
      avatar: dbEvent.hostAvatar,
    },
    // The people who registered here, and nobody else. This used to add
    // `baseAttendees` — a number staff can type into the admin API with no
    // check on it — and publish the sum as "N going", so a listing could claim
    // four hundred women were coming when three had said so. A headcount the
    // organiser reports from elsewhere is not attendance ATHENA can vouch
    // for. Those places are still real places, though, so they come off the
    // cap instead: "3 going of 97" is what is actually left here, and the
    // capacity check on register compares the same two numbers.
    attendees: regCount,
    maxAttendees:
      typeof dbEvent.maxAttendees === 'number'
        ? Math.max(0, dbEvent.maxAttendees - (dbEvent.baseAttendees ?? 0))
        : null,
    // Passed through rather than coerced to 0: null means the organiser has
    // not published a price, which the card shows differently from "Free".
    price: dbEvent.price ?? null,
    tags: Array.isArray(dbEvent.tags) ? dbEvent.tags : [],
    isRegistered,
    isSaved,
    isHost,
    // A member wrote it, so a member sees the list of who registered. The card
    // tells her that before she registers, and only on these listings.
    memberHosted,
    // Only the host and an admin are told a listing is waiting on review;
    // to everyone else a held event simply does not exist yet.
    pendingReview: (isHost || isAdmin) && dbEvent.isHidden === true,
  };
}

async function getEventView(eventId: string, userId?: string, viewerRole?: string) {
  const include: Prisma.EventInclude = {
    _count: { select: { registrations: true } },
  };
  if (userId) {
    include.registrations = { where: { userId }, select: { id: true } };
    include.saves = { where: { userId }, select: { id: true } };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, include });
  if (!event) throw new ApiError(404, 'Event not found');
  // A held listing is invisible to everyone but an admin and the member who
  // wrote it; she has to be able to open the thing she just submitted.
  const hostMaySee = Boolean(userId && event.hostUserId === userId);
  if (event.isHidden && !isAdminRole(viewerRole) && !hostMaySee) {
    throw new ApiError(404, 'Event not found');
  }
  return eventView(event, userId, viewerRole);
}

/**
 * The midnight at the start of today, in the server's own zone.
 *
 * An event is "upcoming" from the start of the day it runs on, not from the
 * minute it starts: a workshop at 10am is still worth listing at 9am, and the
 * `date` column carries the day while `startTime` carries the hour. Callers
 * that care about the hour — the public page does — narrow it further.
 */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    // An admin sees everything, including what is waiting on review. A member
    // sees the published catalogue plus anything she herself submitted, so a
    // held listing does not just vanish on her after she wrote it.
    const visibility: Prisma.EventWhereInput = isAdminRole(req.user?.role)
      ? {}
      : req.user?.id
        ? { OR: [{ isHidden: false }, { hostUserId: req.user.id }] }
        : { isHidden: false };

    // The clauses are AND-ed explicitly rather than spread into one object:
    // both the visibility rule and the keyword search want the `OR` key, and a
    // later spread would silently replace an earlier one — which on this route
    // would mean a search returning held listings to strangers.
    // Only what is still to come, and only ever the soonest hundred of those.
    //
    // This route used to take the hundred rows with the earliest date in the
    // table and hand them over, and the pages built on it threw away anything
    // in the past client-side. That works until the platform has run a hundred
    // events: from then on the window holds nothing but finished ones, the
    // client discards the lot, and both the public catalogue and the dashboard
    // calendar say there is nothing on while next week's listings sit in the
    // database unread. Filtering here means the hundred rows are the hundred
    // that are actually coming up.
    const filters: Prisma.EventWhereInput[] = [visibility, { date: { gte: startOfToday() } }];
    if (dbType) filters.push({ type: dbType });
    if (q) {
      filters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          // Best-effort tag match when q equals a tag.
          { tags: { has: q } },
        ],
      });
    }
    const where: Prisma.EventWhereInput = { AND: filters };

    const include: Prisma.EventInclude = { _count: { select: { registrations: true } } };
    if (req.user?.id) {
      include.registrations = { where: { userId: req.user.id }, select: { id: true } };
      include.saves = { where: { userId: req.user.id }, select: { id: true } };
    }

    const events = await prisma.event.findMany({
      where,
      include,
      orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { date: 'asc' }],
      take: 100,
    });

    res.json({
      success: true,
      data: (events || []).map((e: any) => eventView(e, req.user?.id, req.user?.role)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/mine
 * The listings she hosts (every one, held or published, past or to come) and
 * the ones she is registered for that have not happened yet.
 */
router.get('/mine', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const include: Prisma.EventInclude = {
      _count: { select: { registrations: true } },
      registrations: { where: { userId }, select: { id: true } },
      saves: { where: { userId }, select: { id: true } },
    };
    const [hosting, attending] = await Promise.all([
      prisma.event.findMany({ where: { hostUserId: userId }, include, orderBy: { date: 'desc' }, take: 50 }),
      prisma.event.findMany({
        where: {
          AND: [
            { registrations: { some: { userId } } },
            { date: { gte: startOfToday() } },
            { OR: [{ isHidden: false }, { hostUserId: userId }] },
          ],
        },
        include,
        orderBy: { date: 'asc' },
        take: 50,
      }),
    ]);
    res.json({
      success: true,
      data: {
        hosting: hosting.map((e) => eventView(e, userId, req.user?.role)),
        attending: attending.map((e) => eventView(e, userId, req.user?.role)),
      },
    });
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
    // Ensure the event exists and this member may see it. Her own id goes in
    // because a held listing is visible to its host, and to nobody else.
    const event = await getEventView(req.params.id, req.user!.id, req.user?.role);

    // A cap the organiser set is a cap, not a decoration. Until now this route
    // never read maxAttendees: an organiser who booked a room for a hundred
    // would have the five hundredth registration accepted, and the card would
    // then read "500 going of 100". For a gathering of women at a physical
    // address that is a door-and-fire-exit problem, not a counter bug.
    //
    // The numbers compared are the ones the card shows — the registrations
    // taken here against the places left once the organiser's own headcount is
    // taken off the cap — so the cap means the same thing to her as it does to
    // the room. Someone already registered is let through, because re-posting
    // must stay a no-op rather than lock her out of her own place.
    //
    // Two women clicking at the same instant can still both pass this read;
    // there is no database constraint to lean on and the accelerator enrolment
    // route has the same shape. A seat or two over on a simultaneous click is
    // a different problem from four hundred over.
    if (!event.isRegistered && event.maxAttendees != null && event.attendees >= event.maxAttendees) {
      throw new ApiError(409, 'This event is full. The organiser has capped it at the number of places listed.');
    }

    await prisma.eventRegistration.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
      update: {},
      create: { eventId: req.params.id, userId: req.user!.id },
    });

    // Registering used to write the row and say nothing, so the only record
    // she had of where she had said she would be was the card she clicked. A
    // confirmation now goes to her notifications. It is in the app only, on
    // purpose: an email saying which room she will be in, and when, lands in
    // an inbox that is not always hers alone to read, and the lock-screen copy
    // of any push is already made vague for members who asked for that. A
    // repeat click on a place she already has is not news.
    if (!event.isRegistered) {
      const when = new Date(event.date).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Australia/Brisbane',
      });
      await bestEffort(`event ${req.params.id} registration confirmation to ${req.user!.id}`, () =>
        notificationService.notify({
          userId: req.user!.id,
          type: 'SYSTEM',
          title: 'You are registered',
          message: `You have a place at "${event.title}" on ${when}, ${event.startTime} to ${event.endTime}.`,
          link: '/dashboard/events',
          data: { kind: 'EVENT_REGISTERED', eventId: req.params.id },
        })
      );
    }

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
    // Ensure the event exists and this member may see it. Her own id goes in
    // because a held listing is visible to its host, and to nobody else.
    await getEventView(req.params.id, req.user!.id, req.user?.role);

    try {
      await prisma.eventRegistration.delete({
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
    // Ensure the event exists and this member may see it. Her own id goes in
    // because a held listing is visible to its host, and to nobody else.
    await getEventView(req.params.id, req.user!.id, req.user?.role);

    await prisma.eventSave.upsert({
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
    // Ensure the event exists and this member may see it. Her own id goes in
    // because a held listing is visible to its host, and to nobody else.
    await getEventView(req.params.id, req.user!.id, req.user?.role);

    try {
      await prisma.eventSave.delete({
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
 * The fields a member writes on her own listing, parsed and checked.
 *
 * One parser for the create and the edit, so a listing cannot be written in a
 * shape through PATCH that POST would have refused. `partial` is the edit: a
 * field that was not sent is left out rather than defaulted, and the checks
 * that span fields (a virtual event needs a link; the end comes after the
 * start) are made by the caller on the merged row.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type EventInput = {
  title?: string;
  description?: string;
  type?: DbEventType;
  format?: DbEventFormat;
  date?: Date;
  startTime?: string;
  endTime?: string;
  location?: string | null;
  link?: string | null;
  image?: string;
  maxAttendees?: number | null;
  price?: number;
  tags?: string[];
};

function parseEventInput(b: Record<string, unknown>, partial: boolean): EventInput {
  const out: EventInput = {};
  const sent = (key: string) => !partial || b[key] !== undefined;

  if (sent('title')) out.title = normalizeUserText(b.title, { field: 'title', maxLength: 120 });
  if (sent('description')) out.description = normalizeUserText(b.description, { field: 'description', maxLength: 4000 });

  if (sent('type')) {
    const type = dbEventTypeFromParam(String(b.type ?? ''));
    if (!type) throw new ApiError(400, 'type must be webinar, workshop, networking, conference or meetup');
    out.type = type;
  }
  if (sent('format')) out.format = dbEventFormatFromParam(String(b.format ?? 'virtual') as EventFormat);

  if (sent('date')) {
    const date = new Date(String(b.date ?? ''));
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'date must be a valid date');
    if (date.getTime() < Date.now() - 24 * 60 * 60 * 1000) throw new ApiError(400, 'The event date has already passed');
    out.date = date;
  }

  for (const key of ['startTime', 'endTime'] as const) {
    if (sent(key)) {
      const value = String(b[key] ?? '');
      if (!TIME_PATTERN.test(value)) throw new ApiError(400, 'startTime and endTime must be HH:MM');
      out[key] = value;
    }
  }

  if (sent('location')) {
    out.location = normalizeOptionalUserText(b.location, { field: 'location', maxLength: 200, allowEmpty: true }) || null;
  }
  if (sent('link')) out.link = b.link ? normalizeSafeUrl(b.link, { field: 'link' }) : null;
  if (sent('image')) {
    out.image = b.image ? normalizeSafeUrl(b.image, { field: 'image', allowRelativeUploads: true }) : '/icon.svg';
  }

  if (sent('maxAttendees')) {
    const maxAttendees =
      b.maxAttendees === undefined || b.maxAttendees === null || b.maxAttendees === '' ? null : Number(b.maxAttendees);
    if (maxAttendees !== null && (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 100000)) {
      throw new ApiError(400, 'maxAttendees must be a whole number');
    }
    out.maxAttendees = maxAttendees;
  }

  if (sent('price')) {
    const price = b.price === undefined || b.price === null || b.price === '' ? 0 : Number(b.price);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
      throw new ApiError(400, 'price must be a whole number of dollars');
    }
    out.price = price;
  }

  if (sent('tags')) {
    out.tags = Array.isArray(b.tags)
      ? b.tags
          .map((tag) => String(tag).trim().replace(/^#+/, '').toLowerCase())
          .filter((tag) => tag.length >= 2 && tag.length <= 30)
          .slice(0, 8)
      : [];
  }

  return out;
}

/** The checks that need more than one field, made on the row as it will be. */
function assertEventShape(e: {
  format: DbEventFormat;
  startTime: string;
  endTime: string;
  location: string | null;
  link: string | null;
}) {
  if (e.endTime <= e.startTime) throw new ApiError(400, 'endTime must be after startTime');
  if (e.format === 'VIRTUAL' && !e.link) throw new ApiError(400, 'A virtual event needs a link to join');
  if (e.format === 'IN_PERSON' && !e.location) throw new ApiError(400, 'An in-person event needs a location');
  if (e.format === 'HYBRID' && !e.link && !e.location) throw new ApiError(400, 'A hybrid event needs a link or a location');
}

/**
 * POST /api/events
 * Host an event. The host details come from the member's own profile.
 *
 * This route was originally added because "Host Event" on the events page had
 * no handler, and it published straight to the public catalogue: no owner on
 * the row, no way for a member to report it, and the joining link served to
 * anonymous callers. On a platform used by women leaving violent relationships
 * that is an invitation anyone can find and nobody can trace, so a member's
 * listing is now held for review, carries `hostUserId`, and keeps its link for
 * the people who have said they are coming. The admin events console at
 * /admin/events is where a held listing is read and released.
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const input = parseEventInput(b, false);
    const title = input.title!;
    const date = input.date!;
    const shape = {
      format: input.format!,
      startTime: input.startTime!,
      endTime: input.endTime!,
      location: input.location ?? null,
      link: input.link ?? null,
    };
    assertEventShape(shape);

    const host = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, firstName: true, lastName: true, headline: true, avatar: true },
    });
    const hostName =
      host?.displayName?.trim() || [host?.firstName, host?.lastName].filter(Boolean).join(' ').trim() || 'ATHENA member';

    const created = await prisma.event.create({
      data: {
        title,
        description: input.description!,
        type: input.type!,
        ...shape,
        date,
        image: input.image ?? '/icon.svg',
        hostName,
        hostTitle: host?.headline?.trim() || 'Community host',
        hostAvatar: host?.avatar || '',
        hostUserId: req.user!.id,
        // Held until a moderator has read it. hostName is copied from a profile
        // field the member controls, so it is not attribution; hostUserId is.
        isHidden: true,
        maxAttendees: input.maxAttendees ?? null,
        price: input.price ?? 0,
        tags: input.tags ?? [],
      },
      include: { _count: { select: { registrations: true } } },
    });

    // Same shape the wellness and vendor queues use: one in-app notice per
    // admin, pointing at the queue rather than the row. It never fails the
    // request — she should see "submitted" even if the admin list cannot be
    // read, and the console finds her listing either way.
    await notifyAdmins({
      title: 'A member has listed an event',
      message: `${hostName} has listed "${title}" for ${date.toISOString().slice(0, 10)} and it is waiting to be reviewed.`,
      link: '/admin/events',
      data: { kind: 'MEMBER_EVENT_REVIEW', eventId: created.id, hostUserId: req.user!.id },
    });

    res.status(201).json({ success: true, data: eventView(created, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// THE HOST'S OWN LISTING: WHO IS COMING, CHANGING IT, CALLING IT OFF
// ===========================================================================
//
// Until now a member who hosted an event could write it and nothing else. The
// listing said the host had a list of who was coming; she did not — no route
// returned one, to her or to staff. A venue that fell through, a joining link
// that changed, an evening she had to call off: none of it could be done in
// the product, and staff could not do it for her either, because the admin
// console only pins, features and hides. These routes are hers, and an
// admin's.

/** The host, or staff. Anyone else is told the listing does not exist. */
async function loadOwnEvent(eventId: string, user: { id: string; role?: string }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) throw new ApiError(404, 'Event not found');
  const isHost = Boolean(event.hostUserId && event.hostUserId === user.id);
  if (!isHost && !isAdminRole(user.role)) throw new ApiError(404, 'Event not found');
  return { event, isHost };
}

/**
 * Keep what a report was about, before the host changes or removes it.
 *
 * A report on an event names the event by id. If the host could then rewrite
 * the listing or delete it, the moderator opening the report would find a
 * different listing or nothing at all — and the listings most likely to be
 * rewritten in a hurry are the ones that were reported. So before either
 * happens, the listing as it stood is written into every report on it. The
 * host is not told whether any report exists; this runs the same either way.
 */
async function preserveForReports(event: DbEvent, why: 'EDITED' | 'CANCELLED') {
  const reports = await prisma.contentReport.findMany({
    where: { contentType: 'EVENT', contentId: event.id },
    select: { id: true, evidence: true },
  });
  const snapshot = {
    capturedAt: new Date().toISOString(),
    because: why,
    title: event.title,
    description: event.description,
    date: event.date.toISOString(),
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    link: event.link,
    image: event.image,
    price: event.price,
    hostName: event.hostName,
    hostUserId: event.hostUserId,
  };
  for (const report of reports) {
    const existing =
      report.evidence && typeof report.evidence === 'object' && !Array.isArray(report.evidence)
        ? (report.evidence as Prisma.JsonObject)
        : {};
    const earlier = Array.isArray(existing.eventSnapshots) ? existing.eventSnapshots : [];
    await prisma.contentReport.update({
      where: { id: report.id },
      data: { evidence: { ...existing, eventSnapshots: [...earlier, snapshot] } },
    });
  }
}

/** Tell everyone registered, in the app only. See the note on register below. */
async function tellRegistrants(eventId: string, title: string, message: string, link: string) {
  const registrations = await prisma.eventRegistration.findMany({ where: { eventId }, select: { userId: true } });
  for (const r of registrations) {
    await bestEffort(`event ${eventId} notice to registrant ${r.userId}`, () =>
      notificationService.notify({ userId: r.userId, type: 'SYSTEM', title, message, link })
    );
  }
  return registrations.length;
}

/**
 * GET /api/events/:id/registrations
 * Who has registered, for the host and for staff.
 *
 * What the host is given is deliberately thin: the name each woman shows the
 * platform, and when she registered — no surname, no profile, no contact
 * details. A host is a member like any other, and a list of who will be in a
 * given room at a given hour is exactly what someone looking for a woman who
 * has left would want. So a registrant is listed without her name when she
 * has Safe Mode on (either switch), keeps her profile private, or has a block
 * either way with this host; she still counts towards the numbers. Staff see
 * full names, because they are the ones who act on a report.
 */
router.get('/:id/registrations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { event, isHost } = await loadOwnEvent(req.params.id, req.user!);
    const staffView = !isHost;

    const [rows, blocked] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'asc' },
        take: 1000,
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              safetySettings: { select: { profileVisibility: true } },
              dvSafetyProfile: { select: { isSafeMode: true, hideFromSearch: true } },
              profile: { select: { isSafeMode: true } },
            },
          },
        },
      }),
      isHost ? getBlockedRelationshipIds(req.user!.id) : Promise.resolve([] as string[]),
    ]);
    const blockedIds = new Set(blocked);

    let withheld = 0;
    const registrations = rows.map((r) => {
      const u = r.user;
      if (staffView) {
        return {
          id: r.id,
          registeredAt: r.createdAt,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName || 'A member',
          nameWithheld: false,
          userId: u.id,
        };
      }
      const hidden =
        Boolean(u.dvSafetyProfile?.isSafeMode) ||
        Boolean(u.dvSafetyProfile?.hideFromSearch) ||
        Boolean(u.profile?.isSafeMode) ||
        u.safetySettings?.profileVisibility === 'private' ||
        blockedIds.has(u.id);
      if (hidden) withheld += 1;
      return {
        id: r.id,
        registeredAt: r.createdAt,
        name: hidden ? null : u.displayName?.trim() || u.firstName || 'A member',
        nameWithheld: hidden,
      };
    });

    res.json({
      success: true,
      data: { eventId: event.id, total: event._count.registrations, withheld, registrations },
    });
  } catch (err) {
    next(err);
  }
});

// Fields whose change alters what the listing says or where it sends people.
// On a published member listing, changing any of these puts it back in front
// of a moderator: the review is of what she wrote, and a listing approved as a
// library meetup that is then moved to a private address is a different
// listing. The date, the times and the cap are logistics, and do not.
const REVIEWED_FIELDS = ['title', 'description', 'type', 'format', 'location', 'link', 'image', 'price', 'tags'] as const;
// The fields a registrant has to hear about, because she may already have
// planned around them.
const LOGISTICS_FIELDS = ['date', 'startTime', 'endTime', 'location', 'link', 'format'] as const;

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

/**
 * PATCH /api/events/:id
 * The host changes her own listing.
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { event, isHost } = await loadOwnEvent(req.params.id, req.user!);
    if (event.date.getTime() < startOfToday().getTime()) {
      throw new ApiError(400, 'This event has already happened, so its listing is kept as it was.');
    }

    const input = parseEventInput((req.body ?? {}) as Record<string, unknown>, true);
    const changed = (Object.keys(input) as Array<keyof EventInput>).filter(
      (key) => !sameValue(input[key], (event as Record<string, unknown>)[key])
    );
    if (changed.length === 0) {
      return res.json({ success: true, data: await getEventView(event.id, req.user!.id, req.user?.role) });
    }

    assertEventShape({
      format: input.format ?? event.format,
      startTime: input.startTime ?? event.startTime,
      endTime: input.endTime ?? event.endTime,
      location: input.location !== undefined ? input.location : event.location,
      link: input.link !== undefined ? input.link : event.link,
    });

    const registered = event._count.registrations;
    if (input.maxAttendees != null && input.maxAttendees < registered + (event.baseAttendees ?? 0)) {
      throw new ApiError(
        400,
        `${registered} ${registered === 1 ? 'person is' : 'people are'} already registered, so the cap cannot go below that.`
      );
    }

    // A member's published listing goes back to review when what it says
    // changes; staff editing a listing are the review.
    const backToReview =
      isHost &&
      !isAdminRole(req.user?.role) &&
      event.hostUserId !== null &&
      event.isHidden === false &&
      changed.some((key) => (REVIEWED_FIELDS as readonly string[]).includes(key));

    if (changed.some((key) => (REVIEWED_FIELDS as readonly string[]).includes(key))) {
      await preserveForReports(event, 'EDITED');
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { ...input, ...(backToReview ? { isHidden: true } : {}) },
    });

    if (backToReview) {
      await notifyAdmins({
        title: 'A member has changed a published event',
        message: `"${event.title}" was changed by its host (${changed.join(', ')}) and is held again until it has been reviewed.`,
        link: '/admin/events',
        data: { kind: 'MEMBER_EVENT_REVIEW', eventId: event.id, hostUserId: event.hostUserId, changed },
      });
    }

    const logisticsChanged = changed.some((key) => (LOGISTICS_FIELDS as readonly string[]).includes(key));
    if (logisticsChanged) {
      await tellRegistrants(
        event.id,
        'An event you registered for has changed',
        backToReview
          ? `The host of "${input.title ?? event.title}" has changed its details. ATHENA is checking the change, and the listing will be back on your events page once it has been.`
          : `The host of "${input.title ?? event.title}" has changed the date, time or place. Check the listing before you go.`,
        '/dashboard/events'
      );
    }

    res.json({ success: true, data: await getEventView(event.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:id
 * The host calls her event off.
 *
 * There is no "cancelled" state on an event to leave behind, so calling it off
 * removes the listing and the registrations with it. Everyone who registered
 * is told first, in the app, so nobody turns up to a room that is not booked.
 * An event that has already happened is history, and stays.
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { event } = await loadOwnEvent(req.params.id, req.user!);
    if (event.date.getTime() < startOfToday().getTime()) {
      throw new ApiError(400, 'This event has already happened, so there is nothing to cancel.');
    }

    await preserveForReports(event, 'CANCELLED');
    const when = event.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' });
    const told = await tellRegistrants(
      event.id,
      'An event you registered for is cancelled',
      `"${event.title}" on ${when} has been cancelled by its host, and will not go ahead.`,
      '/dashboard/events'
    );

    await prisma.event.delete({ where: { id: event.id } });
    logger.info('Event cancelled by its host', {
      eventId: event.id,
      by: req.user!.id,
      hostUserId: event.hostUserId,
      registrantsTold: told,
    });

    res.json({ success: true, data: { id: event.id, registrantsTold: told } });
  } catch (err) {
    next(err);
  }
});

export default router;
