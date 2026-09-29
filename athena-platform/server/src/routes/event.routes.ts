import { Router } from 'express';
import { createHash } from 'crypto';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { Prisma, type Event as DbEvent, type EventType as DbEventType, type EventFormat as DbEventFormat } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';
import { notifyAdmins } from '../services/admin-notify.service';
import { auditAfterCommit } from '../services/admin-audit.service';
import { notificationService } from '../services/notification.service';
import { bestEffort } from '../utils/best-effort';
import { getBlockedRelationshipIds } from '../utils/safety-store';
import { logger } from '../utils/logger';
import { runExclusively } from '../utils/redis';
import { recordFailure, recordSuccess } from '../utils/ops-metrics';
import { sendEmail } from '../utils/email';

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
  const cancelledAt: Date | null = dbEvent.cancelledAt ? new Date(dbEvent.cancelledAt) : null;

  // A curated listing's link is a public booking page that staff checked before
  // it went up, so it stays public. A member's link is the way into her
  // gathering — the dialog asks for "Link to join" and the route refuses a
  // virtual event without one — and until 2026-09 that address was handed to
  // every anonymous caller of GET /api/events. Anyone who found the page could
  // walk into a room full of women without ever telling us they were coming.
  // Now the RSVP is the price of the address: she registers, we know she is
  // there, and the host has a list.
  //
  // Once an event is called off the link goes from everyone but the host and
  // staff. A cancelled listing still sits on the page, marked, so the women
  // who registered can see what happened to it; a working "Join" or "Book"
  // beside that mark would send someone into a room nobody is running, or to a
  // booking page for a date that is not going ahead.
  const showLink = cancelledAt ? isHost || isAdmin : !memberHosted || isRegistered || isHost || isAdmin;

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
    // quietly showing nothing where a button used to be. Never on a cancelled
    // event: registering for it is refused, so the promise would be false.
    linkRequiresRegistration: !cancelledAt && memberHosted && !showLink && Boolean(dbEvent.link),
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
    // Called off, and when. Everyone who can see the listing sees that it is
    // not going ahead, which is the point of keeping it on the page. Why is
    // for the women who had a place, the host and staff: a stranger browsing
    // the catalogue does not need the reason, and the women who planned
    // around it do.
    isCancelled: Boolean(cancelledAt),
    cancelledAt: cancelledAt ? cancelledAt.toISOString() : null,
    cancelledReason: cancelledAt && (isRegistered || isHost || isAdmin) ? dbEvent.cancelledReason ?? null : null,
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

    // A cancelled event stays in the list, marked, until its day has passed:
    // a woman who registered and comes back to check should find it saying
    // "cancelled" rather than find it gone. It sorts after everything that is
    // still going ahead, so a called-off listing never holds one of the
    // hundred places ahead of one somebody can actually attend.
    const events = await prisma.event.findMany({
      where,
      include,
      orderBy: [
        { cancelledAt: { sort: 'desc', nulls: 'first' } },
        { isPinned: 'desc' },
        { isFeatured: 'desc' },
        { date: 'asc' },
      ],
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

    // A called-off event is not taking places. The listing stays up so the
    // women who registered can see what happened to it, and without this a
    // newcomer could register for it and be sent a confirmation for a room
    // nobody is running.
    if (event.isCancelled) {
      throw new ApiError(409, 'This event has been cancelled, so it is not taking registrations.');
    }

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
      // A priced event: registering has put her on the list and taken nothing.
      // The confirmation used to read like a receipt for a ticket, and ATHENA
      // sells no tickets, so a woman could arrive at a paid event believing
      // she had paid for it.
      const payment =
        typeof event.price === 'number' && event.price > 0
          ? ` ATHENA has not taken any payment: the organiser charges $${event.price}, which you pay them directly, as their listing describes.`
          : '';
      await bestEffort(`event ${req.params.id} registration confirmation to ${req.user!.id}`, () =>
        notificationService.notify({
          userId: req.user!.id,
          type: 'SYSTEM',
          title: 'You are registered',
          message: `You have a place at "${event.title}" on ${when}, ${event.startTime} to ${event.endTime}.${payment}`,
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
    // Everyone registered has been told it is off. Moving the date or the
    // place of a listing marked cancelled would tell them nothing and leave
    // the page saying two things at once.
    if (event.cancelledAt) {
      throw new ApiError(409, 'This event has been cancelled, so its listing is kept as it was.');
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

    // Staff changing a listing that is not theirs is a staff action on a
    // member's work, and the log has to be able to say who did it. The host
    // editing her own listing is not.
    if (!isHost) {
      await auditAfterCommit({
        action: 'ADMIN_EVENT_UPDATE',
        actorUserId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { eventId: event.id, hostUserId: event.hostUserId, updatedFields: changed },
      });
    }

    res.json({ success: true, data: await getEventView(event.id, req.user!.id, req.user?.role) });
  } catch (err) {
    next(err);
  }
});

/**
 * Why a host may say her event is off.
 *
 * A host picks one of these rather than writing her own. The reason is sent to
 * every woman who registered and shown on the listing, and nobody reads it
 * before it goes out — so a free-text box here would be a way round the review
 * that a change of place or link goes through: "cancelled, come to 14 Such
 * Street instead" would reach every registrant with nothing in between. Staff
 * write their own reason, because staff are the review.
 */
const HOST_CANCEL_REASONS = {
  HOST_UNAVAILABLE: 'The host is no longer able to run it.',
  VENUE_UNAVAILABLE: 'The venue is no longer available.',
  TOO_FEW_REGISTERED: 'Not enough people registered for it to go ahead.',
  OTHER: 'The host has had to call it off.',
} as const;

type HostCancelReason = keyof typeof HOST_CANCEL_REASONS;

function isHostCancelReason(value: unknown): value is HostCancelReason {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HOST_CANCEL_REASONS, value);
}

function cancellationReason(raw: unknown, staff: boolean): string {
  if (isHostCancelReason(raw)) return HOST_CANCEL_REASONS[raw];
  if (!staff) {
    throw new ApiError(400, `reason must be one of ${Object.keys(HOST_CANCEL_REASONS).join(', ')}`);
  }
  const text = normalizeUserText(raw, { field: 'reason', maxLength: 500 });
  if (text.length < 3) throw new ApiError(400, 'Say in a few words why the event is cancelled');
  return text;
}

/**
 * POST /api/events/:id/cancel
 * The host, or staff, calls an event off.
 *
 * This used to be DELETE /api/events/:id, and there was no cancelled state to
 * leave behind, so calling an event off removed the listing and every
 * registration with it. The notice went out first, but after that a woman who
 * had registered and came back to check found the event simply gone from her
 * list, with nothing to say whether it had been called off or whether she had
 * been removed from it; and the only record of who had needed telling went
 * with the rows. Now the listing stays, marked with when it was called off and
 * why, the registrations stay with it, and her own list and the public one
 * both say "cancelled" until the day has passed.
 *
 * Everyone registered is told in the app, as every event notice is: an email
 * naming a room and an hour lands in an inbox that is not always hers alone.
 * An event that has already happened is history, and stays as it was.
 */
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { event, isHost } = await loadOwnEvent(req.params.id, req.user!);
    const staff = isAdminRole(req.user?.role);
    if (event.cancelledAt) {
      throw new ApiError(409, 'This event has already been cancelled.');
    }
    if (event.date.getTime() < startOfToday().getTime()) {
      throw new ApiError(400, 'This event has already happened, so there is nothing to cancel.');
    }
    const reason = cancellationReason((req.body ?? {}).reason, staff);

    // Marked only if nobody else has marked it first. The check above reads
    // the row; a second click, or the host and staff at the same moment, can
    // both pass it, and each would then send every registrant the notice
    // again. The conditional write lets exactly one of them through.
    const marked = await prisma.event.updateMany({
      where: { id: event.id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelledReason: reason },
    });
    if (marked.count === 0) {
      throw new ApiError(409, 'This event has already been cancelled.');
    }
    await preserveForReports(event, 'CANCELLED');

    const when = event.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' });
    const byWhom = isHost ? 'its host' : 'ATHENA';
    const told = await tellRegistrants(
      event.id,
      'An event you registered for is cancelled',
      `"${event.title}" on ${when} has been cancelled by ${byWhom} and will not go ahead. ${reason}`,
      '/dashboard/events'
    );

    // Staff calling off a member's listing tell her themselves, rather than
    // leaving her to find the mark on her own event.
    if (!isHost && event.hostUserId) {
      const hostUserId = event.hostUserId;
      await bestEffort(`event ${event.id} cancellation notice to host ${hostUserId}`, () =>
        notificationService.notify({
          userId: hostUserId,
          type: 'SYSTEM',
          title: 'Your event has been cancelled',
          message: `ATHENA has cancelled "${event.title}" on ${when}. ${reason} Everyone who registered has been told.`,
          link: '/dashboard/events',
          data: { kind: 'EVENT_CANCELLED_BY_STAFF', eventId: event.id },
        })
      );
    }

    if (!isHost) {
      await auditAfterCommit({
        action: 'ADMIN_EVENT_UPDATE',
        actorUserId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { eventId: event.id, hostUserId: event.hostUserId, change: 'CANCELLED', registrantsTold: told },
      });
    }

    logger.info('Event cancelled', {
      eventId: event.id,
      by: req.user!.id,
      byHost: isHost,
      hostUserId: event.hostUserId,
      registrantsTold: told,
    });

    res.json({
      success: true,
      data: { event: await getEventView(event.id, req.user!.id, req.user?.role), registrantsTold: told },
    });
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// AFTER SHE REGISTERS: HER CALENDAR, AND A REMINDER THE DAY BEFORE
// ===========================================================================
//
// Registering used to be the last thing that happened. The confirmation now
// lands in her notifications, but nothing put the event in her own calendar
// and nothing reminded her it was coming, so a woman who said yes to a Tuesday
// workshop three weeks out had only her memory of a card she once clicked.
//
// Both are built for the member this platform is for. The calendar file is
// something she asks for, never something sent, and it has a discreet form
// that names nothing: a calendar synced to a shared account, or a phone
// somebody else picks up, shows "Appointment" and no place. The reminder is in
// the app, like every other event notice. Email is only ever sent to a member
// who has switched it on, and it says that something is on tomorrow and
// nothing else — no title, no time, no address — because an inbox is not
// always hers alone to read.

const BRISBANE = 'Australia/Brisbane';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The calendar day a moment falls on in Brisbane, as yyyy-mm-dd.
 *
 * The `date` column carries the day an event runs on, and the confirmation
 * and every notice name that day in Brisbane time, so the calendar file and
 * the reminder do the same. Queensland keeps no daylight saving, so a day
 * here is always twenty-four hours long.
 */
export function brisbaneDay(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRISBANE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(moment);
}

function brisbaneHour(moment: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: BRISBANE, hour: '2-digit', hourCycle: 'h23' }).format(moment));
}

/** Text as RFC 5545 wants it: backslash, semicolon, comma and line breaks escaped. */
function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * One content line, folded at 75 octets as the standard requires.
 *
 * Counted in bytes, not characters, and never split inside a character: an
 * event called "Café catch-up" or written in any language with accents or
 * non-Latin script would otherwise be cut through the middle of a letter, and
 * calendar apps reject or garble the whole file rather than the one line.
 */
function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const bytes = Buffer.byteLength(ch, 'utf8');
    // A continuation line starts with one space, which counts towards its 75.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function icsUtcStamp(moment: Date): string {
  return moment.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export type CalendarEventInput = {
  id: string;
  title: string;
  description: string;
  format: DbEventFormat;
  date: Date;
  startTime: string;
  endTime: string;
  location: string | null;
  link: string | null;
  updatedAt: Date;
};

/**
 * The event as an iCalendar file.
 *
 * The times are written as floating local times — "09:00", with no zone —
 * which is exactly how the organiser published them and how every page here
 * shows them. Pinning them to Brisbane would move a Sydney workshop an hour
 * for half the year, and the listing carries no zone to pin them to anything
 * better. A listing whose times are not HH:MM, which only an old curated row
 * could be, goes in as an all-day entry rather than at a guessed hour.
 *
 * `discreet` names nothing: "Appointment", no description, no place, no link,
 * and nothing in the file that says ATHENA, down to the identifiers a
 * calendar app never shows but a person opening the file as text would see.
 */
export function buildEventCalendar(
  event: CalendarEventInput,
  options: { discreet: boolean; now?: Date; siteUrl?: string }
): string {
  const now = options.now ?? new Date();
  const day = brisbaneDay(event.date).replace(/-/g, '');
  const timed = TIME_PATTERN.test(event.startTime) && TIME_PATTERN.test(event.endTime) && event.endTime > event.startTime;
  const nextDay = brisbaneDay(new Date(event.date.getTime() + DAY_MS)).replace(/-/g, '');
  const uid = options.discreet
    ? `${createHash('sha256').update(event.id).digest('hex').slice(0, 24)}@calendar`
    : `${event.id}@athena`;
  // Minutes since the epoch fit comfortably in the integer the standard
  // allows, and grow whenever the listing changes, so a calendar that already
  // holds the entry takes a fresh download as the newer copy.
  const sequence = Math.floor(event.updatedAt.getTime() / 60000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    options.discreet ? 'PRODID:-//Calendar//EN' : 'PRODID:-//ATHENA//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtcStamp(now)}`,
    `SEQUENCE:${sequence}`,
    ...(timed
      ? [
          `DTSTART:${day}T${event.startTime.replace(':', '')}00`,
          `DTEND:${day}T${event.endTime.replace(':', '')}00`,
        ]
      : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay}`]),
  ];

  if (options.discreet) {
    lines.push('SUMMARY:Appointment');
  } else {
    lines.push(`SUMMARY:${icsText(event.title)}`);
    const where = event.location?.trim() || (event.format === 'VIRTUAL' && event.link ? event.link : null);
    if (where) lines.push(`LOCATION:${icsText(where)}`);
    if (event.link) lines.push(`URL:${icsText(event.link)}`);
    const site = options.siteUrl?.replace(/\/+$/, '');
    const about = event.description.length > 1000 ? `${event.description.slice(0, 999)}…` : event.description;
    const description = [about, event.link ? `Joining link: ${event.link}` : null, site ? `Your events on ATHENA: ${site}/dashboard/events` : null]
      .filter(Boolean)
      .join('\n\n');
    lines.push(`DESCRIPTION:${icsText(description)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/**
 * GET /api/events/:id/calendar.ics?discreet=1
 * The event as a file for her own calendar: for a woman who has registered,
 * the host, and staff.
 *
 * Without `discreet` in the address, a member with Safe Mode on gets the
 * discreet file, because Safe Mode is her standing answer to "should this
 * name where I will be". The events page always says which one it wants.
 */
router.get('/:id/calendar.ics', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const staff = isAdminRole(req.user?.role);
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { registrations: { where: { userId }, select: { id: true } } },
    });
    const isHost = Boolean(event?.hostUserId && event.hostUserId === userId);
    if (!event || (event.isHidden && !isHost && !staff)) {
      throw new ApiError(404, 'Event not found');
    }
    if (event.registrations.length === 0 && !isHost && !staff) {
      throw new ApiError(403, 'Register for this event to add it to your calendar.');
    }
    // A file for something that is not happening would put it back in her
    // week. The notice she was sent says it is off, and the listing does too.
    if (event.cancelledAt) {
      throw new ApiError(409, 'This event has been cancelled, so there is nothing to add to your calendar.');
    }

    const asked = typeof req.query.discreet === 'string' ? req.query.discreet.trim().toLowerCase() : '';
    let discreet: boolean;
    if (asked === '1' || asked === 'true') {
      discreet = true;
    } else if (asked === '0' || asked === 'false') {
      discreet = false;
    } else {
      const member = await prisma.user.findUnique({
        where: { id: userId },
        select: { dvSafetyProfile: { select: { isSafeMode: true } }, profile: { select: { isSafeMode: true } } },
      });
      discreet = Boolean(member?.dvSafetyProfile?.isSafeMode) || Boolean(member?.profile?.isSafeMode);
    }

    const body = buildEventCalendar(event, { discreet, siteUrl: process.env.CLIENT_URL });
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      // A neutral name: the file sits in her downloads folder afterwards.
      'Content-Disposition': `attachment; filename="${discreet ? 'appointment' : 'event'}.ics"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(body);
  } catch (err) {
    next(err);
  }
});

// Reminders go out in daylight, the day before. The sweep runs every hour, so
// without a window the first run after midnight would send them — the email,
// for a member who asked for one, arriving at two in the morning, which is the
// wrong hour for anyone and a conspicuous one for some.
const REMINDER_FROM_HOUR = 9;
const REMINDER_UNTIL_HOUR = 21;

export type EventReminderSweep = { events: number; reminded: number; hostsReminded: number; emailed: number };

type ReminderPreferences = { inApp?: { all?: unknown }; email?: { eventReminders?: unknown } } | null;

function reminderChannels(raw: unknown): { inApp: boolean; email: boolean } {
  const prefs = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as ReminderPreferences;
  return {
    inApp: prefs?.inApp?.all !== false,
    // Opt-in, and only by an explicit yes: an absent or malformed setting is a no.
    email: prefs?.email?.eventReminders === true,
  };
}

/**
 * The day-before reminder, for every event that runs tomorrow in Brisbane.
 *
 * Each woman registered is told in the app, once: the reminder is keyed on the
 * member and the event, so however often the sweep runs she hears it one time.
 * The host is told too, with the number registered, because the day before is
 * the last useful moment to call it off properly rather than leave a room of
 * women waiting. A held listing is not reminded about, since to everyone but
 * its host it does not exist yet, and a cancelled one has had its notice.
 *
 * A member who has turned in-app notices off is not sent one. If she has
 * turned event reminder emails on, she gets the email, and the reminder is
 * still written, already read, so that it is sent once and not every hour.
 */
export async function runEventReminderSweep(now = new Date()): Promise<EventReminderSweep> {
  const result: EventReminderSweep = { events: 0, reminded: 0, hostsReminded: 0, emailed: 0 };
  const hour = brisbaneHour(now);
  if (hour < REMINDER_FROM_HOUR || hour >= REMINDER_UNTIL_HOUR) return result;

  const tomorrow = brisbaneDay(new Date(now.getTime() + DAY_MS));
  // The column holds a day, written as midnight UTC when it came from a bare
  // date and as midnight in Brisbane (the afternoon before, in UTC) when it
  // came with an offset. The query reads a window wide enough for both and
  // the day itself is settled below, the same way the notices name it.
  const candidates = await prisma.event.findMany({
    where: {
      cancelledAt: null,
      isHidden: false,
      date: { gte: new Date(now.getTime() - 12 * HOUR_MS), lte: new Date(now.getTime() + 60 * HOUR_MS) },
    },
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      hostUserId: true,
      registrations: { select: { userId: true } },
    },
  });
  const due = candidates.filter((e) => brisbaneDay(e.date) === tomorrow);
  if (due.length === 0) return result;
  result.events = due.length;

  const dueIds = new Set(due.map((e) => e.id));
  const earlier = await prisma.notification.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 4 * DAY_MS) }, data: { path: ['kind'], equals: 'EVENT_REMINDER' } },
    select: { userId: true, data: true },
  });
  const done = new Set<string>();
  for (const n of earlier) {
    const eventId = (n.data as { eventId?: unknown } | null)?.eventId;
    if (typeof eventId === 'string' && dueIds.has(eventId)) done.add(`${n.userId}:${eventId}`);
  }

  const people = new Set<string>();
  for (const e of due) {
    for (const r of e.registrations) people.add(r.userId);
    if (e.hostUserId) people.add(e.hostUserId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(people) } },
    select: { id: true, email: true, notificationPreferences: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const site = (process.env.CLIENT_URL || '').replace(/\/+$/, '');

  for (const e of due) {
    const hours = `${e.startTime} to ${e.endTime}`;

    for (const r of e.registrations) {
      if (r.userId === e.hostUserId || done.has(`${r.userId}:${e.id}`)) continue;
      const member = byId.get(r.userId);
      if (!member) continue;
      const channels = reminderChannels(member.notificationPreferences);
      if (!channels.inApp && !channels.email) continue;

      const written = await bestEffort(`event ${e.id} reminder to ${r.userId}`, async () => {
        await prisma.notification.create({
          data: {
            userId: r.userId,
            type: 'SYSTEM',
            title: 'Tomorrow',
            message: `"${e.title}" is tomorrow, ${hours}. The details, and any joining link, are on your events page.`,
            link: '/dashboard/events',
            isRead: !channels.inApp,
            ...(channels.inApp ? {} : { readAt: now }),
            data: { kind: 'EVENT_REMINDER', eventId: e.id, role: 'registrant' },
          },
        });
        return true;
      }, false);
      if (!written) continue;
      done.add(`${r.userId}:${e.id}`);
      result.reminded += 1;

      const to = member.email;
      if (channels.email && to) {
        const link = site ? `${site}/dashboard/events` : '';
        const sent = await bestEffort(`event reminder email to ${r.userId}`, () =>
          sendEmail({
            to,
            subject: 'Something on tomorrow',
            text: `You have something on tomorrow that you said you would go to. Sign in to see the details.${link ? `\n\n${link}` : ''}`,
            html: `<p>You have something on tomorrow that you said you would go to. Sign in to see the details.</p>${
              link ? `<p><a href="${link}">Your events</a></p>` : ''
            }`,
          }), false);
        if (sent) result.emailed += 1;
      }
    }

    const hostUserId = e.hostUserId;
    if (hostUserId && !done.has(`${hostUserId}:${e.id}`)) {
      const host = byId.get(hostUserId);
      if (host && reminderChannels(host.notificationPreferences).inApp) {
        const count = e.registrations.filter((r) => r.userId !== hostUserId).length;
        const who = count === 0 ? 'Nobody has registered yet.' : `${count} ${count === 1 ? 'person has' : 'people have'} registered.`;
        const written = await bestEffort(`event ${e.id} reminder to host ${hostUserId}`, async () => {
          await prisma.notification.create({
            data: {
              userId: hostUserId,
              type: 'SYSTEM',
              title: 'Your event is tomorrow',
              message: `"${e.title}" is tomorrow, ${hours}. ${who} If you cannot run it, cancel it from your events page so everyone registered is told.`,
              link: '/dashboard/events',
              data: { kind: 'EVENT_REMINDER', eventId: e.id, role: 'host' },
            },
          });
          return true;
        }, false);
        if (written) {
          done.add(`${hostUserId}:${e.id}`);
          result.hostsReminded += 1;
        }
      }
    }
  }

  return result;
}

let reminderTimer: NodeJS.Timeout | null = null;

/**
 * Hourly, so the first run inside the daylight window catches every event
 * that is on tomorrow; the key on each reminder keeps the other runs quiet.
 */
export function startEventReminderSweeper(intervalMs = HOUR_MS): void {
  if (reminderTimer || process.env.NODE_ENV === 'test') return;
  const run = () =>
    runExclusively('event-reminders', () => runEventReminderSweep())
      .then((r) => {
        if (r) recordSuccess('event_reminders.sweep');
        if (r && (r.reminded || r.hostsReminded || r.emailed)) logger.info('Event reminders sent', r);
      })
      .catch((err) => {
        // A sweep that fails in silence is a reminder nobody gets, with
        // nothing anywhere to say so.
        recordFailure('event_reminders.sweep', err);
        logger.warn('Event reminder sweep failed', { error: (err as Error).message });
      });
  setTimeout(run, 150_000).unref();
  reminderTimer = setInterval(run, intervalMs);
  reminderTimer.unref();
}

export function stopEventReminderSweeper(): void {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
}

export default router;
