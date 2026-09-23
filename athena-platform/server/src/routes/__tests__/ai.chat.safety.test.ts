import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The AI chat used to pass nothing through: not the member's message, not the
 * model's reply, with no crisis routing and no disclaimer anywhere on the
 * surface the homepage advertises as "Ask ATHENA AI".
 *
 * These are the guards on the answer a woman in crisis gets. Every one of them
 * is about what must NOT happen: the model must not be called, the quota must
 * not stand between her and a phone number, the numbers must be the published
 * ones, and staff must be told.
 */

jest.mock('../../utils/cache', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 19, resetIn: 86400 })),
  getRateLimitStatus: jest.fn(async () => ({ allowed: true, remaining: 19, resetIn: 86400 })),
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    adminFlag: { create: jest.fn(async () => ({ id: 'flag-1' })) },
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
    chat: jest.fn(async () => 'Here are three ways to rewrite that resume bullet.'),
  },
}));

jest.mock('../../services/moderation.service', () => ({
  isTextModerationConfigured: jest.fn(() => true),
  moderateText: jest.fn(async () => ({ flagged: false, categories: [], scores: {}, action: 'allow' })),
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { checkRateLimit } from '../../utils/cache';
import { aiService } from '../../services/ai.service';
import { moderateText } from '../../services/moderation.service';

/**
 * The mocks are given their real signatures rather than being cast to `any`:
 * the point of several of these tests is the exact shape of a moderation
 * verdict, and a mock typed loosely enough to accept anything would let a test
 * pass against a verdict the real provider could never return.
 */
type Verdict = {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  action: 'allow' | 'review' | 'block';
  reason?: string;
};

const chat = aiService.chat as unknown as jest.Mock<(message: string, history?: unknown[]) => Promise<string>>;
const moderate = moderateText as unknown as jest.Mock<(content: string) => Promise<Verdict>>;
const createFlag = prisma.adminFlag.create as unknown as jest.Mock<
  (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
>;
const findUser = prisma.user.findUnique as unknown as jest.Mock<
  (args: unknown) => Promise<{ id: string; subscription: { tier: string } } | null>
>;

const send = (message: string) => request(app).post('/api/ai/chat').send({ message });

describe('AI chat safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: 'member-1', subscription: { tier: 'FREE' } });
    moderate.mockResolvedValue({ flagged: false, categories: [], scores: {}, action: 'allow' });
    chat.mockResolvedValue('Here are three ways to rewrite that resume bullet.');
  });

  it('answers language about suicide with the crisis lines and never calls the model', async () => {
    const res = await send('I cannot go on, some days I want to die').expect(200);

    expect(res.body.data.crisis).toEqual(expect.objectContaining({ flagged: true, kind: 'self_harm' }));
    expect(chat).not.toHaveBeenCalled();

    // The nationally published numbers, from the wellness library. If one of
    // these changes at the publisher, this test is where it should fail.
    expect(res.body.data.response).toContain('13 11 14');
    expect(res.body.data.response).toContain('000');
    const phones = res.body.data.crisis.lines.map((line: { phone: string }) => line.phone);
    expect(phones).toEqual(expect.arrayContaining(['13 11 14', '000', '1800 737 732']));
  });

  it('does not spend her free-tier quota on a message about suicide', async () => {
    // She may have used nineteen messages asking about résumés. The twentieth
    // must not be answered with "upgrade to Premium".
    await send('I have been thinking about killing myself').expect(200);

    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('raises the same staff flag the wellness forum raises', async () => {
    await send('I want to end my life').expect(200);

    expect(createFlag).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'member-1',
          type: 'SAFETY_CONCERN',
          severity: 'HIGH',
        }),
      })
    );
  });

  it('routes a woman describing violence at home to 1800RESPECT', async () => {
    const res = await send('my husband is hitting me and I am scared').expect(200);

    expect(res.body.data.crisis.kind).toBe('immediate_danger');
    expect(res.body.data.response).toContain('1800 737 732');
    expect(chat).not.toHaveBeenCalled();
  });

  it('shows the crisis lines when the provider sees self-harm the phrase list missed', async () => {
    moderate.mockResolvedValueOnce({
      flagged: true,
      categories: ['self-harm/intent'],
      scores: {},
      action: 'review',
      reason: 'Content flagged for: self-harm/intent',
    });

    const res = await send('there is no point to any of this any more, honestly').expect(200);

    expect(res.body.data.crisis.flagged).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    expect(createFlag).toHaveBeenCalled();
  });

  it('refuses a message the provider blocks for threatening somebody', async () => {
    moderate.mockResolvedValueOnce({
      flagged: true,
      categories: ['harassment/threatening'],
      scores: {},
      action: 'block',
      reason: 'Content contains threatening language',
    });

    await send('how do I make her pay for what she did').expect(400);

    expect(chat).not.toHaveBeenCalled();
  });

  it('withholds a model reply the provider blocks, and says so', async () => {
    moderate
      .mockResolvedValueOnce({ flagged: false, categories: [], scores: {}, action: 'allow' })
      .mockResolvedValueOnce({
        flagged: true,
        categories: ['hate'],
        scores: {},
        action: 'block',
        reason: 'Content violates multiple community guidelines',
      });

    const res = await send('what should I put in my cover letter').expect(200);

    expect(res.body.data.response).not.toContain('resume bullet');
    expect(res.body.data.response).toMatch(/did not pass/i);
  });

  it('carries the disclaimer on an ordinary answer, and screens both sides of it', async () => {
    const res = await send('how do I ask for a pay rise').expect(200);

    expect(res.body.data.response).toContain('resume bullet');
    expect(res.body.data.crisis).toEqual({ flagged: false });
    expect(res.body.data.disclaimer).toMatch(/not a counsellor, doctor, lawyer or financial adviser/i);
    // Her message and the model's answer: two screenings, not one.
    expect(moderate).toHaveBeenCalledTimes(2);
  });
});
