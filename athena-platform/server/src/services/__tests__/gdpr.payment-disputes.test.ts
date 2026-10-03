/**
 * A card dispute is a finance record that has to outlive the member it is about,
 * and it names other members: the creators whose withdrawals were paused because
 * of it. What a member is handed when data is asked for, and what survives
 * when erasure is asked for, are both decided by its entry in the register.
 */

jest.mock('../../utils/prisma', () => ({ prisma: {} }));

import { PERSONAL_DATA_MODELS } from '../gdpr.service';

const entry = PERSONAL_DATA_MODELS.find((model) => model.model === 'paymentDispute');

describe('The card dispute record in the personal data register', () => {
  it('is registered, found by the member it was paid by, and kept rather than erased', () => {
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({ section: 'paymentDisputes', keys: ['userId'], erasure: 'retain' });
    expect(entry?.reason).toMatch(/seven years/);
  });

  it('does not keep the account alive: it holds the member id as plain text, with no link to the account', () => {
    expect(entry?.holdsAccount).toBeUndefined();
  });

  it('hands the member what is theirs, and neither ATHENA’s working notes nor the ids of other members', () => {
    const row = {
      id: 'pd-1',
      stripeDisputeId: 'dp_1',
      amount: 2900,
      currency: 'AUD',
      reason: 'fraudulent',
      status: 'lost',
      outcome: 'LOST',
      userId: 'member-1',
      effects: { applied: ['Withdrawals are paused for 2 creators who had already been gifted points.'] },
      heldCreatorProfileIds: ['cp-1', 'cp-2'],
    };

    const exported = entry!.readable!(row) as Record<string, unknown>;

    expect(exported).toMatchObject({ stripeDisputeId: 'dp_1', amount: 2900, reason: 'fraudulent', outcome: 'LOST' });
    expect('effects' in exported).toBe(false);
    expect('heldCreatorProfileIds' in exported).toBe(false);
    expect(JSON.stringify(exported)).not.toMatch(/cp-1|creators who had already been gifted/);
  });
});

describe('A creator’s own profile, which carries the pause on her withdrawals', () => {
  const profileEntry = PERSONAL_DATA_MODELS.find((model) => model.model === 'creatorProfile');

  it('hands her that withdrawals are paused, and not the staff note that says why', () => {
    const exported = profileEntry!.readable!({
      id: 'cp-1',
      userId: 'creator-1',
      pendingPayout: 6000,
      payoutHold: true,
      payoutHoldReason: 'A card dispute on a gift balance purchase (dp_1)',
      payoutHeldAt: new Date('2026-10-01T00:00:00Z'),
    }) as Record<string, unknown>;

    expect(exported).toMatchObject({ payoutHold: true, pendingPayout: 6000 });
    expect('payoutHoldReason' in exported).toBe(false);
    expect(JSON.stringify(exported)).not.toMatch(/dp_1|card dispute/);
  });

  it('is still erased with her account', () => {
    expect(profileEntry).toMatchObject({ section: 'creatorProfile', erasure: 'delete' });
  });
});
