/**
 * Concierge Routes
 * AI Concierge / Career coaching assistant endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import * as conciergeService from '../services/concierge.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route POST /api/concierge/chat
 * @desc Send a message to the AI Concierge
 * @access Private
 */
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await conciergeService.chat(userId, message, conversationHistory || []);
    res.json(response);
  } catch (error: any) {
    logger.error('Concierge chat error', { error });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * @route GET /api/concierge/suggestions
 * @desc Get proactive suggestions based on user context
 * @access Private
 */
router.get('/suggestions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const suggestions = await conciergeService.getProactiveSuggestions(userId);
    res.json({ suggestions });
  } catch (error: any) {
    logger.error('Failed to get suggestions', { error });
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * @route POST /api/concierge/intent
 * @desc Process a specific intent directly
 * @access Private
 */
router.post('/intent', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { intent, parameters } = req.body;

    if (!intent) {
      return res.status(400).json({ error: 'Intent is required' });
    }

    const result = await conciergeService.handleIntent(userId, intent, parameters || {});
    res.json(result);
  } catch (error: any) {
    logger.error('Intent processing error', { error });
    res.status(500).json({ error: 'Failed to process intent' });
  }
});

/**
 * @route GET /api/concierge/faq
 * @desc Search FAQ knowledge base
 * @access Public
 */
router.get('/faq', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const faq = conciergeService.searchFAQ(q as string);
    res.json({ results: faq });
  } catch (error: any) {
    logger.error('FAQ search error', { error });
    res.status(500).json({ error: 'Failed to search FAQ' });
  }
});

/**
 * @route GET /api/concierge/onboarding
 * @desc Get personalized onboarding steps
 * @access Private
 */
router.get('/onboarding', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const steps = await conciergeService.getOnboardingSteps(userId);
    res.json({ steps });
  } catch (error: any) {
    logger.error('Failed to get onboarding steps', { error });
    res.status(500).json({ error: 'Failed to get onboarding steps' });
  }
});

export default router;
