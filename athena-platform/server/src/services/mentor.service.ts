/**
 * Mentor Service
 * Management of mentor profiles, sessions, and reviews
 */

import { prisma } from '../utils/prisma';
import { MentorPaymentStatus, MentorSessionStatus } from '@prisma/client';
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
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            headline: true,
            bio: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { rating: 'desc' },
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
    mentors: filteredMentors,
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
    include: {
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
    },
  });

  return profile;
}

export async function getMentorProfileById(mentorId: string) {
  // `select`, not `include`. An include returns every scalar on the model, and
  // this is served to anonymous callers — so the mentor's Stripe connected
  // account id went out with her public profile. The user fields were already
  // curated; the profile's were not.
  return prisma.mentorProfile.findUnique({
    where: { id: mentorId },
    select: {
      id: true,
      userId: true,
      specializations: true,
      yearsExperience: true,
      hourlyRate: true,
      isAvailable: true,
      sessionCount: true,
      rating: true,
      reviewCount: true,
      // isMonetized is here because the booking UI needs to know whether a
      // paid session can be started at all. stripeAccountId is not: nothing
      // outside the server has any use for it.
      isMonetized: true,
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
    },
  });
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

  // Ensure user has MENTOR role
  await prisma.user.update({
    where: { id: userId },
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

  const hourlyRate = Number(mentor.hourlyRate || 0);
  if (!hourlyRate || hourlyRate <= 0) {
    throw new ApiError(400, 'Mentor hourly rate not set');
  }

  const mentorAccountId = await resolveConnectedAccountId(mentor.userId);
  if (!mentorAccountId) {
    throw new ApiError(400, 'Mentor is not enabled for payments');
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
      paymentStatus: 'PENDING',
    },
  });

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

  // Send notification to mentor
  await notificationService.notify({
    userId: mentor.userId,
    type: 'MENTOR_SESSION',
    title: 'New Mentorship Request',
    message: `You have a new mentorship session request for ${data.scheduledAt.toLocaleDateString()}`,
    link: `/dashboard/mentors/sessions?session=${session.id}`,
    channels: ['in-app', 'email', 'push'],
    emailTemplate: {
      subject: 'New Mentorship Request',
      html: `
        <h2>New Mentorship Request</h2>
        <p>You have a new session request for ${data.scheduledAt.toLocaleString()}.</p>
        <p><strong>Note from mentee:</strong> ${data.note || 'No note provided'}</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard/mentors/sessions?session=${session.id}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a>
        </div>
      `
    }
  });

  return {
    session: updatedSession,
    paymentIntentClientSecret: hold.clientSecret,
  };
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
    select: { id: true },
  });

  if (!escrow) {
    await getStripe().paymentIntents.cancel(paymentIntentId);
    return;
  }

  await cancelEscrowPayment(paymentIntentId, PLATFORM_ESCROW_ACTOR, 'Session canceled');
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

  let paymentUpdates: Record<string, any> = {};

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
      // Left as a warning: an uncancelled hold expires on its own in days and
      // the mentee is never charged, so nobody is out of pocket while it does.
      logger.warn('Failed to cancel mentor session payment intent', {
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

  const updated = await prisma.mentorSession.update({
    where: { id: sessionId },
    data: {
      status,
      ...paymentUpdates,
    },
  });

  // Send notification to other party
  const recipientId = actionBy === 'mentor' ? session.menteeId : session.mentorProfile.userId;
  await notificationService.notify({
    userId: recipientId,
    type: 'MENTOR_SESSION',
    title: 'Session Updated',
    message: `Your mentorship session status has been updated to ${status}`,
    link: `/dashboard/mentors/sessions?session=${sessionId}`,
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
