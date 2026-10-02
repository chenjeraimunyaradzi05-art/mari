/**
 * Renewing the hold behind a marketplace order.
 *
 * The things that matter, in order: only the buyer can start one; it is a second
 * authorisation of the same amount and fee, never a second charge; the order is
 * moved onto the new hold only once that hold is authorised, in one conditional
 * write; and the old hold is released only after that, and never a hold that has
 * been captured (cancelling a captured intent must not become a refund).
 */

const stripeClient = {
  paymentIntents: {
    retrieve: jest.fn(async (_id: string): Promise<any> => ({ id: 'pi_x', status: 'requires_capture', client_secret: 'secret_x' })),
    cancel: jest.fn(async (_id: string): Promise<any> => ({ status: 'canceled' })),
  },
  charges: {
    retrieve: jest.fn(async (_id: string): Promise<any> => ({ payment_method_details: { card: { capture_before: 0 } } })),
  },
};

jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: jest.fn(() => true),
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    serviceOrder: { findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    escrowPayment: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    notification: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(async () => ({
    escrowId: 'esc-new',
    paymentIntentId: 'pi_new',
    clientSecret: 'pi_new_secret',
    amount: 25000,
    platformFee: 2500,
  })),
}));

import { prisma } from '../../utils/prisma';
import { isStripeConfigured } from '../../utils/stripe';
import { createEscrowPayment } from '../stripe-connect.service';
import { opsSnapshot, resetOpsMetrics } from '../../utils/ops-metrics';
import {
  askBuyerToRenew,
  describeOrderHold,
  noteLapsedOrderHold,
  recordCaptureDeadline,
  settleOrderRenewal,
  startOrderReauthorisation,
} from '../escrow-renewal.service';

const db: any = prisma;
const createMock = createEscrowPayment as jest.Mock;
const configured = isStripeConfigured as jest.Mock;

const NOW = new Date('2026-09-17T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

const escrow = (over: Record<string, unknown> = {}) => ({
  id: 'esc-old',
  status: 'AUTHORIZED',
  amount: 25000,
  platformFee: 2500,
  currency: 'AUD',
  description: 'Logo design — Standard',
  paymentIntentId: 'pi_old',
  createdAt: daysAgo(6),
  metadata: { serviceId: 'svc-1', packageIndex: '1' },
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  ...over,
});

const order = (over: Record<string, unknown> = {}, escrowOver: Record<string, unknown> | null = {}) => ({
  id: 'order-1',
  status: 'ACCEPTED',
  clientId: 'buyer-1',
  packageName: 'Standard',
  escrowPaymentId: 'esc-old',
  service: { id: 'svc-1', title: 'Logo design', providerId: 'seller-1' },
  escrow: escrowOver === null ? null : escrow(escrowOver),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  resetOpsMetrics();
  configured.mockReturnValue(true);
  db.escrowPayment.findMany.mockResolvedValue([]);
  db.escrowPayment.updateMany.mockResolvedValue({ count: 1 });
  db.serviceOrder.updateMany.mockResolvedValue({ count: 1 });
  db.notification.findFirst.mockResolvedValue(null);
  stripeClient.paymentIntents.cancel.mockResolvedValue({ status: 'canceled' });
  stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_x', status: 'requires_capture', client_secret: 'secret_x' });
});

describe('What the buyer can do about the hold behind an order', () => {
  it('offers a renewal only in the last two days of a hold', () => {
    expect(describeOrderHold(escrow({ createdAt: daysAgo(4) }), 'ACCEPTED', NOW).canRenew).toBe(false);
    expect(describeOrderHold(escrow({ createdAt: daysAgo(5.5) }), 'ACCEPTED', NOW).canRenew).toBe(true);
  });

  it('says when the hold runs out, by Stripe’s deadline when it has one', () => {
    expect(describeOrderHold(escrow({ createdAt: daysAgo(4) }), 'ACCEPTED', NOW).lapsesAt).toBe(
      new Date(daysAgo(4).getTime() + 7 * DAY).toISOString()
    );
    const deadline = new Date(NOW.getTime() + DAY).toISOString();
    expect(
      describeOrderHold(escrow({ createdAt: daysAgo(3), metadata: { captureBefore: deadline } }), 'ACCEPTED', NOW)
    ).toMatchObject({ lapsesAt: deadline, canRenew: true });
  });

  it('calls a cancelled or failed hold under a live order lapsed, and lets her renew it', () => {
    expect(describeOrderHold(escrow({ status: 'CANCELED' }), 'DELIVERED', NOW)).toEqual({ lapsesAt: null, canRenew: true, lapsed: true });
    expect(describeOrderHold(escrow({ status: 'FAILED' }), 'ACCEPTED', NOW)).toEqual({ lapsesAt: null, canRenew: true, lapsed: true });
  });

  it('offers nothing for a payment she has not made yet, one already taken, or an order that is over', () => {
    expect(describeOrderHold(escrow({ status: 'PENDING' }), 'PENDING', NOW).canRenew).toBe(false);
    expect(describeOrderHold(escrow({ status: 'CAPTURED' }), 'COMPLETED', NOW).canRenew).toBe(false);
    expect(describeOrderHold(escrow({ status: 'CANCELED' }), 'CANCELLED', NOW)).toEqual({ lapsesAt: null, canRenew: false, lapsed: false });
    expect(describeOrderHold(null, 'ACCEPTED', NOW).canRenew).toBe(false);
  });

  it('offers nothing for a development hold, which never runs out', () => {
    expect(describeOrderHold(escrow({ paymentIntentId: 'pi_mock_1', createdAt: daysAgo(6) }), 'ACCEPTED', NOW).canRenew).toBe(false);
  });
});

describe('Starting a fresh hold', () => {
  it('starts a second authorisation for the same amount and fee, tied to the order and the hold it renews', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { createdAt: daysAgo(6) }));

    const result = await startOrderReauthorisation('order-1', 'buyer-1', NOW);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      amount: 25000,
      currency: 'aud',
      sessionType: 'service_order',
      platformFeeAmount: 2500,
      metadata: { serviceId: 'svc-1', packageIndex: '1', renewsEscrowId: 'esc-old', renewsOrderId: 'order-1' },
      idempotencyKey: 'order-renew-esc-old-0',
    });
    expect(result).toMatchObject({ escrowId: 'esc-new', clientSecret: 'pi_new_secret', resumed: false });
    // Nothing about the old hold changes yet: it is the order's until the new one is real.
    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(db.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('starts one for a hold that has already run out', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({ status: 'DELIVERED' }, { status: 'CANCELED' }));

    await startOrderReauthorisation('order-1', 'buyer-1', NOW);

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('does not stack a second hold on her card when she presses the button twice', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { createdAt: daysAgo(6) }));
    db.escrowPayment.findMany.mockResolvedValue([
      { id: 'esc-new', status: 'PENDING', paymentIntentId: 'pi_new', amount: 25000, platformFee: 2500, currency: 'AUD' },
    ]);
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_new', status: 'requires_payment_method', client_secret: 'pi_new_secret' });

    const result = await startOrderReauthorisation('order-1', 'buyer-1', NOW);

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ escrowId: 'esc-new', clientSecret: 'pi_new_secret', resumed: true });
  });

  it('starts a new one when the renewal she began was cancelled, under a new key', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { createdAt: daysAgo(6) }));
    db.escrowPayment.findMany.mockResolvedValue([
      { id: 'esc-gone', status: 'CANCELED', paymentIntentId: 'pi_gone', amount: 25000, platformFee: 2500, currency: 'AUD' },
    ]);

    await startOrderReauthorisation('order-1', 'buyer-1', NOW);

    expect(createMock.mock.calls[0][0].idempotencyKey).toBe('order-renew-esc-old-1');
  });

  it('hands back the card step of a first payment that was begun and not finished, rather than renewing it', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({ status: 'PENDING' }, { status: 'PENDING', createdAt: daysAgo(0) }));
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_old', status: 'requires_payment_method', client_secret: 'pi_old_secret' });

    const result = await startOrderReauthorisation('order-1', 'buyer-1', NOW);

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ escrowId: 'esc-old', clientSecret: 'pi_old_secret', resumed: true });
  });

  it('refuses a hold that is still good, and says until when', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { createdAt: daysAgo(2) }));

    await expect(startOrderReauthorisation('order-1', 'buyer-1', NOW)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/still good until .*September/),
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('is the buyer’s alone: the provider is told it is not theirs to do, a stranger that there is no such order', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { createdAt: daysAgo(6) }));

    await expect(startOrderReauthorisation('order-1', 'seller-1', NOW)).rejects.toMatchObject({ statusCode: 403 });
    await expect(startOrderReauthorisation('order-1', 'stranger', NOW)).rejects.toMatchObject({ statusCode: 404 });
    db.serviceOrder.findUnique.mockResolvedValue(null);
    await expect(startOrderReauthorisation('nope', 'buyer-1', NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELLED'])('does nothing for an order that is %s', async (status) => {
    db.serviceOrder.findUnique.mockResolvedValue(order({ status }, { status: 'CANCELED' }));

    await expect(startOrderReauthorisation('order-1', 'buyer-1', NOW)).rejects.toMatchObject({ statusCode: 409 });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does nothing for an order that has already been paid for', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({ status: 'DELIVERED' }, { status: 'CAPTURED' }));

    await expect(startOrderReauthorisation('order-1', 'buyer-1', NOW)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/already been paid/),
    });
  });

  it('does nothing for a development hold or an order with no payment at all', async () => {
    db.serviceOrder.findUnique.mockResolvedValue(order({}, { paymentIntentId: 'pi_mock_1' }));
    await expect(startOrderReauthorisation('order-1', 'buyer-1', NOW)).rejects.toMatchObject({ statusCode: 409 });

    db.serviceOrder.findUnique.mockResolvedValue(order({}, null));
    await expect(startOrderReauthorisation('order-1', 'buyer-1', NOW)).rejects.toMatchObject({ statusCode: 409 });
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('Moving the order onto the new hold', () => {
  const intent = (over: Record<string, unknown> = {}) =>
    ({
      id: 'pi_new',
      status: 'requires_capture',
      metadata: { renewsEscrowId: 'esc-old', renewsOrderId: 'order-1', serviceId: 'svc-1' },
      ...over,
    }) as any;

  beforeEach(() => {
    db.escrowPayment.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.paymentIntentId === 'pi_new') return { id: 'esc-new', status: 'AUTHORIZED', buyerId: 'buyer-1', sellerId: 'seller-1' };
      if (where.id === 'esc-old') return { id: 'esc-old', status: 'AUTHORIZED', paymentIntentId: 'pi_old' };
      return null;
    });
    db.serviceOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      clientId: 'buyer-1',
      escrowPaymentId: 'esc-old',
      packageName: 'Standard',
      service: { title: 'Logo design', providerId: 'seller-1' },
    });
  });

  it('points the order at the new hold in one conditional write, then releases the old hold', async () => {
    const outcome = await settleOrderRenewal(intent());

    expect(outcome).toBe('renewed');
    // Only an order still pointing at the hold it renews is moved.
    expect(db.serviceOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', escrowPaymentId: 'esc-old' },
      data: { escrowPaymentId: 'esc-new' },
    });
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledTimes(1);
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_old');
    expect(db.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'esc-old', status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: expect.objectContaining({ status: 'CANCELED', cancelReason: 'Replaced by a fresh hold' }),
    });
    // The swap came first.
    expect(db.serviceOrder.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      stripeClient.paymentIntents.cancel.mock.invocationCallOrder[0]
    );
  });

  it('tells the provider she can carry on, and the buyer that nothing was taken', async () => {
    await settleOrderRenewal(intent());

    const notices = db.notification.create.mock.calls.map((c: any[]) => c[0].data);
    expect(notices.find((n: any) => n.userId === 'seller-1').message).toMatch(/carry on/);
    expect(notices.find((n: any) => n.userId === 'buyer-1').message).toMatch(/Nothing has been taken/);
  });

  it('does it once however many times the event is handled', async () => {
    await settleOrderRenewal(intent());
    // The second call finds the order already pointing at the new hold.
    db.serviceOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      clientId: 'buyer-1',
      escrowPaymentId: 'esc-new',
      packageName: 'Standard',
      service: { title: 'Logo design', providerId: 'seller-1' },
    });

    expect(await settleOrderRenewal(intent())).toBe('already_renewed');
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not release the old hold when a concurrent call has already moved the order', async () => {
    db.serviceOrder.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await settleOrderRenewal(intent())).toBe('already_renewed');
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('waits for the new hold to be authorised: until then the order keeps the old one', async () => {
    db.escrowPayment.findUnique.mockImplementation(async ({ where }: any) =>
      where.paymentIntentId === 'pi_new' ? { id: 'esc-new', status: 'PENDING', buyerId: 'buyer-1', sellerId: 'seller-1' } : null
    );

    expect(await settleOrderRenewal(intent())).toBe('not_held');
    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('never cancels an old hold that has been captured: that would refund a sale', async () => {
    db.escrowPayment.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.paymentIntentId === 'pi_new') return { id: 'esc-new', status: 'AUTHORIZED', buyerId: 'buyer-1', sellerId: 'seller-1' };
      if (where.id === 'esc-old') return { id: 'esc-old', status: 'CAPTURED', paymentIntentId: 'pi_old' };
      return null;
    });

    await settleOrderRenewal(intent());

    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('leaves the old hold marked as it was, and counts it, when Stripe will not release it', async () => {
    stripeClient.paymentIntents.cancel.mockRejectedValueOnce(new Error('payment_intent_unexpected_state'));
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_old', status: 'succeeded' });

    expect(await settleOrderRenewal(intent())).toBe('renewed');

    expect(db.escrowPayment.updateMany).not.toHaveBeenCalled();
    expect(opsSnapshot().operations['escrow_renewal.release']?.failure).toBe(1);
  });

  it('marks an old hold cancelled when Stripe says it was already cancelled, as a lapsed one is', async () => {
    stripeClient.paymentIntents.cancel.mockRejectedValueOnce(new Error('already canceled'));
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_old', status: 'canceled' });

    await settleOrderRenewal(intent());

    expect(db.escrowPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'esc-old', status: { in: ['PENDING', 'AUTHORIZED'] } } })
    );
    expect(opsSnapshot().operations['escrow_renewal.release']?.failure ?? 0).toBe(0);
  });

  it.each(['COMPLETED', 'CANCELLED'])('gives the new hold back when the order was %s while she was renewing', async (status) => {
    db.serviceOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status,
      clientId: 'buyer-1',
      escrowPaymentId: 'esc-old',
      packageName: null,
      service: { title: 'Logo design', providerId: 'seller-1' },
    });

    expect(await settleOrderRenewal(intent())).toBe('order_closed');

    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_new');
  });

  it('does not believe metadata that names somebody else’s order', async () => {
    db.serviceOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      clientId: 'someone-else',
      escrowPaymentId: 'esc-old',
      packageName: null,
      service: { title: 'Logo design', providerId: 'seller-1' },
    });

    expect(await settleOrderRenewal(intent())).toBe('mismatch');

    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(opsSnapshot().operations['escrow_renewal.mismatch']?.failure).toBe(1);
  });

  it('does not move an order that points at some other hold than the one the metadata says it renews', async () => {
    db.serviceOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      clientId: 'buyer-1',
      escrowPaymentId: 'esc-unrelated',
      packageName: null,
      service: { title: 'Logo design', providerId: 'seller-1' },
    });

    expect(await settleOrderRenewal(intent())).toBe('mismatch');
    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('does not move an order onto a hold for a different amount than the one it renews', async () => {
    db.escrowPayment.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.paymentIntentId === 'pi_new') return { id: 'esc-new', status: 'AUTHORIZED', buyerId: 'buyer-1', sellerId: 'seller-1', amount: 100 };
      if (where.id === 'esc-old') return { id: 'esc-old', status: 'AUTHORIZED', paymentIntentId: 'pi_old', amount: 25000 };
      return null;
    });

    expect(await settleOrderRenewal(intent())).toBe('mismatch');

    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(opsSnapshot().operations['escrow_renewal.mismatch']?.failure).toBe(1);
  });

  it('moves an order onto a hold for the same amount', async () => {
    db.escrowPayment.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.paymentIntentId === 'pi_new') return { id: 'esc-new', status: 'AUTHORIZED', buyerId: 'buyer-1', sellerId: 'seller-1', amount: 25000 };
      if (where.id === 'esc-old') return { id: 'esc-old', status: 'AUTHORIZED', paymentIntentId: 'pi_old', amount: 25000 };
      return null;
    });

    expect(await settleOrderRenewal(intent())).toBe('renewed');
  });

  it('ignores any hold that is not a renewal', async () => {
    expect(await settleOrderRenewal(intent({ metadata: { serviceId: 'svc-1' } }))).toBe('not_a_renewal');
    expect(db.escrowPayment.findUnique).not.toHaveBeenCalled();
  });
});

describe('Recording when Stripe says a hold runs out', () => {
  const authorised = { id: 'pi_new', latest_charge: 'ch_1' } as any;

  beforeEach(() => {
    db.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', createdAt: NOW, metadata: { serviceId: 'svc-1' } });
  });

  it('writes the deadline onto the hold, beside what was already there', async () => {
    const deadline = Math.floor((NOW.getTime() + 7 * DAY) / 1000);
    stripeClient.charges.retrieve.mockResolvedValue({ payment_method_details: { card: { capture_before: deadline } } });

    await recordCaptureDeadline(authorised);

    expect(stripeClient.charges.retrieve).toHaveBeenCalledWith('ch_1');
    expect(db.escrowPayment.update).toHaveBeenCalledWith({
      where: { id: 'esc-1' },
      data: { metadata: { serviceId: 'svc-1', captureBefore: new Date(deadline * 1000).toISOString() } },
    });
  });

  it('asks Stripe once: a hold with a deadline recorded is not asked about again', async () => {
    db.escrowPayment.findUnique.mockResolvedValue({
      id: 'esc-1',
      createdAt: NOW,
      metadata: { captureBefore: new Date(NOW.getTime() + 5 * DAY).toISOString() },
    });

    await recordCaptureDeadline(authorised);

    expect(stripeClient.charges.retrieve).not.toHaveBeenCalled();
  });

  it('does not keep a deadline that cannot be right', async () => {
    stripeClient.charges.retrieve.mockResolvedValue({
      payment_method_details: { card: { capture_before: Math.floor((NOW.getTime() + 400 * DAY) / 1000) } },
    });

    await recordCaptureDeadline(authorised);

    expect(db.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('does nothing for a card that gives no deadline, and never throws when Stripe is unreachable', async () => {
    stripeClient.charges.retrieve.mockResolvedValueOnce({ payment_method_details: { card: {} } });
    await recordCaptureDeadline(authorised);
    expect(db.escrowPayment.update).not.toHaveBeenCalled();

    stripeClient.charges.retrieve.mockRejectedValueOnce(new Error('timeout'));
    await expect(recordCaptureDeadline(authorised)).resolves.toBeUndefined();
  });

  it('does nothing for an intent with no charge yet, or a development hold', async () => {
    await recordCaptureDeadline({ id: 'pi_new', latest_charge: null } as any);
    await recordCaptureDeadline({ id: 'pi_mock_1', latest_charge: 'ch_1' } as any);

    expect(stripeClient.charges.retrieve).not.toHaveBeenCalled();
  });
});

describe('Telling people when a hold has run out under their order', () => {
  const lapsed = (over: Record<string, unknown> = {}) => ({ id: 'pi_old', cancellation_reason: 'automatic', ...over }) as any;

  it('asks the buyer to renew and the provider to wait', async () => {
    db.serviceOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      clientId: 'buyer-1',
      packageName: 'Standard',
      service: { title: 'Logo design', providerId: 'seller-1' },
    });

    await noteLapsedOrderHold(lapsed());

    const notices = db.notification.create.mock.calls.map((c: any[]) => c[0].data);
    const buyer = notices.find((n: any) => n.userId === 'buyer-1');
    expect(buyer.title).toBe('Your payment hold needs renewing');
    expect(buyer.link).toBe('/skills-marketplace/orders/order-1');
    expect(notices.find((n: any) => n.userId === 'seller-1').message).toMatch(/wait for that before you hand the work over/);
  });

  it('says nothing for a hold somebody cancelled, or for an order that is over', async () => {
    await noteLapsedOrderHold(lapsed({ cancellation_reason: 'requested_by_customer' }));
    expect(db.serviceOrder.findFirst).not.toHaveBeenCalled();

    db.serviceOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      clientId: 'buyer-1',
      packageName: null,
      service: { title: 'Logo design', providerId: 'seller-1' },
    });
    await noteLapsedOrderHold(lapsed());
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('does not ask the same buyer about the same order twice in a day', async () => {
    db.notification.findFirst.mockResolvedValue({ id: 'asked' });

    const wrote = await askBuyerToRenew(
      { id: 'order-1', clientId: 'buyer-1', packageName: null, service: { title: 'Logo design' } },
      'provider_waiting'
    );

    expect(wrote).toBe(false);
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('says why: the provider is waiting to deliver', async () => {
    await askBuyerToRenew({ id: 'order-1', clientId: 'buyer-1', packageName: null, service: { title: 'Logo design' } }, 'provider_waiting');

    expect(db.notification.create.mock.calls[0][0].data.message).toMatch(/provider is ready to hand the work over/);
  });
});
