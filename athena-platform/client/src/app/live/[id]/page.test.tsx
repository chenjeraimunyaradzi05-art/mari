import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * A live stream's page, from the two sides of its chat.
 *
 * The page could show a chat and, for a host, delete a line or remove someone.
 * It could not report a stream or a line, mute a viewer for a while, slow the
 * room down, or say why a viewer's chat had stopped working, and a stream staff
 * had ended read as one that had simply finished. These pin each of those, with
 * the server calls they make.
 */

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 's1' }),
}));

type Listener = (payload: unknown) => void;
const mockListeners = new Map<string, Set<Listener>>();
const mockSocket = {
  connected: true,
  emit: jest.fn(),
  on: (event: string, listener: Listener) => {
    if (!mockListeners.has(event)) mockListeners.set(event, new Set());
    mockListeners.get(event)!.add(listener);
  },
  off: (event: string, listener: Listener) => {
    mockListeners.get(event)?.delete(listener);
  },
};
jest.mock('@/lib/hooks/use-socket', () => ({
  useSocket: () => ({ socket: mockSocket, connected: true }),
}));

let mockUserId = 'viewer-1';
jest.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { id: mockUserId, displayName: 'Me' }, isAuthenticated: true, isLoading: false }),
}));

jest.mock('@/components/live/LivePlayer', () => ({ LivePlayer: () => <div data-testid="player" /> }));
jest.mock('@/components/creator/TopUpModal', () => ({ TopUpModal: () => null }));

jest.mock('@/lib/api-extensions', () => ({
  livestreamApi: {
    get: jest.fn(),
    messages: jest.fn(),
    gifts: jest.fn(),
    wallet: jest.fn(),
    muteViewer: jest.fn(),
    setSlowMode: jest.fn(),
    removeMessage: jest.fn(),
    removeViewer: jest.fn(),
    leaderboard: jest.fn(),
    say: jest.fn(),
    gift: jest.fn(),
    end: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  safetyApi: { createReport: jest.fn() },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import LiveWatchPage from './page';
import { livestreamApi } from '@/lib/api-extensions';
import { safetyApi } from '@/lib/api';

const api = livestreamApi as unknown as Record<string, jest.Mock>;
const createReport = safetyApi.createReport as unknown as jest.Mock;

const host = { id: 'host-1', displayName: 'Mei C.', avatar: null, headline: null, isVerified: false };

const streamRow = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  hostId: 'host-1',
  host,
  title: 'Salary negotiation, live',
  description: null,
  category: 'career',
  thumbnailUrl: null,
  status: 'LIVE',
  playbackUrl: 'https://cdn.example.com/hls/index.m3u8',
  viewerCount: 3,
  peakViewers: 3,
  totalGiftPoints: 0,
  messageCount: 3,
  scheduledFor: null,
  startedAt: '2026-10-01T03:00:00.000Z',
  endedAt: null,
  createdAt: '2026-10-01T02:00:00.000Z',
  isHost: false,
  slowModeSeconds: null,
  ...overrides,
});

const line = (id: string, userId: string, name: string, content: string, isHost = false) => ({
  id,
  streamId: 's1',
  userId,
  content,
  createdAt: '2026-10-01T03:01:00.000Z',
  user: { id: userId, displayName: name, avatar: null },
  isHost,
});

const CHAT = [
  line('l1', 'troll', 'Troll', 'show us your address'),
  line('l2', 'viewer-1', 'Me', 'hello everyone'),
  line('l3', 'host-1', 'Mei C.', 'welcome in', true),
];

function trigger(event: string, payload: unknown) {
  act(() => {
    mockListeners.get(event)?.forEach((listener) => listener(payload));
  });
}

async function openPage(stream: Record<string, unknown> = {}, as = 'viewer-1') {
  mockUserId = as;
  api.get.mockResolvedValue({ data: { data: streamRow(stream) } });
  render(<LiveWatchPage />);
  await screen.findByText('Salary negotiation, live');
  await screen.findByText('show us your address');
}

beforeAll(() => {
  // jsdom has no layout: the chat list scrolls itself to the newest line.
  Element.prototype.scrollTo = jest.fn() as unknown as typeof Element.prototype.scrollTo;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  api.messages.mockResolvedValue({ data: { data: CHAT } });
  api.gifts.mockResolvedValue({ data: { data: [] } });
  api.wallet.mockResolvedValue({ data: { data: { balance: 0 } } });
  api.leaderboard.mockResolvedValue({ data: { data: [] } });
  api.muteViewer.mockResolvedValue({ data: { data: { muted: 'troll', until: new Date(Date.now() + 600_000).toISOString() } } });
  api.setSlowMode.mockImplementation(async (_id: string, seconds: number) => ({
    data: { data: streamRow({ isHost: true, slowModeSeconds: seconds || null }) },
  }));
  createReport.mockResolvedValue({ data: { success: true } });
});

describe('as a viewer', () => {
  it('can report another member\'s line, and not her own', async () => {
    await openPage();

    // The troll's line and the host's, but not "hello everyone", which is hers.
    expect(screen.getAllByRole('button', { name: 'Report this message' })).toHaveLength(2);
  });

  it('reports a chat line by its id, and is told a copy is kept', async () => {
    await openPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Report this message' })[0]);
    expect(await screen.findByText('Report this chat message', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText(/even if the host deletes it/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Harassment or bullying'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    expect(createReport).toHaveBeenCalledWith({ targetType: 'live_message', targetId: 'l1', reason: 'harassment', details: undefined });
  });

  it('reports the stream itself', async () => {
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /^Report$/ }));
    expect(await screen.findByText('Report this stream', { selector: 'h3' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Violence or threats'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    expect(createReport).toHaveBeenCalledWith({ targetType: 'livestream', targetId: 's1', reason: 'violence', details: undefined });
  });

  it('has none of the host\'s controls', async () => {
    await openPage();

    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
    expect(screen.queryByText('Slow mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('is told, when the host has muted her, why her chat stopped, until when, and that she can keep watching', async () => {
    await openPage();
    expect(screen.getByPlaceholderText(/Message as/)).toBeInTheDocument();

    trigger('live:muted', { streamId: 's1', until: new Date(Date.now() + 5 * 60_000).toISOString() });

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent(/The host has muted you in this chat until/);
    expect(note).toHaveTextContent(/You can keep watching/);
    expect(screen.queryByPlaceholderText(/Message as/)).not.toBeInTheDocument();

    trigger('live:unmuted', { streamId: 's1' });
    expect(await screen.findByPlaceholderText(/Message as/)).toBeInTheDocument();
  });

  it('ignores a mute meant for another stream', async () => {
    await openPage();

    trigger('live:muted', { streamId: 'some-other-stream', until: new Date(Date.now() + 60_000).toISOString() });

    expect(screen.getByPlaceholderText(/Message as/)).toBeInTheDocument();
  });

  it('says how slow slow mode is, and follows the host changing it', async () => {
    await openPage({ slowModeSeconds: 10 });
    expect(screen.getByText(/Slow mode is on: one message every 10 seconds\./)).toBeInTheDocument();

    trigger('live:slow_mode', { streamId: 's1', seconds: 60 });
    expect(await screen.findByText(/one message every 1 minute\./)).toBeInTheDocument();

    trigger('live:slow_mode', { streamId: 's1', seconds: null });
    // The note over the chat box goes; the room is told it is off in the chat itself.
    await waitFor(() => expect(document.getElementById('slow-mode-note')).toBeNull());
    expect(screen.getByText('Slow mode is off')).toBeInTheDocument();
  });

  it('is told a stream was ended by the team, and that it is not simply over', async () => {
    await openPage({ status: 'ENDED', suspended: true });

    expect(screen.getAllByText('This stream was ended by the ATHENA team.').length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/Message as/)).not.toBeInTheDocument();
  });
});

describe('as the host', () => {
  it('mutes a viewer from beside their message, for the length she chose', async () => {
    await openPage({ isHost: true }, 'host-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Mute' })[0]);
    await waitFor(() => expect(api.muteViewer).toHaveBeenCalledWith('s1', 'troll', 10));

    fireEvent.change(screen.getByLabelText('Mute a viewer for'), { target: { value: '30' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mute' })[0]);
    await waitFor(() => expect(api.muteViewer).toHaveBeenLastCalledWith('s1', 'troll', 30));
  });

  it('has no Mute on her own lines', async () => {
    await openPage({ isHost: true }, 'host-1');

    // Troll's and the viewer's lines; not hers.
    expect(screen.getAllByRole('button', { name: 'Mute' })).toHaveLength(2);
  });

  it('sets slow mode for the room, and turns it off', async () => {
    await openPage({ isHost: true }, 'host-1');

    fireEvent.change(screen.getByLabelText('Slow mode'), { target: { value: '10' } });
    await waitFor(() => expect(api.setSlowMode).toHaveBeenCalledWith('s1', 10));

    fireEvent.change(screen.getByLabelText('Slow mode'), { target: { value: '0' } });
    await waitFor(() => expect(api.setSlowMode).toHaveBeenLastCalledWith('s1', 0));
  });

  it('is told plainly when staff ended her stream, and is not offered the tools for it', async () => {
    await openPage({ isHost: true, status: 'ENDED', suspended: true }, 'host-1');

    expect(screen.getByRole('status')).toHaveTextContent(/ended by the ATHENA team .* cannot be restarted/);
    expect(screen.queryByLabelText('Slow mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End stream' })).not.toBeInTheDocument();
  });
});
