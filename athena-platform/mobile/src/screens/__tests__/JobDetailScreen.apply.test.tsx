/**
 * Applying for a job.
 *
 * One tap used to send an empty application: no chance to check it was the
 * right job, no cover letter. The tap now opens the application, and only
 * "Send application" sends it, with whatever she wrote.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';

const mockJobGet = jest.fn<(...args: any[]) => any>();
const mockApply = jest.fn<(...args: any[]) => any>();

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { jobId: 'job-1' } }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
}));

jest.mock('../../services/api', () => ({
  jobsApi: {
    get: (...args: unknown[]) => mockJobGet(...args),
    save: jest.fn(),
    unsave: jest.fn(),
    apply: (...args: unknown[]) => mockApply(...args),
  },
  userApi: { getSavedJobs: jest.fn(async () => ({ data: { success: true, data: [] } })) },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  WEB_URL: 'https://athena.example',
}));

import { JobDetailScreen } from '../JobDetailScreen';
import { press, pressableWithText, renderScreen, shows, unmountScreens } from './renderScreen';

jest.setTimeout(30_000);

const job = {
  id: 'job-1',
  title: 'Community Programs Coordinator',
  description: 'Run the Thursday programme.',
  isRemote: false,
  city: 'Brisbane',
  state: 'QLD',
  type: 'FULL_TIME',
  hasApplied: false,
  organization: { name: 'Harbour House' },
};

function typeInto(screen: ReactTestRenderer, placeholder: string, value: string): void {
  const input = screen.root.findAll((node) => node.props?.placeholder === placeholder, { deep: 'all' })[0];
  expect(input).toBeDefined();
  act(() => input.props.onChangeText(value));
}

describe('applying for a job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockJobGet.mockResolvedValue({ data: { success: true, data: job } });
    mockApply.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  it('opens the application on the first tap instead of sending it', async () => {
    const screen = await renderScreen(<JobDetailScreen />);

    await press(pressableWithText(screen, 'Apply Now')!);

    expect(mockApply).not.toHaveBeenCalled();
    expect(shows(screen, 'Apply to Harbour House')).toBe(true);
    expect(shows(screen, 'Want to attach a résumé?')).toBe(true);
  });

  it('sends the cover letter she wrote', async () => {
    const screen = await renderScreen(<JobDetailScreen />);
    await press(pressableWithText(screen, 'Apply Now')!);
    typeInto(screen, 'Cover letter (optional)', '  I ran a drop-in centre for six years.  ');

    await press(pressableWithText(screen, 'Send application')!);

    expect(mockApply).toHaveBeenCalledWith('job-1', { coverLetter: 'I ran a drop-in centre for six years.' });
    expect(shows(screen, 'Applied')).toBe(true);
  });

  it('sends without a cover letter when she leaves it empty', async () => {
    const screen = await renderScreen(<JobDetailScreen />);
    await press(pressableWithText(screen, 'Apply Now')!);

    await press(pressableWithText(screen, 'Send application')!);

    expect(mockApply).toHaveBeenCalledWith('job-1', {});
  });

  it('keeps what she wrote when sending fails', async () => {
    mockApply.mockRejectedValueOnce({ response: { data: { message: 'This job is no longer accepting applications' } } });
    const screen = await renderScreen(<JobDetailScreen />);
    await press(pressableWithText(screen, 'Apply Now')!);
    typeInto(screen, 'Cover letter (optional)', 'Please consider me.');

    await press(pressableWithText(screen, 'Send application')!);

    expect(Alert.alert).toHaveBeenCalledWith('Not sent', 'This job is no longer accepting applications');
    const input = screen.root.findAll((node) => node.props?.placeholder === 'Cover letter (optional)', { deep: 'all' })[0];
    expect(input.props.value).toBe('Please consider me.');
  });

  it('cancels without sending', async () => {
    const screen = await renderScreen(<JobDetailScreen />);
    await press(pressableWithText(screen, 'Apply Now')!);

    await press(pressableWithText(screen, 'Cancel')!);

    expect(mockApply).not.toHaveBeenCalled();
    expect(shows(screen, 'Apply Now')).toBe(true);
  });
});
