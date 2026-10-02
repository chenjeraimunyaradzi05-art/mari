import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The moderators' view of live streams.
 *
 * A stream that broke the rules could be stopped by its host and nobody else.
 * Ending one is for good (no restart, no listing, the host's key stops working),
 * so it asks why, says so, and writes the reason down; putting one back is
 * separate and asks too.
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { LiveStreamsPanel } from './LiveStreams';
import { api } from '@/lib/api';

const get = api.get as unknown as jest.Mock;
const post = api.post as unknown as jest.Mock;

const stream = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  title: 'Salary negotiation, live',
  status: 'LIVE',
  viewerCount: 12,
  messageCount: 40,
  startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  endedAt: null,
  suspendedAt: null,
  suspendedReason: null,
  host: { id: 'host-1', displayName: 'Mei C.' },
  ...overrides,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveStreamsPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: { streams: [stream()] } });
  post.mockResolvedValue({ data: { success: true } });
});

describe('what is live', () => {
  it('lists each stream with its host and how it is going', async () => {
    renderPanel();

    expect(await screen.findByText('Salary negotiation, live')).toBeInTheDocument();
    expect(screen.getByText(/12 watching · 40 chat messages/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mei C.' })).toHaveAttribute('href', '/profile/host-1');
    expect(get).toHaveBeenCalledWith('/admin/moderation/livestreams', { params: {} });
  });

  it('says so when nobody is live, and does not read a failure as nobody being live', async () => {
    get.mockResolvedValueOnce({ data: { streams: [] } });
    const { unmount } = renderPanel();
    expect(await screen.findByText('Nobody is live right now.')).toBeInTheDocument();
    unmount();

    get.mockRejectedValueOnce(new Error('network'));
    renderPanel();
    expect(await screen.findByText(/Do not read that as nothing being live/)).toBeInTheDocument();
  });

  it('ends a stream only once she has said why, and sends the reason', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'End stream' }));

    // It says what ending means before it is done, and who is told.
    expect(screen.getByText(/ends the stream for everyone and for good/)).toBeInTheDocument();
    expect(screen.getByText(/not shown to the host/)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'End it for good' });
    expect(submit).toBeDisabled();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Why this stream is being ended'), { target: { value: '  Threats on air  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'End it for good' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/admin/moderation/livestreams/s1/suspend', { reason: 'Threats on air' });
  });

  it('does nothing when she cancels', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'End stream' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Why this stream is being ended')).not.toBeInTheDocument();
  });
});

describe('what was taken down', () => {
  const takenDown = stream({
    status: 'ENDED',
    viewerCount: 0,
    suspendedAt: new Date(Date.now() - 3600_000).toISOString(),
    suspendedReason: 'Threats on air',
  });

  it('lists them with the reason on record, and asks the server for the suspended ones', async () => {
    get.mockResolvedValue({ data: { streams: [takenDown] } });
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Taken down' }));

    expect(await screen.findByText('Reason on record: Threats on air')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/moderation/livestreams', { params: { suspended: true } }));
    // Nothing to end, and nothing to watch, on a stream that is already down.
    expect(screen.queryByRole('button', { name: 'End stream' })).not.toBeInTheDocument();
  });

  it('puts one back only after she confirms, and says it stays ended', async () => {
    get.mockResolvedValue({ data: { streams: [takenDown] } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Taken down' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Put back' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('It stays ended'));
    expect(post).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/moderation/livestreams/s1/lift'));
    confirm.mockRestore();
  });

  it('says so when nothing has been taken down', async () => {
    get.mockResolvedValue({ data: { streams: [] } });
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Taken down' }));

    expect(await screen.findByText('No stream has been taken down.')).toBeInTheDocument();
  });
});
