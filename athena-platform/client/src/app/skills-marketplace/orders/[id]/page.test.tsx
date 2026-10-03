import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The order page and a delivery the buyer says was wrong.
 *
 * A buyer could only send a delivery back for a revision or let the hold lapse.
 * She can now say it was not delivered as agreed, or that nothing came by the due
 * date; the server freezes the order with the money held. The page offers that
 * only when the server would allow it, asks what went wrong, closes every other
 * button while the dispute is open, and lets the provider answer once.
 */

// The page reads its route params with React's `use`; it is answered directly.
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  use: () => ({ id: 'o1' }),
}));

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/stripe', () => ({ stripeConfigured: false }));
jest.mock('@/components/payments/PaymentIntentForm', () => ({ PaymentIntentForm: () => <div data-testid="pay" /> }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/api-extensions', () => ({
  skillsMarketplaceApi: {
    getOrder: jest.fn(),
    getMyOrders: jest.fn(),
    getReceivedOrders: jest.fn(),
    getOrderPayment: jest.fn(),
    renewOrderPayment: jest.fn(),
    acceptOrder: jest.fn(),
    deliverOrder: jest.fn(),
    requestRevision: jest.fn(),
    completeOrder: jest.fn(),
    cancelOrder: jest.fn(),
    leaveReview: jest.fn(),
    disputeOrder: jest.fn(),
    respondToOrderDispute: jest.fn(),
  },
}));

import OrderPage from './page';
import { skillsMarketplaceApi } from '@/lib/api-extensions';

const api = skillsMarketplaceApi as unknown as Record<string, jest.Mock>;

const DAY = 86400000;

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    status: 'DELIVERED',
    packageName: 'Standard',
    requirements: 'A one-page deck',
    attachments: [],
    totalAmount: 240,
    platformFee: 36,
    providerPayout: 204,
    deliveryDays: 3,
    dueAt: new Date(Date.now() + 2 * DAY).toISOString(),
    deliveredAt: new Date(Date.now() - DAY).toISOString(),
    completedAt: null,
    cancelledAt: null,
    deliveryMessage: 'Here is the deck',
    revisionReason: null,
    cancellationReason: null,
    disputedAt: null,
    disputeReason: null,
    disputeResponse: null,
    disputeRespondedAt: null,
    disputeResolution: null,
    cardDisputeOpen: false,
    createdAt: new Date(Date.now() - 4 * DAY).toISOString(),
    viewerRole: 'client',
    service: { id: 'svc', title: 'Pitch deck polish', providerId: 'seller' },
    client: { id: 'buyer', displayName: 'Mei', avatar: null },
    escrow: { id: 'esc', status: 'AUTHORIZED', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1', capturedAt: null, canceledAt: null },
    hold: { lapsesAt: new Date(Date.now() + 5 * DAY).toISOString(), canRenew: false, lapsed: false },
    ...over,
  };
}

function show(row: unknown) {
  api.getOrder.mockResolvedValue({ data: { data: row } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrderPage params={Promise.resolve({ id: 'o1' })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.disputeOrder.mockResolvedValue({ data: { success: true } });
  api.respondToOrderDispute.mockResolvedValue({ data: { success: true } });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('a buyer with a delivery in hand', () => {
  it('can say it was not delivered as agreed, and sends what she wrote, and nothing until she has written it', async () => {
    show(order());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'This was not delivered as agreed' }));
    const send = screen.getByRole('button', { name: 'Send to ATHENA’s team' });
    expect(send).toBeDisabled();
    expect(screen.getByText(/The hold stays on your card, and nothing is taken/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('What went wrong'), { target: { value: 'It is the wrong deck entirely' } });
    fireEvent.click(send);

    await waitFor(() => expect(api.disputeOrder).toHaveBeenCalledWith('o1', 'It is the wrong deck entirely'));
    expect(api.requestRevision).not.toHaveBeenCalled();
    expect(api.completeOrder).not.toHaveBeenCalled();
  });

  it('keeps approving and asking for a revision beside it', async () => {
    show(order());
    renderPage();

    expect(await screen.findByRole('button', { name: /Approve and release payment/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request a revision' })).toBeInTheDocument();
  });
});

describe('a buyer whose order is late', () => {
  it('can say nothing came once the due date has passed', async () => {
    show(order({ status: 'ACCEPTED', deliveredAt: null, deliveryMessage: null, dueAt: new Date(Date.now() - DAY).toISOString() }));
    renderPage();

    expect(await screen.findByText(/The due date has passed and nothing has been delivered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nothing was delivered by the due date' }));
    fireEvent.change(screen.getByLabelText('What went wrong'), { target: { value: 'Three days late and silent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to ATHENA’s team' }));

    await waitFor(() => expect(api.disputeOrder).toHaveBeenCalledWith('o1', 'Three days late and silent'));
  });

  it('is not offered that while the provider still has time, only cancelling', async () => {
    show(order({ status: 'ACCEPTED', deliveredAt: null, deliveryMessage: null }));
    renderPage();

    expect(await screen.findByText('The provider is working on it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nothing was delivered by the due date' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });
});

describe('an order in dispute', () => {
  const disputed = (over: Record<string, unknown> = {}) =>
    order({
      status: 'DISPUTED',
      disputedAt: new Date(Date.now() - DAY / 2).toISOString(),
      disputeReason: 'It is the wrong deck entirely',
      ...over,
    });

  it('shows the buyer that the money is held and the team is deciding, with no other button', async () => {
    show(disputed());
    renderPage();

    expect(await screen.findByText(/You told us this order was not delivered as agreed/)).toBeInTheDocument();
    expect(screen.getByText('Held while ATHENA’s team decides. Nothing is released or given back until they do.')).toBeInTheDocument();
    expect(screen.getByText('It is the wrong deck entirely')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve and release payment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a revision' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This was not delivered as agreed' })).not.toBeInTheDocument();
  });

  it('lets the provider answer once, and shows the buyer that answer', async () => {
    show(disputed({ viewerRole: 'provider' }));
    renderPage();

    expect(await screen.findByText(/The buyer says this order was not delivered as agreed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as delivered' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Your answer to the dispute'), { target: { value: 'I sent the deck in the brief, on day two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send your answer to the team' }));

    await waitFor(() => expect(api.respondToOrderDispute).toHaveBeenCalledWith('o1', 'I sent the deck in the brief, on day two'));
  });

  it('offers the provider no second answer once one is recorded', async () => {
    show(disputed({ viewerRole: 'provider', disputeResponse: 'I sent the deck in the brief', disputeRespondedAt: new Date().toISOString() }));
    renderPage();

    expect(await screen.findByText('Your answer has been recorded for the team.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer to the dispute')).not.toBeInTheDocument();
    expect(screen.getByText('I sent the deck in the brief')).toBeInTheDocument();
  });

  it('tells both people when the buyer’s bank has also disputed the payment', async () => {
    show(disputed({ cardDisputeOpen: true }));
    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent('Your bank has opened a dispute on this payment');
  });
});

describe('a decided dispute', () => {
  it('says the team gave the payment back when the order was cancelled that way', async () => {
    show(order({ status: 'CANCELLED', cancelledAt: new Date().toISOString(), disputeResolution: 'REFUNDED', escrow: { id: 'esc', status: 'CANCELED', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1', capturedAt: null, canceledAt: new Date().toISOString() } }));
    renderPage();

    expect(await screen.findByText(/The payment was given back to the buyer/)).toBeInTheDocument();
  });
});
