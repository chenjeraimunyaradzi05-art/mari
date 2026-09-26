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
import {
  cancelEscrowPayment,
  captureEscrowPayment,
  createConnectedAccount,
  createEscrowPayment,
  PLATFORM_ESCROW_ACTOR,
  resolveConnectedAccountId,
} from './stripe-connect.service';

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

const MENTOR_PLATFORM_FEE_RATE = 0.2;
const SUPPORTED_SESSION_CURRENCIES = new Set([
  'AUD',
  'USD',
  'SGD',
  'PHP',
  'IDR',
  'THB',
  'VND',
  'MYR',
  'AED',
  'SAR',
  'ZAR',
  'EGP',
  'GBP',
  'EUR',
  'NZD',
]);

async function resolveSessionCurrency(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredCurrency: true },
  });

  const currency = (user?.preferredCurrency || 'AUD').toUpperCase();
  return SUPPORTED_SESSION_CURRENCIES.has(currency) ? currency : 'AUD';
}

function calculateSessionAmounts(hourlyRate: number, durationMinutes: number) {
  const hours = Math.max(0.25, durationMinutes / 60);
  const sessionAmount = hourlyRate * hours;
  const platformFee = sessionAmount * MENTOR_PLATFORM_FEE_RATE;
  const mentorPayout = sessionAmount - platformFee;
  return {
    sessionAmount,
    platformFee,
    mentorPayout,
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

  return Boolean(profile.stripeAccountId);
}

/** Strips the connected account id and answers the bookability question in its place. */
function toPublicMentorProfile<T extends MentorProfileRow>(profile: T) {
  const { stripeAccountId, ...rest } = profile;
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
  where.user = { ...(where.user ?? {}), ...hiddenMemberWhere(viewer) };

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
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
    select: PUBLIC_MENTOR_PROFILE_SELECT,
  });

  return profile ? toPublicMentorProfile(profile) : null;
}

export async function getMentorProfileById(mentorId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { id: mentorId },
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
  // Check if mentor exists
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id: mentorId },
  });

  if (!mentor) {
    throw new ApiError(404, 'Mentor not found');
  }

  if (mentor.userId === menteeId) {
    throw new ApiError(400, 'Cannot request session with yourself');
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

  const currency = await resolveSessionCurrency(menteeId);
  const { sessionAmount, platformFee, mentorPayout } = calculateSessionAmounts(
    hourlyRate,
    durationMinutes
  );

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
    await notifyMentorOfRequest(mentor.userId, session.id, data.scheduledAt, data.note);
    return { session, paymentIntentClientSecret: null };
  }

  const amountCents = Math.max(1, Math.round(sessionAmount * 100));
  const feeCents = Math.max(0, Math.round(platformFee * 100));

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

  await notifyMentorOfRequest(mentor.userId, session.id, data.scheduledAt, data.note);

  return {
    session: updatedSession,
    paymentIntentClientSecret: hold.clientSecret,
  };
}

/**
 * Tells the mentor a session has been requested. Shared by the paid path,
 * which sends it once the hold is in place, and the free path, which has no
 * hold to wait for.
 */
async function notifyMentorOfRequest(
  mentorUserId: string,
  sessionId: string,
  scheduledAt: Date,
  note?: string
): Promise<void> {
  await notificationService.notify({
    userId: mentorUserId,
    type: 'MENTOR_SESSION',
    title: 'New Mentorship Request',
    message: `You have a new mentorship session request for ${scheduledAt.toLocaleDateString()}`,
    link: `/dashboard/mentors/sessions?session=${sessionId}`,
    channels: ['in-app', 'email', 'push'],
    emailTemplate: {
      subject: 'New Mentorship Request',
      html: `
        <h2>New Mentorship Request</h2>
        <p>You have a new session request for ${scheduledAt.toLocaleString()}.</p>
        <p><strong>Note from mentee:</strong> ${note || 'No note provided'}</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard/mentors/sessions?session=${sessionId}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a>
        </div>
      `
    }
  });
}

/**
 * Takes the money a finished session has been holding.
 *
 * Bookings made since mentoring moved onto the shared escrow path have an
 * EscrowPayment row and go through the service, so the ledger row moves with
 * the session. Bookings made before it have a PaymentIntent and no row, and
 * their money is just as real, so they are captured directly — that branch can
 * be dropped once no unfinished session predates the change.
 */
async function captureSessionHold(paymentIntentId: string): Promise<{ capturedAt: Date }> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { status: true, capturedAt: true },
  });

  if (!escrow) {
    const captured = await getStripe().paymentIntents.capture(paymentIntentId);
    if (captured.status !== 'succeeded' && captured.status !== 'processing') {
      throw new ApiError(502, `Stripe left the session payment in ${captured.status}`);
    }
    return { capturedAt: new Date() };
  }

  if (escrow.status === 'CAPTURED') {
    // The expiry sweeper takes a hold early when it is about to lapse, so the
    // money can already be collected by the time the session is marked done.
    // That is a paid session, not a failed capture.
    return { capturedAt: escrow.capturedAt ?? new Date() };
  }

  await captureEscrowPayment(paymentIntentId, PLATFORM_ESCROW_ACTOR);
  return { capturedAt: new Date() };
}

/** Releases a cancelled session's hold, on either side of the escrow change. */
async function cancelSessionHold(paymentIntentId: string): Promise<void> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { id: true, status: true },
  });

  if (!escrow) {
    await getStripe().paymentIntents.cancel(paymentIntentId);
    return;
  }

  // Already given back — by the expiry sweep, the webhook, or an earlier
  // attempt at this same cancellation whose session write failed. The escrow
  // service refuses a second release with a 400, which used to land in the
  // catch below and be reported as a hold that could not be released, when
  // the money was already back on her card.
  if (escrow.status === 'CANCELED' || escrow.status === 'REFUNDED') {
    return;
  }

  await cancelEscrowPayment(paymentIntentId, PLATFORM_ESCROW_ACTOR, 'Session canceled');
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
 * booked has actually elapsed. Cancelling is free for either side right up to
 * the moment the session is due to end, and after that it is the mentor's to
 * make — she may waive her fee, but the mentee cannot void an hour that has
 * already run.
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

  if (status === 'COMPLETED' && !hasEnded) {
    // Completing is what captures the card. Before this check a mentor could
    // charge for an hour that had not happened yet.
    throw new ApiError(400, 'A session can only be marked complete once the booked time has passed');
  }

  if (status === 'CANCELED' && hasEnded && actionBy === 'mentee') {
    throw new ApiError(
      400,
      'This session\'s time has passed, so it can no longer be cancelled. If it did not go ahead, ask your mentor to cancel it or contact support.'
    );
  }

  let paymentUpdates: Prisma.MentorSessionUpdateInput = {};
  let holdStillInPlace = false;

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
    try {
      const { capturedAt } = await captureSessionHold(session.stripePaymentIntentId);
      paymentUpdates = {
        paymentStatus: 'CAPTURED' as MentorPaymentStatus,
        paymentCapturedAt: capturedAt,
      };
    } catch (error) {
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

  // `MentorProfile.sessionCount` is shown on the directory card and on the
  // profile as "N sessions", and nothing on the live path had ever written it,
  // so every mentor on ATHENA advertised zero however many hours she had
  // actually given. The two writes go in one transaction because a counter
  // that can drift from the sessions behind it is a number the mentor will be
  // asked about and cannot explain. The transition rules above have already
  // established that the session was CONFIRMED and that its booked time has
  // passed, so this counts finished hours and nothing else.
  const [updated] = await prisma.$transaction([
    prisma.mentorSession.update({
      where: { id: sessionId },
      data: {
        status,
        ...paymentUpdates,
      },
    }),
    ...(status === 'COMPLETED'
      ? [
          prisma.mentorProfile.update({
            where: { id: session.mentorProfileId },
            data: { sessionCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  if (holdStillInPlace) {
    await notifyUnreleasedHold(session.menteeId, sessionId);
  }

  // When the mentor closes a paid session, the mentee's card is charged at that
  // moment, and the notice she got said only that her session's status was now
  // COMPLETED. She is told what was taken, and where to go if the hour did not
  // happen. (A mentee-side confirmation step before the charge needs somewhere
  // to record a dispute, which MentorSession does not have yet.)
  const chargedAmount = Number(session.sessionAmount);
  const menteeWasCharged =
    actionBy === 'mentor' &&
    status === 'COMPLETED' &&
    paymentUpdates.paymentStatus === 'CAPTURED' &&
    chargedAmount > 0;

  // Send notification to other party
  const recipientId = actionBy === 'mentor' ? session.menteeId : session.mentorProfile.userId;
  await notificationService.notify({
    userId: recipientId,
    type: 'MENTOR_SESSION',
    title: menteeWasCharged ? 'Your session was marked complete and paid' : 'Session Updated',
    message: menteeWasCharged
      ? `Your mentor marked your session on ${session.scheduledAt?.toLocaleDateString() ?? 'its booked date'} as complete, and ${chargedAmount.toFixed(2)} ${session.currency} was charged to your card. If the session did not take place, tell our support team from Help & Support so it can be refunded.`
      : `Your mentorship session status has been updated to ${status}`,
    link: menteeWasCharged ? '/dashboard/support' : `/dashboard/mentors/sessions?session=${sessionId}`,
    channels: ['in-app', 'email'], // Less urgent than new request?
    emailTemplate: {
        subject: `Session ${
           status === 'CONFIRMED' ? 'Confirmed' : 
           status === 'CANCELED' ? 'Canceled' : 
           status === 'COMPLETED' ? 'Completed' : 'Updated'
        }`,
        html: `
            <h2>Session Update</h2>
            <p>Your session scheduled for ${session.scheduledAt?.toLocaleDateString() ?? 'TBD'} is now <strong>${status}</strong>.</p>
            <a href="${process.env.CLIENT_URL}/dashboard/mentors/sessions?session=${sessionId}">View Details</a>
        `
    }
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
  if (session.paymentStatus !== 'PENDING') {
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
    return prisma.mentorSession.findMany({
      where: {
        mentorProfile: { userId },
      },
      include: {
        mentee: { select: { id: true, displayName: true, avatar: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  } else {
    return prisma.mentorSession.findMany({
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
    });
  }
}
