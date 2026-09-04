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

export default router;
