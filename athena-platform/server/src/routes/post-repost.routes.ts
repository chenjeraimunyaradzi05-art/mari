/**
 * Reposts and quote posts.
 *
 *   POST   /api/posts/:id/repost   { content? }  repost as-is (idempotent), or with your own words
 *   DELETE /api/posts/:id/repost                 take back a plain repost
 *   GET    /api/posts/:id/reposts                who reposted or quoted it
 *
 * A repost is a Post row of its own, by the reposter, pointing at the original
 * through repostOfId. Plain reposts carry no content; quotes do. Every list
 * route includes the original (REPOST_OF_INCLUDE) so a repost renders the same
 * in the feed, on a profile and in saved items. Mounted ahead of post.routes.
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import { isBlockedRelationship } from '../utils/safety-store';
import { assertContentAllowed } from '../services/moderation.service';
import { CONTENT_LIMITS, normalizeOptionalUserText } from '../utils/contentSafety';
import { resolveMentionedUserIds } from '../utils/mentions';
import { decoratePosts, REPOST_OF_INCLUDE } from '../services/post-decoration.service';
import { enrichPostLinkPreview } from '../services/link-preview.service';
import { repostLimiter } from '../middleware/socialLimits';

const router = Router();

const AUTHOR_SELECT = {
  author: {
    select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true },
  },
};

type RepostTarget = { id: string; authorId: string; repostOfId: string | null; content: string };

/**
 * The post a repost will point at. Reposting someone's plain repost reposts
 * what they reposted, so counts land on the original and nothing chains.
 */
async function loadRepostTarget(id: string, viewerId: string, depth = 0): Promise<RepostTarget> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, isHidden: true, isPublic: true, repostOfId: true, content: true, groupId: true },
  });
  if (!post || post.isHidden || !post.isPublic) {
    throw new ApiError(404, 'Post not found');
  }
  // What is said in a group stays in the group.
  if (post.groupId) {
    throw new ApiError(400, 'Posts from a group cannot be reposted');
  }
  if (await isBlockedRelationship(viewerId, post.authorId)) {
    throw new ApiError(404, 'Post not found');
  }
  if (post.repostOfId && post.content === '' && depth < 2) {
    return loadRepostTarget(post.repostOfId, viewerId, depth + 1);
  }
  return post;
}

router.post('/:id/repost', authenticate, repostLimiter, async (req: AuthRequest, res, next) => {
  try {
    const viewerId = req.user!.id;
    const original = await loadRepostTarget(req.params.id, viewerId);

    const content =
      normalizeOptionalUserText(req.body?.content, {
        field: 'content',
        maxLength: CONTENT_LIMITS.post,
        allowEmpty: true,
      }) || '';
    const isQuote = content.length > 0;

    if (!isQuote) {
      // Pressing repost twice is one repost.
      const existing = await prisma.post.findFirst({
        where: { authorId: viewerId, repostOfId: original.id, content: '' },
        include: { ...AUTHOR_SELECT, ...REPOST_OF_INCLUDE },
      });
      if (existing) {
        res.json({ success: true, message: 'Already reposted', data: (await decoratePosts([existing], viewerId))[0] });
        return;
      }
    } else {
      await assertContentAllowed(content, { kind: 'post', userId: viewerId });
    }

    const mentionedUserIds = isQuote
      ? (await resolveMentionedUserIds(content)).filter((id) => id !== viewerId)
      : [];

    const [created] = await prisma.$transaction([
      prisma.post.create({
        data: {
          authorId: viewerId,
          content,
          type: 'TEXT',
          mediaUrls: [],
          isPublic: true,
          repostOfId: original.id,
          mentionedUserIds,
        },
        include: { ...AUTHOR_SELECT, ...REPOST_OF_INCLUDE },
      }),
      prisma.post.update({ where: { id: original.id }, data: { repostCount: { increment: 1 } } }),
    ]);

    await notifySocial({
      recipientId: original.authorId,
      actorId: viewerId,
      type: 'REPOST',
      title: isQuote ? 'Your post was quoted' : 'Your post was reposted',
      message: (name) => `${name} ${isQuote ? 'quoted' : 'reposted'} your post`,
      link: socialLinks.post(created.id),
    });
    for (const userId of mentionedUserIds) {
      await notifySocial({
        recipientId: userId,
        actorId: viewerId,
        type: 'MENTION',
        title: 'You were mentioned',
        message: (name) => `${name} mentioned you in a post`,
        link: socialLinks.post(created.id),
      });
    }
    if (isQuote) enrichPostLinkPreview(created.id, content);

    res.status(201).json({
      success: true,
      message: isQuote ? 'Quote posted' : 'Reposted',
      data: (await decoratePosts([created], viewerId))[0],
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/repost', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const mine = await prisma.post.findFirst({
      where: { authorId: req.user!.id, repostOfId: id, content: '' },
      select: { id: true },
    });
    if (!mine) {
      throw new ApiError(404, 'You have not reposted this');
    }

    await prisma.$transaction([
      prisma.post.delete({ where: { id: mine.id } }),
      prisma.post.updateMany({ where: { id, repostCount: { gt: 0 } }, data: { repostCount: { decrement: 1 } } }),
    ]);

    res.json({ success: true, message: 'Repost removed' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/reposts', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.post.findMany({
      where: { repostOfId: req.params.id, isHidden: false, isPublic: true },
      select: { id: true, content: true, createdAt: true, ...AUTHOR_SELECT },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        isQuote: row.content.length > 0,
        excerpt: row.content.slice(0, 140),
        createdAt: row.createdAt,
        author: row.author,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
