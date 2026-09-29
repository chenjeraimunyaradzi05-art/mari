import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The concierge's instant answers.
 *
 * They were an eight-entry literal: a new or corrected answer needed a
 * deploy, and three of them promised things the product does not do. Staff
 * now publish an answer as a blog article tagged `faq`, with the phrases it
 * answers as its other tags; it is checked before the built-in answers and
 * comes with a link to the whole article.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    article: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { resetFaqCache } from '../../services/concierge.service';

const prisma: any = prismaTyped;
const ask = (message: string) => request(app).post('/api/concierge/chat').send({ message }).expect(200);

const faqArticle = (over: Record<string, unknown> = {}) => ({
  slug: 'setting-up-job-alerts',
  title: 'Setting up job alerts',
  excerpt: 'Open Settings, then Notifications, and switch on Job Matches for email or push.',
  body: '# Job alerts\nLonger guidance.',
  tags: ['faq', 'job-alerts', 'job-match', 'cv'],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  resetFaqCache();
  prisma.article.findMany.mockResolvedValue([]);
});

describe('Concierge instant answers', () => {
  it('answers from an article staff published, with a link to it, before the built-in answer', async () => {
    prisma.article.findMany.mockResolvedValue([faqArticle()]);

    const res = await ask('How do I set up Job Alerts?');

    expect(res.body.message).toBe('Open Settings, then Notifications, and switch on Job Matches for email or push.');
    expect(res.body.actions).toEqual([{ type: 'learn', label: 'Read the full answer', target: '/blog/setting-up-job-alerts' }]);
    expect(prisma.article.findMany.mock.calls[0][0].where).toEqual({ status: 'PUBLISHED', tags: { has: 'faq' } });
  });

  it('ignores a tag too short to be a phrase, so it does not match inside ordinary words', async () => {
    prisma.article.findMany.mockResolvedValue([faqArticle({ tags: ['faq', 'cv'] })]);
    const res = await ask('can you review my cv before I apply');
    expect(res.body.message).not.toContain('Job Matches');
  });

  it('falls back to the built-in answers, which no longer promise what the product does not do', async () => {
    const mentors = await ask('where do I find mentors');
    expect(mentors.body.message).toContain('Mentors section');
    expect(mentors.body.message).not.toMatch(/priority/i);

    const premium = await ask('what are the premium benefits');
    expect(premium.body.message).toContain('Pricing page');
    expect(premium.body.message).not.toMatch(/unlimited/i);

    const deletion = await ask('how do i delete account');
    expect(deletion.body.message).toContain('cannot be undone');
    expect(deletion.body.message).not.toContain('30 days');
  });

  it('reads the articles once in five minutes, but tries again at once after a failed read', async () => {
    prisma.article.findMany.mockRejectedValueOnce(new Error('db down'));
    const first = await ask('job alerts please');
    expect(first.body.message).toContain('Job Matches');
    expect(first.body.actions).toBeUndefined();

    prisma.article.findMany.mockResolvedValue([faqArticle()]);
    const second = await ask('job alerts please');
    expect(second.body.actions?.[0]?.target).toBe('/blog/setting-up-job-alerts');

    await ask('job match settings');
    expect(prisma.article.findMany).toHaveBeenCalledTimes(2);
  });
});
