/**
 * MentorMatch Scheduling Service
 * Time-zone handling, slot generation and session reminders.
 *
 * ## Booking does not live here any more
 *
 * This file used to carry a second booking lifecycle — bookSession,
 * respondToBooking, cancelBooking, completeSession, rateSession — behind the
 * `/api/mentoring` router. That path wrote a MentorSession row straight to the
 * database with no hourly rate, no Stripe hold and no `stripeAccountId` check,
 * so any authenticated caller could claim a paid mentor's hour for nothing and
 * take the slot off her published calendar. Both engines wrote the same rows,
 * which is why the free one went unnoticed. The paid path in
 * `mentor.service.ts` — `POST /api/mentors/:id/book`, with its manual-capture
 * PaymentIntent, application fee and transfer destination — is the only way a
 * session may be created, so the duplicate lifecycle and the router in front of
 * it are gone. Do not reintroduce booking writes here; add to
 * `mentor.service.ts` instead.
 *
 * What remains is what the live path calls: the timezone helpers and
 * `getAvailableSlots` behind `GET /api/mentors/:mentorId/slots` and
 * `GET /api/mentors/timezones`, plus the reminder sweep over confirmed
 * sessions.
 *
 * Works with actual Prisma schema:
 * - MentorProfile: userId, specializations, yearsExperience, hourlyRate, isAvailable, sessionCount, rating, reviewCount
 * - MentorSession: mentorProfileId, menteeId, scheduledAt, durationMinutes, status (REQUESTED/CONFIRMED/CANCELED/COMPLETED), note
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { sendNotification } from './socket.service';

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

