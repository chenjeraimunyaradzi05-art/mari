/**
 * Durable processing for a new reel, when this process can offer it.
 *
 * A reel is created PROCESSING and becomes PUBLISHED when the pipeline in
 * services/video-pipeline.service finishes with it. The pipeline used to be
 * fed only from an array held in memory, so a deploy, a crash or an instance
 * being recycled between upload and publish lost the array, and every reel in
 * it stayed on "processing" for ever: the member who made it saw a spinner that
 * would never end, and nobody else ever saw the reel. The BullMQ video queue
 * and its worker existed the whole time and nothing put a reel on them.
 *
 * With the workers running in this process, a reel now goes on the queue:
 * Redis holds it across a restart, and a job that was mid-flight when the
 * process died is handed back to a worker when one comes up. Without them the
 * caller keeps the in-memory pipeline, and workers/stranded-videos picks up
 * whatever a restart left behind.
 *
 * Nothing in here may leave a reel with nobody to process it, so every "no"
 * is a clean false the caller can fall back on, never a throw.
 */

import { logger } from './logger';
import { areWorkersRunning, videoWorkerRunsPipelineInProcess } from './worker-config';

// How long a producer waits for Redis before processing the reel itself. The
// queue's connection retries for ever (BullMQ requires maxRetriesPerRequest to
// be null), so without this an unreachable Redis would leave an upload's
// processing waiting on a promise that never settles.
const QUEUE_ADD_TIMEOUT_MS = 5000;

// The states in which a job will still run without anyone asking again.
const LIVE_JOB_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'paused'] as const;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Whether a reel handed over now would go on the queue. Two things must hold:
 * the workers are running in this process, so a queued job has a consumer;
 * and the video worker runs the pipeline in process. The worker's other branch
 * posts to an external transcoder at VIDEO_PROCESSOR_URL and applies nothing
 * that comes back, so a reel queued for it would never be published. Until
 * that branch can publish, a deployment configured for it keeps the in-memory
 * pipeline, which is what it has always actually used.
 */
export function videoQueueAvailable(): boolean {
  return areWorkersRunning() && videoWorkerRunsPipelineInProcess();
}

/**
 * Puts one reel on the video-processing queue. Resolves true when Redis has
 * the job, false when the caller should process the reel itself: the queue is
 * not available here, the add failed, or Redis did not answer in time.
 *
 * A timed-out add can still land later, and then the reel is processed twice,
 * once here and once by the worker. processVideo is safe to run again on a
 * reel it has already published, so the cost of that rare case is a second
 * transcode, where the cost of waiting would be a reel that never publishes.
 */
export async function tryQueueVideoProcessing(videoId: string, authorId: string): Promise<boolean> {
  if (!videoQueueAvailable()) return false;
  try {
    // Loaded here, not at the top: utils/queue opens its Redis client at
    // import and throws in production without REDIS_URL, and a process with
    // no workers has no business doing either.
    const { queueVideoProcessing } = await import('./queue');
    await withTimeout(queueVideoProcessing({ videoId, userId: authorId }), QUEUE_ADD_TIMEOUT_MS, 'Queueing a reel');
    logger.info('Reel queued for processing', { videoId });
    return true;
  } catch (error) {
    logger.error('A reel could not be queued; processing it in this process instead', {
      videoId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * The reels that already have a job waiting or running, so the restart sweep
 * does not queue a second one beside it. Empty when the queue is not in use
 * here. Throws when Redis cannot be read, and the sweep decides what that means.
 */
export async function videoIdsWithLiveJobs(): Promise<Set<string>> {
  if (!videoQueueAvailable()) return new Set();
  const { videoProcessingQueue } = await import('./queue');
  const jobs = await withTimeout(
    videoProcessingQueue.getJobs([...LIVE_JOB_STATES]),
    QUEUE_ADD_TIMEOUT_MS,
    'Reading the video queue'
  );
  const ids = new Set<string>();
  for (const job of jobs) {
    const videoId = (job?.data as { videoId?: unknown } | undefined)?.videoId;
    if (typeof videoId === 'string' && videoId) ids.add(videoId);
  }
  return ids;
}
