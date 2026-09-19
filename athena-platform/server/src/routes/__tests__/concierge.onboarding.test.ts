import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => null),
    },
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

const prisma: any = prismaTyped;

// The one page in the web client where headline, bio and skills are edited.
// Every step must land here; the earlier paths (/dashboard/profile/edit,
// /dashboard/profile/skills, ...) were never pages.
const PROFILE_SETTINGS = '/dashboard/settings/profile';

type Step = { id: string; completed: boolean; action: string; description: string };

const fetchSteps = async (): Promise<Step[]> => {
  const res = await request(app).get('/api/concierge/onboarding');
  expect(res.status).toBe(200);
  return res.body.steps;
};

describe('GET /api/concierge/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks nothing done for a member who has just registered', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ headline: null, bio: null, profile: null, skills: [] });

    const steps = await fetchSteps();

    expect(steps.map((s) => s.id)).toEqual(['complete-profile', 'add-skills']);
    expect(steps.every((s) => s.completed === false)).toBe(true);
  });

  it('ticks the steps off once the profile really has them', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      headline: 'Product designer',
      bio: null,
      // The bio can live on Profile.aboutMe as well as User.bio.
      profile: { aboutMe: 'I build calm software for busy people.' },
      skills: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    });

    const steps = await fetchSteps();

    expect(steps.find((s) => s.id === 'complete-profile')?.completed).toBe(true);
    expect(steps.find((s) => s.id === 'add-skills')?.completed).toBe(true);
    expect(steps.find((s) => s.id === 'add-skills')?.description).toContain('3 skills');
  });

  it('two skills is not enough, and a headline without a bio is not a profile', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      headline: 'Product designer',
      bio: '   ',
      profile: { aboutMe: null },
      skills: [{ id: 's1' }, { id: 's2' }],
    });

    const steps = await fetchSteps();

    expect(steps.find((s) => s.id === 'complete-profile')?.completed).toBe(false);
    expect(steps.find((s) => s.id === 'add-skills')?.completed).toBe(false);
  });

  it('every action is the profile settings page, which exists', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ headline: null, bio: null, profile: null, skills: [] });

    const steps = await fetchSteps();

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.action === PROFILE_SETTINGS)).toBe(true);
  });

  it('never offers a step that cannot be completed', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ headline: null, bio: null, profile: null, skills: [] });

    const steps = await fetchSteps();

    // The old list carried "explore-features" (completed: false forever),
    // "upload-resume" (no per-member resume is stored) and "set-preferences"
    // (no page edits those fields), which kept the card on screen for good.
    expect(steps.map((s) => s.id)).not.toEqual(
      expect.arrayContaining(['explore-features', 'upload-resume', 'set-preferences'])
    );
  });

  it('returns an empty list, not an error, when the member is gone', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    const steps = await fetchSteps();

    expect(steps).toEqual([]);
  });
});
