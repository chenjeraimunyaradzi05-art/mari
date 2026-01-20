/**
 * Mentor Scheduling Routes
 * Calendar integration, booking, availability management
 *
 * Works with the simplified mentor-scheduling.service.ts
 * Service functions:
 * - getMentorAvailability(mentorProfileId)
 * - setMentorAvailability(mentorProfileId, isAvailable)
 * - getAvailableMentors(filters?)
 * - getMentorSessions(mentorProfileId, status?)
 * - getMenteeSessions(menteeId, status?)
 * - bookSession(request)
 * - respondToBooking(sessionId, mentorUserId, accept, message?)
 * - cancelBooking(sessionId, userId, reason?)
 * - completeSession(sessionId, mentorUserId, notes?)
 * - rateSession(sessionId, menteeId, rating, feedback?)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=mentor-scheduling.routes.d.ts.map