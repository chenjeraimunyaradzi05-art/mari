/**
 * Mentor Service
 * Management of mentor profiles, sessions, and reviews
 */

import { prisma } from '../utils/prisma';
import { MentorPaymentStatus, MentorSessionStatus, Prisma } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import { hiddenMemberWhere, viewerContextFor } from './search.service';
// import { sendNotification } from './socket.service'; // Deprecated
import { notificationService } from './notification.service';
import { getStripe } from '../utils/stripe';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { MENTOR_PLATFORM_FEE_RATE, PRICE_CURRENCY, splitFee } from '../config/price-book';
import {
  createConnectedAccount,
  createEscrowPayment,
  resolveConnectedAccountId,
} from './stripe-connect.service';
import { cancelSessionHold, captureSessionHold, paymentReleaseTimeFor } from './mentor-payment-release.service';
import { isPaymentsPausedError } from './feature-flags.service';
import { isBlockedRelationship } from '../utils/safety-store';
import { MENTOR_BOOKING_HORIZON_DAYS, latestMentorSessionStart } from './escrow-deadline';
import {
  isDevelopmentHold,
  notifyMentorOfRequest,
  readCardHold,
  recordSessionAuthorised,
} from './mentor-session-authorisation.service';

// getStripe() is called at each use rather than once into a module constant.
// Capturing it at import time froze whatever client could be built the moment
// this module loaded: with STRIPE_SECRET_KEY not yet in the environment, every
// Connect account, session authorisation, capture and cancellation for the life
// of the process went out with the sk_test_not_configured placeholder, and the
// cache getStripe() rebuilds when the real key arrives could never be reached
// from here.
//
// There is no isStripeConfigured() gate because nothing in this module has a
// fallback to gate. An unconfigured deployment fails exactly as it did before:
// booking a session surfaces the failure to the mentee. getStripe() is now
// reached only from the two legacy branches below, for sessions booked before
// mentoring moved onto the shared escrow path; everything else goes through
// stripe-connect.service, which does have its own development fallback.
//
// A capture that fails no longer disappears into a warning. The mentor is told,
// the admins are told, and the session's payment status says FAILED rather than
// sitting at AUTHORIZED while the session reads COMPLETED.

// ATHENA's share of a mentoring session is held in the price book, with every
// other fee, so the service and the mentor agreement quote one number.

/** The Help & Support page, whose contact card reaches a person on the team. */
export const MENTEE_SUPPORT_LINK = '/dashboard/settings/help';

/**
 * Mentoring is charged in Australian dollars, whatever currency the mentee has
 * chosen to see her own figures in.
 *
 * A mentor's `hourlyRate` is a bare number with no currency, and every page
 * shows it as dollars. The session was charged in the mentee's own preferred
 * currency, one of fifteen, so the same rate of 100 was A$100 to one mentee and
 * 100 pesos or 100 dong to another: a mentee on PHP or VND paid a fraction of an
 * hour and the mentor, who is paid out of the same charge, was underpaid by the
 * difference. Charging in the one currency the rate is quoted in makes the price
 * on the page the price on the card.
 */
const SESSION_CURRENCY = PRICE_CURRENCY;

/** The shortest time a session is billed for, however short the slot booked. */
const MINIMUM_BILLED_MINUTES = 15;

/**
 * What a session costs, worked out in whole cents, once.
 *
 * The amount, the fee and the payout were floats in dollars and each was rounded
 * on its own when it met Stripe, while the unrounded figures were stored. A
 * 45-minute session at 33.33 an hour was charged as 25.00 with a 5.00 fee and
 * recorded as 24.9975, 4.9995 and 19.998, and the earnings statement, which adds
 * up the stored figures, did not agree with the card or with Stripe. The amount is
 * rounded to a cent here and the fee is rounded to a cent once from it, the payout
 * being what is left, so the three always add up and are what Stripe is sent.
 *
 * The dollar figures are for the columns that store them; they are the cents
 * divided by a hundred and carry no more than two decimals.
 */
export function calculateSessionAmounts(hourlyRate: number, durationMinutes: number) {
  const billedMinutes = Math.max(MINIMUM_BILLED_MINUTES, durationMinutes);
  const amountCents = Math.round((Math.round(hourlyRate * 100) * billedMinutes) / 60);
  const { feeCents, payoutCents } = splitFee(amountCents, Math.round(MENTOR_PLATFORM_FEE_RATE * 100));
  return {
    amountCents,
    feeCents,
    payoutCents,
    sessionAmount: amountCents / 100,
    platformFee: feeCents / 100,
    mentorPayout: payoutCents / 100,
  };
}

export interface MentorFilters {
  specialization?: string;
  minRate?: number;
  maxRate?: number;
  available?: boolean;
  search?: string;
  sort?: MentorSort;
}

/**
 * The orders the directory offers, each one a fact the platform records.
 *
 * The page offered "Highest Rated" as its default and three other orders, and
 * this service read none of them, so all four showed the same list. Rating is
 * not among these because nothing writes a rating: there is no review model,
 * no review endpoint and no review form.
 */
export const MENTOR_SORTS = ['sessions', 'newest', 'price_low', 'price_high'] as const;
export type MentorSort = (typeof MENTOR_SORTS)[number];

const MENTOR_ORDER: Record<MentorSort, Prisma.MentorProfileOrderByWithRelationInput[]> = {
  // Sessions completed is a fact the platform records (see
  // `updateSessionStatus`), and a mentor with none is newest-first rather than
  // buried, so a woman who joined this morning is findable.
  sessions: [{ sessionCount: 'desc' }, { createdAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  // A mentor who has not set a rate cannot be booked, so she sorts last either
  // way rather than first as "cheapest".
  price_low: [{ hourlyRate: { sort: 'asc', nulls: 'last' } }, { sessionCount: 'desc' }],
  price_high: [{ hourlyRate: { sort: 'desc', nulls: 'last' } }, { sessionCount: 'desc' }],
};

/**
 * The columns a mentor profile is served with.
 *
 * `select`, not `include`. An include returns every scalar on the model, and
 * these three endpoints — the directory, the profile-by-user lookup and the
 * profile-by-id lookup — are served to anonymous callers, so the mentor's
 * Stripe connected account id went out with her public profile on every one of
 * them. Fixing it on one of the three left the other two open.
 *
 * `stripeAccountId` is read here and then dropped in `toPublicMentorProfile`
 * below, because whether a paid booking can be raised at all depends on it.
 * It never reaches the response.
 */
const PUBLIC_MENTOR_PROFILE_SELECT = {
  id: true,
  userId: true,
  specializations: true,
  yearsExperience: true,
  hourlyRate: true,
  isAvailable: true,
  sessionCount: true,
  // `rating` and `reviewCount` are no longer served. Nothing writes either —
  // there is no review model, endpoint or form — so every card showed a filled
  // star beside "New (0)", presenting a review system the platform does not
  // have.
  isMonetized: true,
  stripeAccountId: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
      avatar: true,
      // Only an approved identity check sets this. A mentor's own badge is
      // "reviewed by a person" and is not drawn as verified.
      isVerified: true,
      headline: true,
      bio: true,
      experience: true,
      education: true,
    },
  },
} as const;

type MentorProfileRow = {
  hourlyRate: Prisma.Decimal | null;
  isAvailable: boolean;
  stripeAccountId: string | null;
  isMonetized: boolean;
};

/**
 * Whether a mentee can actually raise a booking against this profile.
 *
 * The mentor page has always drawn its booking form behind an `acceptsBookings`
 * flag and fallen back to the raw `stripeAccountId` when the server did not
 * send one. Once the account id was taken off the public payload — correctly —
 * neither value was there any more, so the expression was `undefined` for
 * everybody and the page told every visitor that every mentor "has not
 * finished setting up bookings yet". Nobody on the platform could be booked.
 * The server answers the question now instead of leaving the client to infer
 * it from a column it should never have seen.
 *
 * A null rate means she has not decided what to charge; zero means she has, and
 * the answer was nothing. See `requestSession` for why that is a real state
 * rather than an unset one.
 */
export function mentorAcceptsBookings(profile: MentorProfileRow): boolean {
  if (!profile.isAvailable || profile.hourlyRate === null) {
    return false;
  }

  const rate = Number(profile.hourlyRate);
  if (rate <= 0) {
    return true;
  }

  // An account that exists is not an account that can be paid. It is written
  // the moment it is minted, with Stripe having verified nothing, so a mentor
  // who had only pressed "Connect payouts" was shown as bookable: a mentee chose
  // a time, entered her card and was refused at the hold. `isMonetized` is
  // Stripe's own word that the account can take charges and pay out, kept by
  // the account.updated webhook, which is what the hold itself is gated on.
  return Boolean(profile.stripeAccountId) && profile.isMonetized;
}

/**
 * A mentor whose account staff have suspended or banned.
 *
 * Suspending an account stopped her signing in and nothing else here: her
 * profile stayed in the directory, her page still offered times, and a mentee
 * could raise a booking — and have her card held — against a mentor staff had
 * just taken off the platform, possibly for how she treated the last mentee.
 * The mentor agreement says a suspended mentor cannot be booked, and this is
 * what makes that true. Both columns are read because a ban is recorded
 * separately from a suspension.
 */
const SUSPENDED_MENTOR: Prisma.UserWhereInput = {
  OR: [{ isSuspended: true }, { bannedAt: { not: null } }],
};

/** Strips the connected account id and answers the bookability question in its place. */
function toPublicMentorProfile<T extends MentorProfileRow>(profile: T) {
  const { stripeAccountId: _withheld, ...rest } = profile;
  return { ...rest, acceptsBookings: mentorAcceptsBookings(profile) };
}

/**
 * Get mentors with filtering
 */
export async function getMentors(
  filters: MentorFilters,
  page = 1,
  limit = 20,
  /** Who is looking, when we know. Undefined for an anonymous caller. */
  viewerId?: string
) {
  const skip = (page - 1) * limit;

  const where: any = {
    isAvailable: filters.available ? true : undefined,
  };

  if (filters.minRate || filters.maxRate) {
    where.hourlyRate = {
      ...(filters.minRate && { gte: filters.minRate }),
      ...(filters.maxRate && { lte: filters.maxRate }),
    };
  }

  // Text search on user name or specializations
  if (filters.search) {
    where.OR = [
      { user: { displayName: { contains: filters.search, mode: 'insensitive' } } },
      { user: { bio: { contains: filters.search, mode: 'insensitive' } } },
      // Note: JSON search depends on DB capabilities, simplified here
    ];
  }

  // The mentor directory is a second search engine over the same members, and
  // it did not honour "hide me from search" — so a woman who turned herself off
  // in the Safety Centre was still returned by name here, to anyone, signed in
  // or not. The same filter the main search uses, rather than a second copy of
  // it that can drift: both stores of the switch, plus blocks in both
  // directions once we know who is asking.
  const viewer = await viewerContextFor(viewerId);
  where.user = { AND: [hiddenMemberWhere(viewer), { NOT: SUSPENDED_MENTOR }] };

  const [mentors, total] = await Promise.all([
    prisma.mentorProfile.findMany({
      where,
      select: PUBLIC_MENTOR_PROFILE_SELECT,
      skip,
      take: limit,
      // Not by rating. `MentorProfile.rating` and `reviewCount` have no writer
      // anywhere on the platform — there is no review model, no rating
      // endpoint and no review form, so the column is null for every mentor
      // who has ever existed. Ordering by it sorted the directory by nothing
      // at all while looking like it ranked by quality, which is worse than an
      // arbitrary order because it invites the reader to trust it.
      orderBy: MENTOR_ORDER[filters.sort ?? 'sessions'],
    }),
    prisma.mentorProfile.count({ where }),
  ]);

  // Client-side filtering for specializations if not supported by DB JSON query
  let filteredMentors = mentors;
  if (filters.specialization) {
    const spec = filters.specialization.toLowerCase();
    filteredMentors = mentors.filter((m) => {
      const specs = (m.specializations as string[]) || [];
      return specs.some((s) => s.toLowerCase().includes(spec));
    });
  }

  return {
    mentors: filteredMentors.map(toPublicMentorProfile),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a specific mentor profile
 */
export async function getMentorProfile(userId: string) {
  // The suspension filter sits beside the unique key (Prisma allows non-unique
  // filters there); a suspended mentor's profile answers as not found.
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId, user: { NOT: SUSPENDED_MENTOR } },
    select: PUBLIC_MENTOR_PROFILE_SELECT,
  });

  return profile ? toPublicMentorProfile(profile) : null;
}

export async function getMentorProfileById(mentorId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { id: mentorId, user: { NOT: SUSPENDED_MENTOR } },
    select: PUBLIC_MENTOR_PROFILE_SELECT,
  });

  return profile ? toPublicMentorProfile(profile) : null;
}

/**
 * Whether this member already has a published mentor profile.
 *
 * The profile route is an upsert, so "become a mentor" and "edit my rate" are
 * the same request. Publishing for the first time carries the women-only check;
 * editing an existing profile does not, and this is how the two are told apart.
 */
export async function hasMentorProfile(userId: string): Promise<boolean> {
  const existing = await prisma.mentorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Pause or resume new requests on an existing mentor profile.
 *
 * The become-a-mentor wizard promised "you can stop taking new requests at any
 * moment from your mentor dashboard", and nothing on the client could write
 * `isAvailable = false`: the only writer was the wizard itself, which always
 * sent `true`, so running it again to change a rate quietly re-listed a mentor
 * who had gone dark. Pausing stops new bookings and the free slots; sessions
 * already requested or confirmed are hers to keep or cancel as before.
 */
export async function setMentorAvailability(userId: string, isAvailable: boolean) {
  const existing = await prisma.mentorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!existing) {
    throw new ApiError(404, 'You do not have a mentor profile yet');
  }

  await prisma.mentorProfile.update({ where: { userId }, data: { isAvailable } });
  return getMentorProfile(userId);
}

/**
 * Create or update mentor profile
 */
export async function updateMentorProfile(
  userId: string,
  data: {
    specializations?: string[];
    hourlyRate?: number;
    yearsExperience?: number;
    isAvailable?: boolean;
  }
) {
  const profile = await prisma.mentorProfile.upsert({
    where: { userId },
    create: {
      userId,
      specializations: data.specializations || [],
      hourlyRate: data.hourlyRate,
      yearsExperience: data.yearsExperience,
      isAvailable: data.isAvailable ?? true,
    },
    update: {
      specializations: data.specializations,
      hourlyRate: data.hourlyRate,
      yearsExperience: data.yearsExperience,
      isAvailable: data.isAvailable,
    },
  });

  // A plain member becomes a MENTOR. Nobody else's role is touched.
  //
  // This used to set role: 'MENTOR' for whoever called it, whatever she was
  // before. `User.role` is a single value, not a set, so an ADMIN who
  // published a mentor profile silently stopped being an admin, a MODERATOR
  // lost the report queue, and a CREATOR, EMPLOYER or EDUCATION_PROVIDER lost
  // whatever that role opened for her — and re-saving her rate did it again
  // after anyone had put it back. Nothing on the platform gates on MENTOR
  // (the profile row is what makes a mentor), so leaving a higher role alone
  // costs nothing. updateMany with the USER condition makes the change and
  // the check one statement.
  await prisma.user.updateMany({
    where: { id: userId, role: 'USER' },
    data: { role: 'MENTOR' },
  });

  return profile;
}

/**
 * Enable mentor monetization (Stripe Connect)
 *
 * The account comes from the shared Connect service rather than a second
 * accounts.create of this module's own. Three separate paths — this one,
 * creator mode and the payments page — each used to mint their own Express
 * account for the same woman, and her earnings screen read only the one the
 * payments page wrote, so a mentor paid through this account saw A$0 and a
 * withdraw button that could never enable. `User.stripeConnectAccountId` is
 * the identity; `MentorProfile.stripeAccountId` stays as a mirror for one
 * release so a half-deployed build cannot strand an onboarded account.
 */
export async function enableMentorMonetization(userId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });

  if (!profile) {
    throw new ApiError(404, 'Mentor profile not found');
  }

  const existingAccountId = await resolveConnectedAccountId(userId);
  if (existingAccountId && profile.stripeAccountId === existingAccountId) {
    return profile;
  }

  const { accountId } = await createConnectedAccount({
    userId,
    email: profile.user.email,
    // 'AU' as the payments page already does: Stripe wants an ISO country code
    // and `User.country` holds a display name ("Australia").
    country: 'AU',
    type: 'mentor',
  });

  // createConnectedAccount has already written the account and its real state
  // onto the user and mirrored both onto this profile, including an
  // `isMonetized` that reflects what Stripe has actually verified rather than
  // the unconditional `true` this function used to write over a seconds-old
  // account.
  const updated = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId } });

  logger.info('Mentor monetization enabled', { userId, stripeAccountId: accountId });

  return updated;
}

export async function generateMentorStripeOnboardingLink(userId: string) {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(400, 'Mentor Stripe account not found. Enable monetization first.');
  }

  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    // The same two pages the shared Connect path uses. These used to point at
    // /dashboard/mentor and /dashboard/mentor/onboarding-refresh, neither of
    // which exists — the mentor dashboard is /dashboard/mentors — so a mentor
    // who finished Stripe's questions was handed a 404 at the end of them.
    refresh_url: `${process.env.CLIENT_URL}/dashboard/payments/refresh`,
    return_url: `${process.env.CLIENT_URL}/dashboard/payments/success`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

export async function generateMentorStripeLoginLink(userId: string) {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(400, 'Mentor Stripe account not found.');
  }

  try {
    const loginLink = await getStripe().accounts.createLoginLink(accountId);
    return loginLink.url;
  } catch (error: any) {
    if (error.code === 'account_invalid') {
      throw new ApiError(400, 'Please complete onboarding before accessing the dashboard.');
    }
    throw error;
  }
}

/**
 * Request a mentorship session
 */
export async function requestSession(
  menteeId: string,
  mentorId: string,
  data: {
    scheduledAt: Date;
    durationMinutes?: number;
    note?: string;
  }
) {
  // A suspended or banned mentor is reported as missing, the same answer her
  // profile page now gives, rather than as a mentor who could be booked.
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id: mentorId, user: { NOT: SUSPENDED_MENTOR } },
  });

  if (!mentor) {
    throw new ApiError(404, 'Mentor not found');
  }

  if (mentor.userId === menteeId) {
    throw new ApiError(400, 'Cannot request session with yourself');
  }

  // Not across a block, in either direction, and not only for a paid session. The
  // hold refuses a payment across a block (createEscrowPayment), but a mentor who
  // charges nothing has no hold, so a woman who had blocked somebody could still
  // be sent her request, with her name and picture on the mentor's list, and be
  // told of it by email and push. The answer is the one a mentor who does not
  // exist gets, so a block is not something the person on the other side can read
  // off the reply.
  if (await isBlockedRelationship(menteeId, mentor.userId)) {
    throw new ApiError(404, 'Mentor not found');
  }

  const durationMinutes = data.durationMinutes || 60;

  if (!mentor.isAvailable) {
    throw new ApiError(400, 'This mentor is not taking new sessions right now');
  }

  // A null rate and a zero rate used to be treated as the same thing, and they
  // are not. Null means she has not said what she charges, and a booking
  // against that has no amount to authorise. Zero means she has said, and the
  // answer is nothing — a woman who wants to mentor without charging, which on
  // a platform whose mentorship pitch is empowering the next generation of
  // women leaders is the mode you would expect to work first. It did not: the
  // check below rejected her rate as "not set" and the profile page hid her
  // booking form, so she was published as a mentor and was quietly unbookable,
  // with no explanation on her profile or in the wizard.
  if (mentor.hourlyRate === null) {
    throw new ApiError(400, 'Mentor hourly rate not set');
  }

  const hourlyRate = Number(mentor.hourlyRate);
  if (hourlyRate < 0) {
    throw new ApiError(400, 'Mentor hourly rate not set');
  }

  const isFreeSession = hourlyRate === 0;

  // A time that has passed cannot be booked. Nothing checked it: the route asked
  // only that the value be a date, so a session could be requested for last week,
  // accepted, and marked complete in the same minute, taking the mentee's card
  // for an hour that was never given.
  const requestedAt = Date.now();
  if (Number.isNaN(data.scheduledAt.getTime()) || data.scheduledAt.getTime() <= requestedAt) {
    throw new ApiError(400, 'Choose a time that has not passed yet');
  }

  // A paid session is held on the mentee's card from the moment it is requested,
  // and a hold lasts about a week. Booked further out than that, the hold ran out
  // before the hour, the capture at completion failed, and the mentor was never
  // paid for work she had given. The booking is refused now, with the reason,
  // instead of being taken and quietly failing three weeks later. A free session
  // holds nothing, so it can be booked as far ahead as the mentor will have it.
  if (!isFreeSession) {
    assertStartsWithinHold(data.scheduledAt, { createdAt: new Date(requestedAt) }, 'booking');
  }

  // Only a paid session needs somewhere for the money to land. Requiring a
  // Stripe Express account before a free session could be booked would have
  // made "I will do this for nothing" the one thing the marketplace could not
  // arrange.
  if (!isFreeSession) {
    const mentorAccountId = await resolveConnectedAccountId(mentor.userId);
    if (!mentorAccountId) {
      throw new ApiError(400, 'Mentor is not enabled for payments');
    }
  }

  const currency = SESSION_CURRENCY;
  const amounts = calculateSessionAmounts(hourlyRate, durationMinutes);
  const { sessionAmount, platformFee, mentorPayout } = amounts;

  const session = await prisma.mentorSession.create({
    data: {
      mentorProfileId: mentorId,
      menteeId,
      scheduledAt: data.scheduledAt,
      durationMinutes,
      note: data.note,
      status: 'REQUESTED',
      currency,
      sessionAmount,
      platformFee,
      mentorPayout,
      // A free session settles the moment it is booked: there is nothing to
      // authorise, nothing to capture and nothing for the expiry sweeper to
      // chase. MentorPaymentStatus has no value that says "nothing was owed",
      // and CAPTURED is the one that means the session leaves no money
      // outstanding, so it is the closest true statement the enum can make.
      paymentStatus: isFreeSession ? 'CAPTURED' : 'PENDING',
      paymentCapturedAt: isFreeSession ? new Date() : null,
    },
  });

  if (isFreeSession) {
    await notifyMentorOfRequest(session, mentor.userId);
    return { session, paymentIntentClientSecret: null };
  }

  // The cents the session was recorded with, which are the cents the card is
  // asked for: the rows and Stripe cannot disagree about a cent.
  const amountCents = Math.max(1, amounts.amountCents);
  const feeCents = Math.min(amountCents, amounts.feeCents);

  // Through the shared escrow path rather than a PaymentIntent of this
  // module's own. Mentoring used to run a private escrow that wrote no
  // EscrowPayment row, so a hold nothing could see: the expiry sweeper never
  // looked at it, and a session booked more than a week out had its
  // authorisation lapse quietly, the capture then failed, and the mentor was
  // never paid for work she had done. The row also carries the money onto her
  // earnings screen, which reads escrow and nothing else.
  //
  // `type` and `sessionId` ride in the metadata because the Stripe webhook
  // moves MentorSession.paymentStatus off them; the escrow row it updates
  // alongside is keyed on the payment intent id, which is the same one stored
  // on the session below.
  let hold: Awaited<ReturnType<typeof createEscrowPayment>>;
  try {
    hold = await createEscrowPayment({
      buyerId: menteeId,
      sellerId: mentor.userId,
      amount: amountCents,
      currency: currency.toLowerCase(),
      description: `Mentor session ${session.id}`,
      sessionType: 'mentor_session',
      platformFeeAmount: feeCents,
      automaticPaymentMethods: true,
      // One hold per booking: a repeated request for this session (a double tap,
      // a retry after a timeout) is handed the hold already made, not a second.
      idempotencyKey: `mentor-hold-${session.id}`,
      metadata: {
        type: 'mentor_session',
        sessionId: session.id,
        mentorProfileId: mentorId,
        menteeId,
      },
    });
  } catch (error) {
    // Without the hold there is no booking, and leaving the row behind would
    // put a session on the mentor's list that nobody has paid for and the
    // mentee never saw confirmed.
    await bestEffort('mentor.discard-unpaid-session', () =>
      prisma.mentorSession.delete({ where: { id: session.id } })
    );
    if (error instanceof ApiError && error.statusCode === 400) {
      throw new ApiError(409, 'This mentor has not finished setting up payouts, so paid sessions cannot be booked yet');
    }
    throw error;
  }

  const updatedSession = await prisma.mentorSession.update({
    where: { id: session.id },
    data: { stripePaymentIntentId: hold.paymentIntentId },
  });

  // The mentor is not told yet. A request nobody has paid for is not one she can
  // act on, and accepting it used to leave her with a confirmed hour and no money
  // behind it. She hears of it from the Stripe webhook that says the mentee's card
  // is held (payment_intent.amount_capturable_updated), and a request whose card
  // step is never finished is called off by the expiry sweep, so it never reaches
  // her at all (see mentor-session-authorisation.service).
  //
  // The one exception is the development processor, which has no card step and
  // sends no webhook: its hold is real the moment it is made, so a developer's
  // machine with no Stripe key still runs the flow end to end. Production never
  // makes such a hold.
  if (isDevelopmentHold(hold.paymentIntentId)) {
    await recordSessionAuthorised({ id: session.id, stripePaymentIntentId: hold.paymentIntentId });
    await notifyMentorOfRequest(updatedSession, mentor.userId);
  }

  return {
    session: updatedSession,
    paymentIntentClientSecret: hold.clientSecret,
  };
}

/**
 * Refuses a start time that falls after the hold behind a paid session can still
 * be taken, less the day its mentor needs to mark the hour complete.
 *
 * `hold` is the hold the session will be paid from: one made now, for a booking,
 * or the one it already has, for a session being moved. A move is held to the
 * hold's real deadline, so it cannot be used to carry a session past the money.
 */
function assertStartsWithinHold(
  scheduledAt: Date,
  hold: { createdAt: Date; metadata?: unknown },
  action: 'booking' | 'moving'
): void {
  const latest = latestMentorSessionStart(hold);
  if (scheduledAt.getTime() <= latest.getTime()) {
    return;
  }

  if (action === 'booking') {
    throw new ApiError(
      400,
      `Paid sessions can be booked up to ${MENTOR_BOOKING_HORIZON_DAYS} days ahead. A card hold lasts about a week, and your mentor is paid once the hour has been given, so a session further out could not be paid for. Choose a nearer time.`
    );
  }

  const day = latest.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  throw new ApiError(
    400,
    `The hold on the mentee’s card is what pays for this session, and it lasts only until about ${day}, so it cannot be moved later than that. To meet later, cancel this request and have it booked again nearer the time.`
  );
}

/**
 * Tells the mentee, and the people who can release it by hand, that a
 * cancelled session's hold on her card is still in place.
 *
 * The cancel path used to log this at warn and carry on. The session read
 * CANCELED, its payment status was left at AUTHORIZED, the escrow row stayed
 * held, and nobody was told — while the expiry sweep, which captures held rows
 * before they lapse, could go on to take the money for a session that was
 * called off. Best effort around each write for the same reason as
 * notifyUncollectedSession: the cancellation itself has to land.
 */
async function notifyUnreleasedHold(menteeId: string, sessionId: string): Promise<void> {
  await bestEffort('notification.mentor-cancel-release-failed', () =>
    notificationService.notify({
      userId: menteeId,
      type: 'MENTOR_SESSION',
      title: 'Your session is cancelled, but the card hold is still in place',
      message:
        'We could not release the hold on your card automatically. Our team has been told and will release it. You have not been charged for this session.',
      link: `/dashboard/mentors/sessions?session=${sessionId}`,
      channels: ['in-app', 'email'],
    })
  );

  const admins = await bestEffort(
    'mentor-cancel-release-failed.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );

  await Promise.all(
    admins.map((admin) =>
      bestEffort('notification.mentor-cancel-release-failed-admins', () =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'SYSTEM',
            title: 'A cancelled mentor session still holds the mentee’s money',
            message: `Session ${sessionId} was cancelled but its card authorisation could not be released. Release it in Stripe before the expiry sweep captures it.`,
            link: '/admin',
          },
        })
      )
    )
  );
}

/**
 * Tells the mentor, and the people who can do something about it, that a
 * finished session's money could not be collected.
 *
 * Best effort around each write: the session status change is the caller's
 * real work and has to land, and a notification that fails is still recorded
 * in the log and in the ops metric written beside this call.
 */
async function notifyUncollectedSession(mentorUserId: string, sessionId: string): Promise<void> {
  await bestEffort('notification.mentor-capture-failed', () =>
    notificationService.notify({
      userId: mentorUserId,
      type: 'MENTOR_SESSION',
      title: 'A session payment needs attention',
      message:
        'Your session is complete, but the payment could not be collected. Our team has been notified and will follow it up with you.',
      link: `/dashboard/mentors/sessions?session=${sessionId}`,
      channels: ['in-app', 'email'],
    })
  );

  const admins = await bestEffort(
    'mentor-capture-failed.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );

  await Promise.all(
    admins.map((admin) =>
      bestEffort('notification.mentor-capture-failed-admins', () =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'SYSTEM',
            title: 'A mentor session payment could not be collected',
            message: `Session ${sessionId} is complete but its authorisation could not be captured. The mentor is owed money the platform did not take.`,
            link: '/admin',
          },
        })
      )
    )
  );
}

/**
 * Who may move a session where.
 *
 * There was no state machine here at all: the route accepted CONFIRMED,
 * CANCELED or COMPLETED, checked only that the caller was one of the two
 * people in the session, and wrote it. Marking a session COMPLETED is what
 * captures the mentee's card, so the absence of rules was a money hole in both
 * directions.
 *
 * A mentor could take a REQUESTED session — one she had not even accepted, for
 * a date next month — straight to COMPLETED and capture the hold that minute,
 * for an hour that had not happened and that the mentee could no longer cancel
 * out of. The mentee's side was the mirror image: she could let the session
 * run and then CANCEL it afterwards, releasing the hold and leaving the mentor
 * unpaid for work she had already done.
 *
 * So both moves are now tied to the clock as well as to the caller. Accepting
 * a request is the mentor's move. Completing one can only happen once the hour
 * booked has actually elapsed. Cancelling a confirmed session is free for
 * either side right up to the moment it is due to end, and after that it is
 * the mentor's to make — she may waive her fee, but the mentee cannot void an
 * hour that has already run. A request the mentor never accepted the mentee
 * can withdraw at any time.
 */
const SESSION_TRANSITIONS: Record<
  'CONFIRMED' | 'CANCELED' | 'COMPLETED',
  { from: MentorSessionStatus[]; by: ('mentor' | 'mentee')[] }
> = {
  CONFIRMED: { from: ['REQUESTED'], by: ['mentor'] },
  CANCELED: { from: ['REQUESTED', 'CONFIRMED'], by: ['mentor', 'mentee'] },
  COMPLETED: { from: ['CONFIRMED'], by: ['mentor', 'mentee'] },
};

/**
 * When the booked hour is over. A session with no date on it has not been
 * scheduled, so nothing about it has happened yet.
 */
function sessionHasEnded(scheduledAt: Date | null, durationMinutes: number, now: Date): boolean {
  if (!scheduledAt) {
    return false;
  }
  return scheduledAt.getTime() + durationMinutes * 60 * 1000 <= now.getTime();
}

/**
 * What has to be true before a mentor may accept a paid request: the mentee's
 * card is really held, and the hold will still be there when the hour has been
 * given.
 *
 * Accepting checked the status and the caller and nothing about the money, so a
 * mentor could accept a session whose card had never been authorised, and was
 * then left with a confirmed hour she could not be paid for. The marketplace
 * refuses to accept a booking until its hold is real (escrowHeld in
 * skills-marketplace.routes); this is the same rule for a mentoring session.
 *
 * The session's own paymentStatus is what the Stripe webhook keeps, and it can be
 * behind: a webhook that has not landed, or a deployment with none. Stripe is
 * asked when it says the card is not held, so a hold that is real is never turned
 * away on a stale row. Stripe not answering is its own reply, because "try again
 * in a minute" is not "she has not paid".
 */
async function assertHoldBeforeConfirming(session: {
  id: string;
  sessionAmount: Prisma.Decimal | number | string;
  paymentStatus: MentorPaymentStatus;
  stripePaymentIntentId: string | null;
  scheduledAt: Date | null;
  createdAt?: Date;
}): Promise<void> {
  // A session that costs nothing has no card to hold.
  if (Number(session.sessionAmount) <= 0) {
    return;
  }

  if (session.paymentStatus === 'CANCELED' || session.paymentStatus === 'REFUNDED') {
    throw new ApiError(409, 'The hold on the mentee’s card has ended, so this request can no longer be accepted. She is welcome to book again.');
  }

  const paymentIntentId = session.stripePaymentIntentId;
  if (!paymentIntentId) {
    throw new ApiError(409, 'No payment has been set up for this request, so it cannot be accepted.');
  }

  if (session.paymentStatus !== 'AUTHORIZED' && session.paymentStatus !== 'CAPTURED') {
    const card = await readCardHold(paymentIntentId);
    if (card === 'unknown') {
      throw new ApiError(503, 'We could not check the mentee’s payment with our card processor just now. Please try again in a minute.');
    }
    if (card === 'not_held') {
      throw new ApiError(409, 'The mentee has not authorised payment yet, so this request cannot be accepted. You will be told as soon as she has.');
    }
    await recordSessionAuthorised({ id: session.id, stripePaymentIntentId: paymentIntentId });
  }

  // Money already taken does not run out; a hold does. An accepted hour that
  // starts after the hold is gone could not be paid for, which is what a request
  // booked before the booking limit existed can be.
  if (session.paymentStatus === 'CAPTURED' || !session.scheduledAt || paymentIntentId.startsWith('pi_mock_')) {
    return;
  }

  const hold = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { createdAt: true, metadata: true },
  });
  const heldSince = hold?.createdAt ?? session.createdAt;
  if (heldSince instanceof Date && session.scheduledAt.getTime() > latestMentorSessionStart({ createdAt: heldSince, metadata: hold?.metadata }).getTime()) {
    throw new ApiError(
      409,
      `The hold on the mentee’s card will run out before this session, so it could not be paid for. Decline it and ask her to book a time within the next ${MENTOR_BOOKING_HORIZON_DAYS} days.`
    );
  }
}

/**
 * Update session status (Accept, Reject, Cancel, Complete)
 */
export async function updateSessionStatus(
  sessionId: string,
  userId: string,
  status: MentorSessionStatus,
  actionBy: 'mentor' | 'mentee'
) {
  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    include: { mentorProfile: true },
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Authorization check
  if (actionBy === 'mentor' && session.mentorProfile.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }
  if (actionBy === 'mentee' && session.menteeId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  // State transitions validtion
  if (session.status === 'COMPLETED' || session.status === 'CANCELED') {
    throw new ApiError(400, 'Cannot update finished session');
  }
  // A session in dispute is not either person's to move: the money is held and
  // ATHENA's team decides it (see service-disputes.service).
  if (session.status === 'DISPUTED') {
    throw new ApiError(409, 'This session is in dispute, so ATHENA’s team will decide it. Neither of you can change it meanwhile.');
  }

  const transition = SESSION_TRANSITIONS[status as keyof typeof SESSION_TRANSITIONS];
  if (!transition) {
    throw new ApiError(400, `A session cannot be moved to ${status}`);
  }

  if (!transition.from.includes(session.status)) {
    throw new ApiError(400, `A ${session.status.toLowerCase()} session cannot be moved to ${status.toLowerCase()}`);
  }

  if (!transition.by.includes(actionBy)) {
    throw new ApiError(403, 'Accepting a session request is the mentor\'s to make');
  }

  const now = new Date();
  const hasEnded = sessionHasEnded(session.scheduledAt, session.durationMinutes, now);

  if (status === 'CONFIRMED') {
    await assertHoldBeforeConfirming(session);
  }

  if (status === 'COMPLETED' && !hasEnded) {
    // Completing is what captures the card. Before this check a mentor could
    // charge for an hour that had not happened yet.
    throw new ApiError(400, 'A session can only be marked complete once the booked time has passed');
  }

  // Only a confirmed session. The rule exists because an hour that may have
  // run is not the mentee's to void; a request the mentor never accepted
  // cannot have run. Applying it to REQUESTED as well left a mentee whose
  // mentor ignored her request unable to withdraw it once its date had gone
  // by, with the authorisation still on her card until it lapsed and the
  // request sitting on both lists for good.
  if (status === 'CANCELED' && hasEnded && actionBy === 'mentee' && session.status === 'CONFIRMED') {
    throw new ApiError(
      400,
      'This session\'s time has passed, so it can no longer be cancelled. If it did not go ahead, ask your mentor to cancel it or contact support.'
    );
  }

  let paymentUpdates: Prisma.MentorSessionUpdateInput = {};
  let holdStillInPlace = false;
  // When the mentee's card is to be charged, if the mentor's word starts a
  // window in which she can object instead of charging her at once.
  let confirmationEndsAt: Date | null = null;

  // Both branches go through the escrow service rather than calling Stripe
  // directly, so the EscrowPayment row moves with the session instead of being
  // left behind as a hold the expiry sweeper still thinks is live.
  //
  // PLATFORM_ESCROW_ACTOR, not the caller: escrow only lets the buyer release
  // funds, while a mentor session is closed out by whichever of the two people
  // in it marks it done — and both have already been authorised against this
  // session a few lines above.
  if (status === 'CANCELED' && session.stripePaymentIntentId) {
    try {
      await cancelSessionHold(session.stripePaymentIntentId);
      paymentUpdates = {
        paymentStatus: 'CANCELED' as MentorPaymentStatus,
        paymentCanceledAt: new Date(),
      };
    } catch (error) {
      // This used to be a warning on the grounds that an uncancelled hold
      // expires on its own and the mentee is never charged. Neither half was
      // safe to rely on: until it lapses the money is held against her card,
      // and the expiry sweep captures held rows early rather than let them
      // lapse. The session is still cancelled — the hour is off and the slot
      // is free — but the payment status stays where it is, because the money
      // has not moved, and the people who can move it are told.
      holdStillInPlace = true;
      recordFailure('mentor.session.cancel-release', error);
      logger.error('Could not release a cancelled mentor session’s hold; the mentee’s card is still held', {
        sessionId,
        paymentIntentId: session.stripePaymentIntentId,
        error: (error as Error).message,
      });
    }
  }

  if (status === 'COMPLETED' && session.stripePaymentIntentId) {
    // The mentor's word is not the mentee's. When the mentor closes a paid
    // session the card stays held for SESSION_CONFIRMATION_HOURS, in which the
    // mentee can say it did not happen; the expiry sweep takes the money after
    // that (see mentor-payment-release.service). The mentee confirming it herself
    // needs no window, and neither does a hold too close to lapsing to wait.
    if (actionBy === 'mentor' && Number(session.sessionAmount) > 0) {
      const hold = await prisma.escrowPayment.findUnique({
        where: { paymentIntentId: session.stripePaymentIntentId },
        select: { status: true, createdAt: true, metadata: true },
      });
      confirmationEndsAt = paymentReleaseTimeFor(now, hold);
    }
  }

  if (status === 'COMPLETED' && session.stripePaymentIntentId && !confirmationEndsAt) {
    try {
      const { capturedAt } = await captureSessionHold(session.stripePaymentIntentId);
      paymentUpdates = {
        paymentStatus: 'CAPTURED' as MentorPaymentStatus,
        paymentCapturedAt: capturedAt,
      };
    } catch (error) {
      if (isPaymentsPausedError(error)) {
        // Payments are paused, which is not a card that could not be charged. The
        // session is completed, the money is left held and the payment stays
        // AUTHORIZED, and it is marked due now so the sweep that collects due
        // sessions takes it the moment payments reopen. Marking it FAILED, and
        // telling the mentor a payment needs attention, would be false.
        paymentUpdates = { paymentReleaseAt: now };
        logger.warn('A completed mentor session was left uncollected because payments are paused', {
          sessionId,
          paymentIntentId: session.stripePaymentIntentId,
        });
      } else {
        // This one used to be a bare logger.warn, and it is the failure that
        // costs a mentor the money for work she has already done: the session
        // was written COMPLETED, paymentStatus stayed AUTHORIZED, and nothing
        // anywhere said the capture had failed. A hold booked more than a week
        // ahead lapses before this runs, so it is not a rare path.
        paymentUpdates = {
          paymentStatus: 'FAILED' as MentorPaymentStatus,
          paymentFailedAt: new Date(),
        };
        recordFailure('mentor.session.capture', error);
        logger.error('Failed to capture mentor session payment; the mentor has not been paid', {
          sessionId,
          paymentIntentId: session.stripePaymentIntentId,
          error: (error as Error).message,
        });
        await notifyUncollectedSession(session.mentorProfile.userId, sessionId);
      }
    }
  }

  // `MentorProfile.sessionCount` is shown on the directory card and on the
  // profile as "N sessions", and nothing on the live path had ever written it,
  // so every mentor on ATHENA advertised zero however many hours she had
  // actually given. The two writes go in one transaction because a counter
  // that can drift from the sessions behind it is a number the mentor will be
  // asked about and cannot explain. The transition rules above have already
  // established that the session was CONFIRMED and that its booked time has
  // passed, so this counts finished hours and nothing else.
  //
  // Conditional on the status just read, so a mentee's dispute that lands while
  // this is being worked out is not written over: the session is moved only if it
  // is still where this call found it.
  const updated = await prisma.$transaction(async (tx) => {
    const moved = await tx.mentorSession.updateMany({
      where: { id: sessionId, status: session.status },
      data: {
        status,
        ...(status === 'COMPLETED'
          ? { completedAt: now, paymentReleaseAt: confirmationEndsAt }
          : {}),
        ...(paymentUpdates as Prisma.MentorSessionUpdateManyMutationInput),
      },
    });
    if (moved.count !== 1) {
      throw new ApiError(409, 'This session has just changed. Reload it and try again.');
    }
    if (status === 'COMPLETED') {
      await tx.mentorProfile.update({
        where: { id: session.mentorProfileId },
        data: { sessionCount: { increment: 1 } },
      });
    }
    return tx.mentorSession.findUniqueOrThrow({ where: { id: sessionId } });
  });

  if (holdStillInPlace) {
    await notifyUnreleasedHold(session.menteeId, sessionId);
  }

  // When the mentor closes a paid session the mentee is told what happens to
  // her card. Usually that is a window in which she can object, then the charge;
  // when there is no room for a window the card is charged at that moment, and
  // she is told what was taken and where to go if the hour did not happen.
  //
  // "Where to go" is the Help & Support page, whose contact card reaches the
  // team. The notice first linked to /dashboard/support, a route with no page
  // behind it, so the one member told she might be owed a refund was sent to
  // a 404 to ask for it.
  const chargedAmount = Number(session.sessionAmount);
  const menteeWasCharged =
    actionBy === 'mentor' &&
    status === 'COMPLETED' &&
    paymentUpdates.paymentStatus === 'CAPTURED' &&
    chargedAmount > 0;
  const menteeHasWindow =
    actionBy === 'mentor' && status === 'COMPLETED' && confirmationEndsAt !== null && chargedAmount > 0;

  // Send notification to other party. The email carries the same notice as the
  // in-app one: it used to say only that the session "is now COMPLETED", so a
  // mentee who reads her email rather than the app learnt from her bank
  // statement that she had been charged, and not from us where to go if the hour
  // had not happened.
  const recipientId = actionBy === 'mentor' ? session.menteeId : session.mentorProfile.userId;
  const sessionDate = session.scheduledAt?.toLocaleDateString() ?? 'its booked date';
  const sessionLink = `/dashboard/mentors/sessions?session=${sessionId}`;
  const chargeNotice = `Your mentor marked your session on ${sessionDate} as complete, and ${chargedAmount.toFixed(2)} ${session.currency} was charged to your card. If the session did not take place, contact our team from Help & Support and they will look at a refund with you.`;
  const windowNotice = confirmationEndsAt
    ? `Your mentor marked your session on ${sessionDate} as complete. ${chargedAmount.toFixed(2)} ${session.currency} is held on your card and will be charged on ${confirmationEndsAt.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} (Queensland time). If the session did not take place, say so from your sessions page before then: nothing is charged while our team looks at it.`
    : '';
  await notificationService.notify({
    userId: recipientId,
    type: 'MENTOR_SESSION',
    title: menteeHasWindow
      ? 'Your mentor marked your session complete'
      : menteeWasCharged
        ? 'Your session was marked complete and paid'
        : 'Session Updated',
    message: menteeHasWindow
      ? windowNotice
      : menteeWasCharged
        ? chargeNotice
        : `Your mentorship session status has been updated to ${status}`,
    link: menteeHasWindow ? sessionLink : menteeWasCharged ? MENTEE_SUPPORT_LINK : sessionLink,
    channels: ['in-app', 'email'], // Less urgent than new request?
    emailTemplate: menteeHasWindow
      ? {
          subject: 'Your mentoring session was marked complete',
          html: `
            <h2>Session marked complete</h2>
            <p>${windowNotice}</p>
            <p><a href="${process.env.CLIENT_URL}${sessionLink}">Review the session</a> · <a href="${process.env.CLIENT_URL}${MENTEE_SUPPORT_LINK}">Help &amp; Support</a></p>
          `,
        }
      : menteeWasCharged
      ? {
          subject: 'Your mentoring session was completed and charged',
          html: `
            <h2>Session completed</h2>
            <p>${chargeNotice}</p>
            <p><a href="${process.env.CLIENT_URL}${MENTEE_SUPPORT_LINK}">Help &amp; Support</a> · <a href="${process.env.CLIENT_URL}${sessionLink}">View the session</a></p>
          `,
        }
      : {
          subject: `Session ${
             status === 'CONFIRMED' ? 'Confirmed' :
             status === 'CANCELED' ? 'Canceled' :
             status === 'COMPLETED' ? 'Completed' : 'Updated'
          }`,
          html: `
            <h2>Session Update</h2>
            <p>Your session scheduled for ${session.scheduledAt?.toLocaleDateString() ?? 'TBD'} is now <strong>${status}</strong>.</p>
            <a href="${process.env.CLIENT_URL}${sessionLink}">View Details</a>
          `,
        },
  });

  return updated;
}

/**
 * Reschedule a mentorship session
 */
export async function rescheduleSession(
  sessionId: string,
  userId: string,
  data: {
    scheduledAt: Date;
    durationMinutes?: number;
  }
) {
  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    include: { mentorProfile: true },
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  const isMentee = session.menteeId === userId;
  const isMentor = session.mentorProfile.userId === userId;
  if (!isMentee && !isMentor) {
    throw new ApiError(403, 'Not authorized');
  }

  if (!['REQUESTED', 'CONFIRMED'].includes(session.status)) {
    throw new ApiError(400, 'Only requested or confirmed sessions can be rescheduled');
  }

  const durationMinutes = data.durationMinutes ?? session.durationMinutes;
  const scheduledAt = data.scheduledAt;

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new ApiError(400, 'Choose a time that has not passed yet');
  }

  // A paid session is priced, and its card held, for the length it was booked at,
  // and moving it does not reprice it. Either person can move a session, and the
  // length was taken from the request as it came, so a mentee who booked fifteen
  // minutes could make it four hours (or a mentor could halve the hour she was
  // paid for) with no change to what was held or what the mentor is paid. A
  // session that costs nothing has no price to disagree with.
  if (Number(session.sessionAmount) > 0 && durationMinutes !== session.durationMinutes) {
    throw new ApiError(
      400,
      `This session was booked and paid for as ${session.durationMinutes} minutes, so its length cannot be changed. You can move it to another time, or cancel it and book the length you want.`
    );
  }

  // A paid session is paid from the hold made when it was requested, and moving
  // it does not renew that hold. The new time has to fall inside what is left of
  // it: otherwise a session booked inside the limit could be moved past the
  // money, which is the very thing the limit on booking exists to stop. Money
  // already taken, a session that costs nothing, and the development processor's
  // holds, which never run out, have no deadline to respect.
  const heldIntentId = session.stripePaymentIntentId;
  if (
    Number(session.sessionAmount) > 0 &&
    heldIntentId &&
    session.paymentStatus !== 'CAPTURED' &&
    !heldIntentId.startsWith('pi_mock_')
  ) {
    const hold = await prisma.escrowPayment.findUnique({
      where: { paymentIntentId: heldIntentId },
      select: { createdAt: true, metadata: true },
    });
    const heldSince = hold?.createdAt ?? session.createdAt;
    if (heldSince instanceof Date) {
      assertStartsWithinHold(scheduledAt, { createdAt: heldSince, metadata: hold?.metadata }, 'moving');
    }
  }

  const scheduledEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const conflictWindowStart = new Date(scheduledAt.getTime() - 240 * 60 * 1000);

  const nearbySessions = await prisma.mentorSession.findMany({
    where: {
      id: { not: sessionId },
      mentorProfileId: session.mentorProfileId,
      status: { in: ['REQUESTED', 'CONFIRMED'] },
      scheduledAt: {
        gte: conflictWindowStart,
        lte: scheduledEnd,
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
    },
  });

  const hasConflict = nearbySessions.some((nearbySession) => {
    if (!nearbySession.scheduledAt) return false;
    const nearbyStart = nearbySession.scheduledAt;
    const nearbyEnd = new Date(
      nearbyStart.getTime() + nearbySession.durationMinutes * 60 * 1000
    );
    return nearbyStart < scheduledEnd && nearbyEnd > scheduledAt;
  });

  if (hasConflict) {
    throw new ApiError(409, 'New session time conflicts with an existing booking');
  }

  const updated = await prisma.mentorSession.update({
    where: { id: sessionId },
    data: {
      scheduledAt,
      durationMinutes,
    },
    include: {
      mentee: { select: { id: true, displayName: true, avatar: true } },
    },
  });

  const recipientId = isMentor ? session.menteeId : session.mentorProfile.userId;
  await notificationService.notify({
    userId: recipientId,
    type: 'MENTOR_SESSION',
    title: 'Session Rescheduled',
    message: `Your mentorship session was rescheduled to ${scheduledAt.toLocaleString()}`,
    link: `/dashboard/mentors/sessions?session=${sessionId}`,
    channels: ['in-app', 'email'],
    emailTemplate: {
      subject: 'Mentorship Session Rescheduled',
      html: `
        <h2>Session Rescheduled</h2>
        <p>Your mentorship session has been rescheduled to ${scheduledAt.toLocaleString()}.</p>
        <a href="${process.env.CLIENT_URL}/dashboard/mentors/sessions?session=${sessionId}">View Details</a>
      `,
    },
  });

  return updated;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string) {
  return prisma.mentorSession.findUnique({
    where: { id: sessionId },
    include: { mentorProfile: true },
  });
}

/**
 * The client secret for authorising a session's payment, for the mentee,
 * while the payment is still pending. The booking response carried it once;
 * a mentee who closed that page needs it again from the sessions list.
 */
export async function getSessionPaymentSecret(sessionId: string, menteeId: string) {
  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    select: { id: true, menteeId: true, status: true, paymentStatus: true, stripePaymentIntentId: true, sessionAmount: true, currency: true },
  });
  if (!session || session.menteeId !== menteeId) {
    throw new ApiError(404, 'Session not found');
  }
  if (session.status === 'CANCELED' || session.status === 'COMPLETED') {
    throw new ApiError(409, 'This session is finished');
  }
  const base = { paymentStatus: session.paymentStatus, amount: Number(session.sessionAmount), currency: session.currency };
  // A declined card leaves the intent where another card can be tried on it, and
  // the request stays open for the card step until the expiry sweep calls it off
  // (mentor-session-authorisation.service). Handing the secret back only while
  // the status was PENDING meant a mentee whose first card was declined, and who
  // had closed the form, had no way to pay and watched her request be cancelled.
  // A FAILED payment on a session past the request stage is a capture that did
  // not go through, which is not hers to retry with a card.
  const cardStepOpen =
    session.paymentStatus === 'PENDING' || (session.paymentStatus === 'FAILED' && session.status === 'REQUESTED');
  if (!cardStepOpen) {
    return { ...base, clientSecret: null };
  }
  // A session with a mentor who charges nothing has no card to authorise, and
  // the 409 below would have read as an error on a booking that is perfectly
  // fine.
  if (Number(session.sessionAmount) === 0) {
    return { ...base, clientSecret: null };
  }
  if (!session.stripePaymentIntentId) {
    throw new ApiError(409, 'No payment has been set up for this session');
  }
  const intent = await getStripe().paymentIntents.retrieve(session.stripePaymentIntentId);
  return { ...base, clientSecret: intent.client_secret };
}

/**
 * Get sessions for a user (as mentor or mentee)
 */
export async function getUserSessions(
  userId: string,
  role: 'mentor' | 'mentee'
) {
  if (role === 'mentor') {
    return asTheMembersSee(await prisma.mentorSession.findMany({
      where: {
        mentorProfile: { userId },
        // A paid request is hers to answer once the mentee's card is held, and not
        // before: until then it is the mentee's unfinished payment, not a request,
        // and showing it let a mentor accept an hour with no money behind it. It
        // appears, with its notification, when the authorisation lands.
        NOT: {
          status: 'REQUESTED',
          paymentStatus: { in: ['PENDING', 'FAILED'] },
          sessionAmount: { gt: 0 },
        },
      },
      include: {
        mentee: { select: { id: true, displayName: true, avatar: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    }));
  } else {
    return asTheMembersSee(await prisma.mentorSession.findMany({
      where: {
        menteeId: userId,
      },
      include: {
        mentorProfile: {
          include: {
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    }));
  }
}

/**
 * Sessions as the two people in them see them.
 *
 * Who on the team decided a dispute stays with the team, and each session says
 * whether the mentee's bank has also disputed its payment (a chargeback, which
 * is separate from the mentee telling ATHENA the session did not happen), so
 * neither person is left to wonder why a paid session is not being paid on. One
 * lookup for the whole list. A lookup that fails says nothing rather than
 * failing the list.
 */
async function asTheMembersSee<T extends { stripePaymentIntentId: string | null; disputeResolvedById: string | null }>(
  sessions: T[]
) {
  const intents = sessions.map((s) => s.stripePaymentIntentId).filter((id): id is string => Boolean(id));
  const open = intents.length
    ? await bestEffort(
        'mentor.card-dispute-lookup',
        () => prisma.paymentDispute.findMany({ where: { paymentIntentId: { in: intents }, outcome: 'OPEN' }, select: { paymentIntentId: true } }),
        []
      )
    : [];
  const disputed = new Set(open.map((d) => d.paymentIntentId));

  return sessions.map(({ disputeResolvedById: _staff, ...session }) => ({
    ...session,
    cardDisputeOpen: Boolean(session.stripePaymentIntentId && disputed.has(session.stripePaymentIntentId)),
  }));
}
