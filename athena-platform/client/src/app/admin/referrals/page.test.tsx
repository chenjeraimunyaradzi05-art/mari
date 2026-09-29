import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The authority-referral screen.
 *
 * The queue behind it was API-only: the operations page counted referrals
 * waiting to be filed and linked to a report queue that does not list them.
 * These tests hold the screen to the parts of the duty it exists for: a
 * referral is filed only with the authority's reference, one closed without
 * filing says why, the material itself is never shown, and a queue that fails
 * to load never reads as a queue with nothing in it.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), patch: jest.fn() } }));

import AuthorityReferralsPage from './page';
import { api } from '@/lib/api';

const apiMock = api as unknown as { get: jest.Mock; patch: jest.Mock };

const HOUR = 60 * 60 * 1000;

const referral = (overrides: Record<string, unknown> = {}) => ({
  id: 'esc-1',
  ticketId: 'RPT-ABC-1234',
  reason: 'csam',
  contentType: 'POST',
  contentId: 'post-77',
  escalatedAt: new Date(Date.now() - 30 * HOUR).toISOString(),
  reportedTo: 'Australian Federal Police (ACCCE)',
  referenceNumber: null,
  status: 'reported',
  ageHours: 30,
  report: {
    source: 'anonymous',
    id: 'incident-4',
    status: 'PENDING',
    action: null,
    reviewerId: null,
    reportedUserId: 'user-9',
    description: 'Found on a public post',
    createdAt: new Date(Date.now() - 31 * HOUR).toISOString(),
  },
  ...overrides,
});

function queueResponse(rows = [referral()]) {
  return {
    data: {
      escalations: rows,
      summary: { total: rows.length, reported: 1, acknowledged: 0, resolved: 0 },
      pagination: { page: 1, limit: 25, total: rows.length, totalPages: 1 },
    },
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthorityReferralsPage />
    </QueryClientProvider>
  );
}

describe('Authority referrals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/admin/moderation/escalations') return queueResponse();
      if (url === '/admin/moderation/escalations/esc-1') {
        const detail: Record<string, unknown> = { ...referral(), history: [] };
        delete detail.ageHours;
        return { data: detail };
      }
      throw new Error(`unexpected ${url}`);
    });
  });

  it('opens on the referrals still waiting to be filed and marks one past a day', async () => {
    renderPage();

    expect(await screen.findByText('Child abuse material')).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/admin/moderation/escalations', {
      params: { page: 1, limit: 25, status: 'reported' },
    });
    expect(screen.getByText(/waiting more than a day/)).toBeInTheDocument();
    expect(screen.getByText(/To Australian Federal Police \(ACCCE\)/)).toBeInTheDocument();
  });

  it('files a referral only with the authority’s reference number', async () => {
    apiMock.patch.mockResolvedValue({ data: { escalation: { ...referral(), status: 'acknowledged' }, previousStatus: 'reported' } });
    renderPage();

    fireEvent.click(await screen.findByText('Child abuse material'));
    const file = await screen.findByRole('button', { name: 'Record the filing' });
    expect(file).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Their reference number'), { target: { value: 'ACCCE-2026-0091' } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Filed through the ACCCE online form.' } });
    fireEvent.click(file);

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/admin/moderation/escalations/esc-1', {
        status: 'acknowledged',
        referenceNumber: 'ACCCE-2026-0091',
        notes: 'Filed through the ACCCE online form.',
      })
    );
  });

  it('will not close a referral without filing unless a note says why', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    apiMock.patch.mockResolvedValue({ data: { escalation: { ...referral(), status: 'resolved' }, previousStatus: 'reported' } });
    renderPage();

    fireEvent.click(await screen.findByText('Child abuse material'));
    const close = await screen.findByRole('button', { name: 'Close without filing' });
    expect(close).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'The AFP already holds this under their reference.' } });
    fireEvent.click(close);

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/admin/moderation/escalations/esc-1', {
        status: 'resolved',
        notes: 'The AFP already holds this under their reference.',
      })
    );
    confirm.mockRestore();
  });

  it('gives the reference to the content and never the content itself', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Child abuse material'));

    expect(await screen.findByText('post-77')).toBeInTheDocument();
    expect(screen.getByText(/should not be opened, copied or downloaded/)).toBeInTheDocument();
    expect(screen.getByText(/Filed without an account/)).toBeInTheDocument();
    expect(document.querySelector('img, video, iframe')).toBeNull();
  });

  it('says the queue failed rather than showing an empty one', async () => {
    apiMock.get.mockRejectedValue({ response: { data: { message: 'Database unavailable' } } });
    renderPage();

    expect(await screen.findByText('The referral queue could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText(/do not assume there is nothing waiting/)).toBeInTheDocument();
    expect(screen.queryByText('No referral is waiting to be filed.')).not.toBeInTheDocument();
  });
});
