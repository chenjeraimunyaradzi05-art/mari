/**
 * The social layer on posts that the original post routes never had:
 *
 *   POST   /api/posts/:id/react                      react with a meaning (or change it)
 *   POST   /api/posts/:id/vote                       vote in a poll (or change the vote)
 *   POST   /api/posts/:postId/comments/:commentId/like
 *   DELETE /api/posts/:postId/comments/:commentId/like
 *   PATCH  /api/posts/:postId/comments/:commentId      { content }  edit your own comment
 *   GET    /api/posts/:id/reactions?type=&page=&limit=  who reacted, and how
 *   PATCH  /api/posts/:id/pin                        pin one post to the top of your profile
 *   GET    /api/posts/me/scheduled                   what you have queued
 *   GET    /api/posts/me/mentions                    posts that name you
 *   GET    /api/posts/collections                    your saved-post folders, with counts
 *   POST   /api/posts/collections                    { name, description? }
 *   PATCH  /api/posts/collections/:id
 *   DELETE /api/posts/collections/:id                the saves inside go back to Unsorted
 *   PATCH  /api/posts/:id/save                       { collectionId | null }  file a save (saving it first if needed)
 *
 * Mounted ahead of post.routes so `me/scheduled` is never read as a post id.
 */

import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { commentLimiter, reactionLimiter } from '../middleware/socialLimits';
import { assertContentAllowed } from '../services/moderation.service';
import { resolveMentionedUserIds } from '../utils/mentions';
import { canViewAuthor, canViewGroupPosts } from '../services/audience.service';
import { getBlockedRelationshipIds } from '../utils/safety-store';
import { parsePagination } from '../utils/pagination';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import { isBlockedRelationship } from '../utils/safety-store';
import { CONTENT_LIMITS, normalizeOptionalUserText, normalizeUserText } from '../utils/contentSafety';
import {
  decoratePosts,
  isPollClosed,
  isReactionType,
  readPoll,
  reactionVerb,
} from '../services/post-decoration.service';

const router = Router();

const AUTHOR_SELECT = {
  author: {
    select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true },
  },
};

async function loadVisiblePost(id: string, viewerId: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || (post.isHidden && post.authorId !== viewerId) || (!post.isPublic && post.authorId !== viewerId)) {
    throw new ApiError(404, 'Post not found');
  }
  if (await isBlockedRelationship(viewerId, post.authorId)) {
    throw new ApiError(404, 'Post not found');
  }
  // A private group's posts are for its members; a connections-only
  // author's for their followers. Reacting is seeing.
  if (!(await canViewGroupPosts(viewerId, post.groupId))) {
    throw new ApiError(404, 'Post not found');
  }
  if (!(await canViewAuthor(viewerId, post.authorId))) {
    throw new ApiError(404, 'Post not found');
  }
  return post;
}

// ===========================================
// REACT
// ===========================================
// One reaction per member per post. Reacting again with a different type
// changes it; the same type is a no-op. Removal stays DELETE /:id/like.
router.post(
  '/:id/react',
  authenticate,
  reactionLimiter,
  [body('type').isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);
      const type = String(req.body.type).toUpperCase();
      if (!isReactionType(type)) {
        throw new ApiError(400, 'Unknown reaction');
      }

      const post = await loadVisiblePost(req.params.id, req.user!.id);
      const existing = await prisma.like.findUnique({
        where: { userId_postId: { userId: req.user!.id, postId: post.id } },
      });

      if (existing && existing.type === type) {
        res.json({ success: true, reaction: type, changed: false });
        return;
      }

      if (existing) {
        await prisma.like.update({ where: { id: existing.id }, data: { type } });
      } else {
        await prisma.$transaction([
          prisma.like.create({ data: { userId: req.user!.id, postId: post.id, type } }),
          prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } }),
        ]);
        await notifySocial({
          recipientId: post.authorId,
          actorId: req.user!.id,
          type: 'LIKE',
          title: 'New reaction',
          message: (name) => `${name} ${reactionVerb(type)} your post`,
          link: socialLinks.post(post.id),
        });
      }

      res.status(existing ? 200 : 201).json({ success: true, reaction: type, changed: true });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// WHO REACTED
// ===========================================
// The people behind the counts, newest first, optionally one reaction type.
// Anyone who can see the post can see who reacted, less anyone on either side
// of a block with the viewer; the viewer's follow state rides along so the
// list doubles as a place to follow someone back.
router.get('/:id/reactions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await loadVisiblePost(req.params.id, req.user!.id);
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string }, 50);
    const requested = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : '';
    const type = requested && isReactionType(requested) ? requested : undefined;
    if (requested && !type) {
      throw new ApiError(400, 'Unknown reaction');
    }

    const blocked = await getBlockedRelationshipIds(req.user!.id);
    const where = {
      postId: post.id,
      ...(type ? { type } : {}),
      ...(blocked.length ? { userId: { notIn: blocked } } : {}),
    };

    const [rows, total, following] = await Promise.all([
      prisma.like.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          type: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true } },
        },
      }),
      prisma.like.count({ where }),
      prisma.follow.findMany({ where: { followerId: req.user!.id }, select: { followingId: true } }),
    ]);
    const followed = new Set(following.map((f) => f.followingId));

    res.json({
      success: true,
      data: rows.map((row) => ({
        type: isReactionType(row.type) ? row.type : 'LIKE',
        reactedAt: row.createdAt,
        user: {
          id: row.user.id,
          name: row.user.displayName?.trim() || [row.user.firstName, row.user.lastName].filter(Boolean).join(' ').trim() || 'Member',
          avatar: row.user.avatar,
          headline: row.user.headline,
          isFollowing: followed.has(row.user.id),
          isSelf: row.user.id === req.user!.id,
        },
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// VOTE
// ===========================================
router.post(
  '/:id/vote',
  authenticate,
  [body('optionId').isString().notEmpty().isLength({ max: 16 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

      const post = await loadVisiblePost(req.params.id, req.user!.id);
      const poll = readPoll(post.poll);
      if (!poll) throw new ApiError(400, 'This post is not a poll');
      if (isPollClosed(poll)) throw new ApiError(409, 'This poll has closed');

      const optionId = String(req.body.optionId);
      if (!poll.options.some((option) => option.id === optionId)) {
        throw new ApiError(400, 'That option is not in this poll');
      }

      await prisma.pollVote.upsert({
        where: { postId_userId: { postId: post.id, userId: req.user!.id } },
        update: { optionId },
        create: { postId: post.id, userId: req.user!.id, optionId },
      });

      const [decorated] = await decoratePosts([post], req.user!.id);
      res.json({ success: true, data: decorated.poll });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// COMMENT LIKES
// ===========================================
async function loadComment(postId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, isHidden: true },
  });
  if (!comment || comment.postId !== postId || comment.isHidden) {
    throw new ApiError(404, 'Comment not found');
  }
  return comment;
}

router.post('/:postId/comments/:commentId/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const comment = await loadComment(req.params.postId, req.params.commentId);
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: comment.id, userId: req.user!.id } },
    });
    if (existing) {
      res.json({ success: true, liked: true });
      return;
    }
    const [, updated] = await prisma.$transaction([
      prisma.commentLike.create({ data: { commentId: comment.id, userId: req.user!.id } }),
      prisma.comment.update({ where: { id: comment.id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } }),
    ]);
    await notifySocial({
      recipientId: comment.authorId,
      actorId: req.user!.id,
      type: 'LIKE',
      title: 'New like',
      message: (name) => `${name} liked your comment`,
      link: socialLinks.post(req.params.postId),
    });
    res.status(201).json({ success: true, liked: true, likeCount: updated.likeCount });
  } catch (error) {
    next(error);
  }
});

router.delete('/:postId/comments/:commentId/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.commentLike.deleteMany({
      where: { commentId: req.params.commentId, userId: req.user!.id },
    });
    let likeCount: number | undefined;
    if (deleted.count > 0) {
      const updated = await prisma.comment.update({
        where: { id: req.params.commentId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      likeCount = Math.max(0, updated.likeCount);
    }
    res.json({ success: true, liked: false, likeCount });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PIN TO PROFILE
// ===========================================
// One pinned post per member: pinning another unpins the previous one.
router.patch(
  '/:id/pin',
  authenticate,
  [body('pinned').isBoolean()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

      const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
      if (!post) throw new ApiError(404, 'Post not found');
      if (post.authorId !== req.user!.id) throw new ApiError(403, 'Only the author can pin a post');

      const pinned = Boolean(req.body.pinned);
      if (pinned) {
        await prisma.$transaction([
          prisma.post.updateMany({ where: { authorId: req.user!.id, isPinned: true }, data: { isPinned: false } }),
          prisma.post.update({ where: { id: post.id }, data: { isPinned: true } }),
        ]);
      } else {
        await prisma.post.update({ where: { id: post.id }, data: { isPinned: false } });
      }
      res.json({ success: true, pinned });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// MINE
// ===========================================
router.get('/me/scheduled', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { authorId: req.user!.id, isHidden: true, scheduledFor: { not: null } },
      include: AUTHOR_SELECT,
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });
    res.json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
});

router.get('/me/mentions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { mentionedUserIds: { has: req.user!.id }, isHidden: false },
      include: AUTHOR_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: await decoratePosts(posts, req.user!.id) });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// EDIT A COMMENT
// ===========================================
// The commenter changes their own words. The edit is moderated like a new
// comment, anyone newly named is told, and editedAt lets the thread say
// "edited" without guessing from updatedAt.
router.patch(
  '/:postId/comments/:commentId',
  authenticate,
  commentLimiter,
  [body('content').isString().isLength({ min: 1, max: CONTENT_LIMITS.comment })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);
      const { postId, commentId } = req.params;
      const content = normalizeUserText(req.body.content, { field: 'content', maxLength: CONTENT_LIMITS.comment });

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, authorId: true, content: true, isHidden: true, post: { select: { authorId: true, commentsOff: true } } },
      });
      if (!comment || comment.postId !== postId || comment.isHidden) {
        throw new ApiError(404, 'Comment not found');
      }
      if (comment.authorId !== req.user!.id) {
        throw new ApiError(403, 'You can only edit your own comments');
      }
      if (content === comment.content) {
        res.json({ success: true, message: 'No change', data: { id: comment.id, content, editedAt: null } });
        return;
      }

      await assertContentAllowed(content, { kind: 'comment', userId: req.user!.id });

      const updated = await prisma.comment.update({
        where: { id: comment.id },
        data: { content, editedAt: new Date() },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true } },
        },
      });

      // Only people the new words name and the old ones did not.
      const before = new Set((await resolveMentionedUserIds(comment.content)));
      const mentioned = (await resolveMentionedUserIds(content)).filter(
        (userId) => userId !== req.user!.id && userId !== comment.post.authorId && !before.has(userId)
      );
      for (const userId of mentioned) {
        await notifySocial({
          recipientId: userId,
          actorId: req.user!.id,
          type: 'MENTION',
          title: 'You were mentioned',
          message: (name) => `${name} mentioned you in a comment`,
          link: socialLinks.post(postId),
        });
      }

      res.json({ success: true, message: 'Comment updated', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// PIN A COMMENT
// ===========================================
// The post's author keeps one comment at the top of the thread. Pinning a
// second one replaces the first.
router.patch('/:postId/comments/:commentId/pin', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { postId, commentId } = req.params;
    const pinned = req.body?.pinned !== false;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, isHidden: true, post: { select: { authorId: true } } },
    });
    if (!comment || comment.postId !== postId || comment.isHidden) {
      throw new ApiError(404, 'Comment not found');
    }
    if (comment.post.authorId !== req.user!.id) {
      throw new ApiError(403, 'Only the post’s author can pin a comment');
    }

    await prisma.$transaction([
      prisma.comment.updateMany({ where: { postId, isPinned: true }, data: { isPinned: false } }),
      ...(pinned ? [prisma.comment.update({ where: { id: commentId }, data: { isPinned: true } })] : []),
    ]);

    res.json({ success: true, message: pinned ? 'Comment pinned' : 'Comment unpinned', data: { commentId, isPinned: pinned } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAVED COLLECTIONS
// ===========================================
// Folders for saved posts. A save without a folder sits in "Unsorted"; a
// folder that is deleted lets its saves fall back there rather than losing them.

const COLLECTION_NAME_MAX = 40;
const COLLECTION_DESCRIPTION_MAX = 160;
const MAX_COLLECTIONS = 20;

function firstMediaOf(mediaUrls: unknown): string | null {
  return Array.isArray(mediaUrls) && typeof mediaUrls[0] === 'string' ? mediaUrls[0] : null;
}

router.get('/collections', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.savedCollection.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { saves: true } },
        // The newest save with media gives the folder its cover.
        saves: {
          orderBy: { createdAt: 'desc' },
          take: 4,
          select: { post: { select: { mediaUrls: true } } },
        },
      },
    });

    const unsorted = await prisma.postSave.count({ where: { userId: req.user!.id, collectionId: null } });

    res.json({
      success: true,
      data: {
        unsortedCount: unsorted,
        collections: rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          count: row._count.saves,
          cover: row.saves.map((s) => firstMediaOf(s.post.mediaUrls)).find(Boolean) ?? null,
          updatedAt: row.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/collections', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const name = normalizeUserText(req.body?.name, { field: 'name', maxLength: COLLECTION_NAME_MAX });
    const description = normalizeOptionalUserText(req.body?.description, {
      field: 'description',
      maxLength: COLLECTION_DESCRIPTION_MAX,
      allowEmpty: true,
    });

    const existing = await prisma.savedCollection.findMany({
      where: { userId: req.user!.id },
      select: { id: true, name: true },
    });
    if (existing.length >= MAX_COLLECTIONS) {
      throw new ApiError(400, `You can keep up to ${MAX_COLLECTIONS} collections`);
    }
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, 'You already have a collection with that name');
    }

    const created = await prisma.savedCollection.create({
      data: { userId: req.user!.id, name, description: description || null },
    });
    res.status(201).json({
      success: true,
      message: 'Collection created',
      data: { id: created.id, name: created.name, description: created.description, count: 0, cover: null, updatedAt: created.updatedAt },
    });
  } catch (error) {
    next(error);
  }
});

async function loadOwnCollection(id: string, userId: string) {
  const row = await prisma.savedCollection.findUnique({ where: { id } });
  if (!row || row.userId !== userId) {
    throw new ApiError(404, 'Collection not found');
  }
  return row;
}

router.patch('/collections/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadOwnCollection(req.params.id, req.user!.id);
    const data: { name?: string; description?: string | null } = {};
    if (req.body?.name !== undefined) {
      data.name = normalizeUserText(req.body.name, { field: 'name', maxLength: COLLECTION_NAME_MAX });
    }
    if (req.body?.description !== undefined) {
      data.description =
        normalizeOptionalUserText(req.body.description, {
          field: 'description',
          maxLength: COLLECTION_DESCRIPTION_MAX,
          allowEmpty: true,
        }) || null;
    }
    const updated = await prisma.savedCollection.update({ where: { id: existing.id }, data });
    res.json({ success: true, data: { id: updated.id, name: updated.name, description: updated.description } });
  } catch (error) {
    next(error);
  }
});

router.delete('/collections/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadOwnCollection(req.params.id, req.user!.id);
    await prisma.savedCollection.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Collection removed; its posts are still saved' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await loadVisiblePost(id, req.user!.id);

    const collectionId: string | null =
      typeof req.body?.collectionId === 'string' && req.body.collectionId ? req.body.collectionId : null;
    if (collectionId) {
      await loadOwnCollection(collectionId, req.user!.id);
    }

    // Filing a post you had not saved saves it in one step.
    await prisma.postSave.upsert({
      where: { postId_userId: { postId: id, userId: req.user!.id } },
      update: { collectionId },
      create: { postId: id, userId: req.user!.id, collectionId },
    });
    if (collectionId) {
      await prisma.savedCollection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
    }

    res.json({ success: true, message: collectionId ? 'Saved to collection' : 'Moved to Unsorted', data: { collectionId } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DRAFTS
// ===========================================
// What a member is writing, saved as they type and kept across devices until
// it is published or thrown away.

const MAX_DRAFTS = 25;
const DRAFT_KINDS = new Set(['TEXT', 'POLL', 'WIN']);

function draftView(row: {
  id: string;
  kind: string;
  content: string;
  mediaUrls: unknown;
  mediaAlt: unknown;
  poll: unknown;
  isPublic: boolean;
  isSensitive: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    content: row.content,
    mediaUrls: Array.isArray(row.mediaUrls) ? row.mediaUrls : [],
    mediaAlt: Array.isArray(row.mediaAlt) ? row.mediaAlt : [],
    poll: row.poll ?? null,
    isPublic: row.isPublic,
    isSensitive: row.isSensitive,
    updatedAt: row.updatedAt,
  };
}

function draftData(body: Record<string, unknown>) {
  const kind = typeof body.kind === 'string' && DRAFT_KINDS.has(body.kind) ? body.kind : 'TEXT';
  const content = typeof body.content === 'string' ? body.content.slice(0, 5000) : '';
  const mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((u) => typeof u === 'string').slice(0, 10) : [];
  const mediaAlt = Array.isArray(body.mediaAlt) ? body.mediaAlt.filter((a) => typeof a === 'string').slice(0, 10) : [];
  const poll = body.poll && typeof body.poll === 'object' ? (body.poll as Prisma.InputJsonValue) : Prisma.JsonNull;
  return {
    kind,
    content,
    mediaUrls: mediaUrls as Prisma.InputJsonValue,
    mediaAlt: mediaAlt as Prisma.InputJsonValue,
    poll,
    isPublic: body.isPublic !== false,
    isSensitive: body.isSensitive === true,
  };
}

router.get('/me/drafts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.postDraft.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: MAX_DRAFTS,
    });
    res.json({ success: true, data: rows.map(draftView) });
  } catch (error) {
    next(error);
  }
});

// Creates a draft, or updates one by id. An empty draft is not kept.
router.put('/me/drafts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = draftData(body);
    const id = typeof body.id === 'string' && body.id ? body.id : null;
    const empty = !data.content.trim() && (data.mediaUrls as unknown[]).length === 0;

    if (id) {
      const existing = await prisma.postDraft.findUnique({ where: { id }, select: { userId: true } });
      if (!existing || existing.userId !== req.user!.id) {
        throw new ApiError(404, 'Draft not found');
      }
      if (empty) {
        await prisma.postDraft.delete({ where: { id } });
        res.json({ success: true, data: null });
        return;
      }
      const updated = await prisma.postDraft.update({ where: { id }, data });
      res.json({ success: true, data: draftView(updated) });
      return;
    }

    if (empty) {
      res.json({ success: true, data: null });
      return;
    }
    const count = await prisma.postDraft.count({ where: { userId: req.user!.id } });
    if (count >= MAX_DRAFTS) {
      throw new ApiError(400, `You can keep up to ${MAX_DRAFTS} drafts`);
    }
    const created = await prisma.postDraft.create({ data: { userId: req.user!.id, ...data } });
    res.status(201).json({ success: true, data: draftView(created) });
  } catch (error) {
    next(error);
  }
});

router.delete('/me/drafts/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.postDraft.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ success: true, message: 'Draft discarded' });
  } catch (error) {
    next(error);
  }
});

export default router;
