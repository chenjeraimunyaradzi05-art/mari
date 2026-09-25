/**
 * Stories that actually disappear.
 *
 * A story is posted with a 24-hour expiresAt and the product says, in those
 * words, that it disappears. Until now that promise was kept by a read filter
 * and nothing else: GET /api/status/feed and the view endpoint stopped serving
 * anything past its expiry, but the Status row, its caption, the StatusView
 * rows naming everyone who watched, and the uploaded file all stayed exactly
 * where they were, for good. On a platform whose members include women hiding
 * from someone, "it disappears" cannot mean "we stop showing it to you": the
 * media URL is a plain link, and anyone who had ever loaded it — an ex who
 * screenshotted it, a scraper, a cache, a subpoena — could still fetch her
 * face out of a story she believed was gone hours earlier.
 *
 * So the sweep deletes the row, which takes the viewer list with it by
 * cascade, and then deletes the object behind it.
 *
 * The one thing it must not delete is media a highlight still shows. A
 * StoryHighlightItem copies the story's mediaUrl rather than pointing at the
 * file through the Status row, so the highlight and the expiring story name
 * the same object; dropping it because the story ran out would blank a
 * highlight the member deliberately kept. The row still goes — the highlight
 * carries its own caption and takenAt and does not need it.
 */

import fs from 'fs';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { localPathForUrl } from '../utils/media-storage';
import { recordFailure } from '../utils/ops-metrics';

/**
 * How many expired stories one pass deletes before looking again. Small
 * enough that a backlog does not hold a transaction open, large enough that
 * the minute-by-minute steady state is a single round trip.
 */
const SWEEP_BATCH = 200;

const BUCKET_NAME = process.env.S3_BUCKET || 'athena-media';
const CDN_URL = (process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`).replace(/\/$/, '');

let s3: S3Client | null = null;

function hasS3Credentials(): boolean {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
}

function s3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3;
}

/** The bucket key a stored URL points at, or null when it is not ours. */
function s3KeyForUrl(url: string): string | null {
  const prefix = `${CDN_URL}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 ? decodeURIComponent(key) : null;
}

/**
 * Removes the file behind a stored media URL.
 *
 * Best effort on purpose. A file already gone, a bucket that refuses, a URL
 * from some earlier storage arrangement that no longer parses — none of those
 * may stop the database row being deleted, because the row is the part a
 * member can still be identified from. Failures are counted rather than
 * swallowed, so a bucket that has started refusing every delete shows up in
 * the ops snapshot instead of silently keeping expired stories on disk.
 */
export async function deleteStoredMedia(url: string): Promise<boolean> {
  let deleted = false;

  const key = s3KeyForUrl(url);
  if (key && hasS3Credentials()) {
    try {
      await s3Client().send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      deleted = true;
    } catch (error) {
      recordFailure('story-expiry.media-delete', error);
    }
  }

  try {
    const filePath = localPathForUrl(url);
    if (filePath) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
  } catch (error) {
    recordFailure('story-expiry.media-delete', error);
  }

  return deleted;
}

/**
 * Of these media URLs, the ones a highlight still shows. Those files stay.
 *
 * Matched on the URL rather than on statusId because a member may add the
 * same story to more than one highlight, and because an item created before
 * statusId was recorded carries only the URL.
 */
async function mediaKeptByHighlights(mediaUrls: string[]): Promise<Set<string>> {
  if (mediaUrls.length === 0) return new Set();
  try {
    const kept = await prisma.storyHighlightItem.findMany({
      where: { mediaUrl: { in: mediaUrls } },
      select: { mediaUrl: true },
    });
    return new Set(kept.map((item) => item.mediaUrl));
  } catch (error) {
    // If the lookup fails we cannot tell which files a highlight still needs,
    // so we keep every file this batch would have removed. The rows are still
    // deleted. Losing a member's highlight is worse than leaving an orphaned
    // object for the next pass to reconsider.
    recordFailure('story-expiry.highlight-lookup', error);
    return new Set(mediaUrls);
  }
}

/**
 * Deletes these stories and, where no highlight still shows them, the media
 * behind them. Used by the sweep and by the author deleting her own story,
 * which makes the same promise more strongly.
 *
 * Returns how many rows went.
 */
export async function deleteStoriesWithMedia(
  stories: Array<{ id: string; mediaUrl: string }>
): Promise<number> {
  if (stories.length === 0) return 0;

  const mediaUrls = [...new Set(stories.map((story) => story.mediaUrl).filter(Boolean))];
  const keep = await mediaKeptByHighlights(mediaUrls);

  // The rows go first. If the process dies between the two, an orphaned file
  // is a cost; a row that survived a "deleted" response is a broken promise.
  const { count } = await prisma.status.deleteMany({ where: { id: { in: stories.map((s) => s.id) } } });

  for (const url of mediaUrls) {
    if (keep.has(url)) continue;
    await deleteStoredMedia(url);
  }

  return count;
}

/**
 * Deletes every story past its 24 hours. Returns how many went.
 */
export async function sweepExpiredStories(now = new Date()): Promise<number> {
  let removed = 0;

  for (;;) {
    const expired = await prisma.status.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, mediaUrl: true },
      take: SWEEP_BATCH,
    });
    if (expired.length === 0) break;

    removed += await deleteStoriesWithMedia(expired);

    if (expired.length < SWEEP_BATCH) break;
  }

  if (removed > 0) {
    logger.info('Expired stories removed', { removed });
  }
  return removed;
}
