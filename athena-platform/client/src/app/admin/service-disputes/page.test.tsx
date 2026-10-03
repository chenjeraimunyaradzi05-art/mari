import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A session or an order the buyer says was not delivered waits here, with the
 * buyer's money held, for ATHENA's team to decide. The screen shows what each
 * person said and how long the hold has left, offers only the decisions that can
 * still be made, never offers to give back a payment the buyer's bank is also
 * disputing, asks before deciding, and says what the server said when it refuses.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/admin-payments-api', () => ({
  adminPaymentsApi: { serviceDisputes: jest.fn(), resolveServiceDispute: jest.fn() },
}));

import AdminServiceDisputesPage from './page';
import toast from 'react-hot-toast';
import { adminPaymentsApi } from '@/lib/admin-payments-api';

const api = adminPaymentsApi as unknown as { serviceDisputes: jest.Mock; resolveServiceDispute: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const DAY = 86400000;

const session = (over: Record<string, unknown> = {}) => ({
  kind: 'session',
  id: 's1',
  title: 'Mentoring session',
  buyer: { id: 'mentee', name: 'Sarah K' },
  provider: { id: 'mentor', name: 'Aroha' },
  amount: 37.5,
  currency: 'AUD',
  providerPayout: 30,
  scheduledAt: new Date(Date.now() - 2 * DAY).toISOString(),
  disputedAt: new Date(Date.now() - DAY).toISOString(),
  reason: 'My mentor never joined the call',
  response: null,
  respondedAt: null,
  hold: { status: 'AUTHORIZED', lapsesAt: new Date(Date.now() + 4 * DAY).toISOString() },
  cardDispute: null,
  ...over,
});

const order = (over: Record<string, unknown> = {}) => ({
  kind: 'order',
  id: 'o1',
  title: 'Pitch deck polish · Standard',
  buyer: { id: 'buyer', name: 'Mei Chen' },
  provider: { id: 'seller', name: 'Tui R' },
  amount: 240,
  currency: 'AUD',
  providerPayout: 204,
  scheduledAt: null,
  disputedAt: new Date(Date.now() - DAY).toISOString(),
  reason: 'The file was the wrong deck',
  response: 'I sent the deck she asked for in the brief',
  respondedAt: new Date(Date.now() - DAY / 2).toISOString(),
  hold: { status: 'AUTHORIZED', lapsesAt: new Date(Date.now() + 1.5 * DAY).toISOString() },
  cardDispute: null,
  ...over,
});

function respond(rows: unknown[]) {
  api.serviceDisputes.mockResolvedValue({ data: { data: { disputes: rows } } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminServiceDisputesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  api.resolveServiceDispute.mockResolvedValue({ data: {} });
});

describe('Sessions and orders in dispute', () => {
  it('shows each one with who is in it, the figures to the cent, what the buyer said and what the provider answered', async () => {
    respond([session(), order()]);
    renderPage();

    expect(await screen.findByText(/Sarah K booked Aroha for/)).toBeInTheDocument();
    expect(screen.getByText('$37.50')).toBeInTheDocument();
    expect(screen.getByText('$30 to the provider')).toBeInTheDocument();
    expect(screen.getByText('My mentor never joined the call')).toBeInTheDocument();
    expect(screen.getByText('The provider has not answered yet.')).toBeInTheDocument();

    expect(screen.getByText('Mei Chen ordered from Tui R')).toBeInTheDocument();
    expect(screen.getByText('$240')).toBeInTheDocument();
    expect(screen.getByText('The file was the wrong deck')).toBeInTheDocument();
    expect(screen.getByText('I sent the deck she asked for in the brief')).toBeInTheDocument();
  });

  it('says when the hold runs out, loudly when it is close', async () => {
    respond([session(), order()]);
    renderPage();

    await screen.findAllByText(/runs out on/);
    expect(screen.getByText(/in 2 days/).className).toMatch(/text-red-700/);
    expect(screen.getByText(/in 4 days/).className).not.toMatch(/text-red-700/);
  });

  it('never offers to give back a payment the buyer’s bank is also disputing, and says why', async () => {
    respond([order({ cardDispute: { stripeDisputeId: 'dp_9', evidenceDueBy: new Date(Date.now() + 5 * DAY).toISOString() } })]);
    renderPage();

    expect(await screen.findByText(/bank has also disputed this payment \(dp_9\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give it back to the buyer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Release to the provider' })).toBeEnabled();
  });

  it('offers only closing, not releasing, once the hold has ended', async () => {
    respond([order({ hold: { status: 'CANCELED', lapsesAt: null } })]);
    renderPage();

    expect(await screen.findByText(/no money left to release/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release to the provider' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close the dispute' })).toBeEnabled();
  });

  it('when the payment has already gone to the provider, offers to close it as paid or to refund the buyer', async () => {
    respond([session({ hold: { status: 'CAPTURED', lapsesAt: null } })]);
    renderPage();

    expect(await screen.findByText(/already been released to the provider/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refund the buyer' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Aroha’s share is taken back'));
    await waitFor(() => expect(api.resolveServiceDispute).toHaveBeenCalledWith('session', 's1', 'refund', undefined));
  });
});

describe('Deciding', () => {
  it('releases the payment only after asking, with the note that was written, and says both people were told', async () => {
    respond([order()]);
    renderPage();

    fireEvent.change(await screen.findByLabelText(/A note, if you want one/), { target: { value: 'Provider showed the delivery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Release to the provider' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Release $240 to Tui R'));
    await waitFor(() => expect(api.resolveServiceDispute).toHaveBeenCalledWith('order', 'o1', 'release', 'Provider showed the delivery'));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Released to the provider. Both people have been told.'));
  });

  it('gives a session’s hold back to the mentee, with no note when none was written', async () => {
    respond([session()]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Give it back to the buyer' }));

    await waitFor(() => expect(api.resolveServiceDispute).toHaveBeenCalledWith('session', 's1', 'refund', undefined));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Given back to the buyer. Both people have been told.'));
  });

  it('does nothing when the decision is not confirmed', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    respond([order()]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Release to the provider' }));
    fireEvent.click(screen.getByRole('button', { name: 'Give it back to the buyer' }));

    expect(api.resolveServiceDispute).not.toHaveBeenCalled();
  });

  it('says what the server said when it refuses, and leaves the dispute where it is', async () => {
    respond([order()]);
    api.resolveServiceDispute.mockRejectedValue({ response: { data: { message: 'This order has just been decided by somebody else.' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Release to the provider' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('This order has just been decided by somebody else.'));
    expect(screen.getByText('The file was the wrong deck')).toBeInTheDocument();
  });
});

describe('The list', () => {
  it('says so when nothing is in dispute, rather than showing an invented one', async () => {
    respond([]);
    renderPage();

    expect(await screen.findByText(/No session or order is in dispute/)).toBeInTheDocument();
  });

  it('says so when it could not be loaded', async () => {
    api.serviceDisputes.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText(/The disputes could not be loaded/)).toBeInTheDocument();
  });
});
