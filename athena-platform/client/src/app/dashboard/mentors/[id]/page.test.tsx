import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MentorProfilePage from './page';

/**
 * Booking a paid mentor is limited to the days her card hold will last.
 *
 * A paid session is held on the mentee's card from the moment it is requested, and
 * a card hold lasts about a week, so the server only books a paid session a few days
 * ahead and says how many with the times it offers. The page follows that number: it
 * stops offering dates beyond it, and says why when one is chosen anyway, instead of
 * showing a mentee an empty day and no reason. A mentor who charges nothing has no
 * limit, and the page does not invent one for her.
 */

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'mp-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

let mentor: Record<string, unknown>;

jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'me' } }),
  useMentor: () => ({ data: mentor, isLoading: false, isError: false }),
  useBookMentor: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/lib/api', () => ({
  mentorApi: { slots: jest.fn() },
}));

jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: () => <div data-testid="authorise" />,
}));

import { mentorApi } from '@/lib/api';

const slots = mentorApi.slots as unknown as jest.Mock;

/** The same local-date format the page uses, a number of days from today. */
function localDate(daysAhead: number): string {
  const day = new Date();
  day.setDate(day.getDate() + daysAhead);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MentorProfilePage />
    </QueryClientProvider>
  );
}

const dateInput = () => document.querySelector('input[type="date"]') as HTMLInputElement;

beforeEach(() => {
  jest.clearAllMocks();
  mentor = {
    id: 'mp-1',
    userId: 'mentor-1',
    hourlyRate: 100,
    isAvailable: true,
    acceptsBookings: true,
    specializations: [],
    sessionCount: 0,
    user: { id: 'mentor-1', displayName: 'Aroha', headline: 'Career mentor', bio: null },
  };
  slots.mockResolvedValue({ data: { timezone: 'Australia/Brisbane', paidSessionsDaysAhead: 6, slots: [] } });
});

describe('Booking a mentor: how far ahead', () => {
  it('stops offering dates beyond what a paid session’s card hold will last, once the server has said how many', async () => {
    renderPage();

    await waitFor(() => expect(dateInput()).toHaveAttribute('max', localDate(6)));
    expect(dateInput()).toHaveAttribute('min', localDate(0));
  });

  it('says why nothing is offered on a date past the limit, instead of an empty day with no reason', async () => {
    renderPage();
    await waitFor(() => expect(dateInput()).toHaveAttribute('max'));

    fireEvent.change(dateInput(), { target: { value: localDate(20) } });

    expect(await screen.findByText(/Paid sessions can be booked up to 6 days ahead/)).toBeInTheDocument();
    expect(screen.queryByText(/ATHENA.s standard hours, 9 to 5 on weekdays in her time/)).not.toBeInTheDocument();
  });

  it('gives the ordinary reason for an empty day inside the limit', async () => {
    renderPage();
    await waitFor(() => expect(dateInput()).toHaveAttribute('max'));

    fireEvent.change(dateInput(), { target: { value: localDate(2) } });

    expect(await screen.findByText(/Nothing free on this day/)).toBeInTheDocument();
    expect(screen.queryByText(/Paid sessions can be booked up to/)).not.toBeInTheDocument();
  });

  it('puts no limit on a mentor who charges nothing, whatever number the server sends', async () => {
    mentor = { ...mentor, hourlyRate: 0 };
    renderPage();

    await waitFor(() => expect(slots).toHaveBeenCalled());
    expect(dateInput()).not.toHaveAttribute('max');

    fireEvent.change(dateInput(), { target: { value: localDate(20) } });
    expect(await screen.findByText(/Nothing free on this day/)).toBeInTheDocument();
    expect(screen.queryByText(/Paid sessions can be booked up to/)).not.toBeInTheDocument();
  });

  it('adds no limit of its own when the server did not send one', async () => {
    slots.mockResolvedValue({ data: { timezone: 'Australia/Brisbane', slots: [] } });
    renderPage();

    await waitFor(() => expect(slots).toHaveBeenCalled());
    expect(dateInput()).not.toHaveAttribute('max');
  });
});
