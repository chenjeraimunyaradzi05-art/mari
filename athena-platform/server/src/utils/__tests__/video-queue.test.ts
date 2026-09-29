/**
 * A reel used to be processed from an array in memory, so a restart between
 * upload and publish left it on "processing" for ever, while the BullMQ video
 * queue and its worker sat unused. These pin the producer to the worker: when
 * the workers run here, a reel goes on the queue as the job the worker reads,
 * the worker hands exactly that reel to the pipeline, and every way the queue
 * can be unavailable answers "process it yourself" rather than losing it.
 *
 * BullMQ and Redis are stand-ins; the worker's processor is driven directly.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type Processor = (job: { id: string; data: unknown; updateProgress: (n: number) => Promise<void> }) => Promise<unknown>;
const processors = new Map<string, Processor>();
const added: Array<{ queue: string; name: string; data: unknown; opts: unknown }> = [];
const addBehaviour: { mode: 'ok' | 'reject' | 'hang' } = { mode: 'ok' };
const liveJobs: Array<{ data: unknown }> = [];

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((...args: unknown[]) => {
    processors.set(args[0] as string, args[1] as Processor);
    return { name: args[0], on: jest.fn(), close: jest.fn(async () => undefined), waitUntilReady: jest.fn(async () => undefined) };
  }),
  Queue: jest.fn().mockImplementation((...args: unknown[]) => ({
    name: args[0],
    add: jest.fn((name: string, data: unknown, opts: unknown) => {
      if (addBehaviour.mode === 'reject') return Promise.reject(new Error('Connection is closed.'));
      if (addBehaviour.mode === 'hang') return new Promise(() => undefined);
      added.push({ queue: args[0] as string, name, data, opts });
      return Promise.resolve({ id: 'job-1', data });
    }),
    getJobs: jest.fn(async () => liveJobs),
    close: jest.fn(),
    upsertJobScheduler: jest.fn(async () => undefined),
  })),
  QueueEvents: jest.fn(),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({ on: jest.fn(), quit: jest.fn(async () => undefined) })));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../scripts/data-retention', () => ({ dataRetentionService: { runAllPurgeJobs: jest.fn() } }));
jest.mock('../opensearch', () => ({ indexDocument: jest.fn(), deleteDocument: jest.fn(), isOpenSearchEnabled: () => false }));
jest.mock('../email', () => ({ sendEmail: jest.fn() }));
const processVideo = jest.fn(async (_videoId: string) => undefined);
jest.mock('../../services/video-pipeline.service', () => ({ processVideo: (id: string) => processVideo(id) }));
jest.mock('../../services/push.service', () => ({ pushToUser: jest.fn() }));
jest.mock('../../services/data-export.service', () => ({ runDataExport: jest.fn() }));
jest.mock('../../services/content-report.service', () => ({ alertOverdueReports: jest.fn() }));

import { QUEUE_NAMES } from '../queue';
import { tryQueueVideoProcessing, videoIdsWithLiveJobs, videoQueueAvailable } from '../video-queue';
import { markWorkersRunning } from '../worker-config';
import { startAllWorkers, stopAllWorkers } from '../../services/workers.service';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'test' };
  added.length = 0;
  liveJobs.length = 0;
  addBehaviour.mode = 'ok';
  markWorkersRunning(false);
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.useRealTimers();
});

describe('whether a reel goes on the queue', () => {
  it('does not, in a process whose workers never started', async () => {
    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(false);
    expect(added).toHaveLength(0);
  });

  it('does, once startAllWorkers has brought the workers up here', async () => {
    await startAllWorkers();

    expect(videoQueueAvailable()).toBe(true);
    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(true);
    expect(added).toEqual([
      expect.objectContaining({ queue: QUEUE_NAMES.VIDEO_PROCESSING, data: { videoId: 'video-1', userId: 'author-1' } }),
    ]);
  });

  it('stops as soon as the workers begin to shut down', async () => {
    await startAllWorkers();
    await stopAllWorkers();

    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(false);
    expect(added).toHaveLength(0);
  });

  it('does not when the worker would post the reel to an external transcoder that publishes nothing', async () => {
    markWorkersRunning(true);
    process.env.NODE_ENV = 'production';
    process.env.WORKER_ALLOW_SIMULATION = 'false';
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'false';
    process.env.VIDEO_PROCESSOR_URL = 'https://transcoder.example.test';

    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(false);
    expect(added).toHaveLength(0);
  });

  it('does in production when the pipeline is configured to run in process, as render.yaml and fly.toml set it', async () => {
    markWorkersRunning(true);
    process.env.NODE_ENV = 'production';
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'true';

    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(true);
  });

  it('answers false, so the reel is processed in memory, when Redis refuses the job', async () => {
    markWorkersRunning(true);
    addBehaviour.mode = 'reject';

    await expect(tryQueueVideoProcessing('video-1', 'author-1')).resolves.toBe(false);
  });

  it('answers false rather than waiting for ever when Redis does not answer', async () => {
    markWorkersRunning(true);
    addBehaviour.mode = 'hang';
    jest.useFakeTimers();

    const answer = tryQueueVideoProcessing('video-1', 'author-1');
    // The dynamic import resolves on the microtask queue; let it, then pass the deadline.
    await jest.advanceTimersByTimeAsync(5_001);

    await expect(answer).resolves.toBe(false);
  });
});

describe('the queued job, run by the video worker', () => {
  it('hands exactly the queued reel to the pipeline that publishes it', async () => {
    await startAllWorkers();
    await tryQueueVideoProcessing('video-7', 'author-7');

    const worker = processors.get(QUEUE_NAMES.VIDEO_PROCESSING)!;
    const result = await worker({ id: 'job-7', data: added[0].data, updateProgress: async () => undefined });

    expect(processVideo).toHaveBeenCalledWith('video-7');
    expect(result).toEqual({ success: true });
  });
});

describe('which reels already have a job', () => {
  it('reads the video ids of waiting and running jobs', async () => {
    markWorkersRunning(true);
    liveJobs.push({ data: { videoId: 'video-1', userId: 'a' } }, { data: { videoId: 'video-2', userId: 'b' } }, { data: {} });

    await expect(videoIdsWithLiveJobs()).resolves.toEqual(new Set(['video-1', 'video-2']));
  });

  it('is empty, without touching Redis, when the queue is not in use here', async () => {
    liveJobs.push({ data: { videoId: 'video-1' } });

    await expect(videoIdsWithLiveJobs()).resolves.toEqual(new Set());
  });
});
