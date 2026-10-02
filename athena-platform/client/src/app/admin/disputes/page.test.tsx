import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The card disputes screen is where a dispute's evidence deadline is read, and
 * the one place an admin ends the pause a dispute put on creators' withdrawals.
 * Every figure on it is Stripe's; what it must never do is show a pause that can
 * end while Stripe has not decided, or end one without being asked to confirm.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/admin-payments-api', () => ({
  adminPaymentsApi: { disputes: jest.fn(), releaseDisputeHolds: jest.fn() },
}));

import AdminDisputesPage from './page';
import toast from 'react-hot-toast';
import { adminPaymentsApi } from '@/lib/admin-payments-api';

const api = adminPaymentsApi as unknown as { disputes: jest.Mock; releaseDisputeHolds: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const DAY = 86400000;

const dispute = (over: Record<string, unknown> = {}) => ({
  id: 'pd-1',
  stripeDisputeId: 'dp_1',
  amount: 2900,
  currency: 'AUD',
  reason: 'product_not_received',
  status: 'needs_response',
  outcome: 'OPEN',
  evidenceDueBy: new Date(Date.now() + 10 * DAY).toISOString(),
  openedAt: new Date(Date.now() - 2 * DAY).toISOString(),
  closedAt: null,
  fundsWithdrawn: false,
  kind: 'GIFT_BALANCE',
  kindLabel: 'a gift balance top-up',
  member: { id: 'm1', name: 'Sarah K' },
  applied: [],
  creatorsHeld: 0,
  paymentIntentId: 'pi_1',
  ...over,
});

function respond(disputes: unknown[], nextCursor: string | null = null) {
  api.disputes.mockResolvedValue({ data: { data: { disputes, nextCursor } } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminDisputesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Card disputes', () => {
  it('asks for the open ones first, and shows what each was for, who paid, and when evidence is due', async () => {
    respond([dispute()]);
    renderPage();

    expect(await screen.findByText(/\$29\.00/)).toBeInTheDocument();
    expect(screen.getByText(/a gift balance top-up/)).toBeInTheDocument();
    expect(screen.getByText(/Paid by Sarah K/)).toBeInTheDocument();
    expect(screen.getByText(/reason: product not received/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence is due .* in 10 days\./)).toBeInTheDocument();
    expect(api.disputes).toHaveBeenCalledWith({ outcome: 'OPEN', cursor: undefined, limit: 25 });
  });

  it('is loud about a deadline that is close, and honest about one that has passed', async () => {
    respond([
      dispute({ id: 'pd-soon', stripeDisputeId: 'dp_soon', evidenceDueBy: new Date(Date.now() + 2 * DAY).toISOString() }),
      dispute({ id: 'pd-late', stripeDisputeId: 'dp_late', evidenceDueBy: new Date(Date.now() - 3 * DAY).toISOString() }),
    ]);
    renderPage();

    const soon = await screen.findByText(/in 2 days/);
    expect(soon.className).toMatch(/text-red-700/);
    expect(screen.getByText(/If it was not sent, Stripe has decided without it/)).toBeInTheDocument();
  });

  it('lists what ATHENA did when a dispute was lost, in the words the server wrote down', async () => {
    respond([
      dispute({
        outcome: 'LOST',
        status: 'lost',
        evidenceDueBy: null,
        applied: ['Took back 200 gift points from the member.', '300 points had already been spent on gifts and could not be taken back.'],
      }),
    ]);
    renderPage();

    expect(await screen.findByText('Took back 200 gift points from the member.')).toBeInTheDocument();
    expect(screen.getByText(/300 points had already been spent/)).toBeInTheDocument();
    // A decided dispute has no evidence deadline to nag about.
    expect(screen.queryByText(/Evidence is due/)).not.toBeInTheDocument();
  });

  it('narrows to the outcome that is picked', async () => {
    respond([]);
    renderPage();
    await screen.findByText(/No disputes are open/);

    fireEvent.click(screen.getByRole('tab', { name: 'Lost' }));
    await waitFor(() => expect(api.disputes).toHaveBeenLastCalledWith({ outcome: 'LOST', cursor: undefined, limit: 25 }));

    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() => expect(api.disputes).toHaveBeenLastCalledWith({ outcome: undefined, cursor: undefined, limit: 25 }));
  });

  it('says so when there are none, rather than showing an invented list', async () => {
    respond([]);
    renderPage();

    expect(await screen.findByText('No disputes are open. When Stripe reports one it will appear here.')).toBeInTheDocument();
  });

  it('says so when the list could not be loaded', async () => {
    api.disputes.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText(/The disputes could not be loaded/)).toBeInTheDocument();
  });

  it('links each dispute to Stripe, where the evidence is sent', async () => {
    respond([dispute()]);
    renderPage();

    const link = await screen.findByRole('link', { name: /Open dp_1 in Stripe/ });
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/disputes/dp_1');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('The pause on creators’ withdrawals', () => {
  it('cannot be ended while the dispute is open, and says it ends by itself if it is won', async () => {
    respond([dispute({ creatorsHeld: 2 })]);
    renderPage();

    expect(await screen.findByText(/Withdrawals are paused for 2 creators/)).toBeInTheDocument();
    expect(screen.getByText(/The pause ends by itself if it is won/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End the pause' })).not.toBeInTheDocument();
  });

  it('is ended on a decided dispute only after the admin confirms, and says how many creators it freed', async () => {
    respond([dispute({ outcome: 'LOST', status: 'lost', creatorsHeld: 1 })]);
    api.releaseDisputeHolds.mockResolvedValue({ data: { data: { released: 1 } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'End the pause' }));

    await waitFor(() => expect(api.releaseDisputeHolds).toHaveBeenCalledWith('pd-1'));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Withdrawals are open again for 1 creator.'));
  });

  it('does nothing when the admin does not confirm', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    respond([dispute({ outcome: 'LOST', status: 'lost', creatorsHeld: 1 })]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'End the pause' }));

    expect(api.releaseDisputeHolds).not.toHaveBeenCalled();
  });

  it('says nothing was changed when the server refuses', async () => {
    respond([dispute({ outcome: 'LOST', status: 'lost', creatorsHeld: 1 })]);
    api.releaseDisputeHolds.mockRejectedValue(new Error('403'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'End the pause' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('That did not go through. Nothing was changed.'));
  });

  it('says when nobody was freed because another dispute still holds them', async () => {
    respond([dispute({ outcome: 'WON', status: 'won', creatorsHeld: 1 })]);
    api.releaseDisputeHolds.mockResolvedValue({ data: { data: { released: 0 } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'End the pause' }));

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Nobody was released: another dispute still holds them, or this one is still open.')
    );
  });
});
