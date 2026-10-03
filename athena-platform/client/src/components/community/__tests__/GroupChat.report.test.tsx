import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Reporting a message in a group chat.
 *
 * A group chat reaches a whole room at once, and its members could reply, pin and
 * remove, and not report: the report dialog was never mounted here. A message
 * from someone else in the room carries a Report control that sends the message's
 * id as a group message, which the server checks she is a member to accept and
 * keeps a copy of.
 */

jest.mock('@/lib/hooks/use-socket', () => ({
  useSocket: () => ({ socket: null, connected: false }),
}));

jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'me' } }),
  useUploadChatAttachment: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

const message = (id: string, senderId: string, name: string, content: string) => ({
  id,
  senderId,
  content,
  createdAt: '2026-10-01T03:00:00.000Z',
  deletedAt: null,
  metadata: null,
  sender: { id: senderId, displayName: name, avatar: null },
  replyTo: null,
});

jest.mock('@/lib/api', () => ({
  groupsApi: {
    chatMessages: jest.fn(),
    pinnedChatMessages: jest.fn(),
    sendChatMessage: jest.fn(),
    deleteChatMessage: jest.fn(),
    pinChatMessage: jest.fn(),
  },
  safetyApi: { createReport: jest.fn() },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { GroupChat } from '../GroupChat';
import { groupsApi, safetyApi } from '@/lib/api';

const groups = groupsApi as unknown as Record<string, jest.Mock>;
const createReport = safetyApi.createReport as unknown as jest.Mock;

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupChat groupId="group-1" canModerate={false} />
    </QueryClientProvider>
  );
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  groups.chatMessages.mockResolvedValue({
    data: {
      data: {
        messages: [message('g1', 'her', 'Dan R', 'DM me for a deal'), message('g2', 'me', 'Me', 'hello all')],
        hasMore: false,
      },
    },
  });
  groups.pinnedChatMessages.mockResolvedValue({ data: { data: [] } });
  createReport.mockResolvedValue({ data: { success: true } });
});

describe('a group chat message', () => {
  it('can be reported when someone else sent it, and not when she did', async () => {
    renderChat();
    await screen.findByText('DM me for a deal');

    expect(screen.getAllByRole('button', { name: /Report this message from/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Report this message from Dan R' })).toBeInTheDocument();
  });

  it('is reported by its id as a group message, with the reason she chose', async () => {
    renderChat();
    await screen.findByText('DM me for a deal');

    fireEvent.click(screen.getByRole('button', { name: 'Report this message from Dan R' }));
    expect(await screen.findByText('Report this message', { selector: 'h3' })).toBeInTheDocument();
    // She is told that a copy is kept, because the message can be removed.
    expect(screen.getByText(/We keep a copy of this message and the few before it/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Spam or misleading'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    expect(createReport).toHaveBeenCalledWith({
      targetType: 'group_message',
      targetId: 'g1',
      reason: 'spam',
      details: undefined,
    });
  });

  it('leaves the room as it was when she cancels', async () => {
    renderChat();
    await screen.findByText('DM me for a deal');

    fireEvent.click(screen.getByRole('button', { name: 'Report this message from Dan R' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(createReport).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Report this message', { selector: 'h3' })).not.toBeInTheDocument());
  });
});
