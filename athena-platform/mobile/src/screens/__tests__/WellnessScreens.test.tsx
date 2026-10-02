/**
 * The wellness pillar, rendered.
 *
 * These screens replaced a card that opened the website, and they sit where
 * being wrong costs most: the crisis lines, a daily check-in a woman may make
 * on a bad day, and the K10. So what is pinned is what she would see when the
 * network is not there (the lines that are always answered, and a day that is
 * said to be unreadable rather than empty), that a check-in never writes over
 * one it could not see, and that the K10 sends her answers in order and puts
 * the server's support lines in front of her on a high score.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';

const mockReference = jest.fn<(...args: any[]) => any>();
const mockToday = jest.fn<(...args: any[]) => any>();
const mockAddEntry = jest.fn<(...args: any[]) => any>();
const mockK10 = jest.fn<(...args: any[]) => any>();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  safetyApi: { settings: () => Promise.reject(new Error('offline')) },
}));

jest.mock('../../services/wellness', () => ({
  ...(jest.requireActual('../../services/wellness') as object),
  wellnessApi: {
    reference: (...args: unknown[]) => mockReference(...args),
    today: (...args: unknown[]) => mockToday(...args),
    addEntry: (...args: unknown[]) => mockAddEntry(...args),
    k10: (...args: unknown[]) => mockK10(...args),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, reset: jest.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => effect(), [effect]);
  },
}));

import { WellnessScreen } from '../wellness/WellnessScreen';
import { WellnessCheckInScreen } from '../wellness/WellnessCheckInScreen';
import { WellnessK10Screen } from '../wellness/WellnessK10Screen';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const answered = (data: unknown) => Promise.resolve({ data: { success: true, data } });

const REFERENCE = {
  asAt: 'September 2026',
  crisisLines: [
    { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
    { key: 'beyond-blue', name: 'Beyond Blue', phone: '1300 22 4636', url: 'https://www.beyondblue.org.au', when: '24/7', who: 'Anxiety and depression' },
  ],
  k10: {
    questions: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, text: `question ${i + 1}?` })),
    options: [
      { value: 1, label: 'None of the time' },
      { value: 2, label: 'A little of the time' },
      { value: 3, label: 'Some of the time' },
      { value: 4, label: 'Most of the time' },
      { value: 5, label: 'All of the time' },
    ],
  },
};

const day = (overrides: Record<string, unknown> = {}) => ({
  today: '2026-09-26',
  settings: { trackers: { checkin: true, sleep: true, hydration: true, cycle: true, medications: true } },
  todays: { CHECKIN: null, SLEEP: null, HYDRATION: null, PERIOD: null },
  checkinStreak: { current: 0, longest: 0, doneToday: false, lastDone: null, totalDone: 0 },
  cycle: { phase: 'unknown', dayOfCycle: null, nextPeriod: null, daysUntilNextPeriod: null, confidence: 'low', hasData: false },
  medications: [],
  nextBooking: null,
  headline: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('WellnessScreen', () => {
  it('says the day could not be read, and still shows the lines that are always answered', async () => {
    mockReference.mockRejectedValue(new Error('Network Error'));
    mockToday.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<WellnessScreen />);

    expect(shows(screen, 'Your day could not be read')).toBe(true);
    expect(shows(screen, 'Check your connection')).toBe(true);
    // Not a statement about her day made because of the network.
    expect(shows(screen, 'How is today going?')).toBe(false);
    expect(shows(screen, 'Checked in today')).toBe(false);
    // 000, Lifeline and 1800RESPECT, labelled as the short list.
    const text = visibleText(screen);
    expect(text).toContain('000');
    expect(text).toContain('13 11 14');
    expect(text).toContain('1800 737 732');
    expect(shows(screen, 'these three are always answered')).toBe(true);
  });

  it('shows the server’s crisis lines when it has them, and today’s check-in as made', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockToday.mockReturnValue(
      answered(day({ todays: { CHECKIN: { id: 'e1', kind: 'CHECKIN', day: '2026-09-26', at: '', refId: null, payload: { mood: 4, stress: 2, anxiety: 2, energy: 3 } } }, checkinStreak: { current: 5, longest: 9, doneToday: true, lastDone: '2026-09-26', totalDone: 20 } }))
    );

    const screen = await renderScreen(<WellnessScreen />);

    expect(shows(screen, 'Beyond Blue')).toBe(true);
    expect(shows(screen, 'these three are always answered')).toBe(false);
    expect(shows(screen, 'Checked in today')).toBe(true);
    expect(shows(screen, 'Mood: Good')).toBe(true);
    expect(shows(screen, '5 days in a row')).toBe(true);
  });

  it('does not ask about water when she has switched the tracker off', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockToday.mockReturnValue(answered(day({ settings: { trackers: { hydration: false } } })));

    const screen = await renderScreen(<WellnessScreen />);

    expect(shows(screen, 'Water today')).toBe(false);
    expect(pressableWithText(screen, '+ One glass')).toBeNull();
  });

  it('adds one glass to the day rather than replacing the count', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockToday.mockReturnValue(answered(day()));
    mockAddEntry.mockReturnValue(answered({ entry: {}, streak: null }));

    const screen = await renderScreen(<WellnessScreen />);
    await press(pressableWithText(screen, '+ One glass')!);
    await settle();

    expect(mockAddEntry).toHaveBeenCalledWith({ kind: 'HYDRATION', payload: { glasses: 1 }, add: true });
  });
});

describe('WellnessCheckInScreen', () => {
  it('offers no save at all when it could not see whether she has already checked in', async () => {
    mockToday.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<WellnessCheckInScreen />);

    expect(shows(screen, 'Today could not be read')).toBe(true);
    expect(shows(screen, 'never writes over it')).toBe(true);
    expect(pressableWithText(screen, 'Save check-in')).toBeNull();
  });

  it('fills in the check-in she already made, so saving edits it', async () => {
    mockToday.mockReturnValue(answered(day({ todays: { CHECKIN: { id: 'e1', kind: 'CHECKIN', day: '2026-09-26', at: '', refId: null, payload: { mood: 2, stress: 4, anxiety: 3, energy: 1, note: 'long day' } } } })));

    const screen = await renderScreen(<WellnessCheckInScreen />);

    expect(shows(screen, 'Saving again replaces')).toBe(true);
    expect(byLabel(screen, 'Mood: Low')?.props.accessibilityState).toEqual({ selected: true });
    expect(byLabel(screen, 'Energy: Drained')?.props.accessibilityState).toEqual({ selected: true });
  });

  it('saves the four scales, then last night’s sleep as its own entry', async () => {
    mockToday.mockReturnValue(answered(day()));
    mockAddEntry.mockReturnValue(answered({ entry: {}, streak: { current: 3, longest: 3, doneToday: true, lastDone: '2026-09-26', totalDone: 3 } }));

    const screen = await renderScreen(<WellnessCheckInScreen />);
    for (const label of ['Mood: Okay', 'Stress: A little', 'Anxiety: Calm', 'Energy: Good']) {
      await press(byLabel(screen, label)!);
    }
    const hours = byLabel(screen, 'Hours');
    await act(async () => {
      hours?.props.onChangeText('7.5');
    });
    await press(pressableWithText(screen, 'Save check-in')!);
    await settle();

    expect(mockAddEntry).toHaveBeenNthCalledWith(1, { kind: 'CHECKIN', payload: { mood: 3, stress: 2, anxiety: 1, energy: 4 } });
    expect(mockAddEntry).toHaveBeenNthCalledWith(2, { kind: 'SLEEP', payload: { hours: 7.5 } });
    expect(shows(screen, 'That is 3 days in a row')).toBe(true);
  });

  // The line about the day is hers alone, so the server shows her the lines and
  // says nobody has been told. The phone puts both in front of her where she is
  // looking, instead of the streak sentence being the last thing she reads.
  it('shows the lines the server chose, and says nobody has been told, when the line she wrote sounds like crisis', async () => {
    mockToday.mockReturnValue(answered(day()));
    mockAddEntry.mockReturnValue(
      answered({
        entry: {},
        streak: { current: 1, longest: 1, doneToday: true, lastDone: '2026-09-26', totalDone: 1 },
        crisis: {
          flagged: true,
          message: 'It sounds like things are very hard right now. What you wrote is saved, and only you can read it; nobody has been told. These lines are staffed this minute.',
          lines: [
            { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
            { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
            { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
          ],
        },
      })
    );

    const screen = await renderScreen(<WellnessCheckInScreen />);
    for (const label of ['Mood: Okay', 'Stress: A little', 'Anxiety: Calm', 'Energy: Good']) {
      await press(byLabel(screen, label)!);
    }
    await act(async () => {
      byLabel(screen, 'A line about the day')?.props.onChangeText('I cannot go on');
    });
    await press(pressableWithText(screen, 'Save check-in')!);
    await settle();

    expect(mockAddEntry).toHaveBeenCalledWith({ kind: 'CHECKIN', payload: { mood: 3, stress: 2, anxiety: 1, energy: 4, note: 'I cannot go on' } });
    expect(shows(screen, 'nobody has been told')).toBe(true);
    expect(shows(screen, 'Someone to talk to, now')).toBe(true);
    expect(visibleText(screen)).toContain('1800 737 732');
  });

  it('will not save until every scale has an answer', async () => {
    mockToday.mockReturnValue(answered(day()));

    const screen = await renderScreen(<WellnessCheckInScreen />);
    await press(byLabel(screen, 'Mood: Okay')!);
    await press(pressableWithText(screen, 'Save check-in')!);

    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(shows(screen, 'Pick a step on each of the four scales')).toBe(true);
  });
});

describe('WellnessK10Screen', () => {
  it('says the questions did not load, and shows the lines that are always answered', async () => {
    mockReference.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<WellnessK10Screen />);

    expect(shows(screen, 'The questions could not be loaded')).toBe(true);
    expect(visibleText(screen)).toContain('13 11 14');
  });

  it('sends the ten answers in question order and puts the server’s lines in front of a high score', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockK10.mockReturnValue(
      answered({ score: 38, band: 'severe', label: 'High distress', meaning: 'A high level of distress.', nextStep: 'Call Beyond Blue or Lifeline.', crisisLines: [REFERENCE.crisisLines[1]] })
    );

    const screen = await renderScreen(<WellnessK10Screen />);
    for (let q = 1; q <= 10; q += 1) {
      await press(byLabel(screen, `Question ${q}: ${q % 2 === 0 ? 'All of the time' : 'Most of the time'}`)!);
    }
    await press(pressableWithText(screen, 'See my score')!);
    await settle();

    expect(mockK10).toHaveBeenCalledWith([4, 5, 4, 5, 4, 5, 4, 5, 4, 5]);
    const text = visibleText(screen);
    expect(text).toContain('38');
    expect(text).toContain('high distress');
    expect(text).toContain('Someone to talk to, now');
    expect(text).toContain('1300 22 4636');
    expect(text).toContain('Nothing you answered was stored');
  });

  it('shows whichever lines the server chose, 1800RESPECT among them, for a high score', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockK10.mockReturnValue(
      answered({
        score: 24,
        band: 'moderate',
        label: 'High distress',
        meaning: 'A high level of distress, where support makes a real difference.',
        nextStep: 'Book a GP.',
        crisisLines: [
          { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
          { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
          { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
        ],
      })
    );

    const screen = await renderScreen(<WellnessK10Screen />);
    for (let q = 1; q <= 10; q += 1) await press(byLabel(screen, `Question ${q}: Some of the time`)!);
    await press(pressableWithText(screen, 'See my score')!);
    await settle();

    const text = visibleText(screen);
    expect(text).toContain('Someone to talk to, now');
    expect(text).toContain('1800 737 732');
    expect(text).toContain('13 11 14');
  });

  it('keeps her answers on screen when scoring fails', async () => {
    mockReference.mockReturnValue(answered(REFERENCE));
    mockK10.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<WellnessK10Screen />);
    for (let q = 1; q <= 10; q += 1) await press(byLabel(screen, `Question ${q}: None of the time`)!);
    await press(pressableWithText(screen, 'See my score')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('Not scored', expect.stringContaining('Check your connection'));
    expect(byLabel(screen, 'Question 10: None of the time')?.props.accessibilityState).toEqual({ selected: true });
  });
});
