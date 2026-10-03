/**
 * A formation fee is never simulated in production.
 *
 * ALLOW_STRIPE_SIMULATION was read from the environment whatever the environment
 * was. A production deployment with the flag on and no Stripe key was handed a
 * mock_pi_ intent, and confirming that intent marked the registration paid with
 * nothing charged: a business registration received for free, and an applicant
 * told she had paid. The flag is for development, where there is no Stripe and the
 * flow still has to run end to end; in production the service ignores it.
 *
 * The service reads the flag when it is loaded, so each case loads a fresh copy
 * under the environment it is about.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const registration = {
  id: 'reg-1',
  userId: 'user-1',
  type: 'COMPANY',
  status: 'PAYMENT_PENDING',
  businessName: 'Kestrel Studio Pty Ltd',
  data: {},
};

const prismaMock = {
  businessRegistration: {
    findUnique: jest.fn(async () => ({ ...registration })),
    update: jest.fn(async () => ({ ...registration })),
  },
  user: { findUnique: jest.fn(async () => ({ id: 'user-1', email: 'f@example.com' })) },
};

jest.mock('../../utils/prisma', () => ({ get prisma() { return prismaMock; } }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../services/admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));
jest.mock('../../services/feature-flags.service', () => ({ assertPaymentsOpen: jest.fn(async () => undefined) }));
jest.mock('../../services/stripe-connect.service', () => ({ minorUnitScale: () => 100 }));

let keyIsSet = false;
const paymentIntents = { create: jest.fn(), retrieve: jest.fn() };
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => keyIsSet,
  getStripe: () => ({ paymentIntents }),
}));

const env = process.env as Record<string, string | undefined>;
const original = { NODE_ENV: env.NODE_ENV, VERCEL_ENV: env.VERCEL_ENV, ALLOW_STRIPE_SIMULATION: env.ALLOW_STRIPE_SIMULATION };

/** A fresh copy of the service, loaded under the current environment. */
function loadService(): typeof import('../../services/formation.service') {
  let loaded: typeof import('../../services/formation.service') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the flag is read when the module loads
    loaded = require('../../services/formation.service');
  });
  return loaded as typeof import('../../services/formation.service');
}

beforeEach(() => {
  jest.clearAllMocks();
  keyIsSet = false;
  delete env.VERCEL_ENV;
});

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
});

describe('a formation payment with no Stripe key', () => {
  it('is refused in production even with ALLOW_STRIPE_SIMULATION on, and no mock intent is issued', async () => {
    env.NODE_ENV = 'production';
    env.ALLOW_STRIPE_SIMULATION = 'true';
    const service = loadService();

    await expect(service.getFormationPayment('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining('unavailable'),
    });

    // Nothing was written that could be confirmed as paid.
    expect(prismaMock.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('cannot be confirmed as paid in production on a mock intent, even with the flag on', async () => {
    env.NODE_ENV = 'production';
    env.ALLOW_STRIPE_SIMULATION = 'true';
    prismaMock.businessRegistration.findUnique.mockResolvedValueOnce({
      ...registration,
      data: { stripePaymentIntentId: 'mock_pi_reg-1' },
    } as never);
    const service = loadService();

    await expect(service.confirmFormationPayment('user-1', 'reg-1', 'mock_pi_reg-1')).rejects.toMatchObject({ statusCode: 500 });

    expect(prismaMock.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('is refused on a Vercel production build as well, which is how the web host names it', async () => {
    env.NODE_ENV = 'development';
    env.VERCEL_ENV = 'production';
    env.ALLOW_STRIPE_SIMULATION = 'true';
    const service = loadService();

    await expect(service.getFormationPayment('user-1', 'reg-1')).rejects.toMatchObject({ statusCode: 500 });
  });

  it('still runs end to end on a developer’s machine with the flag on, which is what the flag is for', async () => {
    env.NODE_ENV = 'development';
    env.ALLOW_STRIPE_SIMULATION = 'true';
    const service = loadService();

    const payment = await service.getFormationPayment('user-1', 'reg-1');

    expect(payment).toMatchObject({ paymentIntentId: 'mock_pi_reg-1', clientSecret: null });
  });

  it('runs the same way on a developer’s machine with the flag off: outside production it was never the flag that decided', async () => {
    env.NODE_ENV = 'development';
    delete env.ALLOW_STRIPE_SIMULATION;
    const service = loadService();

    const payment = await service.getFormationPayment('user-1', 'reg-1');

    expect(payment.paymentIntentId).toBe('mock_pi_reg-1');
  });
});
