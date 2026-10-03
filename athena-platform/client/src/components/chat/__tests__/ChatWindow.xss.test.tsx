import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { HOSTILE_TEXT, liveMarkupIn } from '@/test-support/xss';

/**
 * A message is the text most likely to come from someone who means harm, and it
 * is read on a screen that cannot tell what it is looking at. Whatever a sender
 * writes in a message, a reply, a file name or the name on the thread, it is
 * drawn as characters, and an attachment cannot be a script address.
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  raw({ id: 'm-1', content: HOSTILE_TEXT }),
  raw({
    id: 'm-2',
    content: 'look at this',
    replyTo: { id: 'm-1', senderId: 'her', content: HOSTILE_TEXT, type: 'TEXT' },
    // The shape the API sends: the attachments are in the message's metadata.
    metadata: {
      attachments: [
        { key: 'a1', contentType: 'application/pdf', url: 'javascript:alert(1)', name: HOSTILE_TEXT },
        { key: 'a2', contentType: 'application/pdf', url: ' JaVaScRiPt:alert(2)', name: 'second' },
        { key: 'a3', contentType: 'application/pdf', url: 'data:text/html,<script>alert(3)</script>', name: 'third' },
      ],
    },
  }),
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

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe('a thread whose sender wrote nothing but hostile text', () => {
  it('draws every message, reply, file name and the sender\'s name as text', async () => {
    useChatStore.setState({
      conversations: [
        {
          id: 'conv-1',
          participants: [{ id: 'her', name: HOSTILE_TEXT }],
          unreadCount: 0,
          updatedAt: '2026-10-01T03:00:00.000Z',
        },
      ],
    });

    const { container } = render(<ChatWindow conversationId="conv-1" />);

    await waitFor(() => expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0));
    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('does not make a link of an attachment that is a script address', async () => {
    const { container } = render(<ChatWindow conversationId="conv-1" />);

    await waitFor(() => expect(screen.getAllByText('third').length).toBeGreaterThan(0));
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => /^\s*(javascript|data|vbscript):/i.test(href))).toEqual([]);
  });
});
