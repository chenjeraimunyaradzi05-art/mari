/**
 * The inbox, a page at a time.
 *
 * The server answers at most a hundred conversations a page. This screen used
 * to ask once and draw that as the whole inbox, so a member with more threads
 * than that could never reach her older conversations. These pin the paging:
 * the next page is asked for at the end of the list, nothing is shown twice,
 * and a new message re-reads the first page without dropping the rest.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'react-test-renderer';

const mockGetConversations = jest.fn<(...args: any[]) => any>();
let socketHandler: (() => void) | undefined;
const mockSocketOn = jest.fn<(...args: any[]) => () => void>((_event: unknown, handler: unknown) => {
  socketHandler = handler as () => void;
  return () => undefined;
});

jest.mock('../../services/api', () => ({
  messagesApi: { getConversations: (...args: unknown[]) => mockGetConversations(...args) },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/socket', () => ({
  socketService: { on: (...args: unknown[]) => mockSocketOn(...args) },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

import { MessagesScreen, appendPage, mergeFirstPage } from '../MessagesScreen';
import { renderScreen, settle, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const thread = (id: string, name: string) => ({
  id,
  participant: { id: `p-${id}`, displayName: name },
  lastMessage: { content: 'See you Thursday', createdAt: '2026-09-20T10:00:00.000Z' },
  unreadCount: 0,
});

const page = (items: ReturnType<typeof thread>[], hasMore: boolean) => ({
  data: { success: true, data: items, pagination: { page: 1, limit: 100, total: 0, pages: 0, hasMore }, unreadTotal: 0 },
});

describe('the inbox, paged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketHandler = undefined;
  });

  afterEach(() => {
    unmountScreens();
  });

  it('asks for the next page at the end of the list and shows each thread once', async () => {
    mockGetConversations
      .mockResolvedValueOnce(page([thread('a', 'Amira'), thread('b', 'Bea')], true))
      .mockResolvedValueOnce(page([thread('b', 'Bea'), thread('c', 'Chloe')], false));

    const screen = await renderScreen(<MessagesScreen />);
    expect(mockGetConversations).toHaveBeenLastCalledWith({ page: 1 });

    const list = screen.root.findAll((node) => typeof node.props?.onEndReached === 'function')[0];
    await act(async () => {
      list.props.onEndReached();
    });
    await settle();

    expect(mockGetConversations).toHaveBeenLastCalledWith({ page: 2 });
    const text = visibleText(screen);
    expect(text).toContain('Chloe');
    expect(text.match(/Bea/g)).toHaveLength(1);

    // The last page said there is no more; the end of the list asks nothing.
    await act(async () => {
      list.props.onEndReached();
    });
    expect(mockGetConversations).toHaveBeenCalledTimes(2);
  });

  it('re-reads the first page on a new message and keeps the older pages already loaded', async () => {
    mockGetConversations
      .mockResolvedValueOnce(page([thread('a', 'Amira')], true))
      .mockResolvedValueOnce(page([thread('c', 'Chloe')], false))
      .mockResolvedValueOnce(page([thread('c', 'Chloe'), thread('a', 'Amira')], true));

    const screen = await renderScreen(<MessagesScreen />);
    const list = screen.root.findAll((node) => typeof node.props?.onEndReached === 'function')[0];
    await act(async () => {
      list.props.onEndReached();
    });
    await settle();

    await act(async () => {
      socketHandler?.();
    });
    await settle();

    expect(mockGetConversations).toHaveBeenLastCalledWith({ page: 1 });
    const text = visibleText(screen);
    expect(text.indexOf('Chloe')).toBeLessThan(text.indexOf('Amira'));
    expect(text.match(/Chloe/g)).toHaveLength(1);
  });
});

describe('merging pages', () => {
  it('puts the fresh first page first and keeps older threads once', () => {
    const merged = mergeFirstPage([thread('c', 'C'), thread('a', 'A')], [thread('a', 'A'), thread('b', 'B'), thread('c', 'C')]);
    expect(merged.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('appends a later page without repeating a thread already shown', () => {
    const appended = appendPage([thread('a', 'A'), thread('b', 'B')], [thread('b', 'B'), thread('d', 'D')]);
    expect(appended.map((c) => c.id)).toEqual(['a', 'b', 'd']);
  });
});
