/**
 * Mentor Routes
 * API endpoints for mentorship marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { z } from 'zod';
import { zodQuery } from '../middleware/validate';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { isWomanVerified, requireAdultAccount, womanGateState } from '../middleware/account-gates';
import * as mentorService from '../services/mentor.service';
import { answerSessionDispute, forMember, openSessionDispute } from '../services/service-disputes.service';
import * as mentorScheduling from '../services/mentor-scheduling.service';
import { MENTOR_BOOKING_HORIZON_DAYS } from '../services/escrow-deadline';
import { mayOpenMemberPage } from '../services/audience.service';
import { clampLimit, clampPage } from '../utils/pagination';
import { directoryReadLimiter } from '../middleware/rateLimiter';
import { startingAPayment } from '../middleware/moneyLimits';

const router = Router();

// ==========================================
// PUBLIC / SEMI-PUBLIC ENDPOINTS
// ==========================================

/**
 * GET /api/mentors
 * Search for mentors
 */
router.get(
  '/',
  // optionalAuth so the directory stays browsable while signed out, but a
  // signed-in viewer's blocks are known and can be applied. Members who asked
  // to be hidden are excluded either way.
  optionalAuth,
  // Counted per member, or per address for a visitor, after the session is known.
  directoryReadLimiter,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('minRate').optional().isFloat({ min: 0 }),
    query('maxRate').optional().isFloat({ min: 0 }),
    query('sortBy').optional().isIn(mentorService.MENTOR_SORTS),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // The validators were declared and never read.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const filters: mentorService.MentorFilters = {
        specialization: req.query.specialization as string,
        minRate: req.query.minRate ? parseFloat(req.query.minRate as string) : undefined,
        maxRate: req.query.maxRate ? parseFloat(req.query.maxRate as string) : undefined,
        available: req.query.available === 'true',
        search: req.query.search as string,
        // The directory's sort control sends `sortBy`, and nothing read it, so
        // every option on it showed the same order.
        sort: req.query.sortBy as mentorService.MentorSort | undefined,
      };

      // The validators above refuse a limit over 100, but only if they run; the
      // read itself is bounded too, so the ceiling does not depend on them.
      const page = clampPage(req.query.page);
      const limit = clampLimit(req.query.limit, 20, 100);

      const result = await mentorService.getMentors(filters, page, limit, req.user?.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/mentors/profile/:userId
 * Get public mentor profile
 *
 * The page names a mentor by her name, picture, headline and bio, so it is
 * opened only by a viewer who may be shown her (mayOpenMemberPage): the
 * directory already leaves out a mentor who hid herself, who is in Safe Mode,
 * or who is across a block, and a link must not be the way round that.
 */
router.get('/profile/:userId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await mentorService.getMentorProfile(req.params.userId);
    if (!profile || !(await mayOpenMemberPage(req.user, profile.userId))) {
      throw new ApiError(404, 'Mentor profile not found');
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mentors/timezones
 * The timezones a session can be booked in.
 *
 * Declared before `/:mentorId` so it is not read as a profile id.
 */
router.get('/timezones', (_req: Request, res: Response) => {
  res.json({ timezones: mentorScheduling.getSupportedTimezones() });
});

/**
 * GET /api/mentors/me
 * The caller's own mentor profile, or null when she has none.
 *
 * Declared before `/:mentorId` so "me" is not read as a profile id. There was
 * no way for a mentor to read her own profile back, so the wizard could not
 * start from what she had already published, and the dashboard could not show
 * whether she was taking requests.
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await mentorService.getMentorProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/mentors/me/availability
 * Pause or resume new requests. See `setMentorAvailability`.
 */
router.patch(
  '/me/availability',
  authenticate,
  [body('isAvailable').isBoolean().toBoolean()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Say whether you are taking new requests (isAvailable: true or false).');
      }

      const profile = await mentorService.setMentorAvailability(req.user!.id, req.body.isAvailable);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/mentors/:mentorId/slots
 * The times this mentor is actually free on a given day.
 *
 * Without this a booker picks a time blind and finds out it does not suit only
 * when the mentor declines. `date` is a calendar day read in `timezone`, which
 * defaults to the caller's saved timezone and then to the platform default.
 */
router.get(
  '/:mentorId/slots',
  optionalAuth,
  [query('date').optional().isISO8601(), query('timezone').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const requested = req.query.timezone as string | undefined;
      const timezone =
        requested && mentorScheduling.isValidTimezone(requested)
          ? requested
          : await mentorScheduling.getUserTimezone(req.user?.id);

      const date = req.query.date ? new Date(req.query.date as string) : new Date();

      const slots = await mentorScheduling.getAvailableSlots(req.params.mentorId, date, timezone);

      res.json({
        timezone,
        date: date.toISOString(),
        // How far ahead a paid session can be booked, so the page can stop offering
        // days no time exists on. A mentor who charges nothing has no such limit.
        paidSessionsDaysAhead: MENTOR_BOOKING_HORIZON_DAYS,
        slots: slots.map(slot => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          displayTime: slot.displayTime,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// PROTECTED ENDPOINTS
// ==========================================

/**
 * POST /api/mentors/me
 * Create or update own mentor profile
 */
router.post(
  '/me',
  authenticate,
  [
    body('specializations').optional().isArray(),
    body('hourlyRate').optional().isFloat({ min: 0 }),
    body('yearsExperience').optional().isInt({ min: 0 }),
    body('isAvailable').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      // Becoming a mentor is the one place ATHENA presents a member to
      // strangers as checked and then takes their money for the introduction.
      // The confidential housing surfaces deliberately accept Safe Mode instead
      // of a completed check, because a woman leaving violence needs a place
      // tonight; nobody needs to start charging for mentoring tonight, so this
      // asks for the check itself. Editing a profile that already exists is not
      // gated: the promise was made when it was published, and locking an
      // existing mentor out of her own rate card would fix nothing.
      const alreadyAMentor = await mentorService.hasMentorProfile(req.user!.id);
      if (!alreadyAMentor) {
        const state = await womanGateState(req.user!.id);
        if (!isWomanVerified(state)) {
          throw new ApiError(
            403,
            'Mentors are listed as verified members, so finish the women-only check before you publish a mentor profile. It is in Settings, under Verification.'
          );
        }
      }

      const profile = await mentorService.updateMentorProfile(req.user!.id, req.body);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/mentors/enable
 * Enable mentor monetization (Stripe Connect)
 */
router.post('/enable', authenticate, requireAdultAccount, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await mentorService.enableMentorMonetization(req.user!.id);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mentors/onboard
 * Generate Stripe Express onboarding link
 */
router.post('/onboard', authenticate, requireAdultAccount, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = await mentorService.generateMentorStripeOnboardingLink(req.user!.id);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mentors/stripe-login
 * Generate Stripe Express dashboard login link
 */
router.post('/stripe-login', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = await mentorService.generateMentorStripeLoginLink(req.user!.id);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mentors/:mentorId/book
 * Request a session
 */
router.post(
  '/:mentorId/book',
  authenticate,
  startingAPayment,
  [
    body('scheduledAt').isISO8601().withMessage('Valid date required'),
    body('durationMinutes').optional().isInt({ min: 15, max: 240 }),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const result = await mentorService.requestSession(
        req.user!.id,
        req.params.mentorId,
        {
          scheduledAt: new Date(req.body.scheduledAt),
          durationMinutes: req.body.durationMinutes,
          note: req.body.note,
        }
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/mentors/sessions
 * Get sessions for the current user
 */
router.get(
  '/sessions',
  authenticate,
  // The chain that was here (role is mentor or mentee) was declared and never
  // read, so `?role=admin` went to the service as it was. Absent still means
  // her own sessions as a mentee, which is what the handler always did.
  zodQuery(z.object({ role: z.enum(['mentor', 'mentee']).default('mentee') })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as unknown as 'mentor' | 'mentee';
      const sessions = await mentorService.getUserSessions(req.user!.id, role);
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/mentors/sessions/:sessionId/status
 * Update session status (e.g., mentor accepting, or cancelling)
 */
router.patch(
  '/sessions/:sessionId/status',
  authenticate,
  [
    body('status').isIn(['CONFIRMED', 'CANCELED', 'COMPLETED']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const session = await mentorService.getSession(req.params.sessionId);
      
      if (!session) throw new ApiError(404, 'Session not found');
      
      let derivedActionBy: 'mentor' | 'mentee';
      if (session.menteeId === req.user!.id) {
        derivedActionBy = 'mentee';
      } else if (session.mentorProfile.userId === req.user!.id) {
        derivedActionBy = 'mentor';
      } else {
        throw new ApiError(403, 'Not authorized');
      }

      const updated = await mentorService.updateSessionStatus(
        req.params.sessionId,
        req.user!.id,
        req.body.status,
        derivedActionBy
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/mentors/sessions/:sessionId/payment-intent
 * The client secret to authorise a pending session payment (mentee only).
 */
router.post('/sessions/:sessionId/payment-intent', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await mentorService.getSessionPaymentSecret(req.params.sessionId, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/mentors/sessions/:sessionId/dispute
 * The mentee says a paid session did not take place (mentee only).
 *
 * The card stays held, or a charge already made is not paid on, while ATHENA's
 * team decides. See service-disputes.service for when it is open to her.
 */
router.post(
  '/sessions/:sessionId/dispute',
  authenticate,
  [body('reason').isString().trim().isLength({ min: 5, max: 2000 }).withMessage('Tell us what went wrong, in 5 to 2000 characters')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const session = await openSessionDispute(req.params.sessionId, req.user!.id, req.body.reason);
      res.status(201).json({ success: true, data: forMember(session) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/mentors/sessions/:sessionId/dispute/respond
 * The mentor's one answer to a session in dispute (the session's mentor only).
 */
router.post(
  '/sessions/:sessionId/dispute/respond',
  authenticate,
  [body('response').isString().trim().isLength({ min: 5, max: 2000 }).withMessage('Write your answer, in 5 to 2000 characters')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const session = await answerSessionDispute(req.params.sessionId, req.user!.id, req.body.response);
      res.json({ success: true, data: forMember(session) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/mentors/sessions/:sessionId
 * Reschedule a session
 */
router.patch(
  '/sessions/:sessionId',
  authenticate,
  [
    body('scheduledAt').isISO8601().withMessage('Valid date required'),
    body('durationMinutes').optional().isInt({ min: 15, max: 240 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const updated = await mentorService.rescheduleSession(
        req.params.sessionId,
        req.user!.id,
        {
          scheduledAt: new Date(req.body.scheduledAt),
          durationMinutes: req.body.durationMinutes ? Number(req.body.durationMinutes) : undefined,
        }
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/mentors/:mentorId
 * Get mentor profile by mentor profile id
 */
router.get('/:mentorId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await mentorService.getMentorProfileById(req.params.mentorId);
    if (!profile || !(await mayOpenMemberPage(req.user, profile.userId))) {
      throw new ApiError(404, 'Mentor profile not found');
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

export default router;
