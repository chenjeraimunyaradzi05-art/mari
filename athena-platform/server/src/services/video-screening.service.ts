/**
 * Looking at what a video shows, before it is stored.
 *
 * An uploaded picture is checked for explicit content by the moderation
 * provider (moderateImage) and refused if it has some. An uploaded video went
 * through the branch of the upload route that streams it to storage, which
 * returns before that check, so a woman who would have been stopped from posting
 * an explicit photograph could send the same thing as a video, to a reel or to a
 * chat. This takes a few frames from it and puts each through the same check.
 *
 * It is a sample, and it is honest about being one. Frames from the first
 * seconds, the middle stretch and a later point (VIDEO_SCREEN_SECONDS) catch a
 * video that is explicit throughout or that opens with it, which is most of
 * them; a video that is clean at those moments and explicit at another is not
 * caught here. Looking at every frame is a different system (the provider's
 * asynchronous video analysis), and until that exists a person reading a report
 * is what catches the rest. Nothing here says a video "has been checked".
 *
 * A frame the provider refuses stops the upload with a 400 that says why, and
 * nothing is stored. What happens when the check cannot be made follows the image
 * rule exactly, because it is the image check: with no provider configured and
 * moderation required, moderateImage refuses with 503 (and so does a video); with
 * moderation switched off on purpose it allows and counts. A host with no ffmpeg
 * to take the frames cannot screen, and that is counted and logged rather than
 * silent, but does not refuse every video on its own: the same upload route
 * already refuses every video in production when ffmpeg cannot clean its
 * metadata, so a host without ffmpeg is already one that stores none.
 */

import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { moderateImage } from './moderation.service';
import { extractFrameJpeg, isFfmpegAvailable } from './video-pipeline.service';

/** When in the video a frame is taken. A second that is past the end gives no frame and is skipped. */
export const VIDEO_SCREEN_SECONDS: readonly number[] = [0.5, 4, 15];

export async function screenVideoFrames(inputPath: string, context: { userId: string }): Promise<void> {
  if (!isFfmpegAvailable()) {
    logger.warn('A video could not be looked at: there is no ffmpeg on this host to take frames', { userId: context.userId });
    recordFailure('moderation.unscreened_video', new Error('no ffmpeg to take frames from a video'));
    return;
  }

  let looked = 0;
  for (const at of VIDEO_SCREEN_SECONDS) {
    let frame: Buffer | null;
    try {
      frame = await extractFrameJpeg(inputPath, at);
    } catch (error) {
      // Not the same as a file with nothing at that second: ffmpeg itself
      // failed or timed out. Counted, and the next frame is still tried.
      logger.warn('A frame could not be taken from a video', {
        userId: context.userId,
        at,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('moderation.video_frame_failed', error);
      continue;
    }
    if (!frame) continue;

    looked += 1;
    const verdict = await moderateImage(frame);
    if (verdict.action === 'block') {
      logger.warn('Video upload blocked by moderation', { userId: context.userId, at, reason: verdict.reason });
      throw new ApiError(400, `Video rejected: ${verdict.reason ?? 'it contains explicit content'}`);
    }
  }

  if (looked === 0) {
    // Nothing could be taken from it at all: too short, or not readable. The
    // metadata step after this refuses what is unreadable; a clip shorter than
    // the first sample is let through, and counted.
    recordFailure('moderation.unscreened_video', new Error('no frame could be taken from a video'));
  }
}
