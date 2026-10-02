import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The check on the person offering a confidential place, and the sweep that
 * keeps "Checked by ATHENA staff" honest once the check behind it has gone.
 *
 * The badge was a promise about the person as well as the place, and a promise
 * resting on a check that ran out a month ago is the one that hurts someone. So
 * the property tested here is not "the sweep runs" but "no badge survives
 * without a standing check", however the standing was lost.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    housingProviderVerification: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    housingListing: {
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    notification: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

import { prisma as prismaTyped } from '../../utils/prisma';
import { recordFailure } from '../../utils/ops-metrics';
import {
  decideProviderCheck,
  isProviderVerified,
  presentProviderCheck,
  providerStanding,
  submitProviderCheck,
  sweepProviderChecks,
} from '../housing-provider.service';

const prisma: any = prismaTyped;
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T02:00:00.000Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * DAY);

const row = (over: Record<string, unknown> = {}) => ({
  id: 'prov-1',
  userId: 'lister',
  providerName: 'Quiet Streets Housing',
  relationship: 'SERVICE',
  abn: null,
  statement: 'We run three units for women leaving violence in Brisbane.',
  status: 'APPROVED',
  basis: 'Rang two references.',
  evidence: null,
  reviewedById: 'staff',
  reviewedAt: inDays(-30),
  expiresAt: inDays(335),
  submittedAt: inDays(-31),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.housingProviderVerification.findUnique.mockResolvedValue(null);
  prisma.housingProviderVerification.findMany.mockResolvedValue([]);
  prisma.housingProviderVerification.updateMany.mockResolvedValue({ count: 0 });
  prisma.housingListing.findMany.mockResolvedValue([]);
  prisma.housingListing.updateMany.mockResolvedValue({ count: 1 });
});

describe('where a provider check stands', () => {
  it.each([
    ['no row at all', null, 'NONE'],
    ['approved with time left', row(), 'APPROVED'],
    ['approved but past its end date, whatever the stored status says', row({ expiresAt: inDays(-1) }), 'EXPIRED'],
    ['approved on the very instant it ends', row({ expiresAt: NOW }), 'EXPIRED'],
    ['approved with no end date, which is not a standing check', row({ expiresAt: null }), 'EXPIRED'],
    ['waiting', row({ status: 'PENDING', expiresAt: null }), 'PENDING'],
    ['refused', row({ status: 'REJECTED', expiresAt: null }), 'REJECTED'],
    ['marked expired', row({ status: 'EXPIRED' }), 'EXPIRED'],
    ['a status this build does not know', row({ status: 'SOMETHING_NEW' }), 'NONE'],
  ])('%s is %s', (_what, value, expected) => {
    expect(providerStanding(value as any, NOW)).toBe(expected);
  });

  it('is verified only while it stands, and fails closed for a member with no id', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row());
    expect(await isProviderVerified('lister', NOW)).toBe(true);
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row({ expiresAt: inDays(-1) }));
    expect(await isProviderVerified('lister', NOW)).toBe(false);
    expect(await isProviderVerified(null, NOW)).toBe(false);
    expect(await isProviderVerified(undefined, NOW)).toBe(false);
  });
});

describe('asking, and being refused a second ask too early', () => {
  const input = { providerName: 'Quiet Streets Housing', relationship: 'SERVICE' as const, statement: 'We run three units for women leaving violence.' };

  it('a refusal is cleared by asking again, so its reason is not shown beside a request nobody has read', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row({ status: 'REJECTED', expiresAt: null, basis: 'No ABN match.' }));
    prisma.housingProviderVerification.upsert.mockImplementation(async ({ update }: any) => update);

    await submitProviderCheck('lister', input, NOW);

    const { update } = prisma.housingProviderVerification.upsert.mock.calls[0][0];
    expect(update).toMatchObject({ status: 'PENDING', basis: null, reviewedById: null, reviewedAt: null, expiresAt: null });
  });

  it('a standing check is kept standing while a renewal waits', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row({ expiresAt: inDays(10) }));
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => data);

    await submitProviderCheck('lister', input, NOW);

    const { data } = prisma.housingProviderVerification.update.mock.calls[0][0];
    expect(data.status).toBeUndefined();
    expect(data.expiresAt).toBeUndefined();
    expect(data.submittedAt).toEqual(NOW);
  });

  it('refuses a second ask while a check has most of its year left', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row());
    await expect(submitProviderCheck('lister', input, NOW)).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.housingProviderVerification.update).not.toHaveBeenCalled();
    expect(prisma.housingProviderVerification.upsert).not.toHaveBeenCalled();
  });

  it('a member is told they can renew only inside the last month', () => {
    expect(presentProviderCheck(row(), NOW)).toMatchObject({ standing: 'APPROVED', canApply: false, renewable: false });
    expect(presentProviderCheck(row({ expiresAt: inDays(29) }), NOW)).toMatchObject({ standing: 'APPROVED', canApply: true, renewable: true });
    expect(presentProviderCheck(row({ expiresAt: inDays(-1) }), NOW)).toMatchObject({ standing: 'EXPIRED', canApply: true });
    expect(presentProviderCheck(null, NOW)).toEqual({ standing: 'NONE', canApply: true, renewable: false });
  });
});

describe('deciding', () => {
  it('approval with no ABN on file writes no ABN evidence, and says when it ends', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row({ status: 'PENDING', expiresAt: null }));
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => data);

    const { after } = await decideProviderCheck('lister', { decision: 'APPROVE', basis: 'Rang two references and checked the ABN.', validForDays: 90 }, 'staff', NOW);

    expect(after).toMatchObject({ status: 'APPROVED', reviewedById: 'staff', expiresAt: inDays(90) });
    expect(after.evidence).toBeDefined();
  });

  it('records an ABN lookup that could not be made as such, never as a pass', async () => {
    // ABR_GUID is not set in tests, so the lookup is "not configured".
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row({ status: 'PENDING', expiresAt: null, abn: '51824753556' }));
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => data);

    const { after } = await decideProviderCheck('lister', { decision: 'APPROVE', basis: 'Rang two references.'.padEnd(20, '.') }, 'staff', NOW);

    expect(after.evidence).toMatchObject({ abn: { lookup: 'NOT_CONFIGURED', abn: '51824753556' } });
    expect(JSON.stringify(after.evidence)).not.toContain('FOUND"');
  });

  it('a refusal ends the standing check and stores the reason', async () => {
    prisma.housingProviderVerification.findUnique.mockResolvedValue(row());
    prisma.housingProviderVerification.update.mockImplementation(async ({ data }: any) => data);

    const { after } = await decideProviderCheck('lister', { decision: 'REJECT', basis: 'We could not match the ABN to the name.' }, 'staff', NOW);

    expect(after).toMatchObject({ status: 'REJECTED', expiresAt: null, basis: 'We could not match the ABN to the name.' });
    expect(providerStanding(after as any, NOW)).toBe('REJECTED');
  });
});

describe('the sweep: no badge without a standing check', () => {
  const badged = (id: string, agentId: string | null, title = `Listing ${id}`) => ({ id, agentId, title, features: ['dv-safe-note:x'] });
  const standings = (rows: Array<Record<string, unknown>>) => prisma.housingProviderVerification.findMany.mockResolvedValue(rows);

  it('marks checks past their end date as expired, in one write, never touching one that stands', async () => {
    prisma.housingProviderVerification.updateMany.mockResolvedValue({ count: 3 });

    const result = await sweepProviderChecks(NOW);

    expect(result.lapsed).toBe(3);
    const { where, data } = prisma.housingProviderVerification.updateMany.mock.calls[0][0];
    expect(data).toEqual({ status: 'EXPIRED' });
    expect(where).toEqual({ status: 'APPROVED', OR: [{ expiresAt: { lte: NOW } }, { expiresAt: null }] });
  });

  it('only looks at badged confidential listings that are not already withdrawn or let', async () => {
    await sweepProviderChecks(NOW);
    expect(prisma.housingListing.findMany.mock.calls[0][0].where).toEqual({
      safetyVerified: true,
      status: { notIn: ['WITHDRAWN', 'LEASED'] },
      OR: [{ dvSafe: true }, { type: { in: ['EMERGENCY', 'TRANSITIONAL'] } }],
    });
  });

  it('takes the badge off a listing whose lister has no standing check, back to the queue with a new clock', async () => {
    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'lapsed')]);
    standings([{ userId: 'lapsed', status: 'APPROVED', expiresAt: inDays(-2) }]);

    const result = await sweepProviderChecks(NOW);

    expect(result).toMatchObject({ listingsTakenDown: 1, membersTold: 1 });
    const { where, data } = prisma.housingListing.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 'l-1', safetyVerified: true });
    expect(data).toMatchObject({ safetyVerified: false, status: 'PENDING' });
    expect(data.features).toContain('dv-safe-note:x');
    expect(data.features.some((f: string) => f.startsWith(`dv-safe-check-requested:${NOW.toISOString()}`))).toBe(true);
  });

  it('does the same for a lister who was refused, who never had a row, and for a listing with no lister at all', async () => {
    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'refused'), badged('l-2', 'never'), badged('l-3', null)]);
    standings([{ userId: 'refused', status: 'REJECTED', expiresAt: null }]);

    const result = await sweepProviderChecks(NOW);

    expect(result.listingsTakenDown).toBe(3);
    expect(prisma.housingListing.updateMany.mock.calls.map((c: any) => c[0].where.id)).toEqual(['l-1', 'l-2', 'l-3']);
  });

  it('leaves a listing alone while its lister stands, and does not trust the stored status over the date', async () => {
    prisma.housingListing.findMany.mockResolvedValue([badged('l-ok', 'ok'), badged('l-stale', 'stale')]);
    // `stale` is still marked APPROVED because the first step failed, but its end date has passed.
    standings([
      { userId: 'ok', status: 'APPROVED', expiresAt: inDays(200) },
      { userId: 'stale', status: 'APPROVED', expiresAt: inDays(-1) },
    ]);

    const result = await sweepProviderChecks(NOW);

    expect(result.listingsTakenDown).toBe(1);
    expect(prisma.housingListing.updateMany.mock.calls.map((c: any) => c[0].where.id)).toEqual(['l-stale']);
  });

  it('still takes listings down when the first step fails, and puts the failure where staff will see it', async () => {
    prisma.housingProviderVerification.updateMany.mockRejectedValue(new Error('db down'));
    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'lapsed')]);
    standings([{ userId: 'lapsed', status: 'APPROVED', expiresAt: inDays(-2) }]);

    const result = await sweepProviderChecks(NOW);

    expect(result.listingsTakenDown).toBe(1);
    expect(recordFailure).toHaveBeenCalledWith('housing.provider-check-sweep', expect.any(Error));
  });

  it('does not count, or tell anyone about, a listing staff re-approved between the read and the write', async () => {
    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'lapsed')]);
    standings([{ userId: 'lapsed', status: 'APPROVED', expiresAt: inDays(-2) }]);
    prisma.housingListing.updateMany.mockResolvedValue({ count: 0 });

    const result = await sweepProviderChecks(NOW);

    expect(result).toMatchObject({ listingsTakenDown: 0, membersTold: 0 });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('never throws: a failed read is logged and counted, and the next hour starts from the records again', async () => {
    prisma.housingListing.findMany.mockRejectedValue(new Error('db down'));
    await expect(sweepProviderChecks(NOW)).resolves.toMatchObject({ listingsTakenDown: 0 });
    expect(recordFailure).toHaveBeenCalledWith('housing.provider-check-sweep', expect.any(Error));

    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'lapsed')]);
    prisma.housingProviderVerification.findMany.mockRejectedValue(new Error('db down'));
    await expect(sweepProviderChecks(NOW)).resolves.toMatchObject({ listingsTakenDown: 0 });
    expect(prisma.housingListing.updateMany).not.toHaveBeenCalled();
  });

  it('tells each member once, naming up to three of their places, and links to where to ask again', async () => {
    prisma.housingListing.findMany.mockResolvedValue([
      badged('l-1', 'lapsed', 'One'),
      badged('l-2', 'lapsed', 'Two'),
      badged('l-3', 'lapsed', 'Three'),
      badged('l-4', 'lapsed', 'Four'),
    ]);
    standings([{ userId: 'lapsed', status: 'APPROVED', expiresAt: inDays(-2) }]);

    const result = await sweepProviderChecks(NOW);

    expect(result.membersTold).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const sent = prisma.notification.create.mock.calls[0][0].data;
    expect(sent.userId).toBe('lapsed');
    expect(sent.title).toBe('Your provider check has ended');
    expect(sent.message).toContain('"One", "Two", "Three" and 1 more');
    expect(sent.message).not.toContain('"Four"');
    expect(sent.link).toBe('/dashboard/housing#provider-check');
  });

  it('does not say a check "ended" to a member who never had one: a place badged before provider checks existed', async () => {
    prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'never', 'Old badge')]);
    // No row at all for this member.

    await sweepProviderChecks(NOW);

    const sent = prisma.notification.create.mock.calls[0][0].data;
    expect(sent.title).toBe('Your places need a provider check');
    expect(sent.message).toContain('there is no provider check on record for you yet');
    expect(sent.message).not.toContain('ended');
    expect(sent.data).toMatchObject({ kind: 'HOUSING_PROVIDER_CHECK_NEEDED' });
  });

  describe('for one member, straight after staff end their check', () => {
    it('looks only at that member and does not run the expiry step', async () => {
      prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'refused')]);
      standings([{ userId: 'refused', status: 'REJECTED', expiresAt: null }]);

      const result = await sweepProviderChecks(NOW, { userId: 'refused', tell: false });

      expect(prisma.housingProviderVerification.updateMany).not.toHaveBeenCalled();
      expect(prisma.housingListing.findMany.mock.calls[0][0].where).toMatchObject({ agentId: 'refused', safetyVerified: true });
      expect(result.listingsTakenDown).toBe(1);
    });

    it('says nothing to the member when the caller has its own message for them', async () => {
      prisma.housingListing.findMany.mockResolvedValue([badged('l-1', 'refused')]);

      const result = await sweepProviderChecks(NOW, { userId: 'refused', tell: false });

      expect(result).toMatchObject({ listingsTakenDown: 1, membersTold: 0 });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
