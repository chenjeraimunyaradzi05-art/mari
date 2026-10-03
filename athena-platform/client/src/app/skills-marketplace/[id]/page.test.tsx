import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * A listing is where a buyer decides, so two things have to be true of it. A
 * question asked from it opens a thread that already says which listing it is
 * about, so neither of them has to work out what "your service" means; and
 * booking an hour hands the buyer on to the bookings page only once the card step has
 * been dealt with, never before the price is held.
 */

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 's1' }),
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/skills-marketplace/s1',
}));
jest.mock('@/lib/stripe', () => ({ stripeConfigured: true, getStripe: () => Promise.resolve({}) }));
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
    getService: jest.fn(),
    bookService: jest.fn(),
    placeOrder: jest.fn(),
    favoriteService: jest.fn(),
    unfavoriteService: jest.fn(),
  },
}));

import ServiceDetailPage from './page';
import { skillsMarketplaceApi } from '@/lib/api-extensions';

const api = skillsMarketplaceApi as unknown as Record<'getService' | 'bookService', jest.Mock>;

const listing = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  title: 'Pitch review',
  description: 'An hour on your pitch deck.',
  category: 'PROFESSIONAL',
  hourlyRate: 120,
  minimumHours: 1,
  isAvailable: true,
  packages: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  provider: { id: 'p1', displayName: 'Mei Chen' },
  reviews: [],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Asking about a listing', () => {
  it('opens a thread with the provider that already names this listing and links to it', async () => {
    api.getService.mockResolvedValue({ data: { data: listing() } });
    render(<ServiceDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Mei Chen a question first' }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = new URL(push.mock.calls[0][0], 'https://athena.test');
    expect(target.pathname).toBe('/dashboard/messages');
    expect(target.searchParams.get('user')).toBe('p1');
    const opener = target.searchParams.get('text') ?? '';
    expect(opener).toContain('Pitch review');
    expect(opener).toContain(`${window.location.origin}/skills-marketplace/s1`);
  });

  it('offers a message on a listing with nothing to buy yet, and says it is about availability', async () => {
    api.getService.mockResolvedValue({ data: { data: listing({ hourlyRate: 0 }) } });
    render(<ServiceDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Message about availability' }));

    const target = new URL(push.mock.calls[0][0], 'https://athena.test');
    expect(target.searchParams.get('text')).toContain('Pitch review');
    // One way in, not two: nothing is offered to buy, so the question is the only button.
    expect(screen.queryByRole('button', { name: /Ask Mei Chen a question first/ })).not.toBeInTheDocument();
  });
});

describe('Booking an hour from a listing', () => {
  it('asks the server for the time, shows the card step, and moves on to the bookings page only once it is dealt with', async () => {
    api.getService.mockResolvedValue({ data: { data: listing() } });
    api.bookService.mockResolvedValue({
      data: { data: { id: 'b1', payment: { clientSecret: 'pi_1_secret_real', amount: 12000 } } },
    });
    render(<ServiceDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Book an hour' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hold \$120 and request/ }));

    await waitFor(() => expect(api.bookService).toHaveBeenCalledTimes(1));
    expect(api.bookService.mock.calls[0][0]).toBe('s1');
    expect(api.bookService.mock.calls[0][1]).toMatchObject({ durationMinutes: 60 });

    // Booked, but the price is not held yet: the buyer is still on the card step.
    expect(await screen.findByText('card form')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'authorise' }));
    expect(push).toHaveBeenCalledWith('/skills-marketplace/bookings');
  });
});
