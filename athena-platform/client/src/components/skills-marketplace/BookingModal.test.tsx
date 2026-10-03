import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Booking an hour of someone's time holds its price on the buyer's card, so the
 * modal has to say plainly what that does before the button is pressed: the card
 * is held and not charged, nothing is taken until the buyer says the session was given,
 * and a card only holds money for about a week, which is why a booking can only be
 * made a few days ahead.
 */

jest.mock('@/lib/stripe', () => ({ stripeConfigured: true, getStripe: () => Promise.resolve({}) }));
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ onAuthorised, onSkip, skipLabel }: { onAuthorised: () => void; onSkip: () => void; skipLabel?: string }) => (
    <div>
      <p>card form</p>
      <button onClick={onAuthorised}>authorise</button>
      <button onClick={onSkip}>{skipLabel}</button>
    </div>
  ),
}));

import { BOOKING_HORIZON_DAYS, BookingModal } from './BookingModal';

const service = {
  id: 's1',
  title: 'Pitch review',
  description: 'An hour on your pitch deck.',
  category: 'PROFESSIONAL',
  hourlyRate: 120,
  minimumHours: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  provider: { id: 'p1', displayName: 'Mei Chen' },
};

const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function openModal(overrides: Partial<React.ComponentProps<typeof BookingModal>> = {}) {
  const onBook = jest.fn(async (_data: { scheduledAt: string; durationMinutes: number; clientNotes?: string }) => ({
    bookingId: 'b1',
    clientSecret: 'pi_1_secret_real',
    amount: 24000,
  }));
  const onPaid = jest.fn();
  const onClose = jest.fn();
  render(<BookingModal isOpen onClose={onClose} service={service} onBook={onBook} onPaid={onPaid} {...overrides} />);
  return { onBook, onPaid, onClose };
}

describe('Booking an hour', () => {
  it('says the card is held, not charged, until the session has happened and the buyer says so', () => {
    openModal();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Your card is held, not charged, until the session has happened and you say so/);
    expect(text).toMatch(/if they cannot do it, or you cancel before it starts, the hold is released/);
    expect(text).toMatch(new RegExp(`up to ${BOOKING_HORIZON_DAYS} days ahead`));
  });

  it('prices it at the hourly rate and never under the listing’s minimum, and puts that on the button', () => {
    openModal();

    // One hour is asked for by default; the listing's minimum is two.
    expect(screen.getByText(/The 2-hour minimum applies/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hold \$240 and request/ })).toBeInTheDocument();
  });

  it('asks for the booking and then for the card, and does not tell the page it is done until the card step has been dealt with', async () => {
    const { onBook, onPaid, onClose } = openModal();

    fireEvent.click(screen.getByRole('button', { name: /Hold \$240 and request/ }));

    await waitFor(() => expect(screen.getByText('card form')).toBeInTheDocument());
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onBook.mock.calls[0][0]).toMatchObject({ durationMinutes: 60 });
    expect(new Date(onBook.mock.calls[0][0].scheduledAt).getTime()).toBeGreaterThan(Date.now());
    // The booking exists but its money is not held yet: the provider has not been told.
    expect(onPaid).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/is held on your card now and is only taken when you say the session was given/);

    fireEvent.click(screen.getByRole('button', { name: 'authorise' }));
    expect(onPaid).toHaveBeenCalledWith('b1');
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the buyer finish the card step later from the bookings page, without losing the booking', async () => {
    const { onPaid } = openModal();

    fireEvent.click(screen.getByRole('button', { name: /Hold \$240 and request/ }));
    await waitFor(() => expect(screen.getByText('card form')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Pay later from your bookings' }));

    expect(onPaid).toHaveBeenCalledWith('b1');
  });

  it('goes straight on when there is no card to authorise (a development hold)', async () => {
    const { onPaid } = openModal({
      onBook: jest.fn(async () => ({ bookingId: 'b2', clientSecret: 'pi_mock_1_secret_mock', amount: 24000 })),
    });

    fireEvent.click(screen.getByRole('button', { name: /Hold \$240 and request/ }));

    await waitFor(() => expect(onPaid).toHaveBeenCalledWith('b2'));
    expect(screen.queryByText('card form')).not.toBeInTheDocument();
  });

  it('shows the server’s reason, and stays on the details, when the booking is refused', async () => {
    const { onPaid } = openModal({
      onBook: jest.fn(async () => {
        throw { response: { data: { message: 'This provider has not finished setting up payouts, so bookings cannot be made yet' } } };
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Hold \$240 and request/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not finished setting up payouts/);
    expect(onPaid).not.toHaveBeenCalled();
    expect(screen.queryByText('card form')).not.toBeInTheDocument();
  });

  it('refuses a day further off than a card hold can last, before asking the server', async () => {
    const { onBook } = openModal();

    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: inDays(BOOKING_HORIZON_DAYS + 3) } });

    // The button is off and the page never asks.
    const button = screen.getByRole('button', { name: /Hold \$240 and request/ });
    expect(button).toBeDisabled();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(onBook).not.toHaveBeenCalled();
  });
});
