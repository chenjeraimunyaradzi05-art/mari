import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MentorSessionsPage from './page';

/**
 * The sessions page follows the server's clock for completing and cancelling.
 *
 * It used to offer the mentor "Mark complete" on a session weeks away and the
 * mentee "Cancel" on one that had already run — both refused by the server —
 * and never offered the mentee the one thing she could do after the hour:
 * confirm it went ahead. A list that failed to load read "Nothing booked", and
 * a mentee whose card had been charged was never told where to go if the
 * session did not happen.
 */

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'me' }, isAuthenticated: true, isLoading: false }),
}));

jest.mock('@/lib/api', () => ({
  mentorApi: {
    getProfileByUser: jest.fn(),
    getSessions: jest.fn(),
    updateSessionStatus: jest.fn(),
    reschedule: jest.fn(),
    paymentIntent: jest.fn(),
  },
}));

jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: () => <div data-testid="authorise" />,
}));

import { mentorApi } from '@/lib/api';

const api = mentorApi as unknown as Record<string, jest.Mock>;

const HOUR = 60 * 60 * 1000;

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    scheduledAt: new Date(Date.now() - 24 * HOUR).toISOString(),
    durationMinutes: 60,
    status: 'CONFIRMED',
    note: null,
    currency: 'AUD',
    sessionAmount: '37.5',
    paymentStatus: 'AUTHORIZED',
    mentorProfile: { id: 'mp-1', user: { id: 'mentor-1', displayName: 'Aroha', avatar: null } },
    mentee: { id: 'me', displayName: 'Me', avatar: null },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MentorSessionsPage />
    </QueryClientProvider>
  );
}

describe('Mentoring sessions', () => {
  let confirmSpy: jest.SpyInstance;

  beforeAll(() => {
    // jsdom has no layout; the page scrolls a notification's session into view.
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    searchParams = new URLSearchParams();
    api.getProfileByUser.mockResolvedValue({ data: null });
    api.updateSessionStatus.mockResolvedValue({ data: {} });
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('lets a mentee confirm a session that has run, telling her what is charged, instead of offering a cancel the server refuses', async () => {
    api.getSessions.mockResolvedValue({ data: [session()] });
    renderPage();

    const confirmButton = await screen.findByRole('button', { name: 'It went ahead' });
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByText(/ask your mentor to cancel/)).toBeInTheDocument();
    // To the cent, in the session's own currency.
    expect(screen.getByText('$37.50')).toBeInTheDocument();

    fireEvent.click(confirmButton);

    expect(confirmSpy.mock.calls[0][0]).toContain('$37.50 held on your card is paid to your mentor');
    await waitFor(() => expect(api.updateSessionStatus).toHaveBeenCalledWith('s1', 'COMPLETED'));
  });

  it('lets a mentee cancel a session that has not happened, and not complete it', async () => {
    api.getSessions.mockResolvedValue({ data: [session({ scheduledAt: new Date(Date.now() + 48 * HOUR).toISOString() })] });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'It went ahead' })).not.toBeInTheDocument();
  });

  it('lets a mentee withdraw a request the mentor never accepted, even after its date', async () => {
    api.getSessions.mockResolvedValue({ data: [session({ status: 'REQUESTED' })] });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'It went ahead' })).not.toBeInTheDocument();
  });

  it('tells a charged mentee where to go if the session did not take place', async () => {
    api.getSessions.mockResolvedValue({ data: [session({ status: 'COMPLETED', paymentStatus: 'CAPTURED' })] });
    renderPage();

    const link = await screen.findByRole('link', { name: 'Help & Support' });
    expect(link).toHaveAttribute('href', '/dashboard/settings/help');
    expect(screen.getByText(/look at a refund with you/)).toBeInTheDocument();
  });

  it('says so when the list could not be loaded, rather than "Nothing booked"', async () => {
    api.getSessions.mockRejectedValue(new Error('offline'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your sessions just now');
    expect(screen.queryByText(/Nothing booked/)).not.toBeInTheDocument();
  });

  it('says when it could not check for a mentor profile, rather than quietly hiding the mentor side', async () => {
    api.getProfileByUser.mockRejectedValue({ response: { status: 503 } });
    api.getSessions.mockResolvedValue({ data: [] });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not check your mentor profile');
  });

  it('treats a 404 profile as a member who does not mentor, with nothing to warn about', async () => {
    api.getProfileByUser.mockRejectedValue({ response: { status: 404 } });
    api.getSessions.mockResolvedValue({ data: [] });
    renderPage();

    expect(await screen.findByText(/Nothing booked/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('offers the mentor "Mark complete" only once the booked time has passed', async () => {
    searchParams = new URLSearchParams('session=s2');
    api.getProfileByUser.mockResolvedValue({ data: { id: 'mp-me' } });
    api.getSessions.mockImplementation(async (role: string) =>
      role === 'mentor'
        ? {
            data: [
              session({ id: 's2', mentee: { id: 'mentee-1', displayName: 'Sina', avatar: null } }),
              session({
                id: 's3',
                scheduledAt: new Date(Date.now() + 72 * HOUR).toISOString(),
                mentee: { id: 'mentee-2', displayName: 'Tui', avatar: null },
              }),
            ],
          }
        : { data: [] }
    );
    renderPage();

    const buttons = await screen.findAllByRole('button', { name: 'Mark complete' });
    expect(buttons).toHaveLength(1);
    // Her money is on the mentee's card, not "your card".
    expect(screen.getAllByText('Payment held on the mentee’s card')).toHaveLength(2);

    fireEvent.click(buttons[0]);

    expect(confirmSpy.mock.calls[0][0]).toContain('The mentee’s card is charged $37.50 now');
    await waitFor(() => expect(api.updateSessionStatus).toHaveBeenCalledWith('s2', 'COMPLETED'));
  });
});
