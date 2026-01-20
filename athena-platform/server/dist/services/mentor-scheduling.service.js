"use strict";
/**
 * MentorMatch Scheduling Service
 * Calendar integration, time-zone handling, booking flows, reminders
 *
 * Works with actual Prisma schema:
 * - MentorProfile: userId, specializations, yearsExperience, hourlyRate, isAvailable, sessionCount, rating, reviewCount
 * - MentorSession: mentorProfileId, menteeId, scheduledAt, durationMinutes, status (REQUESTED/CONFIRMED/CANCELED/COMPLETED), note
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToTimezone = convertToTimezone;
exports.formatInTimezone = formatInTimezone;
exports.getAvailableSlots = getAvailableSlots;
exports.isValidTimezone = isValidTimezone;
exports.getSupportedTimezones = getSupportedTimezones;
exports.getMentorAvailability = getMentorAvailability;
exports.setMentorAvailability = setMentorAvailability;
exports.getAvailableMentors = getAvailableMentors;
exports.getMentorSessions = getMentorSessions;
exports.getMenteeSessions = getMenteeSessions;
exports.bookSession = bookSession;
exports.respondToBooking = respondToBooking;
exports.cancelBooking = cancelBooking;
exports.completeSession = completeSession;
exports.rateSession = rateSession;
exports.getUpcomingSessionsForReminders = getUpcomingSessionsForReminders;
exports.sendSessionReminders = sendSessionReminders;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const socket_service_1 = require("./socket.service");
// Timezone utilities
const SUPPORTED_TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Asia/Dubai', 'Asia/Mumbai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
];
/**
 * Convert a date to a specific timezone
 */
function convertToTimezone(date, timezone) {
    if (!SUPPORTED_TIMEZONES.includes(timezone)) {
        logger_1.logger.warn('Unsupported timezone, using UTC', { timezone });
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
        const get = (type) => parts.find(p => p.type === type)?.value || '0';
        return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
    }
    catch (error) {
        logger_1.logger.error('Failed to convert timezone', { error, timezone });
        return date;
    }
}
/**
 * Format a date in user's timezone for display
 */
function formatInTimezone(date, timezone, format = 'full') {
    const options = {
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
async function getAvailableSlots(mentorProfileId, date, menteeTimezone) {
    const mentor = await prisma_1.prisma.mentorProfile.findUnique({
        where: { id: mentorProfileId },
        include: { user: { select: { timezone: true } } },
    });
    if (!mentor || !mentor.isAvailable) {
        return [];
    }
    const mentorTimezone = mentor.user?.timezone || 'UTC';
    const slots = [];
    // Get existing bookings for the day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const existingBookings = await prisma_1.prisma.mentorSession.findMany({
        where: {
            mentorProfileId,
            status: { in: ['REQUESTED', 'CONFIRMED'] },
            scheduledAt: { gte: dayStart, lte: dayEnd },
        },
    });
    const bookedTimes = new Set(existingBookings.map(b => b.scheduledAt?.toISOString()));
    // Generate hourly slots from 9 AM to 5 PM in mentor's timezone
    for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        // Skip if already booked
        if (bookedTimes.has(slotStart.toISOString())) {
            continue;
        }
        // Skip if in the past
        if (slotStart < new Date()) {
            continue;
        }
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        slots.push({
            start: slotStart,
            end: slotEnd,
            displayTime: formatInTimezone(slotStart, menteeTimezone, 'time'),
        });
    }
    return slots;
}
/**
 * Validate timezone is supported
 */
function isValidTimezone(timezone) {
    return SUPPORTED_TIMEZONES.includes(timezone);
}
/**
 * Get list of supported timezones
 */
function getSupportedTimezones() {
    return [...SUPPORTED_TIMEZONES];
}
/**
 * Get mentor's availability settings
 */
async function getMentorAvailability(mentorProfileId) {
    try {
        const profile = await prisma_1.prisma.mentorProfile.findUnique({
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
            specializations: profile.specializations || [],
            rating: profile.rating ? Number(profile.rating) : null,
            sessionCount: profile.sessionCount,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentor availability', { error, mentorProfileId });
        return null;
    }
}
/**
 * Set mentor availability (basic on/off)
 */
async function setMentorAvailability(mentorProfileId, isAvailable) {
    try {
        const profile = await prisma_1.prisma.mentorProfile.update({
            where: { id: mentorProfileId },
            data: { isAvailable },
        });
        logger_1.logger.info('Mentor availability updated', { mentorProfileId, isAvailable });
        return {
            mentorProfileId: profile.id,
            userId: profile.userId,
            isAvailable: profile.isAvailable,
            sessionDurationMinutes: 60,
            hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
            specializations: profile.specializations || [],
            rating: profile.rating ? Number(profile.rating) : null,
            sessionCount: profile.sessionCount,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to set mentor availability', { error, mentorProfileId });
        return null;
    }
}
/**
 * Get available mentors with their profiles
 */
async function getAvailableMentors(filters) {
    try {
        const mentors = await prisma_1.prisma.mentorProfile.findMany({
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
            specializations: profile.specializations || [],
            rating: profile.rating ? Number(profile.rating) : null,
            sessionCount: profile.sessionCount,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get available mentors', { error });
        return [];
    }
}
/**
 * Get upcoming sessions for a mentor
 */
async function getMentorSessions(mentorProfileId, status) {
    try {
        const sessions = await prisma_1.prisma.mentorSession.findMany({
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
            status: s.status,
            note: s.note,
            createdAt: s.createdAt,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentor sessions', { error, mentorProfileId });
        return [];
    }
}
/**
 * Get sessions for a mentee
 */
async function getMenteeSessions(menteeId, status) {
    try {
        const sessions = await prisma_1.prisma.mentorSession.findMany({
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
            status: s.status,
            note: s.note,
            createdAt: s.createdAt,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentee sessions', { error, menteeId });
        return [];
    }
}
/**
 * Book a new session
 */
async function bookSession(request) {
    try {
        const { mentorProfileId, menteeId, scheduledAt, durationMinutes = 60, message } = request;
        // Check mentor exists and is available
        const mentor = await prisma_1.prisma.mentorProfile.findUnique({
            where: { id: mentorProfileId },
        });
        if (!mentor || !mentor.isAvailable) {
            logger_1.logger.warn('Mentor not available', { mentorProfileId });
            return null;
        }
        // Check for scheduling conflicts
        const sessionEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
        const conflicts = await prisma_1.prisma.mentorSession.findFirst({
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
            logger_1.logger.warn('Session conflicts with existing booking', { mentorProfileId, scheduledAt });
            return null;
        }
        // Create the session
        const session = await prisma_1.prisma.mentorSession.create({
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
        await (0, socket_service_1.sendNotification)({
            userId: mentor.userId,
            type: 'MENTOR_SESSION_REQUEST',
            title: 'New session request',
            message: 'You have a new mentoring session request',
            link: `/dashboard/mentoring/sessions/${session.id}`,
        });
        logger_1.logger.info('Session booked', { sessionId: session.id, mentorProfileId, menteeId });
        return {
            id: session.id,
            mentorProfileId: session.mentorProfileId,
            menteeId: session.menteeId,
            scheduledAt: session.scheduledAt,
            durationMinutes: session.durationMinutes,
            status: session.status,
            note: session.note,
            createdAt: session.createdAt,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to book session', { error });
        return null;
    }
}
/**
 * Respond to a booking (confirm or cancel)
 */
async function respondToBooking(sessionId, mentorUserId, accept, message) {
    try {
        // Get session with mentor profile
        const session = await prisma_1.prisma.mentorSession.findUnique({
            where: { id: sessionId },
            include: {
                mentorProfile: true,
                mentee: true,
            },
        });
        if (!session) {
            logger_1.logger.warn('Session not found', { sessionId });
            return null;
        }
        // Verify the mentor owns this session
        if (session.mentorProfile.userId !== mentorUserId) {
            logger_1.logger.warn('Unauthorized: user is not the mentor', { sessionId, mentorUserId });
            return null;
        }
        if (session.status !== 'REQUESTED') {
            logger_1.logger.warn('Session is not in REQUESTED status', { sessionId, status: session.status });
            return null;
        }
        const newStatus = accept ? 'CONFIRMED' : 'CANCELED';
        const updated = await prisma_1.prisma.mentorSession.update({
            where: { id: sessionId },
            data: {
                status: newStatus,
                note: message ? `${session.note || ''}\n\nMentor response: ${message}` : session.note,
            },
        });
        // Notify mentee
        await (0, socket_service_1.sendNotification)({
            userId: session.menteeId,
            type: accept ? 'MENTOR_SESSION_CONFIRMED' : 'MENTOR_SESSION_CANCELED',
            title: accept ? 'Session confirmed' : 'Session declined',
            message: accept
                ? `Your session has been confirmed for ${session.scheduledAt?.toLocaleDateString() || 'TBD'}`
                : 'Your mentoring session request was declined',
            link: `/dashboard/mentoring/sessions/${sessionId}`,
        });
        logger_1.logger.info('Session response recorded', { sessionId, accepted: accept });
        return {
            id: updated.id,
            mentorProfileId: updated.mentorProfileId,
            menteeId: updated.menteeId,
            scheduledAt: updated.scheduledAt,
            durationMinutes: updated.durationMinutes,
            status: updated.status,
            note: updated.note,
            createdAt: updated.createdAt,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to respond to booking', { error, sessionId });
        return null;
    }
}
/**
 * Cancel a booking
 */
async function cancelBooking(sessionId, userId, reason) {
    try {
        const session = await prisma_1.prisma.mentorSession.findUnique({
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
            logger_1.logger.warn('Unauthorized cancellation attempt', { sessionId, userId });
            return null;
        }
        // Only allow canceling REQUESTED or CONFIRMED sessions
        if (!['REQUESTED', 'CONFIRMED'].includes(session.status)) {
            logger_1.logger.warn('Cannot cancel session in current status', { sessionId, status: session.status });
            return null;
        }
        const updated = await prisma_1.prisma.mentorSession.update({
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
        await (0, socket_service_1.sendNotification)({
            userId: recipientId,
            type: 'MENTOR_SESSION_CANCELED',
            title: 'Session canceled',
            message: `A mentoring session has been canceled${reason ? `: ${reason}` : ''}`,
            link: `/dashboard/mentoring`,
        });
        logger_1.logger.info('Session canceled', { sessionId, canceledBy: userId });
        return {
            id: updated.id,
            mentorProfileId: updated.mentorProfileId,
            menteeId: updated.menteeId,
            scheduledAt: updated.scheduledAt,
            durationMinutes: updated.durationMinutes,
            status: updated.status,
            note: updated.note,
            createdAt: updated.createdAt,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to cancel booking', { error, sessionId });
        return null;
    }
}
/**
 * Complete a session
 */
async function completeSession(sessionId, mentorUserId, notes) {
    try {
        const session = await prisma_1.prisma.mentorSession.findUnique({
            where: { id: sessionId },
            include: { mentorProfile: true },
        });
        if (!session) {
            return null;
        }
        if (session.mentorProfile.userId !== mentorUserId) {
            logger_1.logger.warn('Unauthorized: user is not the mentor', { sessionId, mentorUserId });
            return null;
        }
        if (session.status !== 'CONFIRMED') {
            logger_1.logger.warn('Session is not in CONFIRMED status', { sessionId, status: session.status });
            return null;
        }
        const updated = await prisma_1.prisma.mentorSession.update({
            where: { id: sessionId },
            data: {
                status: 'COMPLETED',
                note: notes ? `${session.note || ''}\n\nSession notes: ${notes}` : session.note,
            },
        });
        // Update mentor's session count
        await prisma_1.prisma.mentorProfile.update({
            where: { id: session.mentorProfileId },
            data: {
                sessionCount: { increment: 1 },
            },
        });
        // Notify mentee to rate
        await (0, socket_service_1.sendNotification)({
            userId: session.menteeId,
            type: 'MENTOR_SESSION_COMPLETED',
            title: 'Session completed',
            message: 'Your mentoring session has been completed. Please rate your experience!',
            link: `/dashboard/mentoring/sessions/${sessionId}/rate`,
        });
        logger_1.logger.info('Session completed', { sessionId });
        return {
            id: updated.id,
            mentorProfileId: updated.mentorProfileId,
            menteeId: updated.menteeId,
            scheduledAt: updated.scheduledAt,
            durationMinutes: updated.durationMinutes,
            status: updated.status,
            note: updated.note,
            createdAt: updated.createdAt,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to complete session', { error, sessionId });
        return null;
    }
}
/**
 * Rate a completed session
 */
async function rateSession(sessionId, menteeId, rating, feedback) {
    try {
        if (rating < 1 || rating > 5) {
            logger_1.logger.warn('Invalid rating', { sessionId, rating });
            return false;
        }
        const session = await prisma_1.prisma.mentorSession.findUnique({
            where: { id: sessionId },
            include: { mentorProfile: true },
        });
        if (!session || session.menteeId !== menteeId) {
            logger_1.logger.warn('Session not found or unauthorized', { sessionId, menteeId });
            return false;
        }
        if (session.status !== 'COMPLETED') {
            logger_1.logger.warn('Cannot rate non-completed session', { sessionId, status: session.status });
            return false;
        }
        // Update session with feedback
        await prisma_1.prisma.mentorSession.update({
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
        await prisma_1.prisma.mentorProfile.update({
            where: { id: session.mentorProfileId },
            data: {
                rating: newAvg,
                reviewCount: { increment: 1 },
            },
        });
        logger_1.logger.info('Session rated', { sessionId, rating });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to rate session', { error, sessionId });
        return false;
    }
}
/**
 * Get upcoming sessions that need reminders
 */
async function getUpcomingSessionsForReminders(hoursAhead = 24) {
    try {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
        const sessions = await prisma_1.prisma.mentorSession.findMany({
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
            status: s.status,
            note: s.note,
            createdAt: s.createdAt,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get upcoming sessions for reminders', { error });
        return [];
    }
}
/**
 * Send session reminders
 */
async function sendSessionReminders() {
    try {
        const sessions = await getUpcomingSessionsForReminders(24);
        let sentCount = 0;
        for (const session of sessions) {
            if (!session.scheduledAt)
                continue;
            const fullSession = await prisma_1.prisma.mentorSession.findUnique({
                where: { id: session.id },
                include: {
                    mentorProfile: {
                        include: { user: { select: { id: true, firstName: true } } },
                    },
                    mentee: { select: { id: true, firstName: true } },
                },
            });
            if (!fullSession)
                continue;
            const timeStr = session.scheduledAt.toLocaleTimeString();
            // Notify mentor
            await (0, socket_service_1.sendNotification)({
                userId: fullSession.mentorProfile.userId,
                type: 'SESSION_REMINDER',
                title: 'Upcoming session reminder',
                message: `You have a mentoring session with ${fullSession.mentee.firstName} at ${timeStr}`,
                link: `/dashboard/mentoring/sessions/${session.id}`,
            });
            // Notify mentee
            await (0, socket_service_1.sendNotification)({
                userId: fullSession.menteeId,
                type: 'SESSION_REMINDER',
                title: 'Upcoming session reminder',
                message: `You have a mentoring session with ${fullSession.mentorProfile.user.firstName} at ${timeStr}`,
                link: `/dashboard/mentoring/sessions/${session.id}`,
            });
            sentCount += 2;
        }
        logger_1.logger.info('Session reminders sent', { count: sentCount });
        return sentCount;
    }
    catch (error) {
        logger_1.logger.error('Failed to send session reminders', { error });
        return 0;
    }
}
exports.default = {
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
//# sourceMappingURL=mentor-scheduling.service.js.map