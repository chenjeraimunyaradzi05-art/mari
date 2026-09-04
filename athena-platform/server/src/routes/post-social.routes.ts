/**
 * The social layer on posts that the original post routes never had:
 *
 *   POST   /api/posts/:id/react                      react with a meaning (or change it)
 *   POST   /api/posts/:id/vote                       vote in a poll (or change the vote)
 *   POST   /api/posts/:postId/comments/:commentId/like
 *   DELETE /api/posts/:postId/comments/:commentId/like
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
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import { isBlockedRelationship } from '../utils/safety-store';
import { normalizeOptionalUserText, normalizeUserText } from '../utils/contentSafety';
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

export default router;
