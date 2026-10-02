/**
 * GET /api/users/me/export, the older of the two downloads of a member's data,
 * has to carry her date of birth. It reads the account through an explicit list
 * of columns, and the age she gave us (and whether a document check confirmed
 * it) is personal information held about her like any other, so a column added
 * for the age gate has to be added to that list as well.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    user: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn(async () => null) },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) };
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({});
  prisma.profile.findUnique.mockResolvedValue(null);
});

describe('GET /api/users/me/export', () => {
  it('asks for her date of birth and the document-check stamp, and hands both back', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'her',
      email: 'her@example.com',
      dateOfBirth: '1991-03-14T00:00:00.000Z',
      ageVerifiedAt: '2026-09-20T02:00:00.000Z',
    });

    const res = await request(app).get('/api/users/me/export').expect(200);

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.dateOfBirth).toBe(true);
    expect(select.ageVerifiedAt).toBe(true);
    expect(res.body.data.user).toMatchObject({
      dateOfBirth: '1991-03-14T00:00:00.000Z',
      ageVerifiedAt: '2026-09-20T02:00:00.000Z',
    });
  });

  it('never asks for a credential', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com' });

    await request(app).get('/api/users/me/export').expect(200);

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    for (const secret of ['passwordHash', 'twoFactorSecret', 'twoFactorRecoveryCodes']) {
      expect(select[secret]).toBeUndefined();
    }
  });

  // The other members in her file (who follows her, whom she follows, the mentor
  // she booked) are named as the app names them to her: by the public name they
  // chose, else the first name alone. The file used to carry each one's legal
  // first and last name, which is exactly what a pseudonym is for keeping off a
  // page another member can read, and a download is a page she can keep.
  it('names the other members in it by their public name, and never loads or hands over their legal surname', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com', firstName: 'Jane', lastName: 'Doe', displayName: 'Willow' });
    // followers (where followingId is hers) is asked for first, then following.
    // The second row carries a surname the select never asks for, standing in
    // for a column somebody adds to it later: the answer must lose it anyway.
    prisma.follow.findMany
      .mockResolvedValueOnce([{ followerId: 'fan', followingId: 'her', follower: { id: 'fan', firstName: 'Ada', displayName: 'Ada L', avatar: null } }])
      .mockResolvedValueOnce([{ followerId: 'her', followingId: 'idol', following: { id: 'idol', firstName: 'Grace', lastName: 'Hopper', displayName: null, avatar: null } }]);
    prisma.mentorSession.findMany.mockResolvedValue([{ id: 'ms-1', menteeId: 'her', mentorProfile: { id: 'mp-1', user: { id: 'mentor', firstName: 'Mary', displayName: 'Mentor Mary', avatar: null } } }]);

    const res = await request(app).get('/api/users/me/export').expect(200);

    // The legal surname is not read for anyone but her.
    for (const call of prisma.follow.findMany.mock.calls) {
      const person = call[0].include.follower ?? call[0].include.following;
      expect(person.select.lastName).toBeUndefined();
      expect(person.select.displayName).toBe(true);
    }
    expect(prisma.mentorSession.findMany.mock.calls[0][0].include.mentorProfile.include.user.select.lastName).toBeUndefined();

    // She reads her own record whole.
    expect(res.body.data.user).toMatchObject({ firstName: 'Jane', lastName: 'Doe', displayName: 'Willow' });
    // Everyone else is her public name, or her first name alone, with no surname.
    expect(res.body.data.followers[0].follower).toMatchObject({ id: 'fan', displayName: 'Ada L', firstName: 'Ada L', lastName: '' });
    expect(res.body.data.following[0].following).toMatchObject({ id: 'idol', displayName: 'Grace', firstName: 'Grace', lastName: '' });
    expect(res.body.data.mentorSessions[0].mentorProfile.user).toMatchObject({ id: 'mentor', displayName: 'Mentor Mary', firstName: 'Mentor Mary', lastName: '' });
    expect(JSON.stringify(res.body.data)).not.toContain('Hopper');
  });
});
