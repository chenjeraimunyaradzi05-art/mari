/**
 * Which rooms need a completed women-only check, and what happens at each.
 *
 * There are two levels. The floor, that a reviewer has not refused her, is
 * central and is tested in account-standing.test.ts. This is the second level,
 * for the surfaces that promise something to other members: some are enforced
 * always (a mentor profile, confidential housing) and some wait for the
 * founder's decision (private groups, creator payouts) and are switched on by
 * configuration. What matters here is that "not decided yet" is a real,
 * default state that lets through exactly what the floor lets through, that
 * switching a surface on refuses an account that has not been reviewed and
 * says where to go, that a refused account is told how to appeal and not asked
 * to verify, and that a name that matches no surface is not quietly ignored.
 */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock: any = {
  user: { findUnique: jest.fn() },
  creatorProfile: { findUnique: jest.fn() },
  group: { findUnique: jest.fn() },
  groupMember: { findUnique: jest.fn(), upsert: jest.fn() },
  groupJoinRequest: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@ourdomain.org' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../moneyLimits', () => ({
  giftCeiling: (_req: any, _res: any, next: any) => next(),
  payoutCeiling: (_req: any, _res: any, next: any) => next(),
  startingAPayment: () => (_req: any, _res: any, next: any) => next(),
}));
const requestPayout = jest.fn(async (_userId: string) => ({ id: 'payout-1' }));
jest.mock('../../services/creator.service', () => ({ requestPayout: (userId: string) => requestPayout(userId) }));
jest.mock('../../services/socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));

import {
  WOMAN_GATE_SURFACES,
  WOMAN_VERIFIED_REQUIRED_ENV,
  configuredSurfaces,
  verifiedRequiredFor,
} from '../../config/woman-gate-policy';
import { ADMISSION_REFUSED_MESSAGE, requireWomanVerifiedFor, womanVerifiedRefusal } from '../woman-gate-surfaces';
import { WOMAN_GATE_REJECTED_MESSAGE, WOMAN_GATE_UNVERIFIED_MESSAGE } from '../account-gates';
import { accountStandingRefusal } from '../account-standing';
import { CREATOR_TERMS_VERSION } from '../../config/creator-terms';
import creatorRoutes from '../../routes/creator.routes';
import groupRoutes from '../../routes/group.routes';
import { errorHandler } from '../errorHandler';

const original = process.env;

// An adult's date of birth. The one user mock answers every read of her row,
// whatever was selected, and the payout route runs the age gate before the
// women-only surface (requireAdultAccount, then requireCreatorTerms, then
// requireWomanVerifiedFor), so a row with no date of birth would be refused
// as DATE_OF_BIRTH_REQUIRED before this file's gate was ever asked.
const ADULT_DATE_OF_BIRTH = new Date('1990-05-12');

function standing(status: string) {
  prismaMock.user.findUnique.mockResolvedValue({
    womanVerificationStatus: status,
    dateOfBirth: ADULT_DATE_OF_BIRTH,
    dvSafetyProfile: null,
    profile: null,
  });
}

function appWith(path: string, router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...original };
  delete process.env[WOMAN_VERIFIED_REQUIRED_ENV];
  standing('UNVERIFIED');
});

afterEach(() => {
  process.env = original;
});

describe('the floor and the second level, side by side', () => {
  it('lets an account nobody has reviewed write, because everyone self-attests and the floor only turns away a refusal', () => {
    for (const status of ['UNVERIFIED', 'PENDING', 'VERIFIED']) {
      expect(accountStandingRefusal({ womanVerificationStatus: status }, 'POST', '/api/posts')).toBeNull();
    }
    expect(accountStandingRefusal({ womanVerificationStatus: 'REJECTED' }, 'POST', '/api/posts')).not.toBeNull();
  });

  it('asks more of an unreviewed account only where a surface says so, so the floor never needs editing for it', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    standing('UNVERIFIED');

    expect(accountStandingRefusal({ womanVerificationStatus: 'UNVERIFIED' }, 'POST', '/api/groups/g1/join')).toBeNull();
    await expect(womanVerifiedRefusal('her', 'private_groups')).resolves.not.toBeNull();
  });
});

describe('the policy table', () => {
  it('enforces exactly the mentor profile and confidential housing always, and leaves the rest to configuration', () => {
    const always = WOMAN_GATE_SURFACES.filter((policy) => policy.enforcement === 'always').map((policy) => policy.surface);
    expect(always.sort()).toEqual(['confidential_housing', 'mentor_publication']);
    const configurable = WOMAN_GATE_SURFACES.filter((policy) => policy.enforcement === 'configurable').map((policy) => policy.surface);
    expect(configurable.sort()).toEqual(['creator_payouts', 'private_groups']);
  });

  it('says why each surface is asked for a completed check, so the decision can be argued with', () => {
    for (const policy of WOMAN_GATE_SURFACES) {
      expect(policy.why.trim().length).toBeGreaterThan(40);
      expect(policy.label.trim().length).toBeGreaterThan(5);
    }
    const names = WOMAN_GATE_SURFACES.map((policy) => policy.surface);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('configuredSurfaces', () => {
  it('reads a comma-separated list, ignoring case and spaces', () => {
    const { on, unknown } = configuredSurfaces(' Private_Groups , creator_payouts ');
    expect([...on].sort()).toEqual(['creator_payouts', 'private_groups']);
    expect(unknown).toEqual([]);
  });

  it('switches every surface on for "all"', () => {
    expect(configuredSurfaces('all').on.size).toBe(WOMAN_GATE_SURFACES.length);
  });

  it('reports a name that matches nothing instead of ignoring it', () => {
    // A typo would otherwise leave a surface open while whoever set it believed it closed.
    expect(configuredSurfaces('private_group,creator_payouts').unknown).toEqual(['private_group']);
    expect(configuredSurfaces('private_group').on.size).toBe(0);
  });

  it('is empty for nothing', () => {
    expect(configuredSurfaces(undefined).on.size).toBe(0);
    expect(configuredSurfaces('').on.size).toBe(0);
  });
});

describe('verifiedRequiredFor', () => {
  it('asks for a completed check on the always surfaces whatever the configuration says', () => {
    expect(verifiedRequiredFor('mentor_publication', {})).toBe(true);
    expect(verifiedRequiredFor('confidential_housing', {})).toBe(true);
    expect(verifiedRequiredFor('mentor_publication', { [WOMAN_VERIFIED_REQUIRED_ENV]: 'creator_payouts' })).toBe(true);
  });

  it('does not ask on a configurable surface until it is named', () => {
    expect(verifiedRequiredFor('creator_payouts', {})).toBe(false);
    expect(verifiedRequiredFor('private_groups', { [WOMAN_VERIFIED_REQUIRED_ENV]: 'creator_payouts' })).toBe(false);
    expect(verifiedRequiredFor('creator_payouts', { [WOMAN_VERIFIED_REQUIRED_ENV]: 'creator_payouts' })).toBe(true);
    expect(verifiedRequiredFor('private_groups', { [WOMAN_VERIFIED_REQUIRED_ENV]: 'all' })).toBe(true);
  });

  it('reads the environment as it is at the moment of asking', () => {
    expect(verifiedRequiredFor('creator_payouts')).toBe(false);
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    expect(verifiedRequiredFor('creator_payouts')).toBe(true);
  });
});

describe('womanVerifiedRefusal', () => {
  it('lets everyone the floor lets through, and does not even read her standing, while a surface is not switched on', async () => {
    await expect(womanVerifiedRefusal('her', 'creator_payouts')).resolves.toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an account that has not been reviewed, and says where to complete the check', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    standing('UNVERIFIED');

    const refusal = await womanVerifiedRefusal('her', 'creator_payouts');

    expect(refusal).toMatchObject({
      error: WOMAN_GATE_UNVERIFIED_MESSAGE,
      code: 'WOMAN_VERIFICATION_REQUIRED',
      status: 'UNVERIFIED',
      setup: '/dashboard/settings/profile',
      surface: 'creator_payouts',
    });
  });

  it('refuses a request still waiting for a reviewer in the same words, with her status', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    standing('PENDING');

    await expect(womanVerifiedRefusal('her', 'creator_payouts')).resolves.toMatchObject({
      code: 'WOMAN_VERIFICATION_REQUIRED',
      status: 'PENDING',
    });
  });

  it('tells a refused account how to appeal and does not ask her to verify again', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    standing('REJECTED');

    await expect(womanVerifiedRefusal('her', 'creator_payouts')).resolves.toMatchObject({
      error: WOMAN_GATE_REJECTED_MESSAGE,
      code: 'WOMAN_VERIFICATION_REJECTED',
    });
  });

  it('lets a reviewed account through', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    standing('VERIFIED');

    await expect(womanVerifiedRefusal('her', 'creator_payouts')).resolves.toBeNull();
  });

  it('fails when her standing cannot be read, and never reads that as permission', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    prismaMock.user.findUnique.mockRejectedValue(new Error('db away'));

    await expect(womanVerifiedRefusal('her', 'creator_payouts')).rejects.toThrow('db away');
  });
});

describe('requireWomanVerifiedFor as route middleware', () => {
  function appWithGate() {
    const app = express();
    app.post('/pay', (req: any, _res, next) => {
      if (req.headers['x-as']) req.user = { id: String(req.headers['x-as']) };
      next();
    }, requireWomanVerifiedFor('creator_payouts'), (_req, res) => res.json({ paid: true }));
    app.use(errorHandler);
    return app;
  }

  it('needs a signed-in member', async () => {
    await request(appWithGate()).post('/pay').expect(401);
  });

  it('passes while the surface is off, refuses an unreviewed account once it is on, passes a reviewed one', async () => {
    await request(appWithGate()).post('/pay').set('x-as', 'her').expect(200);

    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    const refused = await request(appWithGate()).post('/pay').set('x-as', 'her').expect(403);
    expect(refused.body.code).toBe('WOMAN_VERIFICATION_REQUIRED');
    expect(refused.body.error).toBe(WOMAN_GATE_UNVERIFIED_MESSAGE);

    standing('VERIFIED');
    await request(appWithGate()).post('/pay').set('x-as', 'her').expect(200);
  });
});

describe('POST /api/creator/payouts/request', () => {
  const asked = () => request(appWith('/api/creator', creatorRoutes)).post('/api/creator/payouts/request');

  beforeEach(() => {
    // A creator who has accepted the current Creator Terms Addendum, so the
    // terms gate in front of the women-only surface lets her through and
    // what is being tested is this file's gate alone.
    prismaMock.creatorProfile.findUnique.mockResolvedValue({ creatorTermsVersion: CREATOR_TERMS_VERSION });
  });

  it('pays out an unreviewed creator while the founder has not switched the surface on', async () => {
    await asked().expect(200);
    expect(requestPayout).toHaveBeenCalledWith('her');
  });

  it('refuses an unreviewed creator once it is on, and requests nothing', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';

    const res = await asked().expect(403);

    expect(res.body.code).toBe('WOMAN_VERIFICATION_REQUIRED');
    expect(res.body.surface).toBe('creator_payouts');
    expect(requestPayout).not.toHaveBeenCalled();
  });

  it('pays out a reviewed creator once it is on', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'creator_payouts';
    standing('VERIFIED');

    await asked().expect(200);
    expect(requestPayout).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/groups/:id/join', () => {
  const group = (privacy: 'PUBLIC' | 'PRIVATE') => ({ id: 'g1', name: 'Welders', privacy, isHidden: false });
  const join = () => request(appWith('/api/groups', groupRoutes)).post('/api/groups/g1/join');

  beforeEach(() => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    prismaMock.groupJoinRequest.findUnique.mockResolvedValue(null);
    prismaMock.groupJoinRequest.upsert.mockResolvedValue({ id: 'r1', status: 'PENDING' });
  });

  it('files a request for a private group while the surface is off, as before', async () => {
    prismaMock.group.findUnique.mockResolvedValue(group('PRIVATE'));

    await join().expect(202);

    expect(prismaMock.groupJoinRequest.upsert).toHaveBeenCalledTimes(1);
  });

  it('refuses an unreviewed member a request for a private group once it is on, and files nothing', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    prismaMock.group.findUnique.mockResolvedValue(group('PRIVATE'));

    const res = await join().expect(403);

    expect(res.body.code).toBe('WOMAN_VERIFICATION_REQUIRED');
    expect(res.body.surface).toBe('private_groups');
    expect(prismaMock.groupJoinRequest.upsert).not.toHaveBeenCalled();
  });

  it('files the request for a reviewed member', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    standing('VERIFIED');
    prismaMock.group.findUnique.mockResolvedValue(group('PRIVATE'));

    await join().expect(202);
  });

  it('never asks it of a public group, which has no promise to make about who is in it', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'all';
    prismaMock.group.findUnique.mockResolvedValue(group('PUBLIC'));
    prismaMock.groupMember.upsert.mockResolvedValue({});
    // getGroupView reads the group again to answer; any answer past the gate will do.
    prismaMock.group.findUnique.mockResolvedValue({ ...group('PUBLIC'), _count: { members: 1 }, members: [] });

    const res = await join();

    expect(res.status).not.toBe(403);
    expect(prismaMock.groupMember.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/groups/:id/join-requests/:requestId/approve', () => {
  // The admin is 'her' (the signed-in member); the person being let in is 'newcomer'.
  const group = (privacy: 'PUBLIC' | 'PRIVATE') => ({ id: 'g1', name: 'Welders', privacy, isHidden: false });
  const approve = () =>
    request(appWith('/api/groups', groupRoutes)).post('/api/groups/g1/join-requests/r1/approve');
  const deny = () => request(appWith('/api/groups', groupRoutes)).post('/api/groups/g1/join-requests/r1/deny');

  function newcomerIs(status: string) {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => ({
      womanVerificationStatus: where.id === 'newcomer' ? status : 'VERIFIED',
      dateOfBirth: ADULT_DATE_OF_BIRTH,
      dvSafetyProfile: null,
      profile: null,
    }));
  }

  beforeEach(() => {
    prismaMock.group.findUnique.mockResolvedValue(group('PRIVATE'));
    // 'her' is an admin of the group; the same row answers every membership lookup.
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: 'ADMIN', isBanned: false });
    prismaMock.groupMember.upsert.mockResolvedValue({});
    prismaMock.groupJoinRequest.findUnique.mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'newcomer' });
    prismaMock.groupJoinRequest.update.mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'newcomer', status: 'APPROVED' });
    prismaMock.$transaction.mockImplementation(async (work: any) => work(prismaMock));
  });

  it('lets the admin approve an unreviewed requester while the surface is off, and reads nobody’s standing', async () => {
    newcomerIs('UNVERIFIED');

    await approve().expect(200);

    expect(prismaMock.groupMember.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses to admit an unreviewed requester to a private group once it is on, in words for the admin, and changes nothing', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    newcomerIs('UNVERIFIED');

    const res = await approve().expect(409);

    expect(res.body.message).toBe(ADMISSION_REFUSED_MESSAGE);
    // Said about somebody else: no code that would send the admin to finish a check that is not hers.
    expect(res.body.code).toBeUndefined();
    expect(prismaMock.groupJoinRequest.update).not.toHaveBeenCalled();
    expect(prismaMock.groupMember.upsert).not.toHaveBeenCalled();
  });

  it('asks about the requester and not the admin: a reviewed admin does not carry an unreviewed requester in', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    newcomerIs('PENDING');

    await approve().expect(409);

    const asked = prismaMock.user.findUnique.mock.calls.map((call: any[]) => call[0].where.id);
    expect(asked).toEqual(['newcomer']);
  });

  it('admits a reviewed requester once it is on', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    newcomerIs('VERIFIED');

    await approve().expect(200);

    expect(prismaMock.groupMember.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not ask it of a group that is not private, whatever the configuration says', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'all';
    prismaMock.group.findUnique.mockResolvedValue(group('PUBLIC'));
    newcomerIs('UNVERIFIED');

    await approve().expect(200);

    expect(prismaMock.groupMember.upsert).toHaveBeenCalledTimes(1);
  });

  it('never refuses a denial, so an admin can always turn an unreviewed request down', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    newcomerIs('UNVERIFIED');
    prismaMock.groupJoinRequest.update.mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'newcomer', status: 'DENIED' });

    await deny().expect(200);

    expect(prismaMock.groupMember.upsert).not.toHaveBeenCalled();
  });

  it('does not let the check be read as permission when her standing cannot be read', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    prismaMock.user.findUnique.mockRejectedValue(new Error('db away'));

    await approve().expect(500);

    expect(prismaMock.groupMember.upsert).not.toHaveBeenCalled();
  });
});
