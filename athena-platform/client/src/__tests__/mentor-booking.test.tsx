import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MentorProfilePage from '@/app/dashboard/mentors/[id]/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'mentor-1' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/hooks', () => ({
  useAuthStore: jest.fn(),
  useMentor: jest.fn(),
  useBookMentor: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  mentorApi: { slots: jest.fn() },
}));

// The card step is exercised on its own; here only what the page hands it matters.
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ clientSecret, amountLabel }: { clientSecret: string; amountLabel: string }) => (
    <div data-testid="authorise" data-secret={clientSecret}>
      {amountLabel}
    </div>
  ),
}));

import { useAuthStore, useBookMentor, useMentor } from '@/lib/hooks';
import { mentorApi } from '@/lib/api';

const mockedAuth = useAuthStore as unknown as jest.Mock;
const mockedMentor = useMentor as unknown as jest.Mock;
const mockedBooking = useBookMentor as unknown as jest.Mock;
const mockedApi = mentorApi as unknown as { slots: jest.Mock };

type Slot = { start: string; end: string; displayTime: string };

const slot = (displayTime: string, start: string): Slot => ({ start, end: start, displayTime });

const MORNING = slot('11:00 am', '2099-03-01T01:00:00.000Z');
const AFTERNOON = slot('2:30 pm', '2099-03-01T04:30:00.000Z');

function mentor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mentor-1',
    userId: 'mentor-user',
    hourlyRate: 120,
    rating: 4.5,
    reviewCount: 8,
    sessionCount: 21,
    yearsExperience: 7,
    isAvailable: true,
    // The server answers bookability now rather than shipping the connected
    // account id for the client to infer it from. When that id was taken off
    // the public payload the old fallback read undefined for everybody, and the
    // page told every visitor that every mentor had not finished setting up.
    acceptsBookings: true,
    specializations: ['Product'],
    user: { id: 'mentor-user', displayName: 'Grace Hopper', headline: 'Engineering leader', bio: null, avatar: null },
    ...overrides,
  };
}

const book = jest.fn();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MentorProfilePage />
    </QueryClientProvider>
  );
}

const submitButton = () => screen.getByRole('button', { name: /Pick a time|Request session|Requesting/ });

describe('mentor booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ user: { id: 'mentee-1' } });
    mockedMentor.mockReturnValue({ data: mentor(), isLoading: false, isError: false });
    mockedBooking.mockReturnValue({ mutate: book, isPending: false });
    mockedApi.slots.mockResolvedValue({ data: { timezone: 'Australia/Brisbane', slots: [MORNING, AFTERNOON] } });
  });

  it('offers the hours the mentor is genuinely free, asked of the API for the day chosen', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: '11:00 am' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2:30 pm' })).toBeInTheDocument();
    expect(mockedApi.slots).toHaveBeenCalledWith('mentor-1', expect.any(String), expect.anything());
    expect(screen.getByText(/Times shown in Australia\/Brisbane/)).toBeInTheDocument();
  });

  it('asks again for another day, and offers that day, not the first one', async () => {
    mockedApi.slots.mockImplementation((_id: string, date: string) =>
      Promise.resolve({
        data: { timezone: 'Australia/Brisbane', slots: date === '2099-03-02' ? [slot('9:00 am', '2099-03-02T23:00:00.000Z')] : [MORNING, AFTERNOON] },
      })
    );
    renderPage();
    await screen.findByRole('button', { name: '11:00 am' });

    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2099-03-02' } });

    expect(await screen.findByRole('button', { name: '9:00 am' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '11:00 am' })).not.toBeInTheDocument();
    expect(mockedApi.slots).toHaveBeenLastCalledWith('mentor-1', '2099-03-02', expect.anything());
  });

  it('says so when a day has nothing free, instead of offering times she never gave', async () => {
    mockedApi.slots.mockResolvedValue({ data: { timezone: 'Australia/Brisbane', slots: [] } });
    renderPage();

    expect(await screen.findByText(/Nothing free on this day/)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('says so when her availability cannot be loaded, rather than showing an empty day', async () => {
    mockedApi.slots.mockRejectedValue(new Error('unreachable'));
    renderPage();

    expect(await screen.findByText(/could not load her availability/i)).toBeInTheDocument();
  });

  it('will not take a booking until a time is chosen', async () => {
    renderPage();
    const morning = await screen.findByRole('button', { name: '11:00 am' });

    expect(submitButton()).toHaveTextContent('Pick a time');
    expect(submitButton()).toBeDisabled();
    fireEvent.click(submitButton());
    expect(book).not.toHaveBeenCalled();

    fireEvent.click(morning);

    expect(submitButton()).toHaveTextContent('Request session');
    expect(submitButton()).toBeEnabled();
  });

  it('forgets the time that was chosen when the day changes', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '11:00 am' }));
    expect(submitButton()).toHaveTextContent('Request session');

    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2099-03-02' } });

    await waitFor(() => expect(submitButton()).toHaveTextContent('Pick a time'));
    expect(submitButton()).toBeDisabled();
  });

  it('requests the slot that was chosen, at the length that was chosen', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '2:30 pm' }));
    fireEvent.click(screen.getByRole('button', { name: '90 min' }));
    fireEvent.change(screen.getByLabelText(/What would you like to cover/), { target: { value: 'Pricing my first offer' } });
    fireEvent.click(submitButton());

    expect(book).toHaveBeenCalledTimes(1);
    expect(book.mock.calls[0][0]).toEqual({
      mentorId: 'mentor-1',
      scheduledAt: new Date(AFTERNOON.start).toISOString(),
      durationMinutes: 90,
      note: 'Pricing my first offer',
    });
  });

  it('asks her to authorise the amount the server quoted, not the page estimate', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '11:00 am' }));
    fireEvent.click(submitButton());

    act(() => {
      book.mock.calls[0][1].onSuccess({ data: { paymentIntentClientSecret: 'pi_live_secret', session: { sessionAmount: 150 } } });
    });

    const authorise = await screen.findByTestId('authorise');
    expect(authorise).toHaveAttribute('data-secret', 'pi_live_secret');
    expect(authorise).toHaveTextContent('150');
    expect(authorise).not.toHaveTextContent('120');
  });

  it('goes to her sessions when there is nothing to authorise', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '11:00 am' }));
    fireEvent.click(submitButton());

    act(() => {
      book.mock.calls[0][1].onSuccess({ data: { session: { sessionAmount: 120 } } });
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard/mentors/sessions');
    expect(screen.queryByTestId('authorise')).not.toBeInTheDocument();
  });

  it('cannot be booked when the mentor is not taking sessions, and says why', async () => {
    mockedMentor.mockReturnValue({ data: mentor({ isAvailable: false, acceptsBookings: false }), isLoading: false, isError: false });
    renderPage();

    expect(await screen.findByText(/not taking new sessions right now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request session|Pick a time/ })).not.toBeInTheDocument();
    expect(mockedApi.slots).not.toHaveBeenCalled();
  });

  it('cannot be booked when the mentor has set no rate, and says why', async () => {
    mockedMentor.mockReturnValue({ data: mentor({ hourlyRate: null, acceptsBookings: false }), isLoading: false, isError: false });
    renderPage();

    expect(await screen.findByText(/has not finished setting up bookings yet/)).toBeInTheDocument();
    expect(screen.getByText('Rate on request')).toBeInTheDocument();
    expect(mockedApi.slots).not.toHaveBeenCalled();
  });

  // The public payload no longer carries stripeAccountId at all — the server
  // answers bookability instead of shipping the column the client used to infer
  // it from. So an unpayable mentor is expressed the way the server expresses
  // her: acceptsBookings false.
  it('cannot be booked when the mentor cannot be paid, and says why', async () => {
    mockedMentor.mockReturnValue({ data: mentor({ acceptsBookings: false }), isLoading: false, isError: false });
    renderPage();

    expect(await screen.findByText(/has not finished setting up bookings yet/)).toBeInTheDocument();
    expect(mockedApi.slots).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in rather than offering a booking she cannot make', async () => {
    mockedAuth.mockReturnValue({ user: null });
    renderPage();

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request session|Pick a time/ })).not.toBeInTheDocument();
  });

  it('does not offer a mentor a booking with herself', async () => {
    mockedAuth.mockReturnValue({ user: { id: 'mentor-user' } });
    renderPage();

    expect(await screen.findByText(/This is your mentor profile/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request session|Pick a time/ })).not.toBeInTheDocument();
  });
});
