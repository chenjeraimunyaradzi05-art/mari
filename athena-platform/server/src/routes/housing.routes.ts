import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { bestEffort, labelSegment } from '../utils/best-effort';
import { mayEnterConfidentialSpace, requireWomanMember, womanGateState } from '../middleware/account-gates';
import {
  HOUSING_CSV_COLUMNS,
  MAX_IMPORT_ROWS,
  SAFETY_CHECK_QUEUE_WHERE,
  SAFETY_CHECK_SLA_HOURS,
  SAFETY_CHECK_WINDOW,
  adminRecipients,
  byWaitingLongest,
  checkDueLine,
  dvSafeNoteOf,
  planHousingImport,
  publicFeatures,
  safetyCheckClock,
  staffListingData,
  staffListingSchema,
  withSafetyCheckRequest,
  withoutSafetyCheckRequest,
} from '../services/housing-supply.service';
import { recordStaffAction } from '../services/staff-record.service';

/**
 * Housing: listings, inquiries, and the safety rules around them.
 *
 * A wrong listing here can hurt someone, so the rules are strict and live in
 * one place:
 *
 * - The street address is never in a public response. It is returned to the
 *   lister, to an admin, and to a member whose inquiry the lister has answered
 *   (CONTACTED or later). Until then a listing shows suburb, city, state and
 *   postcode.
 * - A listing marked DV-safe, EMERGENCY or TRANSITIONAL is confidential. It is
 *   left out of anonymous results and shown only to a signed-in member who is
 *   woman-verified or has Safe Mode on. Until the lister answers her, such a
 *   listing shows its city and state only, never suburb or postcode.
 * - `safetyVerified` ("Checked by ATHENA staff") is set only through the admin
 *   route below; the member body is ignored on create and change. A member can
 *   ask for her listing to be shown as DV-safe, with a note saying why. The
 *   listing is held (PENDING) until staff have looked at it, so a live DV-safe
 *   listing is always one that staff checked.
 * - On a confidential listing the lister sees the asker as an alias derived
 *   from the inquiry id ("Applicant 4F2A"), never her name, avatar or user id.
 *   The conversation is carried on the inquiry rather than in messages, and
 *   her details are shared only once the lister has approved her and she has
 *   chosen to share them.
 *
 * - Supply does not depend on members alone. Staff can list a housing
 *   partner's places, singly or from the partner's spreadsheet, each attached
 *   to a member account that answers the women asking; every such listing is
 *   in the audit log under the member of staff who made it. A DV-safe listing
 *   waiting for its check has a due time, and the queue shows what is late
 *   (housing-supply.service holds the rules for both).
 *
 * Three things ride on existing columns because the schema has no room for
 * them yet (a dedicated column each would be cleaner):
 * - the lister's DV-safe note is kept in `features` under a `dv-safe-note:`
 *   prefix, and the moment the check was asked for under
 *   `dv-safe-check-requested:`; both are stripped from every member-facing
 *   response;
 * - the inquiry thread and the asker's share-details decision are kept as JSON
 *   in `HousingInquiry.notes`. A plain-text note from before is read as the
 *   asker's first entry.
 */

const router = Router();

// ------------------------------------------------------------------ constants

const LISTING_TYPES = ['RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL'] as const;
const LISTING_STATUSES = ['ACTIVE', 'PENDING', 'LEASED', 'WITHDRAWN'] as const;
/** Types that are confidential on their own, DV-safe flag or not. */
const CONFIDENTIAL_TYPES = ['EMERGENCY', 'TRANSITIONAL'];
/** The inquiry states at which the lister has answered, and the address may be shown to the asker. */
const ADDRESS_RELEASED_AT = ['CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED'];

const ANONYMOUS_REASON = 'Safe housing listings are shown to signed-in members only.';
const MEMBER_REASON = 'Safe housing listings are shown to members who have Safe Mode on or a verified account. Safe Mode is free and one switch away, under Safety.';
const NEEDS_NOTE = 'Tell us in a sentence why this place is safe for a woman leaving violence, so staff can check it before it goes live.';
const HELD_FOR_CHECK = 'This listing is waiting for a safety check. It goes live as soon as ATHENA staff have looked at it.';

// -------------------------------------------------------------------- helpers

type ListingRow = {
  id: string;
  agentId?: string | null;
  type: string;
  dvSafe?: boolean;
  safetyVerified?: boolean;
  status?: string;
  address?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  features?: string[];
  createdAt?: Date | string | null;
};

type PersonSelect = { id: true; firstName: true; lastName: true; displayName: true; avatar: true };
const personSelect: PersonSelect = { id: true, firstName: true, lastName: true, displayName: true, avatar: true };

const isAdmin = (req: AuthRequest) => req.user?.role === 'ADMIN';
const isConfidential = (l: Pick<ListingRow, 'dvSafe' | 'type'>) => Boolean(l.dvSafe) || CONFIDENTIAL_TYPES.includes(l.type);
const isReleased = (status: string) => ADDRESS_RELEASED_AT.includes(status);

/**
 * The listing as a member may see it. The address goes only where the header
 * says; a confidential listing loses its suburb and postcode too. The DV-safe
 * note and the check clock are never in a member response; the lister's and
 * admin's views add the note.
 */
function present<T extends ListingRow>(l: T, showAddress: boolean) {
  const base = { ...l, features: publicFeatures(l.features) };
  if (showAddress) return { ...base, addressReleased: true };
  const confidential = isConfidential(l);
  return {
    ...base,
    address: null,
    suburb: confidential ? null : (l.suburb ?? null),
    postcode: confidential ? null : (l.postcode ?? null),
    addressReleased: false,
  };
}

/** The lister's own view: everything, plus what is waiting on staff. */
function presentOwn<T extends ListingRow>(l: T) {
  return {
    ...present(l, true),
    dvSafeNote: dvSafeNoteOf(l.features),
    awaitingSafetyCheck: Boolean(l.dvSafe) && !l.safetyVerified,
  };
}

/** Which of these listings the member may see the address of, because the lister has answered her. */
async function releasedListingIds(userId: string | undefined, listingIds: string[]): Promise<Set<string>> {
  if (!userId || listingIds.length === 0) return new Set();
  const rows = await prisma.housingInquiry.findMany({
    where: { userId, listingId: { in: listingIds }, status: { in: ADDRESS_RELEASED_AT as any } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

const canSeeAddress = (req: AuthRequest, l: ListingRow, released: Set<string>) =>
  Boolean(req.user) && (isAdmin(req) || l.agentId === req.user!.id || released.has(l.id));

/**
 * Whether this viewer may see confidential listings: an admin, a woman-verified
 * member, or a member with Safe Mode on. Anyone else gets the reason.
 *
 * The Safe Mode half used to read `DvSafetyProfile.isSafeMode` alone, which is
 * the column the DV safety screen writes. The Safety Centre writes the other
 * one, `Profile.isSafeMode`, so a woman who turned Safe Mode on there — the
 * page whose own copy tells her it unlocks safe housing — was still refused.
 * `womanGateState` reads both, so the switch means the same thing wherever she
 * found it, and the answer to "may she be in this room" is decided in one file
 * rather than in this helper.
 */
async function confidentialAccess(req: AuthRequest): Promise<{ eligible: boolean; reason: string | null }> {
  if (!req.user) return { eligible: false, reason: ANONYMOUS_REASON };
  if (isAdmin(req)) return { eligible: true, reason: null };
  const eligible = mayEnterConfidentialSpace(await womanGateState(req.user.id));
  return { eligible, reason: eligible ? null : MEMBER_REASON };
}

// The thread and the share-details decision, kept as JSON in HousingInquiry.notes.

type ThreadEntry = { from: 'ASKER' | 'LISTER'; text: string; at: string };
type InquiryPrivate = { thread: ThreadEntry[]; contactSharedAt: string | null };

const isEntry = (e: unknown): e is ThreadEntry =>
  Boolean(e) && typeof e === 'object' && ((e as ThreadEntry).from === 'ASKER' || (e as ThreadEntry).from === 'LISTER') && typeof (e as ThreadEntry).text === 'string' && typeof (e as ThreadEntry).at === 'string';

function readPrivate(notes: string | null | undefined, fallbackAt?: Date | string | null): InquiryPrivate {
  if (!notes) return { thread: [], contactSharedAt: null };
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return { thread: parsed.filter(isEntry), contactSharedAt: null };
    if (parsed && typeof parsed === 'object') {
      return {
        thread: Array.isArray(parsed.thread) ? parsed.thread.filter(isEntry) : [],
        contactSharedAt: typeof parsed.contactSharedAt === 'string' ? parsed.contactSharedAt : null,
      };
    }
  } catch {
    // Free text from before the thread lived here: the asker's own note. The
    // parse failing is the answer to the question this function asks, not a
    // swallowed failure, so it is deliberately not logged as best-effort work:
    // every legacy inquiry read would produce a warning saying nothing except
    // that the row predates the thread format, and that noise would bury the
    // failures worth reading.
  }
  const at = fallbackAt ? new Date(fallbackAt).toISOString() : new Date().toISOString();
  return { thread: [{ from: 'ASKER', text: notes, at }], contactSharedAt: null };
}

const writePrivate = (p: InquiryPrivate) => JSON.stringify(p);

/** "Applicant 4F2A": stable for the inquiry, and says nothing about the person. */
export const aliasFor = (inquiryId: string | undefined | null) => `Applicant ${String(inquiryId ?? '').replace(/-/g, '').slice(-4).toUpperCase() || '0000'}`;

type InquiryRow = {
  id: string;
  status: string;
  notes?: string | null;
  updatedAt?: Date | string | null;
  user?: Record<string, unknown> | null;
  listing?: (ListingRow & Record<string, unknown>) | null;
};

/**
 * An inquiry as the lister sees it. On a confidential listing the asker is an
 * alias with no user id or avatar, until the lister has approved her and she
 * has chosen to share her details.
 */
function presentForLister<T extends InquiryRow>(inq: T, listing: Pick<ListingRow, 'dvSafe' | 'type'>) {
  const priv = readPrivate(inq.notes, inq.updatedAt);
  const contactShared = Boolean(priv.contactSharedAt);
  const showPerson = !isConfidential(listing) || (inq.status === 'APPROVED' && contactShared);
  const { notes: _notes, user, ...rest } = inq;
  void _notes;
  return { ...rest, alias: aliasFor(inq.id), user: showPerson ? (user ?? null) : null, contactShared, thread: priv.thread };
}

/** An inquiry as the asker sees it: her listing with the address once the lister has answered. */
function presentForAsker<T extends InquiryRow>(inq: T) {
  const priv = readPrivate(inq.notes, inq.updatedAt);
  const { notes: _notes, listing, ...rest } = inq;
  void _notes;
  return {
    ...rest,
    listing: listing ? present(listing, isReleased(inq.status)) : listing,
    confidential: listing ? isConfidential(listing) : false,
    contactShared: Boolean(priv.contactSharedAt),
    thread: priv.thread,
  };
}

async function note(userId: string | null | undefined, title: string, message: string, link: string, data?: Record<string, unknown>): Promise<void> {
  if (!userId) return;
  // Telling someone must never fail the housing request that caused it — an
  // inquiry that is saved is saved whether or not the lister's bell rang. This
  // used to end in `.catch(() => null)`, so a notification table that had
  // started rejecting writes would leave listers and askers waiting on answers
  // nobody could see had gone missing. The behaviour is unchanged; the failure
  // is in the log now, labelled with the kind of note so that "no one was told
  // about inquiries" can be told apart from "no one was told about safety
  // checks".
  const rawKind = data?.kind;
  const kind = labelSegment(rawKind, 'housing-unspecified');
  await bestEffort(`notification.${kind}`, () => prisma.notification
    .create({ data: { userId, type: 'SYSTEM', title, message, link, ...(data ? { data: data as Prisma.InputJsonValue } : {}) } }), null);
}

async function noteAdmins(title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  // No admins found means no admins are told, exactly as before — and a DV-safe
  // listing is held at PENDING either way, so the risk this carries is a
  // listing waiting longer than it should, never one going live unchecked. The
  // `.catch(() => [])` that used to be here made that indistinguishable from a
  // site with no admins at all.
  //
  // It also used to tell the first five admin accounts and nobody else, so on
  // a team of six the sixth never heard of a single safety check. Every active
  // admin is told now, the same set the overdue sweep tells.
  const admins = await bestEffort('housing.admin-notification-recipients', adminRecipients, [] as Array<{ id: string }>);
  await Promise.all(admins.map((a) => note(a.id, title, message, link, data)));
}

/**
 * The member account a staff-entered listing belongs to: the one that is told
 * about inquiries and answers them. Named by email, because that is what a
 * housing partner gives staff; without one, the member of staff is the lister
 * herself. An account that is suspended, banned or closed cannot answer
 * anyone, so a listing is never attached to one.
 */
async function resolveLister(req: AuthRequest, listerEmail: unknown): Promise<{ id: string; isStaff: boolean }> {
  const email = typeof listerEmail === 'string' ? listerEmail.trim().toLowerCase() : '';
  if (!email) return { id: req.user!.id, isStaff: true };
  const lister = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, isActive: true, isSuspended: true, bannedAt: true },
  });
  if (!lister) throw new ApiError(404, 'No member account has that email. The partner needs an ATHENA account to answer the women who ask.');
  if (!lister.isActive || lister.isSuspended || lister.bannedAt) {
    throw new ApiError(400, 'That account is suspended or closed, so it could not answer anyone who asks. Choose another.');
  }
  return { id: lister.id, isStaff: lister.id === req.user!.id };
}

/** A zod refusal on staff input as a 400 naming the field. */
function staffInput(input: unknown) {
  const parsed = staffListingSchema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'listing'} ${issue.message}` : 'Invalid listing');
  }
  return parsed.data;
}

const failOnErrors = (req: AuthRequest) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);
};

// ===========================================
// HOUSING LISTINGS
// ===========================================

// GET /api/housing/listings - List available housing
router.get('/listings', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, city, state, minRent, maxRent, bedrooms, dvSafe, petFriendly, accessible, page = '1', limit = '20' } = req.query;

    const where: any = { status: 'ACTIVE' };

    if (typeof type === 'string' && (LISTING_TYPES as readonly string[]).includes(type)) where.type = type;
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

    // Confidential listings are for the women who need them, not for anyone
    // with a browser.
    const access = await confidentialAccess(req);
    if (!access.eligible) {
      where.AND = [{ dvSafe: false }, { type: { notIn: CONFIDENTIAL_TYPES } }];
    }

    const take = Math.min(Math.max(1, Number(limit) || 20), 50);
    const pageNo = Math.max(1, Number(page) || 1);
    const skip = (pageNo - 1) * take;

    const [listings, total] = await Promise.all([
      prisma.housingListing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.housingListing.count({ where }),
    ]);

    const released = await releasedListingIds(req.user?.id, listings.map((l) => l.id));

    res.json({
      success: true,
      data: listings.map((l) => present(l, canSeeAddress(req, l, released))),
      pagination: { page: pageNo, limit: take, total, totalPages: Math.ceil(total / take) },
      confidential: { hidden: !access.eligible, reason: access.reason },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/housing/listings/:id - Get listing details
router.get('/listings/:id', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const listing = await prisma.housingListing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, 'Housing listing not found');

    const own = Boolean(req.user) && (isAdmin(req) || listing.agentId === req.user!.id);
    if (isConfidential(listing) && !own) {
      // To a stranger a confidential listing does not exist; a member who is
      // not yet eligible is told how to become so.
      if (!req.user) throw new ApiError(404, 'Housing listing not found');
      const access = await confidentialAccess(req);
      if (!access.eligible) throw new ApiError(403, access.reason || MEMBER_REASON);
    }

    const released = own ? new Set<string>() : await releasedListingIds(req.user?.id, [id]);
    res.json({ success: true, data: present(listing, canSeeAddress(req, listing, released)) });
  } catch (error) {
    next(error);
  }
});

// POST /api/housing/listings/:id/inquire - Inquire about a listing
router.post(
  '/listings/:id/inquire',
  authenticate,
  // Asking about a place puts a member in contact with the woman who listed
  // it. An account a reviewer has already refused does not get to start that
  // conversation, which until now it could.
  requireWomanMember,
  [body('message').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);

      const { id } = req.params;
      const userId = req.user!.id;
      const { message } = req.body;

      const listing = await prisma.housingListing.findUnique({ where: { id } });
      if (!listing) throw new ApiError(404, 'Housing listing not found');
      if (listing.status !== 'ACTIVE') throw new ApiError(400, 'This listing is no longer available');
      if (listing.agentId === userId) throw new ApiError(400, 'This is your own listing');

      if (isConfidential(listing) && !isAdmin(req)) {
        const access = await confidentialAccess(req);
        if (!access.eligible) throw new ApiError(403, access.reason || MEMBER_REASON);
      }

      const existing = await prisma.housingInquiry.findUnique({ where: { listingId_userId: { listingId: id, userId } } });
      if (existing) throw new ApiError(409, 'You have already inquired about this listing');

      const inquiry = await prisma.housingInquiry.create({
        data: { listingId: id, userId, message, status: 'PENDING' },
        include: { listing: true },
      });

      // The lister is told someone asked; on a confidential listing, only as
      // an alias.
      const who = isConfidential(listing) ? aliasFor(inquiry.id) : 'A member';
      await note(listing.agentId, 'Housing inquiry', `${who} has asked about "${listing.title}". Answer from your listings.`, '/dashboard/housing#list-a-place', {
        kind: 'HOUSING_INQUIRY',
        listingId: id,
        inquiryId: inquiry.id,
      });

      logger.info(`User ${userId} inquired about housing listing ${id}`);

      res.status(201).json({ success: true, data: presentForAsker(inquiry), message: 'Inquiry submitted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/housing/my/inquiries - Get user's housing inquiries
router.get('/my/inquiries', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inquiries = await prisma.housingInquiry.findMany({
      where: { userId: req.user!.id },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: inquiries.map((i) => presentForAsker(i)) });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/housing/inquiries/:id - The asker's side: say she applied, withdraw, or write to the lister
router.patch(
  '/inquiries/:id',
  authenticate,
  [
    // The person asking can say she has applied, or withdraw. The outcome is
    // the lister's to record, on the route below.
    body('status').optional().isIn(['APPLICATION_SUBMITTED', 'WITHDRAWN']),
    body('viewingDate').optional().isISO8601(),
    // A line for the lister, carried on the inquiry rather than in messages.
    body('reply').optional().isString().trim().isLength({ min: 1, max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);

      const { id } = req.params;
      const userId = req.user!.id;
      const { status, viewingDate, reply } = req.body as { status?: string; viewingDate?: string; reply?: string };

      const inquiry = await prisma.housingInquiry.findUnique({
        where: { id },
        include: { listing: { select: { id: true, title: true, agentId: true, dvSafe: true, type: true } } },
      });
      if (!inquiry) throw new ApiError(404, 'Inquiry not found');
      if (inquiry.userId !== userId) throw new ApiError(403, 'Not authorized to update this inquiry');

      const text = typeof reply === 'string' ? reply.trim() : '';
      let notes: string | undefined;
      if (text) {
        if (['WITHDRAWN', 'DECLINED'].includes(inquiry.status)) throw new ApiError(400, 'This inquiry is closed');
        const priv = readPrivate(inquiry.notes, inquiry.updatedAt);
        priv.thread.push({ from: 'ASKER', text, at: new Date().toISOString() });
        notes = writePrivate(priv);
      }

      const updated = await prisma.housingInquiry.update({
        where: { id },
        data: {
          ...(status && { status: status as any }),
          ...(viewingDate && { viewingDate: new Date(viewingDate) }),
          ...(notes !== undefined && { notes }),
        },
        include: { listing: true },
      });

      if (text && inquiry.listing) {
        const who = isConfidential(inquiry.listing) ? aliasFor(inquiry.id) : 'The member asking';
        await note(inquiry.listing.agentId, 'Housing update', `${who} wrote about "${inquiry.listing.title}": ${text}`, '/dashboard/housing#list-a-place', {
          kind: 'HOUSING_INQUIRY_MESSAGE',
          listingId: inquiry.listingId,
          inquiryId: inquiry.id,
        });
      }

      res.json({ success: true, data: presentForAsker(updated) });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/housing/inquiries/:id/share-contact - After approval on a confidential
// listing, the asker chooses to let the lister see who she is.
router.post('/inquiries/:id/share-contact', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const inquiry = await prisma.housingInquiry.findUnique({
      where: { id },
      include: { listing: { select: { id: true, title: true, agentId: true, dvSafe: true, type: true } } },
    });
    if (!inquiry) throw new ApiError(404, 'Inquiry not found');
    if (inquiry.userId !== req.user!.id) throw new ApiError(403, 'Not authorized to update this inquiry');
    if (!isConfidential(inquiry.listing)) throw new ApiError(400, 'The lister of an ordinary listing can already see who asked');
    if (inquiry.status !== 'APPROVED') throw new ApiError(400, 'Your details can be shared once the lister has approved you');

    const priv = readPrivate(inquiry.notes, inquiry.updatedAt);
    if (!priv.contactSharedAt) {
      priv.contactSharedAt = new Date().toISOString();
      await prisma.housingInquiry.update({ where: { id }, data: { notes: writePrivate(priv) } });
      await note(inquiry.listing.agentId, 'Housing update', `${aliasFor(inquiry.id)} has chosen to share her details with you for "${inquiry.listing.title}".`, '/dashboard/housing#list-a-place', {
        kind: 'HOUSING_CONTACT_SHARED',
        listingId: inquiry.listingId,
        inquiryId: inquiry.id,
      });
    }

    res.json({ success: true, data: { id, contactShared: true } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LISTING A PLACE (any member; DV-safe claims are checked by staff first)
// ===========================================

router.post(
  '/listings',
  authenticate,
  // Same reason as the inquiry route: a listing is an invitation to contact a
  // stranger, and a refused account does not get to publish one here.
  requireWomanMember,
  [
    body('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('description').isString().trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
    body('type').isIn(LISTING_TYPES as unknown as string[]),
    body('rentWeekly').optional().isNumeric(),
    body('bedrooms').optional().isInt({ min: 0 }),
    body('bathrooms').optional().isInt({ min: 0 }),
    body('dvSafe').optional().isBoolean(),
    body('dvSafeNote').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);

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
        dvSafe,
        dvSafeNote,
        petFriendly,
        accessibleUnit,
        availableFrom,
        minLeaseTerm,
        flexibleLease,
        images,
      } = req.body;

      // `safetyVerified` in the body is ignored: only staff can say a listing
      // was checked. A DV-safe claim is a request, held until staff look.
      const wantsDvSafe = dvSafe === true || dvSafe === 'true';
      const safeNote = typeof dvSafeNote === 'string' ? dvSafeNote.trim() : '';
      if (wantsDvSafe && !safeNote) throw new ApiError(400, NEEDS_NOTE);

      // Anything in the body shaped like one of the internal tags is dropped,
      // so a lister cannot write her own check clock or somebody else's note.
      const cleanFeatures = publicFeatures(features);

      const listing = await prisma.housingListing.create({
        data: {
          agentId: userId,
          title: String(title).trim(),
          description: String(description).trim(),
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
          features: wantsDvSafe ? withSafetyCheckRequest(cleanFeatures, safeNote) : cleanFeatures,
          safetyVerified: false,
          dvSafe: wantsDvSafe,
          petFriendly: petFriendly === true,
          accessibleUnit: accessibleUnit === true,
          availableFrom: availableFrom ? new Date(availableFrom) : undefined,
          minLeaseTerm: minLeaseTerm ? Number(minLeaseTerm) : undefined,
          flexibleLease: flexibleLease === true,
          images,
          status: wantsDvSafe ? 'PENDING' : 'ACTIVE',
        },
      });

      if (wantsDvSafe) {
        await noteAdmins(
          'A housing listing asks to be shown as DV-safe',
          `"${listing.title}"${listing.city ? ` in ${listing.city}` : ''} is held until someone checks it. ${checkDueLine()}`,
          '/admin/housing',
          { kind: 'HOUSING_DV_SAFE_CHECK', listingId: listing.id }
        );
      }

      logger.info(`Housing listing created: ${listing.id}${wantsDvSafe ? ' (held for a safety check)' : ''}`);

      res.status(201).json({
        success: true,
        data: presentOwn(listing),
        pendingSafetyCheck: wantsDvSafe,
        message: wantsDvSafe
          ? 'Listed. Because you asked for it to be shown as DV-safe, ATHENA staff will look at it before it goes live. You will be told when it does.'
          : 'Listed. It is live now.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// THE LISTER'S SIDE: YOUR LISTINGS AND THEIR INQUIRIES
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
          include: { user: { select: personSelect } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: listings.map((l) => ({
        ...presentOwn(l),
        inquiries: (l.inquiries ?? []).map((i) => presentForLister(i, l)),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/housing/listings/:id - Change a listing you made (status, price, availability)
router.patch(
  '/listings/:id',
  authenticate,
  [
    body('status').optional().isIn(LISTING_STATUSES as unknown as string[]),
    body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 5000 }),
    body('rentWeekly').optional().isNumeric(),
    body('availableFrom').optional({ values: 'falsy' }).isISO8601(),
    body('dvSafe').optional().isBoolean(),
    body('dvSafeNote').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);
      const { id } = req.params;
      const listing = await prisma.housingListing.findUnique({
        where: { id },
        select: { id: true, agentId: true, title: true, city: true, dvSafe: true, safetyVerified: true, status: true, features: true },
      });
      if (!listing) throw new ApiError(404, 'Housing listing not found');
      if (listing.agentId !== req.user!.id && !isAdmin(req)) {
        throw new ApiError(403, 'Only the person who listed this place can change it');
      }

      // `safetyVerified` is ignored here for everyone; staff set it on the
      // admin route so the change is recorded as theirs.
      const { status, title, description, rentWeekly, availableFrom, dvSafe, dvSafeNote, petFriendly, accessibleUnit } = req.body;

      const data: Record<string, unknown> = {
        ...(typeof title === 'string' && { title: title.trim() }),
        ...(typeof description === 'string' && { description }),
        ...(rentWeekly !== undefined && rentWeekly !== '' && { rentWeekly: Number(rentWeekly) }),
        ...(availableFrom && { availableFrom: new Date(availableFrom) }),
        ...(typeof petFriendly === 'boolean' && { petFriendly }),
        ...(typeof accessibleUnit === 'boolean' && { accessibleUnit }),
      };

      let message: string | null = null;
      let requestedCheck = false;

      if (dvSafe === true && !listing.dvSafe) {
        // Asking for DV-safe on a listing that is already up: held again until
        // staff have looked, whatever else this call says about the status.
        //
        // The check is of this claim, so an earlier one does not carry over.
        // It used to: a listing checked once, lowered, and raised again kept
        // `safetyVerified` from the first time, never entered the queue, and
        // could be put straight back live by its lister — "Checked by ATHENA
        // staff" over whatever she had changed in between.
        const safeNote = typeof dvSafeNote === 'string' ? dvSafeNote.trim() : '';
        if (!safeNote) throw new ApiError(400, NEEDS_NOTE);
        data.dvSafe = true;
        data.safetyVerified = false;
        data.status = 'PENDING';
        data.features = withSafetyCheckRequest(listing.features, safeNote);
        requestedCheck = true;
        message = 'Asked. ATHENA staff will look at the listing before it shows as DV-safe; it is off the list until then.';
      } else if (dvSafe === false && listing.dvSafe) {
        // Lowering a claim needs no check, and ends the one it had: the badge
        // said this listing was checked as DV-safe, which it no longer claims.
        data.dvSafe = false;
        data.safetyVerified = false;
        data.features = withoutSafetyCheckRequest(listing.features);
      }

      if (status && !requestedCheck) {
        if (status === 'ACTIVE' && listing.dvSafe && !listing.safetyVerified && !isAdmin(req)) {
          throw new ApiError(400, HELD_FOR_CHECK);
        }
        data.status = status;
      }

      const updated = await prisma.housingListing.update({ where: { id }, data });

      if (requestedCheck) {
        await noteAdmins(
          'A housing listing asks to be shown as DV-safe',
          `"${listing.title}"${listing.city ? ` in ${listing.city}` : ''} is held until someone checks it. ${checkDueLine()}`,
          '/admin/housing',
          { kind: 'HOUSING_DV_SAFE_CHECK', listingId: id }
        );
      }

      res.json({ success: true, data: presentOwn(updated), ...(message ? { message } : {}) });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/housing/listings/:listingId/inquiries/:id - Answer someone asking about your place,
// or write to her without changing where things stand.
router.patch(
  '/listings/:listingId/inquiries/:id',
  authenticate,
  [
    body('status').optional().isIn(['CONTACTED', 'VIEWING_SCHEDULED', 'APPROVED', 'DECLINED']),
    body('viewingDate').optional({ values: 'falsy' }).isISO8601(),
    body('message').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);
      const { listingId, id } = req.params;
      const { status, viewingDate, message } = req.body as { status?: string; viewingDate?: string; message?: string };
      const text = typeof message === 'string' ? message.trim() : '';
      if (!status && !text) throw new ApiError(400, 'Say something, or change where things stand');

      const inquiry = await prisma.housingInquiry.findUnique({
        where: { id },
        include: { listing: { select: { id: true, title: true, agentId: true, dvSafe: true, type: true } } },
      });
      if (!inquiry || inquiry.listingId !== listingId) throw new ApiError(404, 'Inquiry not found');
      if (inquiry.listing.agentId !== req.user!.id && !isAdmin(req)) {
        throw new ApiError(403, 'Only the person who listed this place can answer inquiries');
      }
      if (status === 'VIEWING_SCHEDULED' && !viewingDate) throw new ApiError(400, 'A viewing needs a date');

      let notes: string | undefined;
      if (text) {
        const priv = readPrivate(inquiry.notes, inquiry.updatedAt);
        priv.thread.push({ from: 'LISTER', text, at: new Date().toISOString() });
        notes = writePrivate(priv);
      }

      const updated = await prisma.housingInquiry.update({
        where: { id },
        data: {
          ...(status && { status: status as any }),
          ...(viewingDate && { viewingDate: new Date(viewingDate) }),
          ...(notes !== undefined && { notes }),
        },
        include: { user: { select: personSelect } },
      });

      const when = viewingDate
        ? new Date(viewingDate).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Brisbane' })
        : '';
      const said: Record<string, string> = {
        CONTACTED: `The lister has been in touch about "${inquiry.listing.title}".`,
        VIEWING_SCHEDULED: `A viewing of "${inquiry.listing.title}" is booked for ${when}.`,
        APPROVED: `Your application for "${inquiry.listing.title}" was approved.`,
        DECLINED: `Your inquiry about "${inquiry.listing.title}" was not successful.`,
      };
      const lead = status ? said[status] : `The lister wrote about "${inquiry.listing.title}".`;
      await note(inquiry.userId, 'Housing update', `${lead}${text ? ` ${text}` : ''}`, '/dashboard/housing', {
        kind: 'HOUSING_INQUIRY_ANSWER',
        listingId,
        inquiryId: id,
      });

      res.json({ success: true, data: presentForLister(updated, inquiry.listing) });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN: THE SAFETY CHECK ON DV-SAFE LISTINGS
// ===========================================
// A listing that asks to be shown as DV-safe waits here. Staff approve it as
// checked, let it show as an ordinary listing, or take it down; the lister is
// told either way, and the decision is in the audit log under whoever made it.
//
// The queue used to be every DV-safe listing nobody had checked, oldest
// created first, with nothing to say how long any of them had waited. It is
// now ordered by when the check was asked for, each row carries its due time,
// and the answer says how many are late.

// GET /api/housing/admin/pending - DV-safe listings waiting for a check
router.get('/admin/pending', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.housingListing.findMany({
      where: SAFETY_CHECK_QUEUE_WHERE,
      orderBy: { createdAt: 'asc' },
      take: SAFETY_CHECK_WINDOW,
    });
    const listings = byWaitingLongest(rows);
    const agentIds = [...new Set(listings.map((l) => l.agentId).filter((id): id is string => Boolean(id)))];
    const agents = agentIds.length
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, firstName: true, lastName: true, displayName: true, email: true, womanVerificationStatus: true, createdAt: true },
        })
      : [];
    const byId = new Map(agents.map((a) => [a.id, a]));
    const now = new Date();
    const data = listings.map((l) => ({
      ...presentOwn(l),
      lister: l.agentId ? byId.get(l.agentId) ?? null : null,
      safetyCheck: safetyCheckClock(l, now),
    }));
    res.json({
      success: true,
      data,
      sla: { hours: SAFETY_CHECK_SLA_HOURS, waiting: data.length, overdue: data.filter((l) => l.safetyCheck.overdue).length },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/housing/admin/listings/:id - Record the outcome of the check
router.patch(
  '/admin/listings/:id',
  authenticate,
  requireRole('ADMIN'),
  [
    body('safetyVerified').optional().isBoolean(),
    body('dvSafe').optional().isBoolean(),
    body('status').optional().isIn(LISTING_STATUSES as unknown as string[]),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);
      const { id } = req.params;
      const { safetyVerified, dvSafe, status, note: line } = req.body as { safetyVerified?: boolean; dvSafe?: boolean; status?: string; note?: string };
      if (typeof safetyVerified !== 'boolean' && typeof dvSafe !== 'boolean' && !status) {
        throw new ApiError(400, 'Nothing to change');
      }

      const listing = await prisma.housingListing.findUnique({ where: { id } });
      if (!listing) throw new ApiError(404, 'Housing listing not found');

      const after = {
        safetyVerified: typeof safetyVerified === 'boolean' ? safetyVerified : listing.safetyVerified,
        dvSafe: typeof dvSafe === 'boolean' ? dvSafe : listing.dvSafe,
        status: status ?? listing.status,
      };
      // A live DV-safe listing is always one staff checked.
      if (after.dvSafe && after.status === 'ACTIVE' && !after.safetyVerified) {
        throw new ApiError(400, 'A DV-safe listing goes live only once it is marked as checked');
      }

      const clock = listing.dvSafe && !listing.safetyVerified ? safetyCheckClock(listing) : null;

      const updated = await prisma.housingListing.update({
        where: { id },
        data: {
          ...(typeof safetyVerified === 'boolean' && { safetyVerified }),
          ...(typeof dvSafe === 'boolean' && { dvSafe }),
          ...(status && { status: status as any }),
        },
      });

      const wentLive = after.status === 'ACTIVE' && listing.status !== 'ACTIVE';
      let outcome: string;
      if (after.status === 'WITHDRAWN' && listing.status !== 'WITHDRAWN') {
        outcome = `Your listing "${listing.title}" has been taken down by ATHENA staff.`;
      } else if (listing.dvSafe && !after.dvSafe) {
        outcome = `Your listing "${listing.title}" is ${after.status === 'ACTIVE' ? 'live as an ordinary listing' : 'not shown as DV-safe'}; staff could not confirm it as DV-safe.`;
      } else if (after.dvSafe && after.safetyVerified && (wentLive || !listing.safetyVerified)) {
        outcome = `Your listing "${listing.title}" has been checked by ATHENA staff and ${after.status === 'ACTIVE' ? 'is live' : 'will show'} as DV-safe.`;
      } else {
        outcome = `Your listing "${listing.title}" was updated by ATHENA staff.`;
      }
      const extra = typeof line === 'string' && line.trim() ? ` ${line.trim()}` : '';
      await note(listing.agentId, 'Housing update', `${outcome}${extra}`, '/dashboard/housing#list-a-place', {
        kind: 'HOUSING_SAFETY_CHECK',
        listingId: id,
      });

      // Who decided, what the listing was before and after, and how long it
      // had waited. This used to be a log line, which is not a record anyone
      // can be held to: the badge a woman trusts could not be traced to a
      // person.
      await recordStaffAction(req, 'HOUSING_LISTING_SAFETY_CHECKED', {
        resourceType: 'HousingListing',
        resourceId: id,
        targetUserId: listing.agentId,
        before: { safetyVerified: listing.safetyVerified, dvSafe: listing.dvSafe, status: listing.status },
        after,
        ...(clock ? { waitedHours: clock.hoursWaiting, overdue: clock.overdue } : {}),
        ...(extra ? { noteToLister: extra.trim() } : {}),
      });

      res.json({ success: true, data: presentOwn(updated) });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN: HOUSING SUPPLY
// ===========================================
// Staff put a housing partner's places on the platform: one through the form,
// or a partner's whole list from a spreadsheet. Each listing belongs to a
// member account that answers the women who ask about it. A DV-safe place
// staff have already checked goes live checked, with what they checked in the
// audit row; one they have not waits in the queue above like any other.

// POST /api/housing/admin/listings - One listing, entered by staff
router.post('/admin/listings', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = staffInput(req.body);
    const safetyVerified = req.body?.safetyVerified === true;
    const checkNote = typeof req.body?.safetyCheckNote === 'string' ? req.body.safetyCheckNote.trim().slice(0, 1000) : '';
    if (safetyVerified && !input.dvSafe) {
      throw new ApiError(400, 'Only a DV-safe listing is marked as checked. Tick DV-safe, or leave the check off.');
    }
    // Marking a listing checked is the promise the badge makes, so the person
    // making it says what she checked, and that goes in the audit row.
    if (safetyVerified && checkNote.length < 10) {
      throw new ApiError(400, 'Say what you checked — who you spoke to, and how you know the place is safe — before marking it checked.');
    }

    const lister = await resolveLister(req, req.body?.listerEmail);
    const listing = await prisma.housingListing.create({ data: staffListingData(input, lister.id, { safetyVerified }) });

    if (!lister.isStaff) {
      await note(
        lister.id,
        'ATHENA staff listed a place for you',
        `"${listing.title}" is on ATHENA under your account${listing.status === 'PENDING' ? ', waiting for its safety check' : ''}. Inquiries about it come to you, under Your listings.`,
        '/dashboard/housing#list-a-place',
        { kind: 'HOUSING_LISTED_FOR_YOU', listingId: listing.id }
      );
    }
    if (listing.status === 'PENDING') {
      await noteAdmins(
        'A housing listing asks to be shown as DV-safe',
        `"${listing.title}"${listing.city ? ` in ${listing.city}` : ''} was entered by staff and is held until someone checks it. ${checkDueLine()}`,
        '/admin/housing',
        { kind: 'HOUSING_DV_SAFE_CHECK', listingId: listing.id }
      );
    }

    await recordStaffAction(req, 'HOUSING_LISTING_CREATED', {
      resourceType: 'HousingListing',
      resourceId: listing.id,
      targetUserId: lister.isStaff ? null : lister.id,
      listerId: lister.id,
      dvSafe: listing.dvSafe,
      safetyVerified: listing.safetyVerified,
      status: listing.status,
      ...(safetyVerified ? { safetyCheckNote: checkNote } : {}),
    });

    res.status(201).json({
      success: true,
      data: presentOwn(listing),
      message:
        listing.status === 'PENDING'
          ? 'Listed and held for a safety check. Another member of staff can check it from the queue.'
          : listing.safetyVerified
            ? 'Listed and live, marked as checked by ATHENA staff.'
            : 'Listed and live.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/housing/admin/listings/import-template - The columns a partner's sheet needs
router.get('/admin/listings/import-template', authenticate, requireRole('ADMIN'), (_req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="athena-housing-import.csv"');
  res.send(`${HOUSING_CSV_COLUMNS.join(',')}\r\n`);
});

// POST /api/housing/admin/listings/import - A partner's spreadsheet: every row, or none
router.post('/admin/listings/import', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) throw new ApiError(400, 'Paste the spreadsheet as CSV, with the header row first.');
    if (csv.length > 1_000_000) throw new ApiError(400, 'That file is larger than one import takes; split the sheet.');

    const plan = planHousingImport(csv);
    // A sheet with any bad row writes nothing, and every problem is listed at
    // once with its line, so staff fix the sheet in one pass rather than
    // learning of each mistake from a partial import.
    if (plan.errors.length > 0) {
      res.status(400).json({
        success: false,
        message: `${plan.errors.length} problem${plan.errors.length === 1 ? '' : 's'} in the sheet. Nothing was imported.`,
        errors: plan.errors,
        maxRows: MAX_IMPORT_ROWS,
      });
      return;
    }

    const lister = await resolveLister(req, req.body?.listerEmail);
    const held = plan.rows.filter((r) => r.input.dvSafe).length;

    if (req.body?.dryRun === true) {
      res.json({
        success: true,
        dryRun: true,
        data: { rows: plan.rows.length, heldForCheck: held, listerIsStaff: lister.isStaff, titles: plan.rows.map((r) => r.input.title) },
      });
      return;
    }

    // Imported DV-safe rows are never marked checked: a spreadsheet is the
    // partner's word, and the badge is a person's.
    const now = new Date();
    const created = await prisma.$transaction(
      plan.rows.map((row) => prisma.housingListing.create({ data: staffListingData(row.input, lister.id, { safetyVerified: false, now }) }))
    );

    if (!lister.isStaff) {
      await note(
        lister.id,
        'ATHENA staff listed your places',
        `${created.length} place${created.length === 1 ? ' is' : 's are'} on ATHENA under your account${held ? `, ${held} waiting for a safety check` : ''}. Inquiries come to you, under Your listings.`,
        '/dashboard/housing#list-a-place',
        { kind: 'HOUSING_LISTED_FOR_YOU', count: created.length }
      );
    }
    if (held > 0) {
      await noteAdmins(
        `${held} imported listing${held === 1 ? '' : 's'} ask${held === 1 ? 's' : ''} to be shown as DV-safe`,
        `A housing import held ${held} DV-safe listing${held === 1 ? '' : 's'} until someone checks ${held === 1 ? 'it' : 'them'}. ${checkDueLine(now)}`,
        '/admin/housing',
        { kind: 'HOUSING_DV_SAFE_CHECK', count: held }
      );
    }

    await recordStaffAction(req, 'HOUSING_LISTINGS_IMPORTED', {
      resourceType: 'HousingListing',
      targetUserId: lister.isStaff ? null : lister.id,
      listerId: lister.id,
      imported: created.length,
      heldForCheck: held,
      listingIds: created.map((l) => l.id),
    });

    res.status(201).json({
      success: true,
      data: { imported: created.length, heldForCheck: held, listings: created.map((l) => presentOwn(l)) },
      message: `${created.length} imported${held ? `; ${held} held for a safety check` : ''}.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
