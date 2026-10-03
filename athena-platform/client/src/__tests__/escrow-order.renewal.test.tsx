import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A card hold lasts about a week and a package can take longer. The order page
 * has to say so to both people, give the buyer a way to put a fresh hold on her
 * card before the first runs out, and stop the provider handing work over (and
 * the buyer approving it) while there is nothing held to pay from.
 */

// The page reads its route params through React's `use`, which the React in
// this environment does not have. See escrow-order.test.tsx.
const mockUse = <T,>(value: PromiseLike<T> & { value?: T }): T | undefined =>
  value && typeof value.then === 'function' ? value.value : (value as unknown as T);

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  if (typeof actual.use === 'function') return actual;
  return new Proxy(actual, {
    get: (target: Record<string, unknown>, key: string) => (key === 'use' ? mockUse : target[key]),
  });
});

jest.mock('@/lib/api-extensions', () => ({
  skillsMarketplaceApi: {
    getOrder: jest.fn(),
    getOrderPayment: jest.fn(),
    renewOrderPayment: jest.fn(),
    acceptOrder: jest.fn(),
    deliverOrder: jest.fn(),
    requestRevision: jest.fn(),
    completeOrder: jest.fn(),
    cancelOrder: jest.fn(),
    leaveReview: jest.fn(),
  },
}));

jest.mock('@/lib/stripe', () => ({ stripeConfigured: true, getStripe: () => Promise.resolve({}) }));

// The card step is Stripe's own; what matters is that it is shown for the new
// hold and that authorising it is reported back.
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ clientSecret, onAuthorised }: { clientSecret: string; onAuthorised: () => void }) => (
    <button type="button" onClick={onAuthorised}>
      card form for {clientSecret}
    </button>
  ),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import toast from 'react-hot-toast';
import OrderPage from '@/app/skills-marketplace/orders/[id]/page';
import { skillsMarketplaceApi } from '@/lib/api-extensions';

const mockedApi = skillsMarketplaceApi as unknown as Record<string, jest.Mock>;
const DAY = 24 * 60 * 60 * 1000;

type Hold = { lapsesAt: string | null; canRenew: boolean; lapsed: boolean };

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: 'ACCEPTED',
    packageName: 'Standard',
    requirements: 'A logo and a one-page style sheet.',
    attachments: [],
    totalAmount: 250,
    platformFee: 37.5,
    providerPayout: 212.5,
    deliveryDays: 21,
    dueAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    deliveryMessage: null,
    revisionReason: null,
    cancellationReason: null,
    createdAt: '2026-01-05T00:00:00.000Z',
    viewerRole: 'client',
    service: { id: 'service-1', title: 'Brand refresh', providerId: 'provider-1' },
    client: { id: 'client-1', displayName: 'Ada Lovelace', avatar: null },
    escrow: { id: 'escrow-1', status: 'AUTHORIZED', amount: 25000, currency: 'aud', paymentIntentId: 'pi_live', capturedAt: null, canceledAt: null },
    hold: { lapsesAt: new Date(Date.now() + DAY).toISOString(), canRenew: true, lapsed: false } as Hold,
    ...over,
  };
}

const lapsedEscrow = { id: 'escrow-1', status: 'CANCELED', amount: 25000, currency: 'aud', paymentIntentId: 'pi_live', capturedAt: null, canceledAt: '2026-01-12T00:00:00.000Z' };
const lapsedHold: Hold = { lapsesAt: null, canRenew: true, lapsed: true };

function resolvedParams(id: string) {
  const value = { id };
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
}

function renderOrder(data: ReturnType<typeof order>) {
  mockedApi.getOrder.mockResolvedValue({ data: { data } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrderPage params={resolvedParams('order-1') as unknown as Promise<{ id: string }>} />
    </QueryClientProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('The buyer, with a hold that is about to run out', () => {
  it('says when it runs out and offers to renew it', async () => {
    renderOrder(order());

    expect(await screen.findByText(/The hold on your card runs out on/)).toBeInTheDocument();
    expect(screen.getByText(/Renew it now so the provider is sure to be paid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew the hold on my card' })).toBeInTheDocument();
  });

  it('starts the renewal and shows the card form for the new hold', async () => {
    mockedApi.renewOrderPayment.mockResolvedValue({ data: { data: { clientSecret: 'pi_new_secret', amount: 25000, resumed: false } } });
    renderOrder(order());

    fireEvent.click(await screen.findByRole('button', { name: 'Renew the hold on my card' }));

    expect(mockedApi.renewOrderPayment).toHaveBeenCalledWith('order-1');
    expect(await screen.findByText('card form for pi_new_secret')).toBeInTheDocument();
  });

  it('says it is renewed, and that nothing was charged, once the new hold is authorised', async () => {
    mockedApi.renewOrderPayment.mockResolvedValue({ data: { data: { clientSecret: 'pi_new_secret', amount: 25000 } } });
    renderOrder(order());

    fireEvent.click(await screen.findByRole('button', { name: 'Renew the hold on my card' }));
    fireEvent.click(await screen.findByText('card form for pi_new_secret'));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Renewed. Nothing has been charged, and the old hold is released.')
    );
  });

  it('says what went wrong when the renewal cannot be started', async () => {
    mockedApi.renewOrderPayment.mockRejectedValue({ response: { data: { message: 'The hold on your card is still good until Friday.' } } });
    renderOrder(order());

    fireEvent.click(await screen.findByRole('button', { name: 'Renew the hold on my card' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The hold on your card is still good until Friday.'));
  });

  it('offers no renewal while the hold has days left, but still says when it ends', async () => {
    renderOrder(order({ hold: { lapsesAt: new Date(Date.now() + 5 * DAY).toISOString(), canRenew: false, lapsed: false } }));

    expect(await screen.findByText(/we will ask you to renew it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Renew the hold/ })).not.toBeInTheDocument();
  });
});

describe('The buyer, with a hold that has ended', () => {
  it('is told nothing is held, and offered a way to hold the payment again', async () => {
    renderOrder(order({ escrow: lapsedEscrow, hold: lapsedHold }));

    expect(await screen.findByText(/nothing is held for this work right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hold the payment again' })).toBeInTheDocument();
  });

  it('cannot approve a delivery until the hold is back, and is told why', async () => {
    renderOrder(order({ status: 'DELIVERED', escrow: lapsedEscrow, hold: lapsedHold }));

    expect(await screen.findByRole('button', { name: /Approve and release payment/ })).toBeDisabled();
    expect(screen.getByText(/Renew it under Payment, then approve the delivery/)).toBeInTheDocument();
  });
});

describe('The provider, with a hold that has ended', () => {
  it('cannot mark the work delivered, and is told the buyer has been asked to renew', async () => {
    renderOrder(order({ viewerRole: 'provider', escrow: lapsedEscrow, hold: lapsedHold }));

    expect(await screen.findByRole('button', { name: 'Mark as delivered' })).toBeDisabled();
    expect(screen.getByText(/once the buyer’s payment is held again/)).toBeInTheDocument();
    expect(screen.getByText(/Please wait for that before you hand the work over/)).toBeInTheDocument();
  });

  it('is not offered the renew button, which is the buyer’s', async () => {
    renderOrder(order({ viewerRole: 'provider', escrow: lapsedEscrow, hold: lapsedHold }));

    await screen.findByRole('button', { name: 'Mark as delivered' });
    expect(screen.queryByRole('button', { name: /Hold the payment again|Renew the hold/ })).not.toBeInTheDocument();
  });

  it('can deliver while the hold stands, and is told when it runs out', async () => {
    renderOrder(order({ viewerRole: 'provider' }));

    expect(await screen.findByRole('button', { name: 'Mark as delivered' })).toBeEnabled();
    expect(screen.getByText(/The hold on the buyer’s card runs out on/)).toBeInTheDocument();
  });
});
