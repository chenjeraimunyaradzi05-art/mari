/**
 * The direct-message thread, rendered.
 *
 * Three defects lived on this screen at once and every one of them was
 * invisible to a type check:
 *
 *  - `item.senderId === 'me'` decided which side a bubble sat on. No message
 *    has ever carried the string 'me', so every message a member sent was
 *    drawn in the other person's grey bubble, on the other person's side.
 *  - A send that the server had refused was put in the offline queue, where it
 *    replayed the same refusal on every reconnection for the life of the
 *    install; the queued URL was a path the server has never served.
 *  - loadMessages had no catch, so a dropped connection was an unhandled
 *    rejection and the thread simply stayed empty — which reads as "no
 *    messages" rather than "not loaded".
 *
 * Each of those is one assertion below.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act, type ReactTestRenderer } from 'react-test-renderer';

const mockGetMessages = jest.fn<(...args: any[]) => any>();
const mockSend = jest.fn<(...args: any[]) => any>();
const mockQueueOfflineAction = jest.fn<(...args: any[]) => any>();
// The signature is explicit because the mock is called with the arguments the
// real socketService.on takes and must hand back the unsubscribe function the
// screen stores; inferred from the implementation alone it would take none.
const mockSocketOn = jest.fn<(...args: any[]) => () => void>(() => () => undefined);
const mockUseAuth = jest.fn<(...args: any[]) => any>();

jest.mock('../../services/api', () => ({
  messagesApi: {
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    send: (...args: unknown[]) => mockSend(...args),
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/offlineSync', () => ({
  queueOfflineAction: (...args: unknown[]) => mockQueueOfflineAction(...args),
}));

jest.mock('../../services/socket', () => ({
  socketService: { on: (...args: unknown[]) => mockSocketOn(...args) },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { ChatDetailScreen } from '../ChatDetailScreen';
import { byLabel, flatStyle, press, renderScreen, settle, unmountScreens, visibleText } from './renderScreen';

const ME = '11111111-1111-4111-8111-111111111111';
const HER = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';

const thread = [
  { id: 'm1', senderId: HER, conversationId: CONVERSATION, content: 'Are you safe?', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'm2', senderId: ME, conversationId: CONVERSATION, content: 'I am, thank you', createdAt: '2026-01-01T00:01:00.000Z' },
];

// The screen is a stack screen, so it is given route params the way the
// navigator gives them; nothing here navigates.
const route = { params: { conversationId: CONVERSATION, participantName: 'Ruth' } } as never;
const navigation = {} as never;

// The first render in a file pays for React Native's whole lazy module graph,
// which is a fixture cost rather than a slow screen.
jest.setTimeout(30_000);

/**
 * Which side each bubble sits on, in order.
 *
 * A bubble is the only thing on this screen with a 16px corner radius, so the
 * style is what identifies it — and the style is also the thing under test,
 * since "whose message is this" is expressed entirely as alignSelf and a
 * background colour.
 */
function bubbleSides(screen: ReactTestRenderer): Array<unknown> {
  return screen.root
    .findAll((node) => typeof node.type === 'string' && flatStyle(node.props?.style).borderRadius === 16, { deep: 'all' })
    .map((node) => flatStyle(node.props.style).alignSelf);
}

/** Types a message and presses send, letting whatever that starts settle. */
async function sendMessage(screen: ReactTestRenderer, text: string): Promise<void> {
  const input = screen.root.find((node) => node.props?.placeholder === 'Type a message');
  act(() => input.props.onChangeText(text));
  const button = byLabel(screen, 'Send message');
  expect(button).not.toBeNull();
  await press(button!);
  await settle();
}

describe('ChatDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: ME, displayName: 'Mara' } });
    mockGetMessages.mockResolvedValue({ data: { success: true, data: thread } });
  });

  afterEach(() => {
    unmountScreens();
  });

  it('puts her own messages on her own side', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);

    const sides = bubbleSides(screen);
    // Hers on the left, her own on the right. Comparing the sender against the
    // literal 'me' made both of these 'flex-start', so a member reading her own
    // thread saw every word she had written attributed to the other person.
    expect(sides).toEqual(['flex-start', 'flex-end']);
  });

  it('draws nothing as her own when the signed-in member is not known yet', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);

    // An unknown viewer must not be guessed at: a bubble on the wrong side is
    // a message attributed to the wrong person, and in a thread with a support
    // worker that is not a cosmetic mistake.
    expect(bubbleSides(screen)).toEqual(['flex-start', 'flex-start']);
  });

  it('says the thread could not be loaded rather than showing it as empty', async () => {
    mockGetMessages.mockRejectedValue({ response: { data: { message: 'Network unavailable.' } } });

    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);

    expect(visibleText(screen)).toContain('Network unavailable.');
    expect(bubbleSides(screen)).toHaveLength(0);
  });

  it('queues a send that never reached the server, at the path the server serves', async () => {
    // No `response` on the error is what axios gives for a request that never
    // got an answer — the only case that is worth replaying later.
    mockSend.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));

    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);
    await sendMessage(screen, 'I am on my way');

    expect(mockQueueOfflineAction).toHaveBeenCalledTimes(1);
    const [action] = mockQueueOfflineAction.mock.calls[0];
    // POST /messages/conversations/:id — without the trailing /messages — is a
    // route the server has never mounted, so every replay 404ed and the queue
    // kept it because it had failed.
    expect(action.payload).toMatchObject({
      method: 'post',
      url: `/messages/conversations/${CONVERSATION}/messages`,
      data: { content: 'I am on my way' },
    });
    expect(visibleText(screen)).toContain('You are offline');
  });

  it('does not queue a send the server refused on its merits', async () => {
    mockSend.mockRejectedValue({ response: { status: 403, data: { message: 'You cannot message this person.' } } });

    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);
    await sendMessage(screen, 'Hello');

    // A refusal replays into the same refusal forever. It is reported, not kept.
    expect(mockQueueOfflineAction).not.toHaveBeenCalled();
    const text = visibleText(screen);
    expect(text).toContain('You cannot message this person.');
    expect(text).not.toContain('You are offline');
  });

  it('shows a message that arrives live, once, and only for this conversation', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={route} navigation={navigation} />);
    const [, handler] = mockSocketOn.mock.calls[0] as unknown as [string, (message: unknown) => void];

    await act(async () => {
      handler({ id: 'm3', senderId: HER, conversationId: CONVERSATION, content: 'Ring me', createdAt: '2026-01-01T00:02:00.000Z' });
      handler({ id: 'm3', senderId: HER, conversationId: CONVERSATION, content: 'Ring me', createdAt: '2026-01-01T00:02:00.000Z' });
      handler({ id: 'm4', senderId: HER, conversationId: 'another-thread', content: 'Not for this thread', createdAt: '2026-01-01T00:03:00.000Z' });
    });

    const text = visibleText(screen);
    // The server emits to the conversation room and to her own room, so the
    // same message can arrive twice; a message for another thread must not
    // appear in this one at all.
    expect(text.match(/Ring me/g)).toHaveLength(1);
    expect(text).not.toContain('Not for this thread');
  });
});
