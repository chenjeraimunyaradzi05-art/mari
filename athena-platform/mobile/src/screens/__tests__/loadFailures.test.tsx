/**
 * A failed fetch must never read as an answer.
 *
 * Most screens in this app caught a load failure into console.error and then
 * rendered their empty state, so a phone that lost signal told a member things
 * that were not true: that her course was not available, that the job she had
 * been sent had been withdrawn, that a busy thread had no comments in it.
 * Every one of those is a statement about the world, made because of a
 * statement about the network, and none of them offered a way to try again.
 *
 * These are the two where the wording was flatly false rather than merely
 * misleading, so they are the two worth pinning down.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockCourseGet = jest.fn<(...args: any[]) => any>();
const mockClassroom = jest.fn<(...args: any[]) => any>();
const mockJobGet = jest.fn<(...args: any[]) => any>();
const mockGetSavedJobs = jest.fn<(...args: any[]) => any>();

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { courseId: 'course-1', jobId: 'job-1' } }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('../../services/api', () => ({
  coursesApi: {
    get: (...args: unknown[]) => mockCourseGet(...args),
    classroom: (...args: unknown[]) => mockClassroom(...args),
  },
  jobsApi: {
    get: (...args: unknown[]) => mockJobGet(...args),
    save: jest.fn(),
    unsave: jest.fn(),
    apply: jest.fn(),
  },
  userApi: {
    getSavedJobs: (...args: unknown[]) => mockGetSavedJobs(...args),
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  WEB_URL: 'https://athena.example',
}));

import { CourseScreen } from '../CourseScreen';
import { JobDetailScreen } from '../JobDetailScreen';
import { renderScreen, unmountScreens, visibleText } from './renderScreen';

// The first render in a file pays for React Native's whole lazy module graph.
jest.setTimeout(30_000);

describe('a load that failed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSavedJobs.mockResolvedValue({ data: { success: true, data: [] } });
  });

  afterEach(() => {
    unmountScreens();
  });

  it('does not tell a member her course has been withdrawn', async () => {
    mockCourseGet.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<CourseScreen />);

    const text = visibleText(screen);
    expect(text).toContain('Check your connection');
    // The old copy. Somebody part-way through a qualification read it as the
    // provider having pulled the course.
    expect(text).not.toContain('This course is not available.');
  });

  it('still says a course is unavailable when the server says it is gone', async () => {
    mockCourseGet.mockRejectedValue({ response: { status: 404 } });

    const screen = await renderScreen(<CourseScreen />);

    // A 404 really is the course being gone, and softening that would be the
    // same defect pointed the other way.
    expect(visibleText(screen)).toContain('This course is not available.');
  });

  it('does not tell a member a job has been taken down', async () => {
    mockJobGet.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<JobDetailScreen />);

    const text = visibleText(screen);
    expect(text).toContain('Check your connection');
    expect(text).not.toContain('Job not found');
  });

  it('says a job is no longer listed when the server says so', async () => {
    mockJobGet.mockRejectedValue({ response: { status: 404 } });

    const screen = await renderScreen(<JobDetailScreen />);

    expect(visibleText(screen)).toContain('This job is no longer listed.');
  });
});
