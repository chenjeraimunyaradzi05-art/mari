/**
 * The central object-level policy: deny by default in every direction.
 *
 * What the guard promises, and each test breaks one promise on purpose: no
 * session is a 401 and the policy is never asked; a missing resource and a
 * refused one are the same 404, so neither says which ids exist; a policy that
 * throws, or answers anything but `true`, is a refusal; a staff role is a
 * pass only with a second factor, and does not stop staff reaching their own
 * things; and the policies it ships are the checks the routes already made by
 * hand.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: { findFirst: jest.fn(), findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { ApiError } from '../errorHandler';
import {
  anyOf,
  hasRole,
  hiringStaffOf,
  loadedResource,
  orgMember,
  ownedBy,
  participant,
  requireResourceAccess,
} from '../resource-access';

const prisma: any = prismaTyped;

const ada = { id: 'ada', role: 'USER', email: 'ada@athena.com', persona: 'EARLY_CAREER' };

/** Runs the guard and reports what it did: called next with what, or answered how. */
async function run(guard: ReturnType<typeof requireResourceAccess>, user: unknown, params: Record<string, string> = {}) {
  const req: any = { user, params };
  const result: { next: unknown[] | null; status: number | null; body: unknown } = { next: null, status: null, body: null };
  const res: any = {
    status: (code: number) => {
      result.status = code;
      return res;
    },
    json: (body: unknown) => {
      result.body = body;
      return res;
    },
  };
  await guard(req, res, (...args: unknown[]) => {
    result.next = args;
  });
  return { ...result, req };
}

const refusedWith = (outcome: { next: unknown[] | null }) => {
  const error = outcome.next?.[0];
  return error instanceof ApiError ? error.statusCode : null;
};

describe('requireResourceAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets the owner through and hands the handler what it loaded, so it is not fetched twice', async () => {
    const note = { id: 'n1', userId: 'ada' };
    const guard = requireResourceAccess({ load: async () => note, allow: ownedBy<typeof note>('userId') });

    const outcome = await run(guard, ada);

    expect(outcome.next).toEqual([]);
    expect(loadedResource<typeof note>(outcome.req)).toBe(note);
  });

  it('answers a stranger with the same 404 as a missing resource', async () => {
    const guard = requireResourceAccess({
      load: async (req) => (req.params.id === 'n1' ? { id: 'n1', userId: 'bea' } : null),
      allow: ownedBy('userId'),
    });

    const someoneElses = await run(guard, ada, { id: 'n1' });
    const missing = await run(guard, ada, { id: 'nope' });

    expect(refusedWith(someoneElses)).toBe(404);
    expect(refusedWith(missing)).toBe(404);
    expect((someoneElses.next?.[0] as ApiError).message).toBe((missing.next?.[0] as ApiError).message);
  });

  it('is a 401 without a session, and never loads anything', async () => {
    const load = jest.fn(async () => ({ id: 'n1', userId: 'ada' }));
    const guard = requireResourceAccess({ load, allow: ownedBy('userId') });

    expect(refusedWith(await run(guard, undefined))).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });

  it('treats a policy that throws as an error and never as a grant', async () => {
    const guard = requireResourceAccess({
      load: async () => ({ id: 'n1' }),
      allow: async () => {
        throw new Error('database unreachable');
      },
    });

    const outcome = await run(guard, ada);

    expect(outcome.next?.[0]).toBeInstanceOf(Error);
    expect(refusedWith(outcome)).toBeNull();
  });

  it('treats anything but true as a refusal, so a row returned by mistake is not a yes', async () => {
    for (const answer of [{ id: 'row' }, 1, 'yes', undefined, null]) {
      const guard = requireResourceAccess({ load: async () => ({ id: 'n1' }), allow: (() => answer) as any });
      expect(refusedWith(await run(guard, ada))).toBe(404);
    }
  });

  describe('for staff', () => {
    const env = { ...process.env };
    beforeEach(() => {
      process.env = { ...env, NODE_ENV: 'test', STAFF_TWO_FACTOR_REQUIRED: 'true' };
    });
    afterEach(() => {
      process.env = env;
    });

    it('does not let a staff role open anything for an account with no second factor, and says how to fix it', async () => {
      const guard = requireResourceAccess({ load: async () => ({ id: 'n1', userId: 'bea' }), allow: hasRole('ADMIN') });

      const outcome = await run(guard, { ...ada, role: 'ADMIN', twoFactorEnabled: false });

      expect(outcome.status).toBe(403);
      expect((outcome.body as { code: string }).code).toBe('TWO_FACTOR_REQUIRED');
      expect(outcome.next).toBeNull();
    });

    it('lets the same account through once it has one', async () => {
      const guard = requireResourceAccess({ load: async () => ({ id: 'n1', userId: 'bea' }), allow: hasRole('ADMIN') });
      const outcome = await run(guard, { ...ada, role: 'ADMIN', twoFactorEnabled: true });
      expect(outcome.next).toEqual([]);
    });

    it('still lets that account reach its own things, because owning one is not a staff power', async () => {
      const note = { id: 'n1', userId: 'ada' };
      const guard = requireResourceAccess({
        load: async () => note,
        allow: anyOf(hasRole('ADMIN'), ownedBy<typeof note>('userId')),
      });

      const outcome = await run(guard, { ...ada, role: 'ADMIN', twoFactorEnabled: false });

      expect(outcome.next).toEqual([]);
      expect(outcome.status).toBeNull();
    });

    it('answers a staff account with no second factor who is not the owner with the setup refusal, not a 404', async () => {
      const note = { id: 'n1', userId: 'bea' };
      const guard = requireResourceAccess({
        load: async () => note,
        allow: anyOf(ownedBy<typeof note>('userId'), hasRole('ADMIN')),
      });

      const outcome = await run(guard, { ...ada, role: 'ADMIN', twoFactorEnabled: false });

      expect(outcome.status).toBe(403);
      expect(outcome.next).toBeNull();
    });

    it('does not carry the refusal over to an ordinary member who is merely not the owner', async () => {
      const note = { id: 'n1', userId: 'bea' };
      const guard = requireResourceAccess({
        load: async () => note,
        allow: anyOf(ownedBy<typeof note>('userId'), hasRole('ADMIN')),
      });

      const outcome = await run(guard, ada);

      expect(refusedWith(outcome)).toBe(404);
      expect(outcome.status).toBeNull();
    });
  });

  it('refuses to hand over a resource the guard never cleared', () => {
    expect(() => loadedResource({} as any)).toThrow(/did not clear/);
  });
});

describe('the policies', () => {
  const principal: any = ada;
  const req: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ownedBy matches the named field to the caller and nothing else', () => {
    const check = ownedBy<{ ownerId: string; userId: string }>('ownerId');
    expect(check({ ownerId: 'ada', userId: 'bea' }, principal, req)).toBe(true);
    expect(check({ ownerId: 'bea', userId: 'ada' }, principal, req)).toBe(false);
  });

  it('participant admits only people named in the conversation', () => {
    const check = participant<{ members: string[] }>((conversation) => conversation.members);
    expect(check({ members: ['ada', 'bea'] }, principal, req)).toBe(true);
    expect(check({ members: ['bea', 'cleo'] }, principal, req)).toBe(false);
    expect(check({ members: [] }, principal, req)).toBe(false);
  });

  it('orgMember admits an accepted member and refuses an invitation nobody answered', async () => {
    const check = orgMember<{ organizationId: string | null }>((row) => row.organizationId);

    prisma.organizationMember.findFirst.mockResolvedValueOnce({ id: 'm1' });
    expect(await check({ organizationId: 'org-1' }, principal, req)).toBe(true);
    expect(prisma.organizationMember.findFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-1',
      userId: 'ada',
      acceptedAt: { not: null },
    });

    prisma.organizationMember.findFirst.mockResolvedValueOnce(null);
    expect(await check({ organizationId: 'org-1' }, principal, req)).toBe(false);
  });

  it('orgMember refuses a resource that belongs to no organisation, without asking', async () => {
    const check = orgMember<{ organizationId: string | null }>((row) => row.organizationId);
    expect(await check({ organizationId: null }, principal, req)).toBe(false);
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('orgMember lets a real failure through as an error, not a refusal', async () => {
    const check = orgMember<{ organizationId: string }>((row) => row.organizationId);
    prisma.organizationMember.findFirst.mockRejectedValueOnce(new Error('connection reset'));
    await expect(check({ organizationId: 'org-1' }, principal, req)).rejects.toThrow('connection reset');
  });

  it('hiringStaffOf admits the poster of a job that belongs to nobody, and not a stranger', async () => {
    const check = hiringStaffOf<{ job: { organizationId: string | null; postedById: string } }>((row) => row.job);
    expect(await check({ job: { organizationId: null, postedById: 'ada' } }, principal, req)).toBe(true);
    expect(await check({ job: { organizationId: null, postedById: 'bea' } }, principal, req)).toBe(false);
  });

  it('hiringStaffOf asks the organisation for a job that belongs to one', async () => {
    const check = hiringStaffOf<{ organizationId: string; postedById: string }>((row) => row);

    prisma.organizationMember.findUnique.mockResolvedValueOnce({ role: 'RECRUITER', canPostJobs: false, acceptedAt: new Date() });
    expect(await check({ organizationId: 'org-1', postedById: 'bea' }, principal, req)).toBe(true);

    // Poster of the row but no longer on the team: the job is the organisation's now.
    prisma.organizationMember.findUnique.mockResolvedValueOnce(null);
    expect(await check({ organizationId: 'org-1', postedById: 'ada' }, principal, req)).toBe(false);
  });

  it('anyOf is a yes at the first yes and a no only when every check says no', async () => {
    const yes = jest.fn(() => true);
    const no = jest.fn(() => false);
    const never = jest.fn(() => true);

    expect(await anyOf(no, yes, never)({}, principal, req)).toBe(true);
    expect(never).not.toHaveBeenCalled();
    expect(await anyOf(no, no)({}, principal, req)).toBe(false);
    expect(await anyOf()({}, principal, req)).toBe(false);
  });
});
