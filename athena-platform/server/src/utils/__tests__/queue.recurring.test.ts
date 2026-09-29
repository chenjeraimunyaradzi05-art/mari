import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Both bullmq and ioredis are stubbed so importing utils/queue does not open a
// Redis connection. The point of this suite is the *registration contract* -
// which scheduler id, which cron, which job payload - not BullMQ's own repeat
// machinery.
const queueInstances = new Map<string, any>();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((...args: unknown[]) => {
    const name = args[0] as string;
    const instance = {
      name,
      add: jest.fn(),
      close: jest.fn(),
      upsertJobScheduler: jest.fn(),
      getWaitingCount: jest.fn(async () => 0),
      getActiveCount: jest.fn(async () => 0),
      getCompletedCount: jest.fn(async () => 0),
      getFailedCount: jest.fn(async () => 0),
      getDelayedCount: jest.fn(async () => 0),
    };
    queueInstances.set(name, instance);
    return instance;
  }),
  Worker: jest.fn(),
  QueueEvents: jest.fn(),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
  }));
});

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { QUEUE_NAMES, SCHEDULED_TASKS, registerRecurringJobs, getAllQueueStats } from '../queue';

const scheduledTasks = () => queueInstances.get(QUEUE_NAMES.SCHEDULED_TASKS);

describe('registerRecurringJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const schedulerCall = (id: string) =>
    scheduledTasks().upsertJobScheduler.mock.calls.find((call: any[]) => call[0] === id);

  it('registers the data-retention purge as a keyed scheduler on the scheduled-tasks queue', async () => {
    await registerRecurringJobs();

    const [schedulerId, repeatOpts, template] = schedulerCall(SCHEDULED_TASKS.DATA_RETENTION_PURGE);

    expect(schedulerId).toBe(SCHEDULED_TASKS.DATA_RETENTION_PURGE);
    expect(repeatOpts.pattern).toBe('0 3 * * *');
    expect(repeatOpts.tz).toBe('Australia/Brisbane');
    expect(template.data).toEqual({ task: SCHEDULED_TASKS.DATA_RETENTION_PURGE });
    // A retry would land the sweep in morning traffic; the next night is the retry.
    expect(template.opts.attempts).toBe(1);
  });

  it('runs the report-deadline sweep hourly, in the venture timezone, with the next hour as its retry', async () => {
    await registerRecurringJobs();

    const [schedulerId, repeatOpts, template] = schedulerCall(SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP);
    expect(schedulerId).toBe('report-deadline-sweep');
    expect(repeatOpts.pattern).toBe('15 * * * *');
    expect(repeatOpts.tz).toBe('Australia/Brisbane');
    expect(template.data).toEqual({ task: SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP });
    expect(template.opts.attempts).toBe(1);
  });

  it('re-registers under the same ids so repeated boots cannot stack two schedules', async () => {
    await registerRecurringJobs();
    await registerRecurringJobs();

    const ids = scheduledTasks().upsertJobScheduler.mock.calls.map((call: any[]) => call[0]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids)).toEqual(
      new Set([
        SCHEDULED_TASKS.DATA_RETENTION_PURGE,
        SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP,
        SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP,
        SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP,
      ])
    );
  });

  it('no longer has an ML inference queue to report on', async () => {
    const stats = await getAllQueueStats();
    expect(Object.keys(stats)).not.toContain('ml-inference');
  });

  it('reports depth only for queues that have a producer, so a zero means work is keeping up', async () => {
    // The email, push, search-indexing, data-export and analytics queues were
    // reported at zero because nothing could put work in them, which
    // /health/detailed read as a healthy backlog.
    const stats = await getAllQueueStats();
    expect(Object.keys(stats).sort()).toEqual([QUEUE_NAMES.SCHEDULED_TASKS, QUEUE_NAMES.VIDEO_PROCESSING].sort());
    expect(Array.from(queueInstances.keys()).sort()).toEqual([QUEUE_NAMES.SCHEDULED_TASKS, QUEUE_NAMES.VIDEO_PROCESSING].sort());
  });

  it('reports the scheduled-tasks queue in queue stats, where a stalled purge would show', async () => {
    const queue = scheduledTasks();
    queue.getActiveCount.mockResolvedValue(1);
    queue.getCompletedCount.mockResolvedValue(5);
    queue.getDelayedCount.mockResolvedValue(1);

    const stats = await getAllQueueStats();

    expect(stats[QUEUE_NAMES.SCHEDULED_TASKS]).toEqual({
      waiting: 0,
      active: 1,
      completed: 5,
      failed: 0,
      delayed: 1,
    });
  });
});
