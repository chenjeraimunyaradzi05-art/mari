/**
 * Reporting, blocking and answering a request, from the direct-message thread on
 * the phone.
 *
 * The server could take a report of a message and a block from the day they
 * existed, and the phone could send neither: the thread had a title and a
 * message box. A woman being written to by someone she did not want to hear from
 * had no way to say so in the one place it was happening. And a message request
 * could be answered on the web and nowhere else, so on the phone it simply sat
 * there. Each of those is a few assertions below.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

const mockGetMessages = jest.fn<(...args: any[]) => any>();
const mockAccept = jest.fn<(...args: any[]) => any>();
const mockDecline = jest.fn<(...args: any[]) => any>();
const mockReport = jest.fn<(...args: any[]) => any>();
const mockBlock = jest.fn<(...args: any[]) => any>();
const mockGoBack = jest.fn();

jest.mock('../../services/api', () => ({
  messagesApi: {
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    send: jest.fn(),
    acceptRequest: (...args: unknown[]) => mockAccept(...args),
    declineRequest: (...args: unknown[]) => mockDecline(...args),
  },
  memberSafetyApi: {
    report: (...args: unknown[]) => mockReport(...args),
    block: (...args: unknown[]) => mockBlock(...args),
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/offlineSync', () => ({ queueOfflineAction: jest.fn() }));
jest.mock('../../services/socket', () => ({
  socketService: { on: jest.fn(() => () => undefined) },
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: ME, displayName: 'Mara' } }),
}));

import { ChatDetailScreen } from '../ChatDetailScreen';
import { byLabel, press, pressableWithText, renderScreen, settle, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const ME = '11111111-1111-4111-8111-111111111111';
const HER = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';

const thread = [
  { id: 'm1', senderId: HER, conversationId: CONVERSATION, content: 'I know where you work', createdAt: '2026-10-01T00:00:00.000Z' },
  { id: 'm2', senderId: ME, conversationId: CONVERSATION, content: 'Please stop', createdAt: '2026-10-01T00:01:00.000Z' },
];

const navigation = { goBack: mockGoBack } as never;
const routeFor = (params: Record<string, unknown> = {}) =>
  ({ params: { conversationId: CONVERSATION, participantName: 'Dan', ...params } }) as never;

/** The buttons of the next Alert, and a way to press one the way she would. */
function nextAlert(): { buttons: Array<{ text?: string; style?: string; onPress?: () => unknown }>; title: string } {
  const calls = (Alert.alert as unknown as jest.Mock).mock.calls;
  const [title, , buttons] = calls[calls.length - 1] as [string, unknown, any];
  return { title, buttons };
}

function bubbleFor(screen: ReactTestRenderer, text: string) {
  return screen.root.findAll((node) => typeof node.props?.onLongPress === 'function' && visibleTextOf(node).includes(text), { deep: 'all' });
}

function visibleTextOf(node: { children?: unknown[] }): string {
  const parts: string[] = [];
  const walk = (n: any): void => {
    if (typeof n === 'string') parts.push(n);
    else n?.children?.forEach(walk);
  };
  walk(node);
  return parts.join(' ');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockGetMessages.mockResolvedValue({ data: { success: true, data: thread } });
  mockReport.mockResolvedValue({ data: { success: true } });
  mockBlock.mockResolvedValue({ data: { success: true } });
  mockAccept.mockResolvedValue({ data: { success: true } });
  mockDecline.mockResolvedValue({ data: { success: true } });
});

afterEach(() => {
  unmountScreens();
});

describe('reporting a message', () => {
  it('offers it on what the other person said, by pressing and holding, and not on her own words', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor()} navigation={navigation} />);

    expect(bubbleFor(screen, 'I know where you work').length).toBeGreaterThan(0);
    expect(bubbleFor(screen, 'Please stop')).toHaveLength(0);
  });

  it('opens the reasons, says a copy is kept, and sends the message id with the reason she picks', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor()} navigation={navigation} />);

    await act(async () => {
      bubbleFor(screen, 'I know where you work')[0].props.onLongPress();
    });
    await settle();

    const text = visibleText(screen);
    expect(text).toContain('Report this message');
    expect(text).toContain('We keep a copy of this message and the few before it');

    const reason = byLabel(screen, 'Harassment or bullying');
    expect(reason).not.toBeNull();
    await press(reason!);
    await settle();

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith({ targetType: 'message', targetId: 'm1', reason: 'harassment' });
    expect(Alert.alert).toHaveBeenCalledWith('Thank you', expect.stringContaining('safety team'));
  });

  it('says so, and keeps the sheet open, when the report could not be sent', async () => {
    mockReport.mockRejectedValue({ response: { data: { message: 'We could not find that message.' } } });
    const screen = await renderScreen(<ChatDetailScreen route={routeFor()} navigation={navigation} />);

    await act(async () => {
      bubbleFor(screen, 'I know where you work')[0].props.onLongPress();
    });
    await press(byLabel(screen, 'Harassment or bullying')!);
    await settle();

    expect(visibleText(screen)).toContain('We could not find that message.');
    expect(Alert.alert).not.toHaveBeenCalledWith('Thank you', expect.anything());
  });
});

describe('the menu in the thread', () => {
  it('reports the member herself, by the id the thread knows her by', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor({ participantId: HER })} navigation={navigation} />);

    await press(byLabel(screen, 'More options for Dan')!);
    const { buttons } = nextAlert();
    expect(buttons.map((button) => button.text)).toEqual(['Report Dan', 'Block Dan', 'Cancel']);

    await act(async () => {
      buttons[0].onPress?.();
    });
    await press(byLabel(screen, 'Violence or threats')!);
    await settle();

    expect(mockReport).toHaveBeenCalledWith({ targetType: 'user', targetId: HER, reason: 'violence' });
  });

  it('works out who the other person is from the thread when it was opened without her id', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor()} navigation={navigation} />);

    expect(byLabel(screen, 'More options for Dan')).not.toBeNull();
  });

  it('blocks only after saying what it does, and then leaves the thread', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor({ participantId: HER })} navigation={navigation} />);

    await press(byLabel(screen, 'More options for Dan')!);
    await act(async () => {
      nextAlert().buttons[1].onPress?.();
    });

    const confirm = nextAlert();
    expect(confirm.title).toBe('Block Dan?');
    // Nothing is blocked until she says so.
    expect(mockBlock).not.toHaveBeenCalled();

    await act(async () => {
      await confirm.buttons.find((button) => button.text === 'Block')?.onPress?.();
    });
    await settle();

    expect(mockBlock).toHaveBeenCalledWith(HER);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('stays in the thread, and says so, when the block does not go through', async () => {
    mockBlock.mockRejectedValue({ response: { data: { message: 'Could not block this member' } } });
    const screen = await renderScreen(<ChatDetailScreen route={routeFor({ participantId: HER })} navigation={navigation} />);

    await press(byLabel(screen, 'More options for Dan')!);
    await act(async () => {
      nextAlert().buttons[1].onPress?.();
    });
    await act(async () => {
      await nextAlert().buttons.find((button) => button.text === 'Block')?.onPress?.();
    });
    await settle();

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith('Could not block', 'Could not block this member');
  });
});

describe('a message request', () => {
  it('shows who is asking, and lets her accept, which opens the thread', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor({ isRequest: true })} navigation={navigation} />);

    expect(visibleText(screen)).toContain('wants to message you');
    await press(byLabel(screen, 'Accept message request')!);
    await settle();

    expect(mockAccept).toHaveBeenCalledWith(CONVERSATION);
    expect(visibleText(screen)).not.toContain('wants to message you');
  });

  it('declines only after she confirms, and then leaves the thread', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor({ isRequest: true })} navigation={navigation} />);

    await press(byLabel(screen, 'Decline message request')!);
    const confirm = nextAlert();
    expect(confirm.title).toContain('Decline Dan');
    expect(mockDecline).not.toHaveBeenCalled();

    await act(async () => {
      await confirm.buttons.find((button) => button.text === 'Decline')?.onPress?.();
    });
    await settle();

    expect(mockDecline).toHaveBeenCalledWith(CONVERSATION);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('is not shown for an ordinary conversation', async () => {
    const screen = await renderScreen(<ChatDetailScreen route={routeFor()} navigation={navigation} />);

    expect(visibleText(screen)).not.toContain('wants to message you');
    expect(pressableWithText(screen, 'Accept')).toBeNull();
  });
});
