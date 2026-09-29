/**
 * Reels a restart left on "processing".
 *
 * A reel is created PROCESSING and the pipeline publishes it. When the pipeline
 * was running from memory and the process ended (a deploy, a crash, a host
 * recycling the instance), the reels it had not reached were lost with it and
 * stayed PROCESSING for good. Nothing ever looked for them again: the member
 * who uploaded one watched it say "processing" indefinitely and nobody else
 * ever saw it.
 *
 * A reel created before this process started, and still PROCESSING, was
 * either being worked on by the process that has just gone or is waiting in
 * the video queue. The second kind is left alone; the first is handed to the
 * pipeline again, through the same enqueueVideoProcessing an upload uses, so
 * it goes on the queue or into memory by the same rule. Reels uploaded to this
 * process are excluded by their creation time, because the sweep runs once the
 * server is already taking uploads and those are in hand. Running the pipeline
 * again on a reel is safe: it starts from the upload as received, and a
 * failure still publishes the reel as it was uploaded.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { videoIdsWithLiveJobs } from '../utils/video-queue';
import { enqueueVideoProcessing } from '../services/video-pipeline.service';

// Oldest first, and bounded, so a backlog after a long outage is worked
// through over successive boots rather than all queued at once. In practice a
// restart strands a handful.
export const STRANDED_VIDEO_BATCH = 200;

export interface StrandedVideoSweep {
  /** Reels found PROCESSING at boot. */
  stranded: number;
  /** Handed to the pipeline again. */
  resumed: number;
  /** Left alone because a queued job will process them. */
  alreadyQueued: number;
}

/**
 * @param createdBefore When this process started. Only reels older than that
 *                      can have been stranded by a previous one.
 */
export async function resumeStrandedVideos(createdBefore: Date): Promise<StrandedVideoSweep> {
  const stranded = await prisma.video.findMany({
    where: { status: 'PROCESSING', createdAt: { lt: createdBefore } },
    select: { id: true, authorId: true },
    orderBy: { createdAt: 'asc' },
    take: STRANDED_VIDEO_BATCH,
  });
  if (stranded.length === 0) return { stranded: 0, resumed: 0, alreadyQueued: 0 };

  let live: Set<string>;
  try {
    live = await videoIdsWithLiveJobs();
  } catch (error) {
    // Redis could not be read, so the queue's contents are unknown. Resuming
    // everything risks a reel being transcoded twice; resuming nothing risks
    // it never being published. The second is the harm this sweep exists to
    // end, so everything is resumed.
    logger.warn('Could not read the video queue; resuming every stranded reel', {
      error: error instanceof Error ? error.message : String(error),
    });
    live = new Set();
  }

  let resumed = 0;
  for (const video of stranded) {
    if (live.has(video.id)) continue;
    enqueueVideoProcessing(video.id, video.authorId);
    resumed += 1;
  }

  const sweep: StrandedVideoSweep = { stranded: stranded.length, resumed, alreadyQueued: stranded.length - resumed };
  logger.info('Stranded reels handed back to the pipeline', { ...sweep });
  return sweep;
}
