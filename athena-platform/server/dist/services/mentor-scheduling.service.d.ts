/**
 * MentorMatch Scheduling Service
 * Calendar integration, time-zone handling, booking flows, reminders
 *
 * Works with actual Prisma schema:
 * - MentorProfile: userId, specializations, yearsExperience, hourlyRate, isAvailable, sessionCount, rating, reviewCount
 * - MentorSession: mentorProfileId, menteeId, scheduledAt, durationMinutes, status (REQUESTED/CONFIRMED/CANCELED/COMPLETED), note
 */
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
/**
 * Convert a date to a specific timezone
 */
export declare function convertToTimezone(date: Date, timezone: string): Date;
/**
 * Format a date in user's timezone for display
 */
export declare function formatInTimezone(date: Date, timezone: string, format?: 'full' | 'date' | 'time'): string;
/**
 * Get available time slots for a mentor in a specific timezone
 */
export declare function getAvailableSlots(mentorProfileId: string, date: Date, menteeTimezone: string): Promise<{
    start: Date;
    end: Date;
    displayTime: string;
}[]>;
/**
 * Validate timezone is supported
 */
export declare function isValidTimezone(timezone: string): boolean;
/**
 * Get list of supported timezones
 */
export declare function getSupportedTimezones(): string[];
/**
 * Get mentor's availability settings
 */
export declare function getMentorAvailability(mentorProfileId: string): Promise<MentorAvailability | null>;
/**
 * Set mentor availability (basic on/off)
 */
export declare function setMentorAvailability(mentorProfileId: string, isAvailable: boolean): Promise<MentorAvailability | null>;
/**
 * Get available mentors with their profiles
 */
export declare function getAvailableMentors(filters?: {
    specialization?: string;
    maxHourlyRate?: number;
    minRating?: number;
}): Promise<MentorAvailability[]>;
/**
 * Get upcoming sessions for a mentor
 */
export declare function getMentorSessions(mentorProfileId: string, status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED'): Promise<Booking[]>;
/**
 * Get sessions for a mentee
 */
export declare function getMenteeSessions(menteeId: string, status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED'): Promise<Booking[]>;
/**
 * Book a new session
 */
export declare function bookSession(request: BookingRequest): Promise<Booking | null>;
/**
 * Respond to a booking (confirm or cancel)
 */
export declare function respondToBooking(sessionId: string, mentorUserId: string, accept: boolean, message?: string): Promise<Booking | null>;
/**
 * Cancel a booking
 */
export declare function cancelBooking(sessionId: string, userId: string, reason?: string): Promise<Booking | null>;
/**
 * Complete a session
 */
export declare function completeSession(sessionId: string, mentorUserId: string, notes?: string): Promise<Booking | null>;
/**
 * Rate a completed session
 */
export declare function rateSession(sessionId: string, menteeId: string, rating: number, feedback?: string): Promise<boolean>;
/**
 * Get upcoming sessions that need reminders
 */
export declare function getUpcomingSessionsForReminders(hoursAhead?: number): Promise<Booking[]>;
/**
 * Send session reminders
 */
export declare function sendSessionReminders(): Promise<number>;
declare const _default: {
    getMentorAvailability: typeof getMentorAvailability;
    setMentorAvailability: typeof setMentorAvailability;
    getAvailableMentors: typeof getAvailableMentors;
    getMentorSessions: typeof getMentorSessions;
    getMenteeSessions: typeof getMenteeSessions;
    bookSession: typeof bookSession;
    respondToBooking: typeof respondToBooking;
    cancelBooking: typeof cancelBooking;
    completeSession: typeof completeSession;
    rateSession: typeof rateSession;
    getUpcomingSessionsForReminders: typeof getUpcomingSessionsForReminders;
    sendSessionReminders: typeof sendSessionReminders;
    SUPPORTED_TIMEZONES: string[];
};
export default _default;
//# sourceMappingURL=mentor-scheduling.service.d.ts.map