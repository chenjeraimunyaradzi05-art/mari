/**
 * What every post carries for the viewer, on top of its row.
 *
 * Reactions: one Like row per member per post, typed. The feed shows the
 * counts per type and which one the viewer chose; `isLiked` stays for older
 * clients and means "reacted with anything".
 *
 * Polls: the options and close time live in Post.poll; the votes are rows.
 * Results are attached here as counts per option, the viewer's own choice and
 * whether voting has closed.
 *
 * Every list route goes through decoratePosts so a post looks the same in the
 * feed, on a profile, in saved items and on its own page.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

export const REACTION_TYPES = ['LIKE', 'CELEBRATE', 'SUPPORT', 'INSIGHTFUL', 'INSPIRED'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value);
}

/** How a reaction reads in a notification: "Priya celebrated your post". */
export function reactionVerb(type: ReactionType): string {
  switch (type) {
    case 'CELEBRATE':
      return 'celebrated';
    case 'SUPPORT':
      return 'sent support to';
    case 'INSIGHTFUL':
      return 'found insight in';
    case 'INSPIRED':
      return 'was inspired by';
    default:
      return 'liked';
  }
}

export interface PollOption {
  id: string;
  text: string;
}

export interface PollDefinition {
  options: PollOption[];
  endsAt: string;
}

export interface PollResults extends PollDefinition {
  options: Array<PollOption & { votes: number; percent: number }>;
  totalVotes: number;
  myVote: string | null;
  isClosed: boolean;
}

const POLL_MIN_OPTIONS = 2;
const POLL_MAX_OPTIONS = 4;
const POLL_MAX_OPTION_LENGTH = 80;
const POLL_MIN_HOURS = 1;
const POLL_MAX_HOURS = 24 * 14;

/** Validates a poll from the composer and gives each option a stable id. */
export function buildPoll(raw: unknown): PollDefinition {
  const input = (raw ?? {}) as { options?: unknown; durationHours?: unknown };
  const options = Array.isArray(input.options) ? input.options : [];
  const texts = options
    .map((option) => (typeof option === 'string' ? option : (option as { text?: unknown })?.text))
    .map((text) => (typeof text === 'string' ? text.trim() : ''))
    .filter((text) => text.length > 0);

  if (texts.length < POLL_MIN_OPTIONS || texts.length > POLL_MAX_OPTIONS) {
    throw new ApiError(400, `A poll needs between ${POLL_MIN_OPTIONS} and ${POLL_MAX_OPTIONS} options`);
  }
  if (texts.some((text) => text.length > POLL_MAX_OPTION_LENGTH)) {
    throw new ApiError(400, `Poll options must be ${POLL_MAX_OPTION_LENGTH} characters or fewer`);
  }
  if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) {
    throw new ApiError(400, 'Poll options must be different from each other');
  }

  const hours = Number(input.durationHours ?? 24);
  if (!Number.isFinite(hours) || hours < POLL_MIN_HOURS || hours > POLL_MAX_HOURS) {
    throw new ApiError(400, `A poll runs for between ${POLL_MIN_HOURS} hour and ${POLL_MAX_HOURS / 24} days`);
  }

  return {
    options: texts.map((text, index) => ({ id: `o${index + 1}`, text })),
    endsAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
  };
}

export function readPoll(raw: unknown): PollDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const poll = raw as { options?: unknown; endsAt?: unknown };
  if (!Array.isArray(poll.options) || typeof poll.endsAt !== 'string') return null;
  const options = poll.options
    .filter((o): o is PollOption => !!o && typeof o === 'object' && typeof (o as PollOption).id === 'string')
    .map((o) => ({ id: o.id, text: String(o.text ?? '') }));
  return options.length >= 2 ? { options, endsAt: poll.endsAt } : null;
}

export function isPollClosed(poll: PollDefinition, now = new Date()): boolean {
  return new Date(poll.endsAt).getTime() <= now.getTime();
}

type PostLike = { id: string; poll?: unknown; likeCount?: number };

export interface Decorations {
  isLiked: boolean;
  myReaction: ReactionType | null;
  reactionCounts: Partial<Record<ReactionType, number>>;
  isSaved: boolean;
  poll: PollResults | null;
}

/**
 * Attaches reactions, saved state and poll results to a page of posts in
 * three grouped queries, never one per post.
 */
export async function decoratePosts<T extends PostLike>(
  posts: T[],
  viewerId?: string,
  now = new Date()
): Promise<Array<T & Decorations>> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const pollPostIds = posts.filter((p) => readPoll(p.poll)).map((p) => p.id);

  const [reactionRows, mine, saves, voteRows, myVotes] = await Promise.all([
    prisma.like.groupBy({
      by: ['postId', 'type'],
      where: { postId: { in: ids } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.like.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true, type: true } })
      : Promise.resolve([] as Array<{ postId: string; type: string }>),
    viewerId
      ? prisma.postSave.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } })
      : Promise.resolve([] as Array<{ postId: string }>),
    pollPostIds.length
      ? prisma.pollVote.groupBy({
          by: ['postId', 'optionId'],
          where: { postId: { in: pollPostIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ postId: string; optionId: string; _count: { _all: number } }>),
    viewerId && pollPostIds.length
      ? prisma.pollVote.findMany({
          where: { userId: viewerId, postId: { in: pollPostIds } },
          select: { postId: true, optionId: true },
        })
      : Promise.resolve([] as Array<{ postId: string; optionId: string }>),
  ]);

  const counts = new Map<string, Partial<Record<ReactionType, number>>>();
  for (const row of reactionRows) {
    const entry = counts.get(row.postId) ?? {};
    const type = isReactionType(row.type) ? row.type : 'LIKE';
    entry[type] = (entry[type] ?? 0) + row._count._all;
    counts.set(row.postId, entry);
  }
  const myReactions = new Map(mine.map((r) => [r.postId, isReactionType(r.type) ? r.type : 'LIKE']));
  const saved = new Set(saves.map((s) => s.postId));
  const votes = new Map<string, Map<string, number>>();
  for (const row of voteRows) {
    const byOption = votes.get(row.postId) ?? new Map<string, number>();
    byOption.set(row.optionId, row._count._all);
    votes.set(row.postId, byOption);
  }
  const myVoteByPost = new Map(myVotes.map((v) => [v.postId, v.optionId]));

  return posts.map((post) => {
    const definition = readPoll(post.poll);
    let poll: PollResults | null = null;
    if (definition) {
      const byOption = votes.get(post.id) ?? new Map<string, number>();
      const totalVotes = Array.from(byOption.values()).reduce((a, b) => a + b, 0);
      poll = {
        endsAt: definition.endsAt,
        isClosed: isPollClosed(definition, now),
        totalVotes,
        myVote: myVoteByPost.get(post.id) ?? null,
        options: definition.options.map((option) => {
          const count = byOption.get(option.id) ?? 0;
          return { ...option, votes: count, percent: totalVotes ? Math.round((count / totalVotes) * 100) : 0 };
        }),
      };
    }
    const myReaction = (myReactions.get(post.id) as ReactionType | undefined) ?? null;
    return {
      ...post,
      isLiked: myReaction !== null,
      myReaction,
      reactionCounts: counts.get(post.id) ?? {},
      isSaved: saved.has(post.id),
      poll,
    };
  });
}
