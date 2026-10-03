import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Reporting from inside a direct-message thread.
 *
 * The server could take a report of a message from the day reports existed, and
 * nothing in the messaging screens could send one: the report dialog was mounted
 * on posts, comments, profiles and reels, never on a conversation. So a woman
 * being messaged by someone she did not want to hear from had no button for it in
 * the one place it was happening. These pin that the thread offers it, on the
 * other person's messages and on the person, and that it sends what the server
 * needs to keep the evidence (the message id), not a free-text complaint.
 */

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const raw = (overrides: Record<string, unknown>) => ({
  id: 'm-x',
  senderId: 'her',
  content: 'hello',
  type: 'TEXT',
  createdAt: '2026-10-01T03:00:00.000Z',
  ...overrides,
});

const MESSAGES = [
  raw({ id: 'm-theirs', senderId: 'her', content: 'I know where you work' }),
  raw({ id: 'm-mine', senderId: 'me', content: 'Please stop', createdAt: '2026-10-01T03:01:00.000Z' }),
  raw({ id: 'm-unsent', senderId: 'her', content: '', deletedAt: '2026-10-01T03:02:00.000Z', createdAt: '2026-10-01T03:02:00.000Z' }),
  raw({ id: 'm-notice', senderId: 'me', content: 'Disappearing messages are on', type: 'SYSTEM', createdAt: '2026-10-01T03:03:00.000Z' }),
];

jest.mock('@/lib/hooks', () => ({
  useMessages: () => ({ data: MESSAGES, isLoading: false }),
  useSendMessage: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useToggleMessageReaction: () => ({ mutate: jest.fn() }),
  useUploadChatAttachment: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { id: 'me', displayName: 'Me' } }),
}));

jest.mock('@/lib/socket', () => ({
  socketClient: {
    joinConversation: jest.fn(),
    leaveConversation: jest.fn(),
    markConversationRead: jest.fn(),
    setTyping: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  disappearingLabel: () => '1 hour',
  messageApi: { acceptRequest: jest.fn(), declineRequest: jest.fn(), unsend: jest.fn(), edit: jest.fn() },
  safetyApi: { createReport: jest.fn(), blockUser: jest.fn() },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import ChatWindow from '../ChatWindow';
import { useChatStore } from '@/lib/stores/chat.store';
import { safetyApi } from '@/lib/api';

const createReport = safetyApi.createReport as unknown as jest.Mock;
const blockUser = safetyApi.blockUser as unknown as jest.Mock;

function open() {
  useChatStore.setState({
    conversations: [
      {
        id: 'conv-1',
        participants: [{ id: 'her', name: 'Dan R' }],
        unreadCount: 0,
        updatedAt: '2026-10-01T03:00:00.000Z',
      },
    ],
  });
  return render(<ChatWindow conversationId="conv-1" />);
}

// jsdom has no layout, so it has no scrollIntoView, which the thread calls to follow new messages.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  createReport.mockResolvedValue({ data: { success: true } });
  blockUser.mockResolvedValue({ data: { success: true } });
});

describe('reporting a message from the thread', () => {
  it('offers a report on what the other person said, and not on her own messages or a notice', async () => {
    open();

    // One report button: the other person's one live message. Not her own, not
    // the unsent one (nothing left to report) and not the notice from ATHENA.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Report this message' })).toHaveLength(1));
  });

  it('opens the report form on that message, and sends its id with the reason', async () => {
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Report this message' }));

    const dialog = await screen.findByText('Report this message', { selector: 'h3' });
    expect(dialog).toBeInTheDocument();
    // She is told, before she sends, that a copy of the message is kept.
    expect(screen.getByText(/We keep a copy of this message and the few before it/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Harassment or bullying'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    expect(createReport).toHaveBeenCalledWith({
      targetType: 'message',
      targetId: 'm-theirs',
      reason: 'harassment',
      details: undefined,
    });
  });

  it('does not send anything until a reason is chosen', async () => {
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Report this message' }));
    const send = await screen.findByRole('button', { name: 'Send report' });

    expect(send).toBeDisabled();
    expect(createReport).not.toHaveBeenCalled();
  });
});

describe('the thread header menu', () => {
  const openMenu = async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'More options for Dan R' }));
  };

  it('reports the member herself', async () => {
    await openMenu();

    fireEvent.click(await screen.findByText('Report member'));
    fireEvent.click(await screen.findByLabelText('Harassment or bullying'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
    expect(createReport).toHaveBeenCalledWith({ targetType: 'user', targetId: 'her', reason: 'harassment', details: undefined });
  });

  it('blocks her after saying what that does, and goes back to the list', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    await openMenu();

    await act(async () => {
      fireEvent.click(await screen.findByText('Block member'));
    });

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('You can undo this in Settings > Privacy'));
    await waitFor(() => expect(blockUser).toHaveBeenCalledWith({ blockedUserId: 'her' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/messages'));
    confirm.mockRestore();
  });

  it('blocks nobody, and stays in the thread, when she changes her mind', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    await openMenu();

    await act(async () => {
      fireEvent.click(await screen.findByText('Block member'));
    });

    expect(blockUser).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('stays in the thread when the block fails, so she is not told it worked', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    blockUser.mockRejectedValue({ response: { data: { message: 'Could not block this member' } } });
    await openMenu();

    await act(async () => {
      fireEvent.click(await screen.findByText('Block member'));
    });

    await waitFor(() => expect(blockUser).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

