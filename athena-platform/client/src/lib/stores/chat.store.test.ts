import { useChatStore, countUnread, type Conversation } from './chat.store';

const conversation = (id: string, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  participants: [{ id: `p-${id}`, name: `Person ${id}` }],
  unreadCount: 2,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

describe('the unread badge', () => {
  it('counts inbox threads only: not muted, archived, or unaccepted requests', () => {
    const threads = [
      conversation('a'),
      conversation('b', { isMuted: true }),
      conversation('c', { isArchived: true }),
      conversation('d', { isRequest: true }),
      conversation('e', { unreadCount: 0 }),
    ];
    expect(countUnread(threads)).toBe(2);
  });

  it('the store keeps the badge in step when a thread is muted or a request accepted', () => {
    const { setConversations, patchConversation } = useChatStore.getState();
    setConversations([conversation('a'), conversation('b', { isRequest: true })]);
    expect(useChatStore.getState().totalUnread).toBe(2);

    patchConversation('a', { isMuted: true });
    expect(useChatStore.getState().totalUnread).toBe(0);
    expect(useChatStore.getState().conversations.find((c) => c.id === 'a')?.isMuted).toBe(true);

    patchConversation('b', { isRequest: false });
    expect(useChatStore.getState().totalUnread).toBe(2);
  });

  it('a refetch does not wipe a live typing indicator', () => {
    const { setConversations, setTyping } = useChatStore.getState();
    setConversations([conversation('a')]);
    setTyping('a', true);
    setConversations([conversation('a', { unreadCount: 5 })]);
    const a = useChatStore.getState().conversations.find((c) => c.id === 'a');
    expect(a?.isTyping).toBe(true);
    expect(a?.unreadCount).toBe(5);
  });
});
