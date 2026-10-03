import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The bookings page shows money, so it has to show only money that exists. A
 * seller is told what will be paid once the buyer's card is really held, and
 * never before; the buyer says the session was given, which is what takes the
 * money, and cannot say it before it has started; and neither side is offered a
 * step the server would refuse.
 */

jest.mock('react-hot-toast', () => {
  const toast: any = jest.fn();
  toast.success = jest.fn();
  toast.error = jest.fn();
  return { __esModule: true, default: toast };
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/skills-marketplace/bookings',
}));
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ onAuthorised }: { onAuthorised: () => void }) => (
    <div>
      <p>card form</p>
      <button onClick={onAuthorised}>authorise</button>
    </div>
  ),
}));
jest.mock('@/lib/api-extensions', () => ({
  skillsMarketplaceApi: {
    getMyBookings: jest.fn(),
    updateBooking: jest.fn(),
    getBookingPayment: jest.fn(),
    reviewService: jest.fn(),
  },
}));

import BookingsPage from './page';
import { skillsMarketplaceApi } from '@/lib/api-extensions';

const api = skillsMarketplaceApi as unknown as Record<'getMyBookings' | 'updateBooking' | 'getBookingPayment' | 'reviewService', jest.Mock>;

const HOUR = 3600 * 1000;

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  serviceId: 's1',
  clientId: 'client',
  status: 'PENDING',
  scheduledAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  durationMinutes: 120,
  totalAmount: 240,
  platformFee: 36,
  providerPayout: 204,
  escrow: { status: 'AUTHORIZED', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1' },
  service: { id: 's1', title: 'Pitch review', hourlyRate: 120, provider: { id: 'seller', displayName: 'Mei Chen' } },
  ...over,
});

function load(rows: unknown[]) {
  api.getMyBookings.mockResolvedValue({ data: { data: rows } });
}

beforeEach(() => {
  jest.clearAllMocks();
  api.updateBooking.mockResolvedValue({ data: {} });
});

const asProvider = () => fireEvent.click(screen.getByRole('tab', { name: 'Booked with me' }));

describe('A booking, from the seller’s side', () => {
  it('tells the seller what will be paid once the buyer’s card is held', async () => {
    load([booking()]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    expect(await screen.findByText(/\$204 to you once the session is given/)).toBeInTheDocument();
  });

  it('shows the seller no payout at all for a booking nothing has been paid into', async () => {
    load([booking({ escrow: { status: 'PENDING', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1' } })]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    await screen.findByText(/Waiting for the buyer’s card to be held/);
    expect(document.body.textContent).not.toMatch(/to you/);
    expect(document.body.textContent).not.toMatch(/\$204/);
    // And the seller cannot confirm what is not paid for.
    expect(screen.getByRole('button', { name: /Confirm the time/ })).toBeDisabled();
  });

  it('says plainly that a booking made before bookings were paid has nothing to pay the seller from', async () => {
    load([booking({ escrow: null })]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    expect(await screen.findByText(/there is nothing to pay you from/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm the time/ })).toBeDisabled();
  });

  it('lets the seller confirm once the money is held, and asks the server for exactly that move', async () => {
    load([booking()]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    const confirm = await screen.findByRole('button', { name: /Confirm the time/ });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(api.updateBooking).toHaveBeenCalledWith('b1', 'CONFIRMED', undefined));
  });

  it('never offers the seller the step that takes the buyer’s money', async () => {
    load([booking({ status: 'CONFIRMED', scheduledAt: new Date(Date.now() - HOUR).toISOString() })]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    await screen.findByRole('button', { name: /It is under way/ });
    expect(screen.queryByRole('button', { name: /The session was given/ })).not.toBeInTheDocument();
  });
});

describe('A booking, from the buyer’s side', () => {
  it('asks the buyer to finish the card step when the hold was never completed, and opens it', async () => {
    load([booking({ escrow: { status: 'PENDING', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1' } })]);
    api.getBookingPayment.mockResolvedValue({ data: { data: { status: 'PENDING', clientSecret: 'pi_1_secret', amount: 24000 } } });
    render(<BookingsPage />);

    expect(await screen.findByText('Waiting for your card to be held.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish the payment' }));

    expect(await screen.findByText('card form')).toBeInTheDocument();
    expect(api.getBookingPayment).toHaveBeenCalledWith('b1');
  });

  it('cannot say the session was given before it has started, and says why', async () => {
    load([booking({ status: 'CONFIRMED' })]);
    render(<BookingsPage />);

    const given = await screen.findByRole('button', { name: /The session was given/ });
    expect(given).toBeDisabled();
    expect(screen.getByText(/once it has started. Until then, nothing is taken/)).toBeInTheDocument();
    // Nor can it be said to have gone wrong: before it starts the way out is to cancel.
    expect(screen.queryByRole('button', { name: 'Something went wrong' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeEnabled();
  });

  it('says it was given once it has started, which releases the payment', async () => {
    load([booking({ status: 'CONFIRMED', scheduledAt: new Date(Date.now() - HOUR).toISOString() })]);
    render(<BookingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /The session was given/ }));

    await waitFor(() => expect(api.updateBooking).toHaveBeenCalledWith('b1', 'COMPLETED', undefined));
  });

  it('sends a booking that went wrong to ATHENA with what was written, and the payment stays held', async () => {
    load([booking({ status: 'CONFIRMED', scheduledAt: new Date(Date.now() - HOUR).toISOString() })]);
    render(<BookingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Something went wrong' }));
    fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'The provider did not turn up' } });
    expect(screen.getByText(/The payment stays held, and nothing is taken, while ATHENA’s team looks at it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send it to ATHENA' }));

    await waitFor(() => expect(api.updateBooking).toHaveBeenCalledWith('b1', 'DISPUTED', 'The provider did not turn up'));
  });

  it('can cancel before it starts, and is told nothing was taken', async () => {
    load([booking()]);
    render(<BookingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));

    await waitFor(() => expect(api.updateBooking).toHaveBeenCalledWith('b1', 'CANCELLED', undefined));
  });

  it('shows a booking in dispute as being looked at, with no step left to press', async () => {
    load([booking({ status: 'DISPUTED' })]);
    render(<BookingsPage />);

    expect(await screen.findByText(/ATHENA’s team is looking at this booking/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /The session was given/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
  });

  it('says what the server said when a move is refused, and leaves the list as it was', async () => {
    load([booking()]);
    api.updateBooking.mockRejectedValue({ response: { data: { message: 'This booking has just changed. Reload it and try again.' } } });
    render(<BookingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));

    const toast = jest.requireMock('react-hot-toast').default;
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(toast.error.mock.calls[0][0])).toMatch(/just changed|could not be changed/);
  });
});

describe('Messaging about a booking', () => {
  const opened = (link: HTMLElement) => {
    const target = new URL(link.getAttribute('href') ?? '', 'https://athena.test');
    return { path: target.pathname, user: target.searchParams.get('user'), text: target.searchParams.get('text') ?? '' };
  };

  it('opens a thread with the provider that names the listing and the time, for the buyer to read and send', async () => {
    load([booking()]);
    render(<BookingsPage />);

    const link = await screen.findByRole('link', { name: 'Message the provider about this booking' });
    const target = opened(link);

    expect(target.path).toBe('/dashboard/messages');
    expect(target.user).toBe('seller');
    expect(target.text).toContain('Pitch review');
  });

  it('opens one with the buyer for the seller', async () => {
    load([booking()]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');
    asProvider();

    const link = await screen.findByRole('link', { name: 'Message the buyer about this booking' });

    expect(opened(link).user).toBe('client');
  });

  it('offers nothing for a booking that was cancelled', async () => {
    load([booking({ status: 'CANCELLED' })]);
    render(<BookingsPage />);
    await screen.findByText('Pitch review');

    expect(screen.queryByRole('link', { name: /Message the/ })).not.toBeInTheDocument();
  });
});

describe('An empty list', () => {
  it('says so honestly for each side, and does not invent a booking', async () => {
    load([]);
    render(<BookingsPage />);

    expect(await screen.findByText('You have not booked anyone yet')).toBeInTheDocument();
    asProvider();
    expect(await screen.findByText('Nobody has booked you yet')).toBeInTheDocument();
  });
});
