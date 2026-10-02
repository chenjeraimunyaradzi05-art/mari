import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A booking the buyer says was not given waits here, with the buyer's money held on
 * the card, for ATHENA's team to decide. The screen shows what the buyer said and
 * how long the hold has left, offers only the decisions that can still be made,
 * asks before making one, and says what the server said when it refuses.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/admin-payments-api', () => ({
  adminPaymentsApi: { disputedBookings: jest.fn(), settleBooking: jest.fn() },
}));

import AdminBookingDisputesPage from './page';
import toast from 'react-hot-toast';
import { adminPaymentsApi } from '@/lib/admin-payments-api';

const api = adminPaymentsApi as unknown as { disputedBookings: jest.Mock; settleBooking: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const DAY = 86400000;

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  scheduledAt: new Date(Date.now() - 2 * DAY).toISOString(),
  durationMinutes: 120,
  totalAmount: 240,
  platformFee: 36,
  providerPayout: 204,
  clientNotes: null,
  disputedAt: new Date(Date.now() - DAY).toISOString(),
  disputeReason: 'The provider did not turn up',
  service: { id: 's1', title: 'Pitch review', provider: { id: 'seller', displayName: 'Mei Chen' } },
  client: { id: 'client', displayName: 'Sarah K' },
  hold: { status: 'AUTHORIZED', lapsesAt: new Date(Date.now() + 4 * DAY).toISOString() },
  ...over,
});

function respond(rows: unknown[]) {
  api.disputedBookings.mockResolvedValue({ data: { data: rows } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminBookingDisputesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  api.settleBooking.mockResolvedValue({ data: {} });
});

describe('Bookings in dispute', () => {
  it('shows who booked whom, what it cost and what the provider would be paid, and what the buyer said', async () => {
    respond([booking()]);
    renderPage();

    expect(await screen.findByText('Pitch review')).toBeInTheDocument();
    expect(screen.getByText(/Sarah K booked Mei Chen/)).toBeInTheDocument();
    expect(screen.getByText('$240')).toBeInTheDocument();
    expect(screen.getByText('$204 to the provider')).toBeInTheDocument();
    expect(screen.getByText('The provider did not turn up')).toBeInTheDocument();
  });

  it('says so, and invents no reason, when the buyer did not give one', async () => {
    respond([booking({ disputeReason: null })]);
    renderPage();

    expect(await screen.findByText('The buyer did not say why.')).toBeInTheDocument();
  });

  it('says when the hold runs out, loudly when it is close, because after that there is nothing to release', async () => {
    respond([
      booking({ id: 'b-later' }),
      booking({ id: 'b-soon', hold: { status: 'AUTHORIZED', lapsesAt: new Date(Date.now() + 1.5 * DAY).toISOString() } }),
    ]);
    renderPage();

    await screen.findAllByText(/runs out on/);
    const soon = screen.getByText(/in 2 days/);
    expect(soon.className).toMatch(/text-red-700/);
    expect(screen.getByText(/in 4 days/).className).not.toMatch(/text-red-700/);
    expect(screen.getAllByText(/Decide before then/)).toHaveLength(2);
  });

  it('offers only what can still be done when the hold has ended: closing, not releasing', async () => {
    respond([booking({ hold: { status: 'CANCELED', lapsesAt: null } })]);
    renderPage();

    expect(await screen.findByText(/no money left to release/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release to the provider' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close the booking' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Give it back to the buyer' })).not.toBeInTheDocument();
  });

  it('when the payment has already gone to the provider, offers only to close it as paid and never to give it back', async () => {
    respond([booking({ hold: { status: 'CAPTURED', lapsesAt: null } })]);
    renderPage();

    expect(await screen.findByText(/already been released to the provider/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close it as paid' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Give it back to the buyer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close the booking' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close it as paid' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('already been released'));
    await waitFor(() => expect(api.settleBooking).toHaveBeenCalledWith('b1', 'release', undefined));
  });

  it('says nothing was ever held for a booking made before bookings were paid', async () => {
    respond([booking({ hold: null })]);
    renderPage();

    expect(await screen.findByText(/Nothing was ever held for this booking/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release to the provider' })).toBeDisabled();
  });
});

describe('Deciding', () => {
  it('releases the payment only after asking, with the note that was written, and says both people were told', async () => {
    respond([booking()]);
    renderPage();

    fireEvent.change(await screen.findByLabelText(/A note, if you want one/), { target: { value: 'Provider confirmed it was given' } });
    fireEvent.click(screen.getByRole('button', { name: 'Release to the provider' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Release $240 to Mei Chen'));
    await waitFor(() => expect(api.settleBooking).toHaveBeenCalledWith('b1', 'release', 'Provider confirmed it was given'));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Released to the provider. Both people have been told.'));
  });

  it('gives the hold back to the buyer’s card, with no note when none was written', async () => {
    respond([booking()]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Give it back to the buyer' }));

    await waitFor(() => expect(api.settleBooking).toHaveBeenCalledWith('b1', 'return', undefined));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Given back to the buyer’s card. Both people have been told.'));
  });

  it('does nothing when the decision is not confirmed', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    respond([booking()]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Release to the provider' }));
    fireEvent.click(screen.getByRole('button', { name: 'Give it back to the buyer' }));

    expect(api.settleBooking).not.toHaveBeenCalled();
  });

  it('says what the server said when it refuses, and leaves the booking where it is', async () => {
    respond([booking()]);
    api.settleBooking.mockRejectedValue({ response: { data: { message: 'This booking has just been settled by somebody else.' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Release to the provider' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('This booking has just been settled by somebody else.'));
    expect(screen.getByText('Pitch review')).toBeInTheDocument();
  });
});

describe('The list', () => {
  it('says so when no booking is in dispute, rather than showing an invented one', async () => {
    respond([]);
    renderPage();

    expect(await screen.findByText(/No bookings are in dispute/)).toBeInTheDocument();
  });

  it('says so when it could not be loaded', async () => {
    api.disputedBookings.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText(/The bookings could not be loaded/)).toBeInTheDocument();
  });
});
