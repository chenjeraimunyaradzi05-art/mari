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
    disputeSession: jest.fn(),
    respondToSessionDispute: jest.fn(),
  },
}));

jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: () => <div data-testid="authorise" />,
}));

import { mentorApi } from '@/lib/api';
import { DISPUTE_WINDOW_DAYS, SESSION_CONFIRMATION_HOURS } from '@/lib/pricing';

const api = mentorApi as unknown as Record<string, jest.Mock>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
    expect(screen.getByText(/If it did not, say so below/)).toBeInTheDocument();
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

  it('tells a mentee charged longer ago than the dispute window where to go if the session did not take place', async () => {
    api.getSessions.mockResolvedValue({
      data: [
        session({
          status: 'COMPLETED',
          paymentStatus: 'CAPTURED',
          paymentCapturedAt: new Date(Date.now() - (DISPUTE_WINDOW_DAYS + 3) * DAY).toISOString(),
        }),
      ],
    });
    renderPage();

    const link = await screen.findByRole('link', { name: 'Help & Support' });
    expect(link).toHaveAttribute('href', '/dashboard/settings/help');
    expect(screen.getByText(/look at a refund with you/)).toBeInTheDocument();
    // The server would refuse it, so the button is not offered.
    expect(screen.queryByRole('button', { name: 'It did not happen' })).not.toBeInTheDocument();
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

    // The mentor's word is not the mentee's: the card is charged after the
    // window in which the mentee can say it did not happen, not that minute.
    expect(confirmSpy.mock.calls[0][0]).toContain(
      `has ${SESSION_CONFIRMATION_HOURS} hours to say it did not happen; after that her card is charged $37.50`
    );
    expect(confirmSpy.mock.calls[0][0]).not.toMatch(/charged \$37\.50 now/);
    await waitFor(() => expect(api.updateSessionStatus).toHaveBeenCalledWith('s2', 'COMPLETED'));
  });

  // The mentor's word starts a window; the mentee's objection freezes the money.
  describe('saying a session did not happen', () => {
    beforeEach(() => {
      api.disputeSession.mockResolvedValue({ data: { success: true } });
      api.respondToSessionDispute.mockResolvedValue({ data: { success: true } });
    });

    it('tells the mentee when her card is charged after the mentor marks it complete, and lets her object before then', async () => {
      const releaseAt = new Date(Date.now() + 20 * HOUR);
      api.getSessions.mockResolvedValue({
        data: [session({ status: 'COMPLETED', paymentStatus: 'AUTHORIZED', paymentReleaseAt: releaseAt.toISOString() })],
      });
      renderPage();

      expect(await screen.findByText(/\$37\.50 is charged on .* unless you tell us before then/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'It did not happen' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Help & Support' })).not.toBeInTheDocument();
    });

    it('sends what she wrote, and nothing until she has written it, for a session charged within the window', async () => {
      api.getSessions.mockResolvedValue({
        data: [session({ status: 'COMPLETED', paymentStatus: 'CAPTURED', paymentCapturedAt: new Date(Date.now() - 2 * DAY).toISOString() })],
      });
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'It did not happen' }));
      const send = screen.getByRole('button', { name: 'Send to ATHENA’s team' });
      expect(send).toBeDisabled();
      expect(screen.getByText(/not paid on to your mentor while ATHENA’s team looks at it/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('What went wrong?'), { target: { value: 'Nobody joined the call' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send to ATHENA’s team' }));

      await waitFor(() => expect(api.disputeSession).toHaveBeenCalledWith('s1', 'Nobody joined the call'));
    });

    it('shows a session in dispute to the mentor with what the mentee said, lets her answer once, and offers no other action', async () => {
      searchParams = new URLSearchParams('session=s2');
      api.getProfileByUser.mockResolvedValue({ data: { id: 'mp-me' } });
      api.getSessions.mockImplementation(async (role: string) =>
        role === 'mentor'
          ? {
              data: [
                session({
                  id: 's2',
                  status: 'DISPUTED',
                  disputeReason: 'My mentor never joined',
                  disputeResponse: null,
                  mentee: { id: 'mentee-1', displayName: 'Sina', avatar: null },
                }),
              ],
            }
          : { data: [] }
      );
      renderPage();

      expect(await screen.findByText(/The mentee says this session did not take place/)).toBeInTheDocument();
      expect(screen.getByText('“My mentor never joined”')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Tell your side/), { target: { value: 'We met on Zoom for the full hour' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send to the team' }));

      await waitFor(() => expect(api.respondToSessionDispute).toHaveBeenCalledWith('s2', 'We met on Zoom for the full hour'));
    });

    it('shows the mentor’s answer to the mentee and that the money is held, with no way to move it', async () => {
      api.getSessions.mockResolvedValue({
        data: [session({ status: 'DISPUTED', disputeReason: 'Nobody joined', disputeResponse: 'We met for the full hour' })],
      });
      renderPage();

      expect(await screen.findByText(/You told us this session did not take place/)).toBeInTheDocument();
      expect(screen.getByText(/Your mentor’s answer/).closest('p')).toHaveTextContent('“We met for the full hour”');
      expect(screen.queryByRole('button', { name: 'It did not happen' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'It went ahead' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  // A declined card leaves the request open for another, and the server calls it
  // off after a few hours, so the mentee has to be able to try again from here.
  describe('a mentee whose card was declined', () => {
    it('is offered another card while the request is still open', async () => {
      api.getSessions.mockResolvedValue({
        data: [session({ status: 'REQUESTED', paymentStatus: 'FAILED', scheduledAt: new Date(Date.now() + 48 * HOUR).toISOString() })],
      });
      api.paymentIntent.mockResolvedValue({ data: { data: { paymentStatus: 'FAILED', amount: 37.5, currency: 'AUD', clientSecret: 'cs_retry' } } });
      renderPage();

      expect(await screen.findByText(/You can try another card/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try another card' }));

      await waitFor(() => expect(api.paymentIntent).toHaveBeenCalledWith('s1'));
      expect(await screen.findByTestId('authorise')).toBeInTheDocument();
    });

    it('is not offered a card for a finished session whose payment could not be collected', async () => {
      api.getSessions.mockResolvedValue({ data: [session({ status: 'COMPLETED', paymentStatus: 'FAILED' })] });
      renderPage();

      expect(await screen.findByText('Payment failed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try another card' })).not.toBeInTheDocument();
      expect(screen.queryByText(/You can try another card/)).not.toBeInTheDocument();
    });
  });

  // The server will not let a mentor accept a paid request until the mentee's
  // card is held, so the button says so instead of offering something that
  // answers with an error.
  describe('accepting a paid request', () => {
    const mentorSide = (sessions: unknown[]) => {
      searchParams = new URLSearchParams('session=r1');
      api.getProfileByUser.mockResolvedValue({ data: { id: 'mp-me' } });
      api.getSessions.mockImplementation(async (role: string) => (role === 'mentor' ? { data: sessions } : { data: [] }));
    };
    const request = (overrides: Record<string, unknown> = {}) =>
      session({
        id: 'r1',
        status: 'REQUESTED',
        scheduledAt: new Date(Date.now() + 48 * HOUR).toISOString(),
        mentee: { id: 'mentee-1', displayName: 'Sina', avatar: null },
        ...overrides,
      });

    it('keeps Confirm switched off, and says why, until the mentee has authorised payment', async () => {
      mentorSide([request({ paymentStatus: 'PENDING' })]);
      renderPage();

      const confirm = await screen.findByRole('button', { name: /Confirm/ });
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAccessibleDescription(/once the mentee has authorised payment/);

      fireEvent.click(confirm);
      expect(api.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('lets the mentor confirm once the card is held', async () => {
      mentorSide([request({ paymentStatus: 'AUTHORIZED' })]);
      renderPage();

      const confirm = await screen.findByRole('button', { name: /Confirm/ });
      expect(confirm).toBeEnabled();
      expect(screen.queryByText(/once the mentee has authorised payment/)).not.toBeInTheDocument();

      fireEvent.click(confirm);
      await waitFor(() => expect(api.updateSessionStatus).toHaveBeenCalledWith('r1', 'CONFIRMED'));
    });

    it('does not make a mentor wait on a payment for a session that costs nothing', async () => {
      mentorSide([request({ sessionAmount: 0, paymentStatus: 'CAPTURED' })]);
      renderPage();

      expect(await screen.findByRole('button', { name: /Confirm/ })).toBeEnabled();
    });
  });
});
