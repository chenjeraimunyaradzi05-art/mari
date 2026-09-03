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

  it('registers the data-retention purge as a keyed scheduler on the scheduled-tasks queue', async () => {
    await registerRecurringJobs();

    expect(scheduledTasks().upsertJobScheduler).toHaveBeenCalledTimes(1);
    const [schedulerId, repeatOpts, template] = scheduledTasks().upsertJobScheduler.mock.calls[0];

    expect(schedulerId).toBe(SCHEDULED_TASKS.DATA_RETENTION_PURGE);
    expect(repeatOpts.pattern).toBe('0 3 * * *');
    expect(repeatOpts.tz).toBe('Australia/Brisbane');
    expect(template.data).toEqual({ task: SCHEDULED_TASKS.DATA_RETENTION_PURGE });
    // A retry would land the sweep in morning traffic; the next night is the retry.
    expect(template.opts.attempts).toBe(1);
  });

  it('re-registers under the same id so repeated boots cannot stack two schedules', async () => {
    await registerRecurringJobs();
    await registerRecurringJobs();

    const ids = scheduledTasks().upsertJobScheduler.mock.calls.map((call: any[]) => call[0]);
    expect(new Set(ids).size).toBe(1);
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
