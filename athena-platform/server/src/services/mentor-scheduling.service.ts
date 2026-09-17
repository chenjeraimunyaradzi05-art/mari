/**
 * MentorMatch Scheduling Service
 * Calendar integration, time-zone handling, booking flows, reminders
 * 
 * Works with actual Prisma schema:
 * - MentorProfile: userId, specializations, yearsExperience, hourlyRate, isAvailable, sessionCount, rating, reviewCount
 * - MentorSession: mentorProfileId, menteeId, scheduledAt, durationMinutes, status (REQUESTED/CONFIRMED/CANCELED/COMPLETED), note
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { sendNotification } from './socket.service';

export interface TimeSlot {
  id: string;
  mentorProfileId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  isAvailable: boolean;
}

export interface BookingRequest {
  mentorProfileId: string;
  menteeId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  sessionType?: string;
  topics?: string[];
  message?: string;
  timezone?: string;
}

export interface Booking {
  id: string;
  mentorProfileId: string;
  menteeId: string;
  scheduledAt: Date | null;
  durationMinutes: number;
  status: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED';
  note: string | null;
  createdAt: Date;
}

export interface MentorAvailability {
  mentorProfileId: string;
  userId: string;
  isAvailable: boolean;
  sessionDurationMinutes: number;
  hourlyRate: number | null;
  specializations: string[];
  rating: number | null;
  sessionCount: number;
}

// Timezone utilities.
//
// Australia is listed first and in full because it is the home market and
// `User.timezone` defaults to Australia/Sydney. The distinction between the
// eastern zones matters for booking: Brisbane does not observe daylight saving,
// so for half the year it is an hour behind Sydney and Melbourne despite
// sharing their standard offset, and a mentor in Perth is two to three hours
// behind depending on the season.
const SUPPORTED_TIMEZONES = [
  'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne',
  'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin', 'Australia/Hobart',
  'Pacific/Auckland',
  'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Mumbai', 'Asia/Dubai',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo',
];

/** The working day a mentor is offered to bookers, in the mentor's own timezone. */
const DAY_STARTS_AT_HOUR = 9;
const DAY_ENDS_AT_HOUR = 17;

/** Matches the default on MentorSession.durationMinutes. */
const DEFAULT_SESSION_MINUTES = 60;

/** Matches the default on User.timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/**
 * How far `timeZone` sits from UTC at a given instant, in milliseconds.
 *
 * There is no way to ask JavaScript this directly, so we format the instant in
 * the target zone, read that wall-clock time back as if it were UTC, and take
 * the difference.
 */
function offsetAtInstant(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);

  // Intl emits hour 24 for midnight when hour12 is false.
  const hour = get('hour') === 24 ? 0 : get('hour');

  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));

  return asIfUtc - instant.getTime();
}

/**
 * The instant at which a given wall-clock time occurs in `timeZone`.
 *
 * The offset has to be looked up twice: the first guess is taken at the wrong
 * instant, which lands on the wrong side of a daylight-saving change for the
 * hours either side of it.
 */
function instantForLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  const firstGuess = naive - offsetAtInstant(new Date(naive), timeZone);
  const settled = naive - offsetAtInstant(new Date(firstGuess), timeZone);

  return new Date(settled);
}

/** The calendar date in `timeZone` at a given instant, as its year, month and day. */
function calendarDateIn(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);

  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Convert a date to a specific timezone
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  if (!SUPPORTED_TIMEZONES.includes(timezone)) {
    logger.warn('Unsupported timezone, using UTC', { timezone });
    return date;
  }
  
  try {
    // Get the offset for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    return new Date(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
    );
  } catch (error) {
    logger.error('Failed to convert timezone', { error, timezone });
    return date;
  }
}

/**
 * Format a date in user's timezone for display
 */
export function formatInTimezone(date: Date, timezone: string, format: 'full' | 'date' | 'time' = 'full'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
  };
  
  if (format === 'full' || format === 'date') {
    options.weekday = 'short';
    options.month = 'short';
    options.day = 'numeric';
  }
  
  if (format === 'full' || format === 'time') {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Get available time slots for a mentor in a specific timezone
 */
export async function getAvailableSlots(
  mentorProfileId: string,
  date: Date,
  menteeTimezone: string
): Promise<{ start: Date; end: Date; displayTime: string }[]> {
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id: mentorProfileId },
    include: { user: { select: { timezone: true } } },
  });
  
  if (!mentor || !mentor.isAvailable) {
    return [];
  }
  
  const mentorTimezone = mentor.user?.timezone || 'UTC';
  const slots: { start: Date; end: Date; displayTime: string }[] = [];

  // The requested day is the mentee's day, so it is resolved in the mentee's
  // timezone. Reading it in the server's zone instead would offer a mentee in
  // Perth the wrong date whenever the server is not sitting beside her.
  const requestedDay = calendarDateIn(date, menteeTimezone);

  // MentorProfile carries no per-mentor session length, so slots are offered at
  // the same default a session is created with.
  const durationMinutes = DEFAULT_SESSION_MINUTES;
  const durationMs = durationMinutes * 60 * 1000;

  // Slots are generated across the mentor's working day, so the window has to
  // be wide enough to cover it wherever the mentee is: the same calendar day in
  // Brisbane and in London barely overlap.
  const windowStart = instantForLocalTime(requestedDay.year, requestedDay.month, requestedDay.day, 0, 0, menteeTimezone);
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

  const existingBookings = await prisma.mentorSession.findMany({
    where: {
      mentorProfileId,
      status: { in: ['REQUESTED', 'CONFIRMED'] },
      scheduledAt: {
        gte: new Date(windowStart.getTime() - durationMs),
        lte: windowEnd,
      },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const booked = existingBookings
    .filter(b => b.scheduledAt)
    .map(b => {
      const start = b.scheduledAt!.getTime();
      return { start, end: start + (b.durationMinutes ?? durationMinutes) * 60 * 1000 };
    });

  const now = Date.now();

  // The mentor's working day may begin on either the previous or the next
  // calendar date in her own zone, so both are generated and filtered back down
  // to the window the mentee asked for.
  for (const dayOffset of [-1, 0, 1]) {
    const anchor = new Date(windowStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const mentorDay = calendarDateIn(anchor, mentorTimezone);

    for (let hour = DAY_STARTS_AT_HOUR; hour < DAY_ENDS_AT_HOUR; hour++) {
      const slotStart = instantForLocalTime(
        mentorDay.year,
        mentorDay.month,
        mentorDay.day,
        hour,
        0,
        mentorTimezone
      );
      const startedAt = slotStart.getTime();
      const endsAt = startedAt + durationMs;

      if (startedAt < windowStart.getTime() || startedAt >= windowEnd.getTime()) {
        continue;
      }

      if (startedAt < now) {
        continue;
      }

      // A slot is gone if any existing booking overlaps it, not only if one
      // starts at the same minute: a 90-minute session blocks the hour after it.
      if (booked.some(b => b.start < endsAt && startedAt < b.end)) {
        continue;
      }

      if (slots.some(s => s.start.getTime() === startedAt)) {
        continue;
      }

      slots.push({
        start: slotStart,
        end: new Date(endsAt),
        displayTime: formatInTimezone(slotStart, menteeTimezone, 'time'),
      });
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());

  return slots;
}

/**
 * Validate timezone is supported
 */
export function isValidTimezone(timezone: string): boolean {
  return SUPPORTED_TIMEZONES.includes(timezone);
}

/**
 * The timezone to show a member times in.
 *
 * Falls back to the platform default rather than UTC, because showing an
 * Australian member a UTC time is a wrong answer rather than a neutral one.
 */
export async function getUserTimezone(userId?: string): Promise<string> {
  if (!userId) return DEFAULT_TIMEZONE;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  const saved = user?.timezone;

  return saved && isValidTimezone(saved) ? saved : DEFAULT_TIMEZONE;
}

/**
 * Get list of supported timezones
 */
export function getSupportedTimezones(): string[] {
  return [...SUPPORTED_TIMEZONES];
}

/**
 * Get mentor's availability settings
 */
export async function getMentorAvailability(mentorProfileId: string): Promise<MentorAvailability | null> {
  try {
    const profile = await prisma.mentorProfile.findUnique({
      where: { id: mentorProfileId },
    });

    if (!profile) {
      return null;
    }

    return {
      mentorProfileId: profile.id,
      userId: profile.userId,
      isAvailable: profile.isAvailable,
      sessionDurationMinutes: 60, // Default
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      specializations: (profile.specializations as string[]) || [],
      rating: profile.rating ? Number(profile.rating) : null,
      sessionCount: profile.sessionCount,
    };
  } catch (error) {
    logger.error('Failed to get mentor availability', { error, mentorProfileId });
    return null;
  }
}

/**
 * Set mentor availability (basic on/off)
 */
export async function setMentorAvailability(
  mentorProfileId: string,
  isAvailable: boolean
): Promise<MentorAvailability | null> {
  try {
    const profile = await prisma.mentorProfile.update({
      where: { id: mentorProfileId },
      data: { isAvailable },
    });

    logger.info('Mentor availability updated', { mentorProfileId, isAvailable });

    return {
      mentorProfileId: profile.id,
      userId: profile.userId,
      isAvailable: profile.isAvailable,
      sessionDurationMinutes: 60,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      specializations: (profile.specializations as string[]) || [],
      rating: profile.rating ? Number(profile.rating) : null,
      sessionCount: profile.sessionCount,
    };
  } catch (error) {
    logger.error('Failed to set mentor availability', { error, mentorProfileId });
    return null;
  }
}

/**
 * Get available mentors with their profiles
 */
export async function getAvailableMentors(filters?: {
  specialization?: string;
  maxHourlyRate?: number;
  minRating?: number;
}): Promise<MentorAvailability[]> {
  try {
    const mentors = await prisma.mentorProfile.findMany({
      where: {
        isAvailable: true,
        ...(filters?.maxHourlyRate && { 
          hourlyRate: { lte: filters.maxHourlyRate } 
        }),
        ...(filters?.minRating && { 
          rating: { gte: filters.minRating } 
        }),
      },
      orderBy: [
        { rating: 'desc' },
        { sessionCount: 'desc' },
      ],
    });

    return mentors.map(profile => ({
      mentorProfileId: profile.id,
      userId: profile.userId,
      isAvailable: profile.isAvailable,
      sessionDurationMinutes: 60,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      specializations: (profile.specializations as string[]) || [],
      rating: profile.rating ? Number(profile.rating) : null,
      sessionCount: profile.sessionCount,
    }));
  } catch (error) {
    logger.error('Failed to get available mentors', { error });
    return [];
  }
}

/**
 * Get upcoming sessions for a mentor
 */
export async function getMentorSessions(
  mentorProfileId: string,
  status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED'
): Promise<Booking[]> {
  try {
    const sessions = await prisma.mentorSession.findMany({
      where: {
        mentorProfileId,
        ...(status && { status }),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        mentee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return sessions.map(s => ({
      id: s.id,
      mentorProfileId: s.mentorProfileId,
      menteeId: s.menteeId,
      scheduledAt: s.scheduledAt,
      durationMinutes: s.durationMinutes,
      status: s.status as any,
      note: s.note,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    logger.error('Failed to get mentor sessions', { error, mentorProfileId });
    return [];
  }
}

/**
 * Get sessions for a mentee
 */
export async function getMenteeSessions(
  menteeId: string,
  status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED'
): Promise<Booking[]> {
  try {
    const sessions = await prisma.mentorSession.findMany({
      where: {
        menteeId,
        ...(status && { status }),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return sessions.map(s => ({
      id: s.id,
      mentorProfileId: s.mentorProfileId,
      menteeId: s.menteeId,
      scheduledAt: s.scheduledAt,
      durationMinutes: s.durationMinutes,
      status: s.status as any,
      note: s.note,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    logger.error('Failed to get mentee sessions', { error, menteeId });
    return [];
  }
}

/**
 * Book a new session
 */
export async function bookSession(request: BookingRequest): Promise<Booking | null> {
  try {
    const { mentorProfileId, menteeId, scheduledAt, durationMinutes = 60, message } = request;

    // Check mentor exists and is available
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentorProfileId },
    });

    if (!mentor || !mentor.isAvailable) {
      logger.warn('Mentor not available', { mentorProfileId });
      return null;
    }

    // Check for scheduling conflicts
    const sessionEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    const conflicts = await prisma.mentorSession.findFirst({
      where: {
        mentorProfileId,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - durationMinutes * 60 * 1000),
          lte: sessionEnd,
        },
      },
    });

    if (conflicts) {
      logger.warn('Session conflicts with existing booking', { mentorProfileId, scheduledAt });
      return null;
    }

    // Create the session
    const session = await prisma.mentorSession.create({
      data: {
        mentorProfileId,
        menteeId,
        scheduledAt,
        durationMinutes,
        status: 'REQUESTED',
        note: message,
      },
    });

    // Notify mentor
    await sendNotification({
      userId: mentor.userId,
      type: 'MENTOR_SESSION_REQUEST',
      title: 'New session request',
      message: 'You have a new mentoring session request',
      link: `/dashboard/mentors/sessions?session=${session.id}`,
    });

    logger.info('Session booked', { sessionId: session.id, mentorProfileId, menteeId });

    return {
      id: session.id,
      mentorProfileId: session.mentorProfileId,
      menteeId: session.menteeId,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      status: session.status as any,
      note: session.note,
      createdAt: session.createdAt,
    };
  } catch (error) {
    logger.error('Failed to book session', { error });
    return null;
  }
}

/**
 * Respond to a booking (confirm or cancel)
 */
export async function respondToBooking(
  sessionId: string,
  mentorUserId: string,
  accept: boolean,
  message?: string
): Promise<Booking | null> {
  try {
    // Get session with mentor profile
    const session = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: {
        mentorProfile: true,
        mentee: true,
      },
    });

    if (!session) {
      logger.warn('Session not found', { sessionId });
      return null;
    }

    // Verify the mentor owns this session
    if (session.mentorProfile.userId !== mentorUserId) {
      logger.warn('Unauthorized: user is not the mentor', { sessionId, mentorUserId });
      return null;
    }

    if (session.status !== 'REQUESTED') {
      logger.warn('Session is not in REQUESTED status', { sessionId, status: session.status });
      return null;
    }

    const newStatus = accept ? 'CONFIRMED' : 'CANCELED';

    const updated = await prisma.mentorSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        note: message ? `${session.note || ''}\n\nMentor response: ${message}` : session.note,
      },
    });

    // Notify mentee
    await sendNotification({
      userId: session.menteeId,
      type: accept ? 'MENTOR_SESSION_CONFIRMED' : 'MENTOR_SESSION_CANCELED',
      title: accept ? 'Session confirmed' : 'Session declined',
      message: accept 
        ? `Your session has been confirmed for ${session.scheduledAt?.toLocaleDateString() || 'TBD'}`
        : 'Your mentoring session request was declined',
      link: `/dashboard/mentors/sessions?session=${sessionId}`,
    });

    logger.info('Session response recorded', { sessionId, accepted: accept });

    return {
      id: updated.id,
      mentorProfileId: updated.mentorProfileId,
      menteeId: updated.menteeId,
      scheduledAt: updated.scheduledAt,
      durationMinutes: updated.durationMinutes,
      status: updated.status as any,
      note: updated.note,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    logger.error('Failed to respond to booking', { error, sessionId });
    return null;
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  sessionId: string,
  userId: string,
  reason?: string
): Promise<Booking | null> {
  try {
    const session = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: {
        mentorProfile: true,
        mentee: true,
      },
    });

    if (!session) {
      return null;
    }

    // Check if user is mentor or mentee
    const isMentor = session.mentorProfile.userId === userId;
    const isMentee = session.menteeId === userId;

    if (!isMentor && !isMentee) {
      logger.warn('Unauthorized cancellation attempt', { sessionId, userId });
      return null;
    }

    // Only allow canceling REQUESTED or CONFIRMED sessions
    if (!['REQUESTED', 'CONFIRMED'].includes(session.status)) {
      logger.warn('Cannot cancel session in current status', { sessionId, status: session.status });
      return null;
    }

    const updated = await prisma.mentorSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELED',
        note: reason 
          ? `${session.note || ''}\n\nCanceled by ${isMentor ? 'mentor' : 'mentee'}: ${reason}`
          : session.note,
      },
    });

    // Notify the other party
    const recipientId = isMentor ? session.menteeId : session.mentorProfile.userId;
    await sendNotification({
      userId: recipientId,
      type: 'MENTOR_SESSION_CANCELED',
      title: 'Session canceled',
      message: `A mentoring session has been canceled${reason ? `: ${reason}` : ''}`,
      link: `/dashboard/mentoring`,
    });

    logger.info('Session canceled', { sessionId, canceledBy: userId });

    return {
      id: updated.id,
      mentorProfileId: updated.mentorProfileId,
      menteeId: updated.menteeId,
      scheduledAt: updated.scheduledAt,
      durationMinutes: updated.durationMinutes,
      status: updated.status as any,
      note: updated.note,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    logger.error('Failed to cancel booking', { error, sessionId });
    return null;
  }
}

/**
 * Complete a session
 */
export async function completeSession(
  sessionId: string,
  mentorUserId: string,
  notes?: string
): Promise<Booking | null> {
  try {
    const session = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: { mentorProfile: true },
    });

    if (!session) {
      return null;
    }

    if (session.mentorProfile.userId !== mentorUserId) {
      logger.warn('Unauthorized: user is not the mentor', { sessionId, mentorUserId });
      return null;
    }

    if (session.status !== 'CONFIRMED') {
      logger.warn('Session is not in CONFIRMED status', { sessionId, status: session.status });
      return null;
    }

    const updated = await prisma.mentorSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        note: notes ? `${session.note || ''}\n\nSession notes: ${notes}` : session.note,
      },
    });

    // Update mentor's session count
    await prisma.mentorProfile.update({
      where: { id: session.mentorProfileId },
      data: {
        sessionCount: { increment: 1 },
      },
    });

    // Notify mentee to rate
    await sendNotification({
      userId: session.menteeId,
      type: 'MENTOR_SESSION_COMPLETED',
      title: 'Session completed',
      message: 'Your mentoring session has been completed. Please rate your experience!',
      link: `/dashboard/mentors/sessions?session=${sessionId}/rate`,
    });

    logger.info('Session completed', { sessionId });

    return {
      id: updated.id,
      mentorProfileId: updated.mentorProfileId,
      menteeId: updated.menteeId,
      scheduledAt: updated.scheduledAt,
      durationMinutes: updated.durationMinutes,
      status: updated.status as any,
      note: updated.note,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    logger.error('Failed to complete session', { error, sessionId });
    return null;
  }
}

/**
 * Rate a completed session
 */
export async function rateSession(
  sessionId: string,
  menteeId: string,
  rating: number,
  feedback?: string
): Promise<boolean> {
  try {
    if (rating < 1 || rating > 5) {
      logger.warn('Invalid rating', { sessionId, rating });
      return false;
    }

    const session = await prisma.mentorSession.findUnique({
      where: { id: sessionId },
      include: { mentorProfile: true },
    });

    if (!session || session.menteeId !== menteeId) {
      logger.warn('Session not found or unauthorized', { sessionId, menteeId });
      return false;
    }

    if (session.status !== 'COMPLETED') {
      logger.warn('Cannot rate non-completed session', { sessionId, status: session.status });
      return false;
    }

    // Update session with feedback
    await prisma.mentorSession.update({
      where: { id: sessionId },
      data: {
        note: `${session.note || ''}\n\nRating: ${rating}/5${feedback ? `\nFeedback: ${feedback}` : ''}`,
      },
    });

    // Update mentor's average rating
    const profile = session.mentorProfile;
    const currentRating = profile.rating ? Number(profile.rating) : 0;
    const currentCount = profile.reviewCount || 0;
    const newAvg = (currentRating * currentCount + rating) / (currentCount + 1);

    await prisma.mentorProfile.update({
      where: { id: session.mentorProfileId },
      data: {
        rating: newAvg,
        reviewCount: { increment: 1 },
      },
    });

    logger.info('Session rated', { sessionId, rating });
    return true;
  } catch (error) {
    logger.error('Failed to rate session', { error, sessionId });
    return false;
  }
}

/**
 * Get upcoming sessions that need reminders
 */
export async function getUpcomingSessionsForReminders(
  hoursAhead: number = 24
): Promise<Booking[]> {
  try {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const sessions = await prisma.mentorSession.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledAt: {
          gte: now,
          lte: reminderTime,
        },
      },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        mentee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return sessions.map(s => ({
      id: s.id,
      mentorProfileId: s.mentorProfileId,
      menteeId: s.menteeId,
      scheduledAt: s.scheduledAt,
      durationMinutes: s.durationMinutes,
      status: s.status as any,
      note: s.note,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    logger.error('Failed to get upcoming sessions for reminders', { error });
    return [];
  }
}

/**
 * Send session reminders
 */
export async function sendSessionReminders(): Promise<number> {
  try {
    const sessions = await getUpcomingSessionsForReminders(24);
    let sentCount = 0;

    for (const session of sessions) {
      if (!session.scheduledAt) continue;

      const fullSession = await prisma.mentorSession.findUnique({
        where: { id: session.id },
        include: {
          mentorProfile: {
            include: { user: { select: { id: true, firstName: true } } },
          },
          mentee: { select: { id: true, firstName: true } },
        },
      });

      if (!fullSession) continue;

      const timeStr = session.scheduledAt.toLocaleTimeString();
      
      // Notify mentor
      await sendNotification({
        userId: fullSession.mentorProfile.userId,
        type: 'SESSION_REMINDER',
        title: 'Upcoming session reminder',
        message: `You have a mentoring session with ${fullSession.mentee.firstName} at ${timeStr}`,
        link: `/dashboard/mentors/sessions?session=${session.id}`,
      });

      // Notify mentee
      await sendNotification({
        userId: fullSession.menteeId,
        type: 'SESSION_REMINDER',
        title: 'Upcoming session reminder',
        message: `You have a mentoring session with ${fullSession.mentorProfile.user.firstName} at ${timeStr}`,
        link: `/dashboard/mentors/sessions?session=${session.id}`,
      });

      sentCount += 2;
    }

    logger.info('Session reminders sent', { count: sentCount });
    return sentCount;
  } catch (error) {
    logger.error('Failed to send session reminders', { error });
    return 0;
  }
}

export default {
  getMentorAvailability,
  setMentorAvailability,
  getAvailableMentors,
  getMentorSessions,
  getMenteeSessions,
  bookSession,
  respondToBooking,
  cancelBooking,
  completeSession,
  rateSession,
  getUpcomingSessionsForReminders,
  sendSessionReminders,
  SUPPORTED_TIMEZONES,
};
