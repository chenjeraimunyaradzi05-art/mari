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

/**
 * @route POST /api/concierge/intent
 * @desc Process a specific intent directly
 * @access Private
 */
router.post('/intent', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { intent, parameters } = req.body;

    if (!intent) {
      return res.status(400).json({ error: 'Intent is required' });
    }

    const result = await conciergeService.handleIntent(userId, intent, parameters || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/concierge/faq
 * @desc Search FAQ knowledge base
 * @access Public
 */
router.get('/faq', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const faq = conciergeService.searchFAQ(q as string);
    res.json({ results: faq });
  } catch (error) {
    next(error);
  }
});

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
