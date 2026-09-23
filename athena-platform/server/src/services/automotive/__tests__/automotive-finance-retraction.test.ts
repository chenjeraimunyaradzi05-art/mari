/**
 * The retraction of the car finance "pre-approvals" ATHENA was never
 * entitled to issue.
 *
 * An admin used to be able to pick PRE_APPROVED from a dropdown. The member
 * was then told she was pre-approved for an amount, at a rate, with a lender
 * named — the literal string "ATHENA finance desk" — and that it was good for
 * sixty days, and the platform booked itself a referral fee on the loan. No
 * lender had seen any of it, because there is no lender. The route can no
 * longer write that, but the rows it already wrote are still in the database,
 * and a row that says PRE_APPROVED is the claim still standing. These cover
 * the sweep that takes it back: the status, the lender, the expiry, the
 * commission, and telling her.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;

const store: { applications: Row[]; referrals: Row[]; notifications: Row[] } = { applications: [], referrals: [], notifications: [] };

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    carFinanceApplication: {
      findMany: jest.fn(async ({ where }: { where: Row }) => store.applications.filter((a) => (where?.status?.in as string[]).includes(a.status as string)).map((a) => ({ ...a }))),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = store.applications.find((a) => a.id === where.id);
        if (!row) throw new Error(`no application ${where.id}`);
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    carReferral: {
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const hit = store.referrals.filter((r) => r.kind === where.kind && r.referenceId === where.referenceId && (where.status.in as string[]).includes(r.status as string));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => { store.notifications.push(data); return data; }),
      findFirst: jest.fn(async () => null),
    },
    tradeInRequest: { updateMany: jest.fn(async () => ({ count: 0 })) },
    mechanic: { updateMany: jest.fn(async () => ({ count: 0 })) },
    dealership: { updateMany: jest.fn(async () => ({ count: 0 })) },
    vehicleListing: { updateMany: jest.fn(async () => ({ count: 0 })) },
    user: { findMany: jest.fn(async () => [{ id: 'admin' }]) },
  },
}));

jest.mock('../../../utils/redis', () => ({ runExclusively: jest.fn(async (_k: string, fn: () => unknown) => fn()) }));
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (v: unknown) => v,
}));

import { retractFinancePreApprovals, sweepExpiries } from '../automotive-reminders.service';

const NOW = new Date('2026-09-23T09:00:00Z');

/** A row as the old admin dropdown left it: approved, with a lender and a clock on it. */
const preApproved = (id: string, status = 'PRE_APPROVED'): Row => ({
  id,
  userId: `member-${id}`,
  referenceCode: `CF-${id.toUpperCase()}`,
  status,
  lender: 'ATHENA finance desk',
  amount: 19000,
  expiresAt: new Date('2026-11-01T00:00:00Z'),
  decisionNote: null,
  timeline: [{ at: '2026-09-01T00:00:00Z', status: 'SUBMITTED', note: 'Sent to the finance desk' }],
});

beforeEach(() => {
  store.applications = [];
  store.referrals = [];
  store.notifications = [];
  jest.clearAllMocks();
});

describe('retracting the finance pre-approvals', () => {
  it('closes the row, takes the lender and the expiry off it, and says so on the timeline', async () => {
    store.applications.push(preApproved('a'));

    const { retracted } = await retractFinancePreApprovals(NOW);

    expect(retracted).toBe(1);
    const row = store.applications[0];
    expect(row.status).toBe('WITHDRAWN');
    expect(row.lender).toBeNull();
    expect(row.expiresAt).toBeNull();
    expect(row.decisionNote).toMatch(/not licensed/i);
    expect(row.timeline).toHaveLength(2);
    expect((row.timeline as Row[])[1].status).toBe('WITHDRAWN');
  });

  it('voids the commission booked against an introduction that never happened', async () => {
    store.applications.push(preApproved('a'));
    store.referrals.push({ id: 'r1', kind: 'FINANCE', referenceId: 'a', status: 'PENDING', fee: 190 });
    store.referrals.push({ id: 'r2', kind: 'DEALER_SALE', referenceId: 'a', status: 'PENDING', fee: 300 });

    await retractFinancePreApprovals(NOW);

    expect(store.referrals.find((r) => r.id === 'r1')!.status).toBe('VOID');
    // A dealership sale really did begin with a test drive booked here; only
    // the finance fee was owed for something that did not happen.
    expect(store.referrals.find((r) => r.id === 'r2')!.status).toBe('PENDING');
  });

  it('tells her, because she may be standing in a dealership on it', async () => {
    store.applications.push(preApproved('a'));

    await retractFinancePreApprovals(NOW);

    expect(store.notifications).toHaveLength(1);
    const sent = store.notifications[0];
    expect(sent.userId).toBe('member-a');
    expect(sent.data.kind).toBe('CAR_FINANCE_RETRACTED');
    expect(sent.message).toMatch(/not a lender/i);
    expect(sent.message).toContain('CF-A');
  });

  it('takes back the ones that lapsed too — "your pre-approval expired" was the same claim', async () => {
    store.applications.push(preApproved('a', 'EXPIRED'));

    const { retracted } = await retractFinancePreApprovals(NOW);

    expect(retracted).toBe(1);
    expect(store.applications[0].status).toBe('WITHDRAWN');
  });

  it('converges: a second sweep finds nothing and writes nothing', async () => {
    store.applications.push(preApproved('a'));

    await sweepExpiries(NOW);
    const second = await sweepExpiries(NOW);

    expect(second.retracted).toBe(0);
    expect(store.notifications).toHaveLength(1);
  });

  it('leaves a live enquiry alone', async () => {
    store.applications.push({ ...preApproved('a'), status: 'SUBMITTED', lender: null, expiresAt: null });

    const { retracted } = await retractFinancePreApprovals(NOW);

    expect(retracted).toBe(0);
    expect(store.applications[0].status).toBe('SUBMITTED');
    expect(store.notifications).toHaveLength(0);
  });
});
