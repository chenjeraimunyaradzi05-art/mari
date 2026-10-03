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
  CONFIDENTIAL_LISTING_TYPES,
  HOUSING_CSV_COLUMNS,
  MAX_IMPORT_ROWS,
  SAFETY_CHECK_QUEUE_WHERE,
  SAFETY_CHECK_SLA_HOURS,
  SAFETY_CHECK_WINDOW,
  adminRecipients,
  byWaitingLongest,
  checkDueLine,
  cleanListingImages,
  confidentialTextProblem,
  dvSafeNoteOf,
  isConfidentialListing,
  listingImagesProblem,
  planHousingImport,
  publicFeatures,
  safetyCheckClock,
  staffListingData,
  staffListingSchema,
  takenDownByStaff,
  withSafetyCheckRequest,
  withStaffTakedown,
  withoutSafetyCheckRequest,
  withoutStaffTakedown,
} from '../services/housing-supply.service';
import { recordStaffAction, recordStaffRead } from '../services/staff-record.service';
import {
  PROVIDER_CHECK_HELD_NOTE,
  PROVIDER_CHECK_REQUIRED,
  PROVIDER_CHECK_RENEWAL_WINDOW_DAYS,
  PROVIDER_RELATIONSHIP_LABELS,
  decideProviderCheck,
  isProviderVerified,
  parseProviderInput,
  presentProviderCheck,
  providerApplicationSchema,
  providerDecisionSchema,
  providerStanding,
  providerStandings,
  submitProviderCheck,
  sweepProviderChecks,
} from '../services/housing-provider.service';
import { formatAbn } from '../services/abr.service';
import { safeNotificationFor } from '../services/dv-safe.service';
import { assertContentAllowed } from '../services/moderation.service';

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
 *   route below; the member body is ignored on create and change. A confidential
 *   listing (DV-safe, emergency or transitional) is held (PENDING) until staff
 *   have looked at it, so a live confidential listing is always one that staff
 *   checked. The check needs two things on record: what the member of staff
 *   checked, and a standing provider check on the person offering the place
 *   (housing-provider.service). Changing a checked listing's title, description
 *   or rent ends the check, because it was a check of what was there.
 * - Every response here is per viewer, so none of it may be cached: the whole
 *   router answers `Cache-Control: private, no-store`.
 * - A listing can be reported (POST /api/safety/reports, targetType
 *   housing_listing); the report routes to the lister.
 * - Only administrators reach the staff routes (requireRole('ADMIN')); a
 *   moderator reaches none of them. What an administrator is shown that a
 *   member is not (the check queue, the address of a confidential listing, an
 *   inquiry thread on one) is written to the audit log as HOUSING_DV_SAFE_VIEWED
 *   when it is shown (auditStaffView below); the decisions staff make are
 *   written as they have always been (recordStaffAction).
 * - On a confidential listing the lister sees the asker as an alias derived
 *   from the inquiry id ("Applicant 4F2A"), never her name, avatar or user id.
 *   The conversation is carried on the inquiry rather than in messages, and
 *   her details are shared only once the lister has approved her and she has
 *   chosen to share them.
 * - The address is released by the lister's answer and nothing else. The asker
 *   may withdraw, or say "I have applied" once the lister has been in touch;
 *   no move the asker makes alone reaches a state that releases the address
 *   (ASKER_MOVES). The words on a confidential listing carry neither its
 *   street address nor a phone number (housing-supply confidentialTextProblem),
 *   the pictures are http(s) links and no more than ten, and the title and
 *   description go through the same screen as a post.
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

// Every answer on this router depends on who is asking: a confidential listing
// is there for one reader and not for another, an address is released to one
// member and not the next. A shared cache or a browser's back button that kept
// one reader's answer and handed it to a different request would undo all of
// that, so none of it is stored.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// ------------------------------------------------------------------ constants

const LISTING_TYPES = ['RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL'] as const;
const LISTING_STATUSES = ['ACTIVE', 'PENDING', 'LEASED', 'WITHDRAWN'] as const;
/** Types that are confidential on their own, DV-safe flag or not. */
const CONFIDENTIAL_TYPES: string[] = [...CONFIDENTIAL_LISTING_TYPES];
/** The inquiry states at which the lister has answered, and the address may be shown to the asker. */
const ADDRESS_RELEASED_AT = ['CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED'];
/**
 * Where the asker may move an inquiry from, for each move the asker's route
 * offers. Saying "I have applied" is allowed only once the lister has answered
 * (CONTACTED or later): APPLICATION_SUBMITTED is one of the states that releases
 * the address, so a move the asker could make alone from PENDING handed over the
 * street address of a DV-safe place with the lister never having said a word,
 * to any account with Safe Mode switched on. A closed inquiry (DECLINED,
 * WITHDRAWN) is not reopened by either side.
 */
const ASKER_MOVES: Record<string, readonly string[]> = {
  APPLICATION_SUBMITTED: ['CONTACTED', 'VIEWING_SCHEDULED', 'APPROVED'],
  WITHDRAWN: ['PENDING', 'CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED'],
};
const CLOSED_INQUIRY = 'This inquiry is closed';
const APPLY_AFTER_ANSWER = 'You can say you have applied once the lister has been in touch with you.';

const ANONYMOUS_REASON = 'Safe housing listings are shown to signed-in members only.';
const MEMBER_REASON = 'Safe housing listings are shown to members who have Safe Mode on or a verified account. Safe Mode is free and one switch away, under Safety.';
const NEEDS_NOTE = 'Tell us in a sentence why this place is safe for a woman leaving violence, so staff can check it before it goes live.';
const HELD_FOR_CHECK = 'This listing is waiting for a safety check. It goes live as soon as ATHENA staff have looked at it.';
const CHECK_NOTE_REQUIRED = 'Say what you checked, in a sentence or two: who you spoke to, and how you know the place is safe. It is kept in the record of this decision.';
const TAKEN_DOWN_BY_STAFF = 'ATHENA staff took this listing down, so it cannot be put back on the list from here. If you think that was a mistake, you can appeal the decision from the Help page.';
const CHECK_ENDED_BY_EDIT = 'Because you changed what the listing says, its safety check has ended and ATHENA staff will look at it again before it goes back on the list.';

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
const isConfidential = (l: Pick<ListingRow, 'dvSafe' | 'type'>) => isConfidentialListing(l);
const isReleased = (status: string) => ADDRESS_RELEASED_AT.includes(status);

/**
 * The listing as a member may see it. The address goes only where the header
 * says; a confidential listing loses its suburb and postcode too. The DV-safe
 * note and the check clock are never in a member response; the lister's and
 * admin's views add the note.
 */
function present<T extends ListingRow>(l: T, showAddress: boolean) {
  const confidential = isConfidential(l);
  // The row is spread whole, and one of its columns is `agentId`: the lister's
  // user id, which is the key to her profile. Nobody reading a listing has any
  // need of it: a confidential listing is one a lister may be hiding behind, and
  // on a room in somebody's home, the id reached anonymous visitors and led to
  // her name. So it is dropped for every reader and every kind of listing. The
  // lister's own and the admin's views put it back (presentOwn).
  const { agentId: _agentId, ...row } = l;
  void _agentId;
  const base = { ...row, features: publicFeatures(l.features) };
  if (showAddress) return { ...base, addressReleased: true };
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
    ...(l.agentId !== undefined ? { agentId: l.agentId } : {}),
    dvSafeNote: dvSafeNoteOf(l.features),
    awaitingSafetyCheck: isConfidential(l) && !l.safetyVerified,
    // Staff took it down; only staff put it back, so the lister is not offered a switch that would be refused.
    takenDownByStaff: takenDownByStaff(l.features),
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

// Staff reads of confidential housing data.
//
// The audit log held every change staff made to housing and none of what they
// looked at, so "need-to-know, audited" (docs/security/authorisation-matrix.md)
// was true of writes only. Reading is where the harm is for a woman hiding from
// someone: a street address, the note on why a place is safe, who is asking
// about it. Each place below that hands one of those to a member of staff, who
// is not the listing's own lister and has not been given it by the lister's
// answer, writes one row naming her, the listings, what was in the response and
// when. No reason is demanded (the check queue is its own reason, and a screen
// that refused to open would only teach staff to type "x"), but one given with
// ?reason= is kept beside the row.

const REASON_MAX = 300;

/** The reason a member of staff gave for opening this, if she gave one. */
function statedReason(req: AuthRequest): string | undefined {
  const raw = req.query?.reason;
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, REASON_MAX) : undefined;
}

/**
 * Whether this read is staff reading a confidential listing, as opposed to its
 * lister reading her own, or a woman reading what the lister released to her.
 * Ordinary listings are not DV-safe data and are not recorded.
 */
const isStaffReadOfConfidential = (req: AuthRequest, l: ListingRow, released: Set<string> = new Set()) =>
  isAdmin(req) && isConfidential(l) && l.agentId !== req.user?.id && !released.has(l.id);

type StaffViewVia = 'check queue' | 'listing list' | 'listing detail' | 'listing change' | 'check decision' | 'inquiry thread';

async function auditStaffView(req: AuthRequest, listings: Array<Pick<ListingRow, 'id' | 'agentId'>>, via: StaffViewVia, disclosed: string[]): Promise<void> {
  if (listings.length === 0) return;
  const reason = statedReason(req);
  const only = listings.length === 1 ? listings[0] : null;
  await recordStaffRead(req, 'HOUSING_DV_SAFE_VIEWED', {
    resourceType: 'HousingListing',
    // One listing is the row's subject, and the lister is the member it is about;
    // a screen of many is a list of ids.
    ...(only ? { resourceId: only.id, targetUserId: only.agentId ?? null } : {}),
    listingIds: listings.map((l) => l.id),
    count: listings.length,
    via,
    disclosed,
    ...(reason ? { statedReason: reason } : {}),
  });
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
  listingId?: string;
  userId?: string;
  message?: string | null;
  viewingDate?: Date | string | null;
  createdAt?: Date | string | null;
  notes?: string | null;
  updatedAt?: Date | string | null;
  user?: Record<string, unknown> | null;
  listing?: (ListingRow & Record<string, unknown>) | null;
};

/**
 * An inquiry as the lister sees it. On a confidential listing the asker is an
 * alias with no user id or avatar, until the lister has approved her and she
 * has chosen to share her details.
 *
 * The row is built from a short list of what a lister may see, not by spreading
 * what the database returned. Prisma hands back every scalar column with the
 * include, and one of them is `userId`: the key to her public profile, her real
 * name and her city. It used to ride along beside a nulled `user`, so a lister
 * could read the alias and the id in the same response and unmask her before
 * she had chosen to share anything. A column added to the table later stays out
 * of this response until someone decides a lister should see it.
 */
function presentForLister<T extends InquiryRow>(inq: T, listing: Pick<ListingRow, 'dvSafe' | 'type'>) {
  const priv = readPrivate(inq.notes, inq.updatedAt);
  const contactShared = Boolean(priv.contactSharedAt);
  const showPerson = !isConfidential(listing) || (inq.status === 'APPROVED' && contactShared);
  return {
    id: inq.id,
    listingId: inq.listingId,
    status: inq.status,
    message: inq.message,
    viewingDate: inq.viewingDate,
    createdAt: inq.createdAt,
    updatedAt: inq.updatedAt,
    // Her id appears only where `user` does, which is where she has been seen
    // by name already (an ordinary listing) or has chosen to be.
    ...(showPerson && inq.userId !== undefined ? { userId: inq.userId } : {}),
    alias: aliasFor(inq.id),
    user: showPerson ? (inq.user ?? null) : null,
    contactShared,
    thread: priv.thread,
  };
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
  await bestEffort(`notification.${kind}`, async () => {
    // A housing note names the place and quotes the other person, which is the
    // one thing a woman who keeps her notifications vague does not want read by
    // whoever is holding her open phone. Every notification that leaves the
    // platform is shaped by this member's setting (push.service, the email
    // sender), and this bell list was the one that was not: it wrote the
    // listing's title and the lister's own words straight into the row. The
    // words stay in the housing page the link opens, where she is signed in; the
    // row says only that there is an update. A lookup that fails reads as vague,
    // not as the real words.
    const shaped = await safeNotificationFor(userId, title, message);
    return prisma.notification.create({
      data: { userId, type: 'SYSTEM', title: shaped.title, message: shaped.message, link, ...(data ? { data: data as Prisma.InputJsonValue } : {}) },
    });
  }, null);
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
    } else {
      // Even for a woman who may see them, a confidential listing is shown only
      // once staff have checked it. Writes already hold such a listing until
      // then; this is the read that keeps a row written before that rule, or
      // by a path that forgot it, from reaching her as "safe".
      where.AND = [{ OR: [{ safetyVerified: true }, { dvSafe: false, type: { notIn: CONFIDENTIAL_TYPES } }] }];
    }

    const take = Math.min(Math.max(1, Number(limit) || 20), 50);
    // Capped as every other list is (utils/pagination MAX_PAGE): ?page=1e18 made an OFFSET Postgres refuses.
    const pageNo = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), 10_000);
    const skip = (pageNo - 1) * take;

    const [listings, total] = await Promise.all([
      prisma.housingListing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.housingListing.count({ where }),
    ]);

    const released = await releasedListingIds(req.user?.id, listings.map((l) => l.id));

    // A member of staff browsing the list is shown the street address of each
    // confidential place on it; that is a read of DV-safe data and is recorded.
    await auditStaffView(req, listings.filter((l) => isStaffReadOfConfidential(req, l, released)), 'listing list', ['address']);

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
    // A held, let or withdrawn listing is the lister's and staff's business. It
    // used to be readable by id by anyone who could read the type, which put a
    // listing nobody had checked in front of a woman who had only been given a
    // link; to everyone else it does not exist.
    if (!own && listing.status !== 'ACTIVE') throw new ApiError(404, 'Housing listing not found');
    if (isConfidential(listing) && !own) {
      // To a stranger a confidential listing does not exist; a member who is
      // not yet eligible is told how to become so.
      if (!req.user) throw new ApiError(404, 'Housing listing not found');
      const access = await confidentialAccess(req);
      if (!access.eligible) throw new ApiError(403, access.reason || MEMBER_REASON);
      // Live and confidential but never checked is a row from before the check
      // was required; it does not exist for her either.
      if (!listing.safetyVerified) throw new ApiError(404, 'Housing listing not found');
    }

    const released = own ? new Set<string>() : await releasedListingIds(req.user?.id, [id]);
    // Staff reach a held, let or withdrawn confidential listing here too, and
    // with its address. Recorded whatever its status.
    await auditStaffView(req, isStaffReadOfConfidential(req, listing, released) ? [listing] : [], 'listing detail', ['address']);
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
      if (isConfidential(listing) && !listing.safetyVerified) throw new ApiError(400, 'This listing is no longer available');
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

      const closed = ['WITHDRAWN', 'DECLINED'].includes(inquiry.status);
      // The status used to be written as sent, so the asker could move a pending
      // inquiry to APPLICATION_SUBMITTED, and this route's own answer then
      // carried the street address (presentForAsker releases it at that state),
      // or move a declined one back to open. See ASKER_MOVES.
      if (status && !(ASKER_MOVES[status] ?? []).includes(inquiry.status)) {
        throw new ApiError(409, closed ? CLOSED_INQUIRY : status === 'APPLICATION_SUBMITTED' ? APPLY_AFTER_ANSWER : 'That change cannot be made from where this inquiry stands');
      }

      const text = typeof reply === 'string' ? reply.trim() : '';
      if (closed && (text || viewingDate)) throw new ApiError(400, CLOSED_INQUIRY);
      let notes: string | undefined;
      if (text) {
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

// DELETE /api/housing/inquiries/:id - The asker's side: take the whole thing back.
//
// Withdrawing only changed the status: the inquiry, what she wrote and every line
// of the thread stayed on /my/inquiries for as long as the account did, which on
// a shared device is a record that she looked for a safe place. This removes it:
// the row, with the message and the thread it carries, and the notices the lister
// was given about it. Nobody is told. The lister has no use for a thread with
// someone who is no longer asking, and a notice "she deleted her inquiry" is a
// notice about her. The listing is unaffected, and she may ask about it again.
router.delete('/inquiries/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const inquiry = await prisma.housingInquiry.findUnique({
      where: { id },
      select: { id: true, userId: true, listing: { select: { agentId: true } } },
    });
    if (!inquiry) throw new ApiError(404, 'Inquiry not found');
    if (inquiry.userId !== userId) throw new ApiError(403, 'Not authorized to remove this inquiry');

    await prisma.housingInquiry.delete({ where: { id: inquiry.id } });

    // Its notices in the lister's bell point at a thread that is gone, and so do
    // the asker's own. Only those two members are ever sent one about an
    // inquiry, so the sweep is bounded to them by the indexed column and is not
    // a scan of every notification on the platform for a value inside the JSON.
    // Best effort: the inquiry is already deleted, and a stale notice is cosmetic.
    const recipients = [inquiry.userId, ...(inquiry.listing?.agentId ? [inquiry.listing.agentId] : [])];
    await bestEffort('housing.inquiry-removed.lister-notices', () =>
      prisma.notification.deleteMany({ where: { userId: { in: recipients }, data: { path: ['inquiryId'], equals: inquiry.id } } })
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

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
      // was checked. A DV-safe claim is a request, held until staff look. So is
      // an emergency or transitional place, which is confidential whether or not
      // the lister ticks DV-safe: it used to go live at once, so anyone with an
      // account could offer "emergency accommodation" to a woman in crisis with
      // nobody having looked at it.
      const wantsDvSafe = dvSafe === true || dvSafe === 'true';
      const needsCheck = isConfidential({ dvSafe: wantsDvSafe, type });
      const safeNote = typeof dvSafeNote === 'string' ? dvSafeNote.trim() : '';
      if (wantsDvSafe && !safeNote) throw new ApiError(400, NEEDS_NOTE);

      // Anything in the body shaped like one of the internal tags is dropped,
      // so a lister cannot write her own check clock or somebody else's note.
      const cleanFeatures = publicFeatures(features);

      // The pictures were stored as typed, whatever they were. Each is a link
      // a member's page will render, so each has to be one a browser may follow.
      const imagesProblem = listingImagesProblem(images);
      if (imagesProblem) throw new ApiError(400, imagesProblem);

      // On a confidential place the words carry neither the street address nor
      // a phone number: every eligible member reads them before the lister has
      // answered anyone, which is exactly when the address is withheld.
      const wordsProblem = needsCheck ? confidentialTextProblem(title, description) : null;
      if (wordsProblem) throw new ApiError(400, wordsProblem.message);

      // Then the same screen a post goes through. A listing was the one public
      // surface that skipped it, and its words reach a woman looking for
      // somewhere safe.
      await assertContentAllowed(`${String(title).trim()}\n${String(description).trim()}`, { kind: 'housing_listing', userId });

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
          features: needsCheck ? withSafetyCheckRequest(cleanFeatures, safeNote) : cleanFeatures,
          safetyVerified: false,
          dvSafe: wantsDvSafe,
          petFriendly: petFriendly === true,
          accessibleUnit: accessibleUnit === true,
          availableFrom: availableFrom ? new Date(availableFrom) : undefined,
          minLeaseTerm: minLeaseTerm ? Number(minLeaseTerm) : undefined,
          flexibleLease: flexibleLease === true,
          images: cleanListingImages(images),
          status: needsCheck ? 'PENDING' : 'ACTIVE',
        },
      });

      if (needsCheck) {
        await noteAdmins(
          wantsDvSafe ? 'A housing listing asks to be shown as DV-safe' : `A ${String(type).toLowerCase()} housing listing is waiting for a check`,
          `"${listing.title}"${listing.city ? ` in ${listing.city}` : ''} is held until someone checks it. ${checkDueLine()}`,
          '/admin/housing',
          { kind: 'HOUSING_DV_SAFE_CHECK', listingId: listing.id }
        );
      }

      logger.info(`Housing listing created: ${listing.id}${needsCheck ? ' (held for a safety check)' : ''}`);

      res.status(201).json({
        success: true,
        data: presentOwn(listing),
        pendingSafetyCheck: needsCheck,
        message: needsCheck
          ? `Listed. Because ${wantsDvSafe ? 'you asked for it to be shown as DV-safe' : 'it is offered as emergency or transitional housing'}, ATHENA staff will look at it before it goes live. ${PROVIDER_CHECK_HELD_NOTE} You will be told when it does go live.`
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

// ===========================================
// THE LISTER'S PROVIDER CHECK
// ===========================================
// "Checked by ATHENA staff" on a DV-safe, emergency or transitional place is a
// promise about the person offering it as well as the place. A member who lists
// such places asks to be checked as a provider here: who they are and how they
// are connected to the places they list. Staff decide it from the queue below,
// and the badge can be given only while the check stands (housing-provider.service).
// The member is told what is checked and what is not; no police or background
// check is run, and none is asked for.

// GET /api/housing/my/provider-check - Where the member's check stands, and what asking involves
router.get('/my/provider-check', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.housingProviderVerification.findUnique({ where: { userId: req.user!.id } });
    res.json({
      success: true,
      data: {
        ...presentProviderCheck(row),
        relationships: Object.entries(PROVIDER_RELATIONSHIP_LABELS).map(([value, label]) => ({ value, label })),
        renewalWindowDays: PROVIDER_CHECK_RENEWAL_WINDOW_DAYS,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/housing/my/provider-check - Ask to be checked, or ask again
router.post('/my/provider-check', authenticate, requireWomanMember, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parseProviderInput(providerApplicationSchema, req.body);
    const row = await submitProviderCheck(req.user!.id, input);

    await noteAdmins(
      'A housing provider asks to be checked',
      `${input.providerName} asks to be checked as a provider of safe housing. Any of their DV-safe, emergency or transitional places that need the badge wait on it.`,
      '/admin/housing#provider-checks',
      { kind: 'HOUSING_PROVIDER_CHECK', userId: req.user!.id }
    );

    logger.info(`User ${req.user!.id} asked to be checked as a housing provider`);
    res.status(201).json({
      success: true,
      data: presentProviderCheck(row),
      message: 'Sent. A member of staff will look at it. Your DV-safe, emergency and transitional places can show as checked once they have.',
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
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Authentication required');
      const listing = await prisma.housingListing.findUnique({
        where: { id },
        select: { id: true, agentId: true, title: true, description: true, rentWeekly: true, type: true, city: true, dvSafe: true, safetyVerified: true, status: true, features: true },
      });
      if (!listing) throw new ApiError(404, 'Housing listing not found');
      if (listing.agentId !== userId && !isAdmin(req)) {
        throw new ApiError(403, 'Only the person who listed this place can change it');
      }

      // `safetyVerified` is ignored here for everyone; staff set it on the
      // admin route so the change is recorded as theirs.
      const { status, title, description, rentWeekly, availableFrom, dvSafe, dvSafeNote, petFriendly, accessibleUnit } = req.body;

      // A listing staff took down (an administrator withdrew it, or a moderator
      // removed it on a report) comes back only through staff. Its status is a
      // switch its lister can press, so without this a take-down of an ordinary
      // listing, which has no check to go back through, lasted until she pressed
      // "Available".
      if (status === 'ACTIVE' && listing.status !== 'ACTIVE' && takenDownByStaff(listing.features)) {
        throw new ApiError(409, TAKEN_DOWN_BY_STAFF);
      }

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
      let adminTitle = 'A housing listing asks to be shown as DV-safe';

      // Takes the listing off the list, ends any check it had, and starts the
      // clock for a new one. Whatever else this call says about the status.
      const holdForCheck = (safeNote: string) => {
        data.safetyVerified = false;
        data.status = 'PENDING';
        data.features = withSafetyCheckRequest(listing.features, safeNote);
        requestedCheck = true;
      };

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
        holdForCheck(safeNote);
        message = 'Asked. ATHENA staff will look at the listing before it shows as DV-safe; it is off the list until then.';
      } else if (dvSafe === false && listing.dvSafe) {
        // Lowering a claim needs no check, and ends the one it had: the badge
        // said this listing was checked as DV-safe, which it no longer claims.
        data.dvSafe = false;
        data.safetyVerified = false;
        if (isConfidential({ dvSafe: false, type: listing.type })) {
          // An emergency or transitional place is confidential with or without
          // the DV-safe claim, so lowering it ends the check without making the
          // place any less in need of one: it goes back to the queue.
          if (listing.status === 'ACTIVE') {
            holdForCheck(dvSafeNoteOf(listing.features) ?? '');
            adminTitle = `A ${String(listing.type).toLowerCase()} housing listing is waiting for a check`;
            message = 'Staff will look at the listing again before it goes back on the list.';
          }
        } else {
          data.features = withoutSafetyCheckRequest(listing.features);
        }
      }

      const claimsDvSafe = typeof data.dvSafe === 'boolean' ? data.dvSafe : listing.dvSafe;
      const staysConfidential = isConfidential({ dvSafe: claimsDvSafe, type: listing.type });

      // New words are screened as they are on the way in (POST /listings): on a
      // confidential place for a street address or a phone number, and on any
      // listing by the gate a post goes through. Only when they changed; a saved
      // form that repeats them is not a new publication.
      const titleAfter = typeof data.title === 'string' ? data.title.trim() : String(listing.title).trim();
      const descriptionAfter = typeof data.description === 'string' ? data.description.trim() : String(listing.description).trim();
      const wordsChanged = titleAfter !== String(listing.title).trim() || descriptionAfter !== String(listing.description).trim();
      if (wordsChanged) {
        const wordsProblem = staysConfidential ? confidentialTextProblem(titleAfter, descriptionAfter) : null;
        if (wordsProblem) throw new ApiError(400, wordsProblem.message);
        await assertContentAllowed(`${titleAfter}\n${descriptionAfter}`, { kind: 'housing_listing', userId });
      }

      // A check is a check of what was there. Changing the title, the
      // description or the rent afterwards leaves "Checked by ATHENA staff" on
      // words and a price nobody looked at, so it ends the check. A live
      // confidential listing is taken off the list until staff have looked
      // again; anything else just loses the badge.
      if (listing.safetyVerified && !requestedCheck) {
        const edited =
          (typeof data.title === 'string' && data.title.trim() !== String(listing.title).trim()) ||
          (typeof data.description === 'string' && data.description.trim() !== String(listing.description).trim()) ||
          (typeof data.rentWeekly === 'number' && data.rentWeekly !== (listing.rentWeekly === null ? null : Number(listing.rentWeekly)));
        if (edited) {
          data.safetyVerified = false;
          message = CHECK_ENDED_BY_EDIT;
          if (staysConfidential && listing.status === 'ACTIVE') {
            holdForCheck(dvSafeNoteOf(listing.features) ?? '');
            adminTitle = 'A checked housing listing was changed and needs checking again';
          }
        }
      }

      if (status && !requestedCheck) {
        const verifiedAfter = typeof data.safetyVerified === 'boolean' ? data.safetyVerified : listing.safetyVerified;
        // A checked listing that was withdrawn or let comes back with its badge
        // only if the check on whoever lists it still stands: the hourly sweep
        // looks at live listings, so a withdrawn one would otherwise come back
        // after the provider check ran out, with the badge on it.
        const providerLapsed =
          status === 'ACTIVE' && staysConfidential && verifiedAfter && listing.status !== 'ACTIVE' && !(await isProviderVerified(listing.agentId));
        if (providerLapsed) {
          holdForCheck(dvSafeNoteOf(listing.features) ?? '');
          adminTitle = `A ${String(listing.type).toLowerCase()} housing listing is waiting for a check`;
          message = 'Your provider check is no longer current, so staff will look at the listing again before it goes back on the list. Ask for a new provider check under "Your provider check".';
        } else if (status === 'ACTIVE' && staysConfidential && !verifiedAfter) {
          // Not live until checked, and not even for an admin here: staff put a
          // listing live from the check below, where the decision is recorded.
          if (listing.status === 'PENDING' || isAdmin(req)) throw new ApiError(400, HELD_FOR_CHECK);
          // Withdrawn or let, and unchecked: putting it back is asking for the
          // check, so it goes to the queue rather than being refused with
          // nothing waiting.
          holdForCheck(dvSafeNoteOf(listing.features) ?? '');
          adminTitle = `A ${String(listing.type).toLowerCase()} housing listing is waiting for a check`;
          message = 'Asked. ATHENA staff will look at the listing before it goes back on the list.';
        } else {
          data.status = status;
        }
      }

      const updated = await prisma.housingListing.update({ where: { id }, data });

      // An administrator may change a listing that is not hers, and the answer
      // is the lister's own view of it: address and DV-safe note included. It is a
      // read of confidential data if the listing was confidential when she opened
      // it or is after her change: an administrator who lowers the DV-safe claim is
      // still handed the address and note of the place that was one a moment ago.
      const confidentialRead = isStaffReadOfConfidential(req, listing) || isStaffReadOfConfidential(req, updated);
      await auditStaffView(req, confidentialRead ? [updated] : [], 'listing change', ['address', 'dvSafeNote']);

      if (requestedCheck) {
        await noteAdmins(
          adminTitle,
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

      // An administrator who answers for a lister is shown the whole thread, and
      // on a confidential listing the thread is the one thing that is kept from
      // everyone but the lister. The row is about the woman who asked, so her
      // own export lists it, and it names the thread, not what it says.
      if (isStaffReadOfConfidential(req, inquiry.listing)) {
        const reason = statedReason(req);
        await recordStaffRead(req, 'HOUSING_DV_SAFE_VIEWED', {
          resourceType: 'HousingInquiry',
          resourceId: id,
          targetUserId: inquiry.userId,
          listingIds: [listingId],
          count: 1,
          via: 'inquiry thread',
          disclosed: ['inquiry thread'],
          ...(reason ? { statedReason: reason } : {}),
        });
      }

      res.json({ success: true, data: presentForLister(updated, inquiry.listing) });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN: THE SAFETY CHECK ON CONFIDENTIAL LISTINGS
// ===========================================
// A listing that asks to be shown as DV-safe, and every emergency or
// transitional listing, waits here. Staff approve it as checked, let a DV-safe
// one show as an ordinary listing, or take it down; the lister is told either
// way, and the decision is in the audit log under whoever made it. Approving
// takes two things: a note of what staff checked, and a standing provider check
// on the lister (below).
//
// The queue used to be every DV-safe listing nobody had checked, oldest
// created first, with nothing to say how long any of them had waited. It is
// now ordered by when the check was asked for, each row carries its due time,
// and the answer says how many are late.

// GET /api/housing/admin/pending - DV-safe, emergency and transitional listings waiting for a check
router.get('/admin/pending', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    // Whether the person offering each place has a standing provider check. A
    // listing cannot be marked checked without one, so staff are shown it
    // beside the listing and know before they press Approve.
    const standings = await providerStandings(agentIds, now);
    const data = listings.map((l) => ({
      ...presentOwn(l),
      lister: l.agentId ? byId.get(l.agentId) ?? null : null,
      providerCheck: l.agentId ? standings.get(l.agentId) ?? { standing: 'NONE', expiresAt: null } : { standing: 'NONE', expiresAt: null },
      safetyCheck: safetyCheckClock(l, now),
    }));
    // The queue carries each lister's name and email, the note on why the place
    // is safe and its street address. One row for the request, naming every
    // listing it held (an empty queue shows nothing and writes nothing).
    await auditStaffView(req, listings, 'check queue', ['address', 'dvSafeNote', 'listerName', 'listerEmail']);
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
    // A line the lister is shown with the outcome.
    body('note').optional().isString().isLength({ max: 500 }),
    // What the member of staff checked. Kept in the audit row, not shown to the lister.
    body('checkNote').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      failOnErrors(req);
      const { id } = req.params;
      const { safetyVerified, dvSafe, status, note: line, checkNote: rawCheckNote } = req.body as {
        safetyVerified?: boolean;
        dvSafe?: boolean;
        status?: string;
        note?: string;
        checkNote?: string;
      };
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
      const confidentialAfter = isConfidential({ dvSafe: after.dvSafe, type: listing.type });
      // A live DV-safe, emergency or transitional listing is always one staff checked.
      if (confidentialAfter && after.status === 'ACTIVE' && !after.safetyVerified) {
        throw new ApiError(400, 'A DV-safe, emergency or transitional listing goes live only once it is marked as checked');
      }

      // The badge is for confidential listings only, as the staff-entered route
      // has always said: what it tells a woman (housing page) includes a check
      // on the provider, which an ordinary listing never goes through. So an
      // ordinary listing is not badged from here, and a listing that stops being
      // confidential because staff lower its DV-safe claim loses the badge the
      // claim earned, as it does when its lister lowers the claim.
      if (!confidentialAfter && after.safetyVerified) {
        if (safetyVerified === true) {
          throw new ApiError(400, 'Only a DV-safe, emergency or transitional listing is marked as checked. Tick DV-safe, or leave the check off.');
        }
        after.safetyVerified = false;
      }

      // Marking a place checked is the promise the badge makes, so the person
      // making it says what she checked, and that goes in the audit row. The
      // approval used to take an optional line for the lister and nothing else:
      // a badge a woman trusts, with no record of what had been looked at.
      const newlyChecked = after.safetyVerified && !listing.safetyVerified;
      const checkNote = typeof rawCheckNote === 'string' ? rawCheckNote.trim() : '';
      if (newlyChecked && checkNote.length < 10) throw new ApiError(400, CHECK_NOTE_REQUIRED);

      // The badge is also a promise about the person offering the place, so a
      // confidential listing is badged, or put live badged, only while its
      // lister has a provider check that is approved and has not run out.
      const badgeNeedsProvider = confidentialAfter && after.safetyVerified && (newlyChecked || after.status === 'ACTIVE');
      const providerVerified = badgeNeedsProvider ? await isProviderVerified(listing.agentId) : null;
      if (badgeNeedsProvider && !providerVerified) throw new ApiError(400, PROVIDER_CHECK_REQUIRED);

      const clock = isConfidential(listing) && !listing.safetyVerified ? safetyCheckClock(listing) : null;

      // A listing staff take down comes back only through the staff check. Left
      // checked, its lister could put it live again herself with the badge on
      // it, which is the one thing a take-down is meant to stop.
      const takenDown = confidentialAfter && after.status === 'WITHDRAWN' && listing.status !== 'WITHDRAWN' && typeof safetyVerified !== 'boolean';
      if (takenDown) after.safetyVerified = false;

      // Whatever its type, a listing staff withdraw is marked as theirs, so its
      // lister cannot put it back with the status switch; and one staff put back
      // is released, so she can manage it again.
      const staffTookDown = after.status === 'WITHDRAWN' && listing.status !== 'WITHDRAWN';
      const staffPutBack = Boolean(status) && after.status !== 'WITHDRAWN' && takenDownByStaff(listing.features);
      const features = staffTookDown ? withStaffTakedown(listing.features) : staffPutBack ? withoutStaffTakedown(listing.features) : null;

      // Written when staff said so, and when the rules above changed it (a
      // take-down, or a claim lowered) from what the row holds.
      const badgeChanged = after.safetyVerified !== listing.safetyVerified;
      const updated = await prisma.housingListing.update({
        where: { id },
        data: {
          ...((typeof safetyVerified === 'boolean' || badgeChanged) && { safetyVerified: after.safetyVerified }),
          ...(typeof dvSafe === 'boolean' && { dvSafe }),
          ...(status && { status: status as any }),
          ...(features && { features }),
        },
      });

      const wentLive = after.status === 'ACTIVE' && listing.status !== 'ACTIVE';
      let outcome: string;
      if (after.status === 'WITHDRAWN' && listing.status !== 'WITHDRAWN') {
        outcome = `Your listing "${listing.title}" has been taken down by ATHENA staff.`;
      } else if (listing.dvSafe && !after.dvSafe && !confidentialAfter) {
        outcome = `Your listing "${listing.title}" is ${after.status === 'ACTIVE' ? 'live as an ordinary listing' : 'not shown as DV-safe'}; staff could not confirm it as DV-safe.`;
      } else if (confidentialAfter && after.safetyVerified && (wentLive || !listing.safetyVerified)) {
        const shownAs = after.dvSafe ? 'DV-safe' : `${String(listing.type).toLowerCase()} housing`;
        outcome = `Your listing "${listing.title}" has been checked by ATHENA staff and ${after.status === 'ACTIVE' ? 'is live' : 'will show'} as ${shownAs}.`;
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
        // What the member of staff said she checked, and that the lister held a
        // standing provider check when the badge was given.
        ...(newlyChecked ? { checkNote } : {}),
        ...(providerVerified !== null ? { providerCheckStanding: providerVerified ? 'APPROVED' : 'NOT_APPROVED' } : {}),
        ...(clock ? { waitedHours: clock.hoursWaiting, overdue: clock.overdue } : {}),
        ...(extra ? { noteToLister: extra.trim() } : {}),
      });

      // The answer is the lister's own view of the listing, address and DV-safe
      // note included, and the route takes any listing's id, not only one from
      // the queue; so deciding on a confidential listing is also a read of it, and
      // is recorded as one beside the decision. (A listing the member of staff
      // lists herself is hers to read, as everywhere else.)
      const confidentialRead = isStaffReadOfConfidential(req, listing) || isStaffReadOfConfidential(req, updated);
      await auditStaffView(req, confidentialRead ? [updated] : [], 'check decision', ['address', 'dvSafeNote']);

      res.json({ success: true, data: presentOwn(updated) });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN: THE PROVIDER CHECK
// ===========================================
// The person offering a DV-safe, emergency or transitional place is checked once
// and the check stands for a year, so a badge on a listing rests on a person
// ATHENA has looked at. Approving writes down what was checked; refusing writes
// down why, which the member can read. Either way the decision is in the audit
// log under whoever made it. A refusal, or a check withdrawn, takes the badge
// off that member's listings at once rather than at the next hourly sweep.

const staffProviderRow = (
  row: {
    id: string;
    userId: string;
    providerName: string;
    relationship: string;
    abn: string | null;
    statement: string | null;
    status: string;
    basis: string | null;
    evidence: unknown;
    reviewedAt: Date | null;
    expiresAt: Date | null;
    submittedAt: Date;
    user?: unknown;
  },
  now: Date
) => ({
  id: row.id,
  userId: row.userId,
  providerName: row.providerName,
  relationship: row.relationship,
  relationshipLabel: PROVIDER_RELATIONSHIP_LABELS[row.relationship as keyof typeof PROVIDER_RELATIONSHIP_LABELS] ?? row.relationship,
  abn: row.abn ? formatAbn(row.abn) : null,
  statement: row.statement,
  standing: providerStanding(row, now),
  basis: row.basis,
  evidence: row.evidence ?? null,
  reviewedAt: row.reviewedAt,
  expiresAt: row.expiresAt,
  submittedAt: row.submittedAt,
  // A member whose check stands asked again before it ended.
  renewalRequested: row.status === 'APPROVED' && Boolean(row.reviewedAt) && row.submittedAt.getTime() > row.reviewedAt!.getTime(),
  user: row.user ?? null,
});

// GET /api/housing/admin/provider-checks - Checks waiting for a decision, those about to end, and the rest that stand
router.get('/admin/provider-checks', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + PROVIDER_CHECK_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const include = {
      user: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, womanVerificationStatus: true, createdAt: true } },
    };
    // "Standing" is every approved check that does not end within the month, so
    // that staff can find one to withdraw. Without it a check could be taken back
    // only in the last month of its year, because the queue showed nothing else;
    // and a check whose date has passed is not "ending", it is over.
    const [waiting, ending, standing] = await Promise.all([
      prisma.housingProviderVerification.findMany({ where: { status: 'PENDING' }, include, orderBy: { submittedAt: 'asc' }, take: SAFETY_CHECK_WINDOW }),
      prisma.housingProviderVerification.findMany({ where: { status: 'APPROVED', expiresAt: { gt: now, lte: soon } }, include, orderBy: { expiresAt: 'asc' }, take: SAFETY_CHECK_WINDOW }),
      prisma.housingProviderVerification.findMany({ where: { status: 'APPROVED', expiresAt: { gt: soon } }, include, orderBy: { expiresAt: 'asc' }, take: SAFETY_CHECK_WINDOW }),
    ]);
    res.json({
      success: true,
      data: {
        waiting: waiting.map((row) => staffProviderRow(row, now)),
        ending: ending.map((row) => staffProviderRow(row, now)),
        standing: standing.map((row) => staffProviderRow(row, now)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/housing/admin/provider-checks/:userId - Approve or refuse a member's provider check
router.patch('/admin/provider-checks/:userId', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const decision = parseProviderInput(providerDecisionSchema, req.body);
    // A check decided by the person it is about is not a check. Another member
    // of staff has to decide it.
    if (userId === req.user!.id) {
      throw new ApiError(403, 'You cannot decide your own provider check. Ask another member of staff to.');
    }

    const now = new Date();
    const { before, after } = await decideProviderCheck(userId, decision, req.user!.id, now);

    if (decision.decision === 'REJECT') {
      // The badge on this member's listings was resting on the check that has
      // just been refused or withdrawn.
      const swept = await sweepProviderChecks(now, { userId, tell: false });
      await note(
        userId,
        'Your provider check was not approved',
        `${decision.basis} Your DV-safe, emergency and transitional places${swept.listingsTakenDown ? ' that showed as checked are off the list' : ' do not show as checked'} until a check is approved. You can ask again under "Your provider check".`,
        '/dashboard/housing#provider-check',
        { kind: 'HOUSING_PROVIDER_CHECK_DECISION', outcome: 'REJECTED' }
      );
    } else {
      await note(
        userId,
        'Your provider check is approved',
        `ATHENA staff have checked you as a provider. It stands until ${after.expiresAt!.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'Australia/Brisbane' })}. Your DV-safe, emergency and transitional places can now show as checked once staff have looked at each one.`,
        '/dashboard/housing#provider-check',
        { kind: 'HOUSING_PROVIDER_CHECK_DECISION', outcome: 'APPROVED' }
      );
    }

    await recordStaffAction(req, 'HOUSING_PROVIDER_CHECKED', {
      resourceType: 'HousingProviderVerification',
      resourceId: after.id,
      targetUserId: userId,
      before: { status: before.status, expiresAt: before.expiresAt },
      after: { status: after.status, expiresAt: after.expiresAt },
      decision: decision.decision,
      basis: decision.basis,
      ...(decision.checks ? { checks: decision.checks } : {}),
      ...(after.evidence ? { evidence: after.evidence } : {}),
    });

    res.json({ success: true, data: staffProviderRow(after, now) });
  } catch (error) {
    next(error);
  }
});

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
    if (safetyVerified && !isConfidentialListing(input)) {
      throw new ApiError(400, 'Only a DV-safe, emergency or transitional listing is marked as checked. Tick DV-safe, or leave the check off.');
    }
    // Marking a listing checked is the promise the badge makes, so the person
    // making it says what she checked, and that goes in the audit row.
    if (safetyVerified && checkNote.length < 10) {
      throw new ApiError(400, 'Say what you checked — who you spoke to, and how you know the place is safe — before marking it checked.');
    }

    const lister = await resolveLister(req, req.body?.listerEmail);
    // The badge is also a promise about whoever the place is listed under. A
    // listing entered by staff is badged only while that member holds a
    // standing provider check, the same rule as when staff check a member's own.
    if (safetyVerified && !(await isProviderVerified(lister.id))) throw new ApiError(400, PROVIDER_CHECK_REQUIRED);
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
// validated: csv must be non-empty text of at most 1,000,000 characters and is parsed row by row by
//   planHousingImport, which writes nothing if any row is bad; dryRun is read as === true.
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
    const held = plan.rows.filter((r) => isConfidentialListing(r.input)).length;

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
