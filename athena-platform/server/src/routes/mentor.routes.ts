/**
 * Mentor Routes
 * API endpoints for mentorship marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import * as mentorService from '../services/mentor.service';

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
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('minRate').optional().isFloat({ min: 0 }),
    query('maxRate').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: mentorService.MentorFilters = {
        specialization: req.query.specialization as string,
        minRate: req.query.minRate ? parseFloat(req.query.minRate as string) : undefined,
        maxRate: req.query.maxRate ? parseFloat(req.query.maxRate as string) : undefined,
        available: req.query.available === 'true',
        search: req.query.search as string,
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await mentorService.getMentors(filters, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/mentors/profile/:userId
 * Get public mentor profile
 */
router.get('/profile/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await mentorService.getMentorProfile(req.params.userId);
    if (!profile) {
      throw new ApiError(404, 'Mentor profile not found');
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

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
router.post('/enable', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
router.post('/onboard', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  [query('role').isIn(['mentor', 'mentee'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = (req.query.role as 'mentor' | 'mentee') || 'mentee';
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

export default router;
