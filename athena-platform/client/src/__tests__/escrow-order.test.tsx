import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The page reads its route params through React's `use`, which the React in
// this environment does not have. A settled thenable is what `use` itself
// reads, so the same params work either way.
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
    acceptOrder: jest.fn(),
    deliverOrder: jest.fn(),
    requestRevision: jest.fn(),
    completeOrder: jest.fn(),
    cancelOrder: jest.fn(),
    leaveReview: jest.fn(),
  },
}));

jest.mock('@/lib/stripe', () => ({ stripeConfigured: true, getStripe: () => Promise.resolve({}) }));

// The card step is exercised on its own; here only what the page hands it matters.
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ clientSecret, amountLabel }: { clientSecret: string; amountLabel: string }) => (
    <div data-testid="authorise" data-secret={clientSecret}>
      {amountLabel}
    </div>
  ),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import OrderPage from '@/app/skills-marketplace/orders/[id]/page';
import { skillsMarketplaceApi } from '@/lib/api-extensions';

const mockedApi = skillsMarketplaceApi as unknown as Record<string, jest.Mock>;

type Escrow = { status: string; paymentIntentId: string | null } | null;

function order(overrides: { status?: string; viewerRole?: 'client' | 'provider'; escrow?: Escrow } = {}) {
  const { escrow, ...rest } = overrides;
  return {
    id: 'order-1',
    status: 'PENDING',
    packageName: 'Standard',
    requirements: 'A logo and a one-page style sheet.',
    attachments: [],
    totalAmount: 400,
    platformFee: 40,
    providerPayout: 360,
    deliveryDays: 5,
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
    escrow:
      escrow === undefined
        ? { id: 'escrow-1', status: 'AUTHORIZED', amount: 40000, currency: 'aud', paymentIntentId: 'pi_live', capturedAt: null, canceledAt: null }
        : escrow && { id: 'escrow-1', amount: 40000, currency: 'aud', capturedAt: null, canceledAt: null, ...escrow },
    ...rest,
  };
}

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

describe('escrow order', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('describing the money', () => {
    it('tells the buyer her money is held, not spent', async () => {
      renderOrder(order({ viewerRole: 'client' }));

      expect(await screen.findByText('Held on your card')).toBeInTheDocument();
      expect(screen.getByText(/released only when they approve the work/)).toBeInTheDocument();
    });

    it('tells the provider the money is held, and what is left after the fee', async () => {
      renderOrder(order({ viewerRole: 'provider' }));

      expect(await screen.findByText('Payment held')).toBeInTheDocument();
      expect(screen.getByText('Platform fee')).toBeInTheDocument();
      expect(screen.getByText('− $40')).toBeInTheDocument();
      expect(screen.getByText('$360')).toBeInTheDocument();
    });

    it('does not show the buyer the provider cut of her order', async () => {
      renderOrder(order({ viewerRole: 'client' }));

      await screen.findByText('Held on your card');
      expect(screen.queryByText('Platform fee')).not.toBeInTheDocument();
      expect(screen.queryByText('You receive')).not.toBeInTheDocument();
    });

    it('says a released payment was released, not that it is still held', async () => {
      renderOrder(order({ status: 'COMPLETED', viewerRole: 'provider', escrow: { status: 'CAPTURED', paymentIntentId: 'pi_live' } }));

      expect(await screen.findByText('Released to you')).toBeInTheDocument();
      expect(screen.getByText(/Released when the buyer approved the delivery/)).toBeInTheDocument();
      expect(screen.queryByText(/released only when they approve the work/)).not.toBeInTheDocument();
    });

    it('says plainly that nothing was taken when the hold was released', async () => {
      renderOrder(order({ status: 'CANCELLED', viewerRole: 'client', escrow: { status: 'CANCELED', paymentIntentId: 'pi_live' } }));

      expect(await screen.findByText('Hold released')).toBeInTheDocument();
      expect(screen.getByText('Nothing was taken.')).toBeInTheDocument();
    });

    it('does not call an unpaid order held', async () => {
      renderOrder(order({ viewerRole: 'provider', escrow: { status: 'PENDING', paymentIntentId: null } }));

      expect(await screen.findByText('Awaiting payment')).toBeInTheDocument();
      expect(screen.getByText(/has not yet authorised the hold/)).toBeInTheDocument();
    });

    it('resumes an unpaid order at the amount the server holds, not its value in cents', async () => {
      mockedApi.getOrderPayment.mockResolvedValue({ data: { data: { status: 'REQUIRES_PAYMENT', clientSecret: 'pi_live_secret', amount: 40000 } } });
      renderOrder(order({ viewerRole: 'client', escrow: { status: 'PENDING', paymentIntentId: null } }));

      fireEvent.click(await screen.findByRole('button', { name: /Authorise \$400/ }));

      const authorise = await screen.findByTestId('authorise');
      expect(authorise).toHaveAttribute('data-secret', 'pi_live_secret');
      expect(authorise).toHaveTextContent('$400');
      expect(authorise).not.toHaveTextContent('40,000');
    });
  });

  describe('who may do what', () => {
    it('offers the release of the money to the buyer only', async () => {
      renderOrder(order({ status: 'DELIVERED', viewerRole: 'client' }));

      expect(await screen.findByRole('button', { name: /Approve and release payment/ })).toBeInTheDocument();
    });

    it('does not offer the provider the approval that releases her own payment', async () => {
      renderOrder(order({ status: 'DELIVERED', viewerRole: 'provider' }));

      expect(await screen.findByText(/Waiting for the buyer to approve the delivery/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve and release payment/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Request a revision/ })).not.toBeInTheDocument();
    });

    it('does not offer the buyer the delivery that only the provider can make', async () => {
      renderOrder(order({ status: 'ACCEPTED', viewerRole: 'client' }));

      expect(await screen.findByText(/The provider is working on it/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark as delivered/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Delivery message')).not.toBeInTheDocument();
    });

    it('lets the provider deliver on an accepted order', async () => {
      mockedApi.deliverOrder.mockResolvedValue({ data: {} });
      renderOrder(order({ status: 'ACCEPTED', viewerRole: 'provider' }));

      fireEvent.change(await screen.findByLabelText('Delivery message'), { target: { value: 'Files are in the shared folder.' } });
      fireEvent.click(screen.getByRole('button', { name: /Mark as delivered/ }));

      await waitFor(() => expect(mockedApi.deliverOrder).toHaveBeenCalledWith('order-1', { message: 'Files are in the shared folder.' }));
    });

    it('will not let the provider start until the buyer money is held', async () => {
      renderOrder(order({ status: 'PENDING', viewerRole: 'provider', escrow: { status: 'PENDING', paymentIntentId: null } }));

      const accept = await screen.findByRole('button', { name: 'Accept order' });
      expect(accept).toBeDisabled();
      expect(screen.getByText(/accept once the buyer’s payment is held/)).toBeInTheDocument();

      fireEvent.click(accept);
      expect(mockedApi.acceptOrder).not.toHaveBeenCalled();
    });

    it('lets the provider start once it is held', async () => {
      mockedApi.acceptOrder.mockResolvedValue({ data: {} });
      renderOrder(order({ status: 'PENDING', viewerRole: 'provider' }));

      const accept = await screen.findByRole('button', { name: 'Accept order' });
      expect(accept).toBeEnabled();

      fireEvent.click(accept);
      await waitFor(() => expect(mockedApi.acceptOrder).toHaveBeenCalledWith('order-1'));
    });

    it('asks before releasing the money, and releases nothing if she says no', async () => {
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
      mockedApi.completeOrder.mockResolvedValue({ data: {} });
      renderOrder(order({ status: 'DELIVERED', viewerRole: 'client' }));

      fireEvent.click(await screen.findByRole('button', { name: /Approve and release payment/ }));

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('$400'));
      expect(mockedApi.completeOrder).not.toHaveBeenCalled();

      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByRole('button', { name: /Approve and release payment/ }));
      await waitFor(() => expect(mockedApi.completeOrder).toHaveBeenCalledWith('order-1'));

      confirm.mockRestore();
    });

    it('does not offer a review to the provider on a completed order', async () => {
      renderOrder(order({ status: 'COMPLETED', viewerRole: 'provider', escrow: { status: 'CAPTURED', paymentIntentId: 'pi_live' } }));

      expect(await screen.findByText(/Done\. The payment has been released to you/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Leave review' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Review')).not.toBeInTheDocument();
    });

    it('shows nothing of the order to someone it is not for', async () => {
      mockedApi.getOrder.mockRejectedValue({ response: { status: 403 } });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <OrderPage params={resolvedParams('order-1') as unknown as Promise<{ id: string }>} />
        </QueryClientProvider>
      );

      expect(await screen.findByText(/not yours to see, or does not exist/)).toBeInTheDocument();
      expect(screen.queryByText('Brand refresh')).not.toBeInTheDocument();
    });
  });
});
