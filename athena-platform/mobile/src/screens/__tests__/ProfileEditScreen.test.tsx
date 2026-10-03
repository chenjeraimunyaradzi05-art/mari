/**
 * The public name on the phone's Edit Profile screen. ATHENA tells members they can
 * use a pseudonym on the platform, and until this field existed no screen, web or
 * phone, let them: the name other members see was filled from the legal one at
 * sign-up. The server keeps the legal first and last name off every social surface;
 * this is where she chooses what to be called instead.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';

const mockUpdateProfile = jest.fn<(...args: any[]) => Promise<unknown>>();
const mockRefreshUser = jest.fn<() => Promise<void>>();
let mockUser: Record<string, unknown> = {};

jest.mock('../../services/api', () => ({
  userApi: { updateProfile: (...args: unknown[]) => mockUpdateProfile(...args) },
}));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, refreshUser: mockRefreshUser }) }));
jest.mock('../OpensOnWebScreen', () => ({ openOnWeb: jest.fn() }));

import { ProfileEditScreen } from '../ProfileEditScreen';
import { press, pressableWithText, renderScreen, settle, shows, unmountScreens } from './renderScreen';

jest.setTimeout(30_000);

const inputFor = (screen: ReactTestRenderer, labelId: string) => {
  const found = screen.root.findAll((node) => node.props?.accessibilityLabelledBy === labelId && typeof node.props?.onChangeText === 'function', { deep: 'all' });
  if (!found.length) throw new Error(`No input labelled ${labelId}`);
  return found[0];
};

const type = async (screen: ReactTestRenderer, labelId: string, text: string) => {
  await TestRenderer.act(async () => {
    inputFor(screen, labelId).props.onChangeText(text);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockUpdateProfile.mockResolvedValue({ data: { success: true } });
  mockRefreshUser.mockResolvedValue(undefined);
  mockUser = { id: 'u1', firstName: 'Jane', lastName: 'Doe', displayName: 'Jane Doe', headline: 'Product lead', bio: '' };
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('the public name', () => {
  it('is offered, with what it is for, what stays private, and how she will be seen', async () => {
    const screen = await renderScreen(<ProfileEditScreen />);

    expect(shows(screen, 'Public name')).toBe(true);
    expect(shows(screen, 'It can be different from your real name')).toBe(true);
    expect(shows(screen, 'Your real name is not shown on them')).toBe(true);
    expect(shows(screen, 'a payment, an identity check you choose to do, an application or booking you make, or the law')).toBe(true);
    expect(inputFor(screen, 'displayNameLabel').props.value).toBe('Jane Doe');
    expect(shows(screen, 'Other members will see you as: Jane Doe')).toBe(true);
  });

  it('is saved as a pseudonym, and the preview follows what she types', async () => {
    const screen = await renderScreen(<ProfileEditScreen />);

    await type(screen, 'displayNameLabel', 'Willow Rain');
    expect(shows(screen, 'Other members will see you as: Willow Rain')).toBe(true);
    await press(pressableWithText(screen, 'Save Changes')!);
    await settle();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ firstName: 'Jane', lastName: 'Doe', displayName: 'Willow Rain', headline: 'Product lead', bio: '' });
    expect(Alert.alert).toHaveBeenCalledWith('Saved', expect.any(String));
  });

  it('is cleared by emptying it, and she is then seen by her first name alone', async () => {
    const screen = await renderScreen(<ProfileEditScreen />);

    await type(screen, 'displayNameLabel', '');
    expect(shows(screen, 'Other members will see you as: Jane')).toBe(true);
    await press(pressableWithText(screen, 'Save Changes')!);
    await settle();

    expect(mockUpdateProfile.mock.calls[0][0]).toMatchObject({ displayName: '' });
  });

  it('is left out of the save when she changed something else, so an old name that would not pass today cannot stop her saving', async () => {
    const screen = await renderScreen(<ProfileEditScreen />);

    await type(screen, 'headlineLabel', 'Head of Product');
    await press(pressableWithText(screen, 'Save Changes')!);
    await settle();

    const sent = mockUpdateProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.headline).toBe('Head of Product');
    expect(Object.keys(sent)).not.toContain('displayName');
  });

  it('shows the server\'s reason when it refuses the name, and keeps what she typed', async () => {
    mockUpdateProfile.mockRejectedValue({ response: { data: { message: 'Leave phone numbers out of your public name; everyone can see it' } } });
    const screen = await renderScreen(<ProfileEditScreen />);

    await type(screen, 'displayNameLabel', 'Call 0412 345 678');
    await press(pressableWithText(screen, 'Save Changes')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('Not saved', 'Leave phone numbers out of your public name; everyone can see it');
    expect(inputFor(screen, 'displayNameLabel').props.value).toBe('Call 0412 345 678');
  });
});
