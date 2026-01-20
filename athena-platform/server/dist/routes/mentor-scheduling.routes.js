"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const mentor_scheduling_service_1 = __importDefault(require("../services/mentor-scheduling.service"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * @route GET /api/mentoring/mentors
 * @desc Get available mentors with optional filters
 * @access Private
 */
router.get('/mentors', auth_1.authenticate, async (req, res) => {
    try {
        const { specialization, maxHourlyRate, minRating } = req.query;
        const mentors = await mentor_scheduling_service_1.default.getAvailableMentors({
            specialization: specialization,
            maxHourlyRate: maxHourlyRate ? Number(maxHourlyRate) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        });
        res.json({ mentors });
    }
    catch (error) {
        logger_1.logger.error('Failed to get available mentors', { error });
        res.status(500).json({ error: 'Failed to get mentors' });
    }
});
/**
 * @route GET /api/mentoring/availability/:mentorProfileId
 * @desc Get mentor's availability settings
 * @access Private
 */
router.get('/availability/:mentorProfileId', auth_1.authenticate, async (req, res) => {
    try {
        const { mentorProfileId } = req.params;
        const availability = await mentor_scheduling_service_1.default.getMentorAvailability(mentorProfileId);
        if (!availability) {
            return res.status(404).json({ error: 'Mentor profile not found' });
        }
        res.json(availability);
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentor availability', { error });
        res.status(500).json({ error: 'Failed to get availability' });
    }
});
/**
 * @route PUT /api/mentoring/availability/:mentorProfileId
 * @desc Update mentor's availability (on/off)
 * @access Private (Mentor)
 */
router.put('/availability/:mentorProfileId', auth_1.authenticate, async (req, res) => {
    try {
        const { mentorProfileId } = req.params;
        const { isAvailable } = req.body;
        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({ error: 'isAvailable must be a boolean' });
        }
        const availability = await mentor_scheduling_service_1.default.setMentorAvailability(mentorProfileId, isAvailable);
        if (!availability) {
            return res.status(404).json({ error: 'Mentor profile not found' });
        }
        res.json({
            message: 'Availability updated',
            availability,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update availability', { error });
        res.status(500).json({ error: 'Failed to update availability' });
    }
});
/**
 * @route GET /api/mentoring/sessions/mentor/:mentorProfileId
 * @desc Get sessions for a mentor
 * @access Private (Mentor)
 */
router.get('/sessions/mentor/:mentorProfileId', auth_1.authenticate, async (req, res) => {
    try {
        const { mentorProfileId } = req.params;
        const { status } = req.query;
        const sessions = await mentor_scheduling_service_1.default.getMentorSessions(mentorProfileId, status);
        res.json({ sessions });
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentor sessions', { error });
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});
/**
 * @route GET /api/mentoring/sessions/mentee
 * @desc Get current user's sessions as mentee
 * @access Private
 */
router.get('/sessions/mentee', auth_1.authenticate, async (req, res) => {
    try {
        const menteeId = req.user.id;
        const { status } = req.query;
        const sessions = await mentor_scheduling_service_1.default.getMenteeSessions(menteeId, status);
        res.json({ sessions });
    }
    catch (error) {
        logger_1.logger.error('Failed to get mentee sessions', { error });
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});
/**
 * @route POST /api/mentoring/book
 * @desc Book a mentoring session
 * @access Private
 */
router.post('/book', auth_1.authenticate, async (req, res) => {
    try {
        const menteeId = req.user.id;
        const { mentorProfileId, scheduledAt, durationMinutes, sessionType, topics, message, timezone } = req.body;
        if (!mentorProfileId || !scheduledAt) {
            return res.status(400).json({
                error: 'Mentor profile ID and scheduled time are required'
            });
        }
        const booking = await mentor_scheduling_service_1.default.bookSession({
            mentorProfileId,
            menteeId,
            scheduledAt: new Date(scheduledAt),
            durationMinutes: durationMinutes || 60,
            sessionType,
            topics: topics || [],
            message,
            timezone: timezone || 'America/New_York',
        });
        if (!booking) {
            return res.status(400).json({ error: 'Failed to book session. Check availability.' });
        }
        res.status(201).json({
            message: 'Session booked successfully',
            booking,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to book session', { error });
        res.status(400).json({ error: error.message || 'Failed to book session' });
    }
});
/**
 * @route POST /api/mentoring/respond/:sessionId
 * @desc Confirm or reject a booking (Mentor)
 * @access Private (Mentor)
 */
router.post('/respond/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        const mentorUserId = req.user.id;
        const { sessionId } = req.params;
        const { accept, message } = req.body;
        if (typeof accept !== 'boolean') {
            return res.status(400).json({ error: 'accept must be a boolean' });
        }
        const result = await mentor_scheduling_service_1.default.respondToBooking(sessionId, mentorUserId, accept, message);
        if (!result) {
            return res.status(400).json({ error: 'Failed to respond to booking' });
        }
        res.json({
            message: accept ? 'Session confirmed' : 'Session declined',
            booking: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to respond to booking', { error });
        res.status(400).json({ error: error.message || 'Failed to respond' });
    }
});
/**
 * @route POST /api/mentoring/cancel/:sessionId
 * @desc Cancel a booking
 * @access Private
 */
router.post('/cancel/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;
        const { reason } = req.body;
        const result = await mentor_scheduling_service_1.default.cancelBooking(sessionId, userId, reason);
        if (!result) {
            return res.status(400).json({ error: 'Failed to cancel session' });
        }
        res.json({
            message: 'Session cancelled',
            booking: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to cancel session', { error });
        res.status(400).json({ error: error.message || 'Failed to cancel' });
    }
});
/**
 * @route POST /api/mentoring/complete/:sessionId
 * @desc Mark a session as complete (Mentor)
 * @access Private (Mentor)
 */
router.post('/complete/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        const mentorUserId = req.user.id;
        const { sessionId } = req.params;
        const { notes } = req.body;
        const result = await mentor_scheduling_service_1.default.completeSession(sessionId, mentorUserId, notes);
        if (!result) {
            return res.status(400).json({ error: 'Failed to complete session' });
        }
        res.json({
            message: 'Session completed',
            booking: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to complete session', { error });
        res.status(400).json({ error: error.message || 'Failed to complete' });
    }
});
/**
 * @route POST /api/mentoring/rate/:sessionId
 * @desc Rate a completed session (Mentee)
 * @access Private (Mentee)
 */
router.post('/rate/:sessionId', auth_1.authenticate, async (req, res) => {
    try {
        const menteeId = req.user.id;
        const { sessionId } = req.params;
        const { rating, feedback } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        const success = await mentor_scheduling_service_1.default.rateSession(sessionId, menteeId, rating, feedback);
        if (!success) {
            return res.status(400).json({ error: 'Failed to rate session' });
        }
        res.json({
            message: 'Thank you for your feedback!',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to rate session', { error });
        res.status(400).json({ error: error.message || 'Failed to rate session' });
    }
});
/**
 * @route GET /api/mentoring/timezones
 * @desc Get list of supported timezones
 * @access Public
 */
router.get('/timezones', (_req, res) => {
    res.json({ timezones: mentor_scheduling_service_1.default.SUPPORTED_TIMEZONES });
});
exports.default = router;
//# sourceMappingURL=mentor-scheduling.routes.js.map