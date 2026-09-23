/**
 * The ML ranker's seat in the feed. The engagement ranker in feed.service
 * always runs; when an operator has pointed the server at the ML service and
 * it answers its health check, the ranked candidates are re-ordered by the
 * model's scores and its explanation joins the post's "why this" reasons.
 * Any failure, timeout or unknown id leaves the engagement order exactly as
 * it was: the feed never goes blank because a model did. Falling back quietly
 * is not the same as failing quietly, though — a service that answers and
 * refuses the request is a contract defect, and that one is logged loudly.
 */

import type { PostType } from '@prisma/client';
import { mlService, FeedCandidate, FeedItemType } from './ml.service';
import { logger } from '../utils/logger';

// Only an explicit URL counts. The localhost default inside ml.service is a
// development convenience, not a deployment.
export function mlRankingEnabled(): boolean {
  return Boolean(process.env.ML_SERVICE_URL) && process.env.ML_FEED_RANKING !== 'false';
}

export interface RankablePost {
  id: string;
  authorId: string;
  type: string;
  createdAt: Date | string;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  hashtags?: string[] | null;
  isSponsored?: boolean | null;
}

/**
 * Prisma's PostType and the model's FeedItemType are two different vocabularies
 * that happen to share a word. This used to be bridged by lowercasing the
 * Prisma value, which posted 'text', 'article' and 'job_share' into a pydantic
 * enum that accepts none of them. One rejected candidate fails the whole
 * request, so every batch that was not purely video came back 422: the ranker
 * never applied, and because the refusal was swallowed as a warning nobody saw
 * it — while the retries it triggered added roughly three seconds to each feed
 * load. Declaring the map as Record<PostType, FeedItemType> is the part that
 * matters most: a new kind of post cannot be added to the schema without the
 * compiler making someone decide what the model should call it.
 */
const ML_ITEM_TYPE: Record<PostType, FeedItemType> = {
  TEXT: 'post',
  IMAGE: 'post',
  VIDEO: 'video',
  ARTICLE: 'post',
  JOB_SHARE: 'job',
  COURSE_SHARE: 'course',
  POLL: 'post',
  WIN: 'post',
};

export function feedItemTypeFor(postType: string | null | undefined): FeedItemType {
  // A row whose type is not in the map is still a post as far as the model is
  // concerned; what must never happen is passing the raw value through and
  // losing the batch.
  return ML_ITEM_TYPE[postType as PostType] ?? 'post';
}

export function toFeedCandidate(post: RankablePost): FeedCandidate {
  return {
    id: post.id,
    item_type: feedItemTypeFor(post.type),
    author_id: post.authorId,
    created_at: new Date(post.createdAt).toISOString(),
    view_count: post.viewCount ?? 0,
    like_count: post.likeCount ?? 0,
    comment_count: post.commentCount ?? 0,
    share_count: post.shareCount ?? 0,
    tags: Array.isArray(post.hashtags) ? post.hashtags : [],
    is_sponsored: Boolean(post.isSponsored),
  };
}

// At most this many candidates go to the model; the tail keeps its order.
const MAX_CANDIDATES = 200;

/**
 * True when the service answered and refused, rather than never answering. The
 * check is on the shape rather than `instanceof MlServiceError` so that it
 * still recognises a refusal when ml.service is mocked, and so a refusal
 * surfaced by some future transport is not quietly demoted to a warning.
 */
function isServiceRefusal(error: unknown): error is { status: number; detail?: unknown; message?: string } {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export async function rerankWithMl<T extends RankablePost>(
  posts: T[],
  context: { userId: string; persona?: string | null }
): Promise<{ posts: T[]; applied: boolean; reasons: Map<string, string> }> {
  const untouched = { posts, applied: false, reasons: new Map<string, string>() };
  if (!mlRankingEnabled() || posts.length === 0) return untouched;

  let candidates: FeedCandidate[] = [];
  try {
    if (!(await mlService.isReady())) return untouched;

    candidates = posts.slice(0, MAX_CANDIDATES).map(toFeedCandidate);
    // The model wants a persona string; a member who has not chosen one is
    // ranked as a general member rather than left out.
    const result = await mlService.generateFeed({ user_id: context.userId, persona: context.persona ?? 'GENERAL' }, candidates, { page: 1 });
    const items = Array.isArray(result?.feed_items) ? result.feed_items : [];
    if (items.length === 0) return untouched;

    const order = new Map<string, { position: number; reason: string }>();
    items.forEach((item, index) => {
      if (!order.has(item.id)) order.set(item.id, { position: typeof item.position === 'number' ? item.position : index, reason: item.reason });
    });

    // The model's order first; anything it did not score keeps its place after.
    const ranked = posts.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)!.position - order.get(b.id)!.position);
    const rest = posts.filter((p) => !order.has(p.id));
    const reasons = new Map<string, string>();
    for (const [id, { reason }] of order) {
      if (reason && reason.trim()) reasons.set(id, reason.trim());
    }
    return { posts: [...ranked, ...rest], applied: true, reasons };
  } catch (error) {
    // A refusal is not the service being down, it is the candidate shape and
    // the model's schema disagreeing — the exact failure that hid here for
    // months behind a warning nobody read. It is logged at error level, with
    // the item types we actually sent, so the next drift shows up in alerting
    // on the first feed load. The feed itself still falls back to the
    // engagement order: a ranker's bad day must never blank somebody's feed.
    if (isServiceRefusal(error)) {
      logger.error('ML feed ranking refused the candidates; engagement order kept', {
        status: error.status,
        detail: error.detail ?? error.message,
        itemTypes: Array.from(new Set(candidates.map((candidate) => candidate.item_type))),
        candidates: candidates.length,
      });
      return untouched;
    }

    logger.warn('ML feed ranking unavailable; engagement order kept', {
      error: error instanceof Error ? error.message : String(error),
    });
    return untouched;
  }
}
