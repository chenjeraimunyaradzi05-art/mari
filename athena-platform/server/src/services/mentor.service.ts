/**
 * Mentor Service
 * Management of mentor profiles, sessions, and reviews
 */

import { prisma } from '../utils/prisma';
import { MentorPaymentStatus, MentorSessionStatus } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
// import { sendNotification } from './socket.service'; // Deprecated
import { notificationService } from './notification.service';
import Stripe from 'stripe';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

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
  limit = 20
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
 */
export async function enableMentorMonetization(userId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  if (!profile) {
    throw new ApiError(404, 'Mentor profile not found');
  }

  if (profile.stripeAccountId) {
    return profile;
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email: profile.user?.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: {
      name: `${profile.user?.firstName ?? ''} ${profile.user?.lastName ?? ''}`.trim(),
      product_description: 'Mentor services on ATHENA platform',
    },
  });

  const updated = await prisma.mentorProfile.update({
    where: { userId },
    data: {
      stripeAccountId: account.id,
      isMonetized: true,
    },
  });

  logger.info('Mentor monetization enabled', { userId, stripeAccountId: account.id });

  return updated;
}

export async function generateMentorStripeOnboardingLink(userId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
  });

  if (!profile?.stripeAccountId) {
    throw new ApiError(400, 'Mentor Stripe account not found. Enable monetization first.');
  }

  const accountLink = await stripe.accountLinks.create({
    account: profile.stripeAccountId,
    refresh_url: `${process.env.CLIENT_URL}/dashboard/mentor/onboarding-refresh`,
    return_url: `${process.env.CLIENT_URL}/dashboard/mentor`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

export async function generateMentorStripeLoginLink(userId: string) {
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
  });

  if (!profile?.stripeAccountId) {
    throw new ApiError(400, 'Mentor Stripe account not found.');
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);
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

  if (!mentor.stripeAccountId) {
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

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    transfer_data: {
      destination: mentor.stripeAccountId,
    },
    application_fee_amount: feeCents,
    metadata: {
      type: 'mentor_session',
      sessionId: session.id,
      mentorProfileId: mentorId,
      menteeId,
    },
    description: `Mentor session ${session.id}`,
  });

  const updatedSession = await prisma.mentorSession.update({
    where: { id: session.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  // Send notification to mentor
  await notificationService.notify({
    userId: mentor.userId,
    type: 'MENTOR_SESSION',
    title: 'New Mentorship Request',
    message: `You have a new mentorship session request for ${data.scheduledAt.toLocaleDateString()}`,
    link: `/dashboard/mentor/sessions/${session.id}`,
    channels: ['in-app', 'email', 'push'],
    emailTemplate: {
      subject: 'New Mentorship Request',
      html: `
        <h2>New Mentorship Request</h2>
        <p>You have a new session request for ${data.scheduledAt.toLocaleString()}.</p>
        <p><strong>Note from mentee:</strong> ${data.note || 'No note provided'}</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard/mentor/sessions/${session.id}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a>
        </div>
      `
    }
  });

  return {
    session: updatedSession,
    paymentIntentClientSecret: paymentIntent.client_secret,
  };
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

  // Logic for generating video link if confirmed
  let additionalData = {};
  if (status === 'CONFIRMED') {
    // In a real app, generate Jitsi/Zoom/Chime link here
    // For now, construct a platform link
    // additionalData = { videoUrl: `https://meet.athena.io/${session.id}` };
  }

  let paymentUpdates: Record<string, any> = {};

  if (status === 'CANCELED' && session.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(session.stripePaymentIntentId);
      paymentUpdates = {
        paymentStatus: 'CANCELED' as MentorPaymentStatus,
        paymentCanceledAt: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to cancel mentor session payment intent', {
        sessionId,
        paymentIntentId: session.stripePaymentIntentId,
      });
    }
  }

  if (status === 'COMPLETED' && session.stripePaymentIntentId) {
    try {
      const captured = await stripe.paymentIntents.capture(session.stripePaymentIntentId);
      if (captured.status === 'succeeded' || captured.status === 'processing') {
        paymentUpdates = {
          paymentStatus: 'CAPTURED' as MentorPaymentStatus,
          paymentCapturedAt: new Date(),
        };
      }
    } catch (error) {
      logger.warn('Failed to capture mentor session payment intent', {
        sessionId,
        paymentIntentId: session.stripePaymentIntentId,
      });
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
    link: `/dashboard/mentor/sessions/${sessionId}`,
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
            <a href="${process.env.CLIENT_URL}/dashboard/mentor/sessions/${sessionId}">View Details</a>
        `
    }
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
