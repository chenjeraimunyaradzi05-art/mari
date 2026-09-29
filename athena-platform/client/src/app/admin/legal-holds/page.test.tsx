import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The legal hold console.
 *
 * Holds could only be placed with curl, so a preservation notice that arrived
 * on a Friday was a hold placed after the weekend's purge. These tests hold the
 * screen to what a hold has to be: named by the addresses staff have, scoped
 * to the kinds of record the purge actually answers to, honest that a hold past
 * its review date still stands, released only with a reason, and never read as
 * "nothing held" when the list failed to load.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

import LegalHoldsPage from './page';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };
const DAY = 24 * 60 * 60 * 1000;

const CATALOGUE = [
  { value: 'messages', label: 'Direct messages', purge: 'Direct messages past the retention period are deleted' },
  { value: 'notifications', label: 'Notifications', purge: 'Old notifications are deleted' },
];

const hold = (overrides: Record<string, unknown> = {}) => ({
  id: 'hold-1',
  name: 'Smith v ATHENA',
  reason: 'Preservation notice served on 2 September 2026.',
  caseReference: 'QLD-2026-114',
  affectedUserIds: ['user-1'],
  affectedDataTypes: ['messages'],
  startDate: new Date(Date.now() - 40 * DAY).toISOString(),
  endDate: new Date(Date.now() - 2 * DAY).toISOString(),
  isActive: true,
  authorizedBy: 'admin-1',
  authorizedAt: new Date(Date.now() - 40 * DAY).toISOString(),
  releasedBy: null,
  releasedAt: null,
  releaseReason: null,
  expired: true,
  authorizedByName: 'Mere Tipene',
  releasedByName: null,
  unrecognisedDataTypes: [],
  ...overrides,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LegalHoldsPage />
    </QueryClientProvider>
  );
}

describe('Legal holds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/admin/legal-holds') {
        return { data: { holds: [hold()], activeCount: 1, dataTypes: CATALOGUE, pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } } };
      }
      if (url === '/admin/legal-holds/hold-1') {
        return {
          data: {
            ...hold(),
            affectedUsers: [{ id: 'user-1', name: 'Aroha Ngata', email: 'aroha@example.org' }],
            affectedUserCount: 1,
          },
        };
      }
      throw new Error(`unexpected ${url}`);
    });
  });

  it('lists the standing holds and says plainly that one past its review date still holds', async () => {
    renderPage();

    expect(await screen.findByText('Smith v ATHENA')).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/admin/legal-holds', { params: { page: 1, limit: 25, active: 'true' } });
    expect(screen.getByText('Past its review date')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Smith v ATHENA'));
    expect(await screen.findByText(/still standing and still keeps everything it names/)).toBeInTheDocument();
    expect(screen.getByText('Aroha Ngata')).toBeInTheDocument();
  });

  it('places a hold on members named by email and on the kinds of record the purge answers to', async () => {
    apiMock.post.mockResolvedValue({ data: hold({ id: 'hold-2', unrecognisedDataTypes: [] }) });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Place a hold/ }));
    const place = screen.getByRole('button', { name: 'Place the hold' });
    expect(place).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Preservation notice' } });
    fireEvent.change(screen.getByLabelText(/Why it must be kept/), { target: { value: 'Served by the member’s solicitor.' } });
    fireEvent.change(screen.getByLabelText(/Members, by email address or account id/), {
      target: { value: 'aroha@example.org, user-5\nmere@example.org' },
    });
    fireEvent.click(screen.getByText('Notifications'));
    fireEvent.click(place);

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/admin/legal-holds', {
        name: 'Preservation notice',
        reason: 'Served by the member’s solicitor.',
        affectedUserEmails: ['aroha@example.org', 'mere@example.org'],
        affectedUserIds: ['user-5'],
        affectedDataTypes: ['notifications'],
      })
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the server’s refusal when a member cannot be matched, and places nothing', async () => {
    apiMock.post.mockRejectedValue({ response: { data: { message: 'No account uses: typo@example.org' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Place a hold/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Notice' } });
    fireEvent.change(screen.getByLabelText(/Why it must be kept/), { target: { value: 'Served.' } });
    fireEvent.change(screen.getByLabelText(/Members, by email address or account id/), { target: { value: 'typo@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place the hold' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No account uses: typo@example.org'));
  });

  it('releases a hold only with a reason, and only once confirmed', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    apiMock.post.mockResolvedValue({ data: hold({ isActive: false }) });
    renderPage();

    fireEvent.click(await screen.findByText('Smith v ATHENA'));
    const panel = await screen.findByRole('complementary', { name: 'Legal hold' });
    const release = await within(panel).findByRole('button', { name: 'Release the hold' });
    expect(release).toBeDisabled();

    fireEvent.change(within(panel).getByLabelText(/Why it no longer has to stand/), {
      target: { value: 'Matter settled; the notice was withdrawn in writing.' },
    });
    fireEvent.click(release);

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/admin/legal-holds/hold-1/release', {
        releaseReason: 'Matter settled; the notice was withdrawn in writing.',
      })
    );
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('widens a hold without offering to narrow it', async () => {
    apiMock.patch.mockResolvedValue({ data: hold({ affectedDataTypes: ['messages', 'notifications'] }) });
    renderPage();

    fireEvent.click(await screen.findByText('Smith v ATHENA'));
    const panel = await screen.findByRole('complementary', { name: 'Legal hold' });
    fireEvent.change(await within(panel).findByLabelText(/More members/), { target: { value: 'kiri@example.org' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add to the hold' }));

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/admin/legal-holds/hold-1', { addUserEmails: ['kiri@example.org'] })
    );
    // Messages are already held, so the box is ticked and cannot be unticked.
    const alreadyHeld = within(panel)
      .getAllByText('Direct messages')
      .map((text) => text.closest('label')?.querySelector('input'))
      .find((input): input is HTMLInputElement => Boolean(input))!;
    expect(alreadyHeld).toBeChecked();
    expect(alreadyHeld).toBeDisabled();
  });

  it('says the holds failed to load rather than that nothing is held', async () => {
    apiMock.get.mockRejectedValue({ response: { data: { message: 'Database unavailable' } } });
    renderPage();

    expect(await screen.findByText('The legal holds could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No hold is standing/)).not.toBeInTheDocument();
  });
});
