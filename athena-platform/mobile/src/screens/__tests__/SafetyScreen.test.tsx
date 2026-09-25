/**
 * The safety screen, rendered.
 *
 * This is the screen where being wrong is most expensive: it tells a woman
 * whether safe mode is on, whether she is hidden from search, and whether the
 * panic button will reach anybody. Two of those claims were untrue at once
 * before the last remediation pass — a failed fetch drew every protection as
 * OFF, and the panic button reported "Alert sent" off a field the server does
 * not return — and nothing in this package could have caught either, because
 * no test had ever rendered a screen.
 *
 * So the assertions here are deliberately about what a member sees rather than
 * about how the component is built: a switch that exists, a button that is
 * absent, a sentence that appears. That is the layer the defects lived in.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'react-test-renderer';
import { Alert, Switch } from 'react-native';

// Prefixed with "mock" because jest hoists jest.mock above every other
// statement in the file, and only that prefix is allowed through the guard
// against referencing a variable the factory would read before it exists.
const mockSettings = jest.fn<(...args: any[]) => any>();
const mockUpdate = jest.fn<(...args: any[]) => any>();
const mockPanic = jest.fn<(...args: any[]) => any>();
const mockAddContact = jest.fn<(...args: any[]) => any>();
const mockRemoveContact = jest.fn<(...args: any[]) => any>();

jest.mock('../../services/api', () => ({
  safetyApi: {
    settings: (...args: unknown[]) => mockSettings(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    panic: (...args: unknown[]) => mockPanic(...args),
    addContact: (...args: unknown[]) => mockAddContact(...args),
    removeContact: (...args: unknown[]) => mockRemoveContact(...args),
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

import { SafetyScreen } from '../SafetyScreen';
import { byLabel, press, pressableWithText, renderScreen, shows, unmountScreens, visibleText } from './renderScreen';

const READ_SETTINGS = {
  isSafeMode: true,
  hideFromSearch: true,
  allowMessages: false,
  safeExitEnabled: false,
  safeExitUrl: null,
  panicButtonEnabled: true,
  activityLogEnabled: true,
  disguisedAppIcon: false,
  notificationsSafe: true,
  emergencyContacts: [{ id: 'c1', name: 'Ruth', phone: '0400000000', email: 'ruth@example.com', relationship: 'Sister' }],
};

const answered = (data: unknown) => Promise.resolve({ data: { success: true, data } });

// The first render in a file pays for React Native's whole lazy module graph,
// which on a cold cache is several seconds before any of this screen's own
// code runs. That is a fixture cost, not a slow screen, and it should not read
// as a failure.
jest.setTimeout(30_000);

describe('SafetyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  it('draws no protection at all when the settings could not be read', async () => {
    mockSettings.mockRejectedValue({ response: { data: { message: 'Network unavailable.' } } });

    const screen = await renderScreen(<SafetyScreen />);

    // The defect this replaces: every switch rendered from `settings?.[key]`,
    // so a failed read showed five protections as OFF. A survivor was told she
    // was exposed when she was not, and touching a switch to "fix" it wrote
    // that false state back over the real one.
    expect(screen.root.findAllByType(Switch)).toHaveLength(0);
    expect(shows(screen, 'Your settings could not be read')).toBe(true);
    expect(shows(screen, 'Nothing has changed')).toBe(true);
    // Nor the panic button, which is drawn from panicButtonEnabled.
    expect(byLabel(screen, 'Panic button')).toBeNull();
    // 000 is always reachable, whatever else failed.
    expect(shows(screen, 'call 000')).toBe(true);
  });

  it('draws each protection in the state the server reported', async () => {
    mockSettings.mockReturnValue(answered(READ_SETTINGS));

    const screen = await renderScreen(<SafetyScreen />);

    const switches = screen.root.findAllByType(Switch);
    expect(switches).toHaveLength(5);
    // Safe mode on, "allow messages" off: the screen must not flatten either
    // into the other, which is what a single falsy default did.
    expect(switches.map((s) => s.props.value)).toEqual([true, true, false, true, true]);
    expect(shows(screen, 'Safe mode')).toBe(true);
  });

  it('hides the panic button when she has not turned it on', async () => {
    mockSettings.mockReturnValue(answered({ ...READ_SETTINGS, panicButtonEnabled: false }));

    const screen = await renderScreen(<SafetyScreen />);

    expect(byLabel(screen, 'Panic button')).toBeNull();
  });

  it('says plainly that nobody was told when the alert reached no one', async () => {
    mockSettings.mockReturnValue(answered(READ_SETTINGS));
    mockPanic.mockReturnValue(answered({ notifiedContacts: [], unreachableContacts: ['Ruth'] }));

    const screen = await renderScreen(<SafetyScreen />);
    const button = byLabel(screen, 'Panic button');
    expect(button).not.toBeNull();

    // The button asks first; the confirmation is the second action on the
    // alert. Driving it through Alert is how a member reaches the send.
    await press(button!);
    const [, , actions] = (Alert.alert as jest.Mock).mock.calls[0];
    const send = (actions as Array<{ text: string; onPress?: () => void }>).find((a) => a.text === 'Send alert');
    expect(send).toBeDefined();
    await press({ props: { onPress: send!.onPress } } as never);

    const text = visibleText(screen);
    // The old screen said "Alert sent — your contacts were told" here, off a
    // field the server does not return. It is now the truth, and it stays on
    // screen after the dialog is dismissed, because in a crisis a dialog is
    // read once and gone.
    expect(text).toContain('Nobody was told');
    expect(text).toContain('Call 000');
    expect(text).not.toContain('Alert sent');
  });

  it('names who was reached when the alert did go out', async () => {
    mockSettings.mockReturnValue(answered(READ_SETTINGS));
    mockPanic.mockReturnValue(answered({ notifiedContacts: ['Ruth'], unreachableContacts: [] }));

    const screen = await renderScreen(<SafetyScreen />);
    await press(byLabel(screen, 'Panic button')!);
    const [, , actions] = (Alert.alert as jest.Mock).mock.calls[0];
    const send = (actions as Array<{ text: string; onPress?: () => void }>).find((a) => a.text === 'Send alert');
    await press({ props: { onPress: send!.onPress } } as never);

    const text = visibleText(screen);
    expect(text).toContain('One person was told');
    expect(text).toContain('Ruth');
  });

  it('tells her nothing left the phone when the panic request itself failed', async () => {
    mockSettings.mockReturnValue(answered(READ_SETTINGS));
    mockPanic.mockRejectedValue({ response: { data: { message: 'Service unavailable.' } } });

    const screen = await renderScreen(<SafetyScreen />);
    await press(byLabel(screen, 'Panic button')!);
    const [, , actions] = (Alert.alert as jest.Mock).mock.calls[0];
    const send = (actions as Array<{ text: string; onPress?: () => void }>).find((a) => a.text === 'Send alert');
    await press({ props: { onPress: send!.onPress } } as never);

    const text = visibleText(screen);
    expect(text).toContain('The alert did not go out');
    expect(text).toContain('Nobody has been told');
  });

  it('flags a contact the panic button cannot reach', async () => {
    mockSettings.mockReturnValue(
      answered({
        ...READ_SETTINGS,
        emergencyContacts: [{ id: 'c1', name: 'Ruth', phone: '0400000000', relationship: 'Sister' }],
      })
    );

    const screen = await renderScreen(<SafetyScreen />);

    // A contact saved before the form required an address is cover that is not
    // there, so the list says so rather than listing her like the others.
    expect(shows(screen, 'the panic button cannot reach them')).toBe(true);
  });

  it('refuses a new contact with no email address, because the alert is an email', async () => {
    mockSettings.mockReturnValue(answered(READ_SETTINGS));

    const screen = await renderScreen(<SafetyScreen />);
    // One field per act: each onChangeText spreads the `contact` it closed
    // over, so three of them inside one act would all write over the same
    // stale object and only the last field would survive.
    const fill = (placeholder: string, value: string) => {
      const input = screen.root
        .findAll((node) => typeof node.props?.placeholder === 'string', { deep: 'all' })
        .find((node) => node.props.placeholder === placeholder);
      expect(input).toBeDefined();
      act(() => {
        input!.props.onChangeText(value);
      });
    };

    fill('Name', 'Ruth');
    fill('Phone', '0400000000');
    fill('How you know them', 'Sister');

    const addButton = pressableWithText(screen, 'Add contact');
    expect(addButton).not.toBeNull();
    await press(addButton!);

    expect(mockAddContact).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('An email address is needed', expect.stringContaining('alerts your contacts by email'));
  });
});
