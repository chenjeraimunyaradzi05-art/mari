import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Who the premium AI tools answer, and how they refuse everyone else.
 *
 * The web app's gate read a field no server response sets, so it locked out
 * paying members and let free ones through, and the server's own gate refused
 * with 401 — which the client's interceptor reads as an expired session and
 * answers by rotating her refresh token. These are the guards on the rule both
 * now share (GET /api/ai/access and the gate in front of every premium route)
 * and on the refusal being a 403 that says what it is.
 */

jest.mock('../../utils/cache', () => ({
  getRedisClient: jest.fn(() => null),
  checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 19, resetIn: 86400 })),
  getRateLimitStatus: jest.fn(async () => ({ allowed: true, remaining: 19, resetIn: 86400 })),
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
    job: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member@test.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/ai.service', () => ({
  aiService: {
    optimizeResume: jest.fn(async () => ({
      score: 71,
      strengths: 'Clear structure',
      weaknesses: null,
      improvements: [],
      keywordsMatched: [],
      keywordsMissing: [],
      simulated: false,
    })),
    generateInterviewQuestions: jest.fn(async () => ({
      questions: ['Walk me through a budget you have owned.'],
      tips: null,
      answers: [],
      simulated: false,
    })),
  },
}));

jest.mock('../../services/ai-budget.service', () => ({
  checkAiBudget: jest.fn(async () => ({ allowed: true })),
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { aiService } from '../../services/ai.service';
import { checkAiBudget } from '../../services/ai-budget.service';

type Standing = { tier: string; status: string } | null;

const findSubscription = prisma.subscription.findUnique as unknown as jest.Mock<(args: unknown) => Promise<Standing>>;
const optimizeResume = aiService.optimizeResume as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const generateQuestions = aiService.generateInterviewQuestions as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;
const budget = checkAiBudget as unknown as jest.Mock<(userId: string | null) => Promise<unknown>>;

const analyse = () =>
  request(app).post('/api/ai/resume-optimizer').send({ resume: 'Ten years in operations.', jobDescription: 'Ops lead' });

describe('Premium AI access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    budget.mockResolvedValue({ allowed: true });
  });

  describe('GET /api/ai/access', () => {
    it.each([
      [{ tier: 'PREMIUM_CAREER', status: 'ACTIVE' }, true],
      [{ tier: 'PREMIUM_PROFESSIONAL', status: 'TRIALING' }, true],
      [{ tier: 'PREMIUM_CAREER', status: 'PAST_DUE' }, false],
      [{ tier: 'PREMIUM_CAREER', status: 'CANCELED' }, false],
      [{ tier: 'FREE', status: 'ACTIVE' }, false],
    ])('answers %o with premium %s', async (subscription, premium) => {
      findSubscription.mockResolvedValue(subscription);

      const res = await request(app).get('/api/ai/access').expect(200);

      expect(res.body.data).toEqual({ premium, tier: subscription.tier, status: subscription.status });
    });

    it('treats a member with no subscription row as free', async () => {
      findSubscription.mockResolvedValue(null);

      const res = await request(app).get('/api/ai/access').expect(200);

      expect(res.body.data).toEqual({ premium: false, tier: 'FREE', status: null });
    });
  });

  describe('the gate on a premium route', () => {
    it('refuses a free member with 403 PREMIUM_REQUIRED, never 401, and never calls the model', async () => {
      findSubscription.mockResolvedValue({ tier: 'FREE', status: 'ACTIVE' });

      const res = await analyse();

      expect(res.status).toBe(403);
      expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'PREMIUM_REQUIRED' }));
      expect(optimizeResume).not.toHaveBeenCalled();
    });

    it('tells a member whose Premium has lapsed why, rather than offering her a plan she has', async () => {
      findSubscription.mockResolvedValue({ tier: 'PREMIUM_CAREER', status: 'PAST_DUE' });

      const res = await analyse();

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/past due/i);
      expect(optimizeResume).not.toHaveBeenCalled();
    });

    it('lets an active Premium member through and meters the call to her', async () => {
      findSubscription.mockResolvedValue({ tier: 'PREMIUM_CAREER', status: 'ACTIVE' });

      const res = await analyse().expect(200);

      expect(res.body.data.score).toBe(71);
      expect(optimizeResume).toHaveBeenCalledWith('Ten years in operations.', 'Ops lead', { userId: 'member-1' });
    });

    it('refuses with 429 once her daily AI allowance is used, before the model is called', async () => {
      findSubscription.mockResolvedValue({ tier: 'PREMIUM_CAREER', status: 'ACTIVE' });
      budget.mockResolvedValue({
        allowed: false,
        scope: 'member',
        resetIn: 3600,
        message: "You have used today's AI allowance. It resets in about 1h 1m.",
      });

      const res = await analyse();

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('3600');
      expect(optimizeResume).not.toHaveBeenCalled();
    });

    it('answers 503 when the platform budget is gone, and says it is not her account', async () => {
      findSubscription.mockResolvedValue({ tier: 'PREMIUM_CAREER', status: 'ACTIVE' });
      budget.mockResolvedValue({
        allowed: false,
        scope: 'global',
        resetIn: 600,
        message: "ATHENA's AI tools have reached today's spending limit and are paused for about 10 min. Nothing is wrong with your account, and nothing you asked for has been charged.",
      });

      const res = await analyse();

      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/Nothing is wrong with your account/);
      expect(optimizeResume).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/ai/interview-coach', () => {
    beforeEach(() => {
      findSubscription.mockResolvedValue({ tier: 'PREMIUM_CAREER', status: 'ACTIVE' });
    });

    it('draws the questions from the role she typed when there is no listing', async () => {
      const res = await request(app)
        .post('/api/ai/interview-coach')
        .send({ jobRole: 'Operations Manager', interviewType: 'behavioral' })
        .expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({ jobTitle: 'Operations Manager', company: null, questions: expect.any(Array) })
      );
      const [description, type, meter] = generateQuestions.mock.calls[0];
      expect(description).toContain('Operations Manager');
      expect(type).toBe('behavioral');
      expect(meter).toEqual({ userId: 'member-1' });
    });

    it('refuses a request that names neither a listing nor a role', async () => {
      await request(app).post('/api/ai/interview-coach').send({ interviewType: 'technical' }).expect(400);
      expect(generateQuestions).not.toHaveBeenCalled();
    });
  });
});
