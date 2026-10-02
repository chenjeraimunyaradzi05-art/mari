/**
 * The inbox keeps message requests apart.
 *
 * The web has had a Requests tab since requests existed; the phone listed every
 * thread together, so someone she does not follow could put a message at the top
 * of her inbox just by sending it, and there was nowhere to decide it. These pin
 * the split: a request is not in Messages, it is in Requests with a count, and
 * opening it hands the thread the facts it needs to ask her.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockGetConversations = jest.fn<(...args: any[]) => any>();
const mockNavigate = jest.fn();

jest.mock('../../services/api', () => ({
  messagesApi: { getConversations: (...args: unknown[]) => mockGetConversations(...args) },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/socket', () => ({
  socketService: { on: jest.fn(() => () => undefined) },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { MessagesScreen } from '../MessagesScreen';
import { byLabel, press, renderScreen, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const thread = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  participant: { id: `p-${id}`, displayName: name },
  lastMessage: { content: `Hello from ${name}`, createdAt: '2026-10-01T00:00:00.000Z' },
  unreadCount: 0,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConversations.mockResolvedValue({
    data: {
      success: true,
      data: [thread('a', 'Amira'), thread('b', 'Dan', { isRequest: true }), thread('c', 'Eve', { isRequest: true })],
      pagination: { hasMore: false },
    },
  });
});

afterEach(() => {
  unmountScreens();
});

describe('the Messages tab', () => {
  it('leaves requests out, and says how many are waiting', async () => {
    const screen = await renderScreen(<MessagesScreen />);

    const text = visibleText(screen);
    expect(text).toContain('Amira');
    expect(text).not.toContain('Dan');
    expect(text).not.toContain('Eve');
    expect(byLabel(screen, 'Requests, 2 waiting')).not.toBeNull();
  });
});

describe('the Requests tab', () => {
  it('lists only requests, and an honest empty state when there are none', async () => {
    const screen = await renderScreen(<MessagesScreen />);

    await press(byLabel(screen, 'Requests, 2 waiting')!);
    const text = visibleText(screen);
    expect(text).toContain('Dan');
    expect(text).toContain('Eve');
    expect(text).not.toContain('Amira');

    unmountScreens();
    mockGetConversations.mockResolvedValue({ data: { success: true, data: [thread('a', 'Amira')], pagination: { hasMore: false } } });
    const quiet = await renderScreen(<MessagesScreen />);
    await press(byLabel(quiet, 'Requests')!);
    expect(visibleText(quiet)).toContain('No requests');
  });

  it('opens a request with her id and the fact that it is a request, so the thread can ask her', async () => {
    const screen = await renderScreen(<MessagesScreen />);
    await press(byLabel(screen, 'Requests, 2 waiting')!);

    await press(byLabel(screen, 'Conversation with Dan')!);

    expect(mockNavigate).toHaveBeenCalledWith('ChatDetail', {
      conversationId: 'b',
      participantName: 'Dan',
      participantId: 'p-b',
      isRequest: true,
    });
  });

  it('opens an ordinary thread as an ordinary thread', async () => {
    const screen = await renderScreen(<MessagesScreen />);

    await press(byLabel(screen, 'Conversation with Amira')!);

    expect(mockNavigate).toHaveBeenCalledWith('ChatDetail', {
      conversationId: 'a',
      participantName: 'Amira',
      participantId: 'p-a',
      isRequest: false,
    });
  });
});
