/**
 * The scheduled-tasks worker is what turns a registered schedule into work.
 * alertOverdueReports existed and was tested, but no case here called it, so
 * a report could sit past the review deadline promised to the woman who filed
 * it with nobody told. These drive the worker's processor directly: BullMQ
 * and Redis are stand-ins, and every service it calls is a mock.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Processor = (job: { id: string; data: unknown; updateProgress?: (n: number) => Promise<void> }) => Promise<unknown>;
const processors = new Map<string, Processor>();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((...args: unknown[]) => {
    processors.set(args[0] as string, args[1] as Processor);
    return { name: args[0], on: jest.fn(), close: jest.fn(), waitUntilReady: jest.fn() };
  }),
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn(), upsertJobScheduler: jest.fn() })),
  QueueEvents: jest.fn(),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({ on: jest.fn(), quit: jest.fn() })));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/worker-config', () => ({ resolveWorkerRedisUrl: () => 'redis://stand-in:6379' }));
jest.mock('../../scripts/data-retention', () => ({ dataRetentionService: { runAllPurgeJobs: jest.fn() } }));
jest.mock('../../utils/opensearch', () => ({
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  isOpenSearchEnabled: () => false,
}));
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../video-pipeline.service', () => ({ processVideo: jest.fn() }));
jest.mock('../push.service', () => ({ pushToUser: jest.fn() }));
jest.mock('../data-export.service', () => ({ runDataExport: jest.fn() }));

const alertOverdueReports = jest.fn() as jest.Mock<() => Promise<{ overdue: number; alerted: boolean }>>;
jest.mock('../content-report.service', () => ({ alertOverdueReports }));
const alertOverdueSafetyChecks = jest.fn() as jest.Mock<() => Promise<{ waiting: number; overdue: number; notified: number }>>;
jest.mock('../housing-supply.service', () => ({ alertOverdueSafetyChecks }));
const sweepProviderChecks = jest.fn() as jest.Mock<() => Promise<{ lapsed: number; listingsTakenDown: number; membersTold: number }>>;
jest.mock('../housing-provider.service', () => ({ sweepProviderChecks }));
const sweepPractitionerRechecks = jest.fn() as jest.Mock<
  () => Promise<{ verified: number; due: number; newlyDue: number; lapsed: number }>
>;
jest.mock('../wellness/practitioner-recheck.service', () => ({ sweepPractitionerRechecks }));

import { QUEUE_NAMES, SCHEDULED_TASKS } from '../../utils/queue';
import '../workers.service';
import { logger } from '../../utils/logger';

const scheduledTask = () => processors.get(QUEUE_NAMES.SCHEDULED_TASKS)!;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the scheduled-tasks worker', () => {
  it('runs the overdue-report alert and records what it found', async () => {
    alertOverdueReports.mockResolvedValue({ overdue: 3, alerted: true });

    const result = await scheduledTask()({ id: 'job-1', data: { task: SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP } });

    expect(alertOverdueReports).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, overdue: 3, alerted: true });
    expect(logger.info).toHaveBeenCalledWith('Report deadline sweep finished', { jobId: 'job-1', overdue: 3, alerted: true });
  });

  it('says so when nothing is late, as the record that the sweep ran', async () => {
    alertOverdueReports.mockResolvedValue({ overdue: 0, alerted: false });

    await expect(
      scheduledTask()({ id: 'job-2', data: { task: SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP } })
    ).resolves.toEqual({ success: true, overdue: 0, alerted: false });
  });

  // Both sweeps existed and were documented as built for this worker, and
  // nothing ran them: no overdue DV-safe check was ever heard about, and no
  // practitioner verification ever lapsed.
  it('runs the housing safety-check sweep and records what was overdue', async () => {
    alertOverdueSafetyChecks.mockResolvedValue({ waiting: 2, overdue: 1, notified: 1 });
    sweepProviderChecks.mockResolvedValue({ lapsed: 0, listingsTakenDown: 0, membersTold: 0 });

    const result = await scheduledTask()({ id: 'job-4', data: { task: SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP } });

    expect(alertOverdueSafetyChecks).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      waiting: 2,
      overdue: 1,
      notified: 1,
      providerChecks: { lapsed: 0, listingsTakenDown: 0, membersTold: 0 },
    });
    expect(logger.info).toHaveBeenCalledWith('Housing safety-check sweep finished', {
      jobId: 'job-4',
      waiting: 2,
      overdue: 1,
      notified: 1,
    });
  });

  // A provider check that ran out must take the badge off the listings that
  // rested on it, and the hourly worker is what runs that, so a worker that
  // forgot to call it would leave "Checked by ATHENA staff" on for ever.
  it('runs the provider-check sweep in the same hour and records what it took down', async () => {
    alertOverdueSafetyChecks.mockResolvedValue({ waiting: 0, overdue: 0, notified: 0 });
    sweepProviderChecks.mockResolvedValue({ lapsed: 2, listingsTakenDown: 3, membersTold: 2 });

    const result = await scheduledTask()({ id: 'job-6', data: { task: SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP } });

    expect(sweepProviderChecks).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, providerChecks: { lapsed: 2, listingsTakenDown: 3, membersTold: 2 } });
    expect(logger.info).toHaveBeenCalledWith('Housing provider-check sweep finished', {
      jobId: 'job-6',
      lapsed: 2,
      listingsTakenDown: 3,
      membersTold: 2,
    });
  });

  it('runs the practitioner re-check sweep and records who fell due and who lapsed', async () => {
    sweepPractitionerRechecks.mockResolvedValue({ verified: 12, due: 3, newlyDue: 1, lapsed: 1 });

    const result = await scheduledTask()({ id: 'job-5', data: { task: SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP } });

    expect(sweepPractitionerRechecks).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, verified: 12, due: 3, newlyDue: 1, lapsed: 1 });
  });

  it('refuses a task this build does not know', async () => {
    await expect(scheduledTask()({ id: 'job-3', data: { task: 'something-old' } })).rejects.toThrow(
      'Unknown scheduled task: something-old'
    );
  });

  it('starts no worker for the ML inference queue that used to call back to any URL', () => {
    expect(Array.from(processors.keys())).not.toContain('ml-inference');
  });

  it('starts a worker only for the queues something actually fills', () => {
    // Email, push, search indexing, data export and analytics each had a
    // worker and never a producer, which made the worker container look like
    // an eight-queue pipeline when it ran one nightly purge.
    expect(Array.from(processors.keys()).sort()).toEqual([QUEUE_NAMES.SCHEDULED_TASKS, QUEUE_NAMES.VIDEO_PROCESSING].sort());
  });
});
