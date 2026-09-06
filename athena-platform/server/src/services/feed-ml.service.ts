/**
 * The ML ranker's seat in the feed. The engagement ranker in feed.service
 * always runs; when an operator has pointed the server at the ML service and
 * it answers its health check, the ranked candidates are re-ordered by the
 * model's scores and its explanation joins the post's "why this" reasons.
 * Any failure, timeout or unknown id leaves the engagement order exactly as
 * it was: the feed never goes blank because a model did.
 */

import { mlService, FeedCandidate } from './ml.service';
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

export function toFeedCandidate(post: RankablePost): FeedCandidate {
  return {
    id: post.id,
    item_type: String(post.type || 'post').toLowerCase(),
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

export async function rerankWithMl<T extends RankablePost>(
  posts: T[],
  context: { userId: string; persona?: string | null }
): Promise<{ posts: T[]; applied: boolean; reasons: Map<string, string> }> {
  const untouched = { posts, applied: false, reasons: new Map<string, string>() };
  if (!mlRankingEnabled() || posts.length === 0) return untouched;

  try {
    if (!(await mlService.isReady())) return untouched;

    const candidates = posts.slice(0, MAX_CANDIDATES).map(toFeedCandidate);
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
    logger.warn('ML feed ranking unavailable; engagement order kept', {
      error: error instanceof Error ? error.message : String(error),
    });
    return untouched;
  }
}
