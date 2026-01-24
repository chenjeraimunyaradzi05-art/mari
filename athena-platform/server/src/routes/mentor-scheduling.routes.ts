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

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import mentorSchedulingService from '../services/mentor-scheduling.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/mentoring/mentors
 * @desc Get available mentors with optional filters
 * @access Private
 */
router.get('/mentors', authenticate, async (req: Request, res: Response) => {
  try {
    const { specialization, maxHourlyRate, minRating } = req.query;

    const mentors = await mentorSchedulingService.getAvailableMentors({
      specialization: specialization as string | undefined,
      maxHourlyRate: maxHourlyRate ? Number(maxHourlyRate) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    });

    res.json({ mentors });
  } catch (error: any) {
    logger.error('Failed to get available mentors', { error });
    res.status(500).json({ error: 'Failed to get mentors' });
  }
});

/**
 * @route GET /api/mentoring/availability/:mentorProfileId
 * @desc Get mentor's availability settings
 * @access Private
 */
router.get('/availability/:mentorProfileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { mentorProfileId } = req.params;
    const availability = await mentorSchedulingService.getMentorAvailability(mentorProfileId);

    if (!availability) {
      return res.status(404).json({ error: 'Mentor profile not found' });
    }

    res.json(availability);
  } catch (error: any) {
    logger.error('Failed to get mentor availability', { error });
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

/**
 * @route PUT /api/mentoring/availability/:mentorProfileId
 * @desc Update mentor's availability (on/off)
 * @access Private (Mentor)
 */
router.put('/availability/:mentorProfileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { mentorProfileId } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean' });
    }

    const availability = await mentorSchedulingService.setMentorAvailability(
      mentorProfileId,
      isAvailable
    );

    if (!availability) {
      return res.status(404).json({ error: 'Mentor profile not found' });
    }

    res.json({
      message: 'Availability updated',
      availability,
    });
  } catch (error: any) {
    logger.error('Failed to update availability', { error });
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

/**
 * @route GET /api/mentoring/sessions/mentor/:mentorProfileId
 * @desc Get sessions for a mentor
 * @access Private (Mentor)
 */
router.get('/sessions/mentor/:mentorProfileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { mentorProfileId } = req.params;
    const { status } = req.query;

    const sessions = await mentorSchedulingService.getMentorSessions(
      mentorProfileId,
      status as any
    );

    res.json({ sessions });
  } catch (error: any) {
    logger.error('Failed to get mentor sessions', { error });
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * @route GET /api/mentoring/sessions/mentee
 * @desc Get current user's sessions as mentee
 * @access Private
 */
router.get('/sessions/mentee', authenticate, async (req: Request, res: Response) => {
  try {
    const menteeId = (req as any).user.id;
    const { status } = req.query;

    const sessions = await mentorSchedulingService.getMenteeSessions(
      menteeId,
      status as any
    );

    res.json({ sessions });
  } catch (error: any) {
    logger.error('Failed to get mentee sessions', { error });
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * @route POST /api/mentoring/book
 * @desc Book a mentoring session
 * @access Private
 */
router.post('/book', authenticate, async (req: Request, res: Response) => {
  try {
    const menteeId = (req as any).user.id;
    const { 
      mentorProfileId, 
      scheduledAt, 
      durationMinutes,
      sessionType, 
      topics, 
      message,
      timezone 
    } = req.body;

    if (!mentorProfileId || !scheduledAt) {
      return res.status(400).json({ 
        error: 'Mentor profile ID and scheduled time are required' 
      });
    }

    const booking = await mentorSchedulingService.bookSession({
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
  } catch (error: any) {
    logger.error('Failed to book session', { error });
    res.status(400).json({ error: 'Failed to book session' });
  }
});

/**
 * @route POST /api/mentoring/respond/:sessionId
 * @desc Confirm or reject a booking (Mentor)
 * @access Private (Mentor)
 */
router.post('/respond/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const mentorUserId = (req as any).user.id;
    const { sessionId } = req.params;
    const { accept, message } = req.body;

    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'accept must be a boolean' });
    }

    const result = await mentorSchedulingService.respondToBooking(
      sessionId,
      mentorUserId,
      accept,
      message
    );

    if (!result) {
      return res.status(400).json({ error: 'Failed to respond to booking' });
    }

    res.json({
      message: accept ? 'Session confirmed' : 'Session declined',
      booking: result,
    });
  } catch (error: any) {
    logger.error('Failed to respond to booking', { error });
    res.status(400).json({ error: 'Failed to respond to booking' });
  }
});

/**
 * @route POST /api/mentoring/cancel/:sessionId
 * @desc Cancel a booking
 * @access Private
 */
router.post('/cancel/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { sessionId } = req.params;
    const { reason } = req.body;

    const result = await mentorSchedulingService.cancelBooking(sessionId, userId, reason);

    if (!result) {
      return res.status(400).json({ error: 'Failed to cancel session' });
    }

    res.json({
      message: 'Session cancelled',
      booking: result,
    });
  } catch (error: any) {
    logger.error('Failed to cancel session', { error });
    res.status(400).json({ error: 'Failed to cancel session' });
  }
});

/**
 * @route POST /api/mentoring/complete/:sessionId
 * @desc Mark a session as complete (Mentor)
 * @access Private (Mentor)
 */
router.post('/complete/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const mentorUserId = (req as any).user.id;
    const { sessionId } = req.params;
    const { notes } = req.body;

    const result = await mentorSchedulingService.completeSession(
      sessionId,
      mentorUserId,
      notes
    );

    if (!result) {
      return res.status(400).json({ error: 'Failed to complete session' });
    }

    res.json({
      message: 'Session completed',
      booking: result,
    });
  } catch (error: any) {
    logger.error('Failed to complete session', { error });
    res.status(400).json({ error: 'Failed to complete session' });
  }
});

/**
 * @route POST /api/mentoring/rate/:sessionId
 * @desc Rate a completed session (Mentee)
 * @access Private (Mentee)
 */
router.post('/rate/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const menteeId = (req as any).user.id;
    const { sessionId } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const success = await mentorSchedulingService.rateSession(
      sessionId,
      menteeId,
      rating,
      feedback
    );

    if (!success) {
      return res.status(400).json({ error: 'Failed to rate session' });
    }

    res.json({
      message: 'Thank you for your feedback!',
    });
  } catch (error: any) {
    logger.error('Failed to rate session', { error });
    res.status(400).json({ error: 'Failed to rate session' });
  }
});

/**
 * @route GET /api/mentoring/timezones
 * @desc Get list of supported timezones
 * @access Public
 */
router.get('/timezones', (_req: Request, res: Response) => {
  res.json({ timezones: mentorSchedulingService.SUPPORTED_TIMEZONES });
});

export default router;
