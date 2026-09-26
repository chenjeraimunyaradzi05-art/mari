/**
 * Concierge Routes
 * AI Concierge / Career coaching assistant endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as conciergeService from '../services/concierge.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route POST /api/concierge/chat
 * @desc Send a message to the AI Concierge
 * @access Private
 */
router.post('/chat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { message, conversationHistory, currentPage } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // chat(message, context, history) — passing the user id first meant the
    // assistant received the caller's id as their question, built its context
    // from an undefined user id, and never saw what was actually asked.
    const response = await conciergeService.chat(
      message,
      { userId: user.id, persona: user.persona, currentPage },
      conversationHistory || []
    );
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/concierge/suggestions
 * @desc Get proactive suggestions based on user context
 * @access Private
 */
router.get('/suggestions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const suggestions = await conciergeService.getProactiveSuggestions(userId);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

/*
 * POST /intent and GET /faq used to sit here. No client called either: the
 * web panel talks to /chat and /suggestions, and the onboarding checklist to
 * /onboarding. /intent had also never worked — it passed the member's id
 * where the intent belonged, so every call fell through to the default reply
 * — and /faq searched the same eight-line literal /chat already answers from.
 * Two routes nothing used, one of them broken, were two more things to keep
 * safe for no one; they and the functions only they called are gone.
 */

/**
 * @route GET /api/concierge/onboarding
 * @desc Get personalized onboarding steps
 * @access Private
 */
router.get('/onboarding', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const steps = await conciergeService.getOnboardingSteps(userId);
    res.json({ steps });
  } catch (error) {
    next(error);
  }
});

export default router;
