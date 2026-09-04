import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { indexDocument, deleteDocument, IndexNames } from '../utils/opensearch';
import { aiService } from '../services/ai.service'; // Added import
import { generateFeed, getVideoFeed, recordPostView } from '../services/feed.service';
import { assertContentAllowed } from '../services/moderation.service';
import { logger } from '../utils/logger';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { getBlockedRelationshipIds, isBlockedRelationship } from '../utils/safety-store';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import {
  CONTENT_LIMITS,
  normalizeMediaUrls,
  normalizeOptionalUserText,
  normalizeSafeUrl,
  normalizeUserText,
} from '../utils/contentSafety';

const router = Router();


// ===========================================
// GET FEED
// ===========================================
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });

    // Phase 1 community tabs: "for-you" (ranked) and "following" (only followed users)
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'for-you';
    const typeParam = typeof req.query.type === 'string' ? req.query.type : 'all';
    const algorithmParam = typeof req.query.algorithm === 'string' ? req.query.algorithm : undefined;

    // Blocking is symmetric, so the same list keeps both parties out of each
    // other's feed no matter who pressed block.
    const blockedIds = req.user ? await getBlockedRelationshipIds(req.user.id) : [];

    if (tab === 'following' && req.user) {
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.id },
        select: { followingId: true },
      });
      const blocked = new Set(blockedIds);
      const followingIds = following
        .map((f) => f.followingId)
        .filter((followingId) => !blocked.has(followingId));
      followingIds.push(req.user.id);

      const where: any = {
        authorId: { in: followingIds },
        isHidden: false,
      };

      // Optional content type filter
      if (typeParam && typeParam !== 'all') {
        where.type = String(typeParam).toUpperCase();
      }

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                headline: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.post.count({ where }),
      ]);

      const postIds = posts.map((p) => p.id);
      const [likes, saves] = await Promise.all([
        prisma.like.findMany({
          where: { userId: req.user.id, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.postSave.findMany({
          where: { userId: req.user.id, postId: { in: postIds } },
          select: { postId: true },
        }),
      ]);
      const likedPostIds = new Set(likes.map((l) => l.postId));
      const savedPostIds = new Set(saves.map((s) => s.postId));

      res.json({
        success: true,
        data: posts.map((post) => ({
          ...post,
          // Everyone on this tab is followed by definition, except the viewer.
          author: { ...post.author, isFollowing: post.authorId !== req.user!.id },
          isLiked: likedPostIds.has(post.id),
          isSaved: savedPostIds.has(post.id),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
      return;
    }

    if (tab !== 'for-you' && tab !== 'following') {
      throw new ApiError(400, 'Invalid feed tab');
    }

    const normalizedType = ((): 'all' | 'video' | 'image' | 'text' => {
      const t = String(typeParam || 'all').toLowerCase();
      if (t === 'video' || t === 'image' || t === 'text') return t;
      return 'all';
    })();

    const normalizedAlgorithm = ((): 'chronological' | 'engagement' | 'personalized' => {
      const a = String(algorithmParam || 'engagement').toLowerCase();
      if (a === 'chronological' || a === 'personalized') return a;
      return 'engagement';
    })();

    const result = await generateFeed({
      userId: req.user?.id,
      page,
      limit,
      type: normalizedType,
      algorithm: normalizedAlgorithm,
    });

    // generateFeed ranks without knowing about blocks or saves, so drop blocked
    // authors and decorate the rest here.
    const blocked = new Set(blockedIds);
    const visiblePosts = result.posts.filter((post) => !blocked.has(post.authorId));

    let posts: unknown[] = visiblePosts;
    if (req.user) {
      const saves = await prisma.postSave.findMany({
        where: { userId: req.user.id, postId: { in: visiblePosts.map((p) => p.id) } },
        select: { postId: true },
      });
      const savedPostIds = new Set(saves.map((s) => s.postId));
      posts = visiblePosts.map((post) => ({ ...post, isSaved: savedPostIds.has(post.id) }));
    }

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// VIDEO FEED (TikTok-style)
// ===========================================
router.get('/video-feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw!)) : 10;

    const result = await getVideoFeed(req.user?.id, cursor, limit);

    const blocked = new Set(req.user ? await getBlockedRelationshipIds(req.user.id) : []);

    res.json({
      success: true,
      data: result.videos.filter((video) => !blocked.has(video.authorId)),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RECORD VIEW (explicit; used by video players)
// ===========================================
router.post('/:id/view', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    try {
      await recordPostView(id, req.user?.id, { silent: false });
    } catch (err: any) {
      // Prisma throws P2025 when the record doesn't exist.
      if (err?.code === 'P2025') {
        throw new ApiError(404, 'Post not found');
      }
      throw err;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET POST BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatar: true,
            headline: true,
          },
        },
        comments: {
          where: {
            parentId: null,
            ...(isAdmin ? {} : { isHidden: false }),
          },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
              },
            },
            replies: {
              where: isAdmin ? undefined : { isHidden: false },
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    if (post.isHidden && !isAdmin && req.user?.id !== post.authorId) {
      throw new ApiError(404, 'Post not found');
    }

    const blockedAuthorIds = new Set(
      req.user && !isAdmin ? await getBlockedRelationshipIds(req.user.id) : []
    );

    if (blockedAuthorIds.has(post.authorId)) {
      throw new ApiError(404, 'Post not found');
    }

    // Check if private
    if (!post.isPublic && req.user?.id !== post.authorId) {
      throw new ApiError(403, 'This post is private');
    }

    // Increment view count
    await recordPostView(id, req.user?.id);

    // Check if liked
    let isLiked = false;
    if (req.user) {
      const like = await prisma.like.findUnique({
        where: {
          userId_postId: {
            userId: req.user.id,
            postId: id,
          },
        },
      });
      isLiked = !!like;
    }

    const comments = post.comments
      .filter((comment) => !blockedAuthorIds.has(comment.authorId))
      .map((comment) => ({
        ...comment,
        replies: comment.replies.filter((reply) => !blockedAuthorIds.has(reply.authorId)),
      }));

    // The counters are denormalised and have drifted before (seed rows carried
    // "15 comments" over an empty thread). On the one page that shows the
    // thread itself, report what is actually there.
    res.json({
      success: true,
      data: {
        ...post,
        likeCount: post._count?.likes ?? post.likeCount,
        commentCount: post._count?.comments ?? post.commentCount,
        comments,
        isLiked,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE POST
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.post }),
    body('type').optional().isIn(['TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'JOB_SHARE', 'COURSE_SHARE']),
    body('mediaUrls').optional().isArray({ max: 10 }),
    body('isPublic').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const content = normalizeUserText(req.body.content, {
        field: 'content',
        maxLength: CONTENT_LIMITS.post,
      });
      const mediaUrls = normalizeMediaUrls(req.body.mediaUrls);
      const type = req.body.type || 'TEXT';
      const isPublic = req.body.isPublic ?? true;

      await assertContentAllowed(content, { kind: 'post', userId: req.user!.id });

      // AI Content Enrichment
      let enrichedData = { qualityScore: 0, tags: [], sentiment: 'neutral', isSafe: true };
      try {
        if (process.env.AI_SOCIAL_CONTENT_ENABLED === 'true') {
           enrichedData = await aiService.enrichSocialContent(content, mediaUrls);
        }
      } catch (err) {
        logger.warn('AI enrichment skipped', { error: err });
      }

      const post = await prisma.post.create({
        data: {
          authorId: req.user!.id,
          content,
          type,
          mediaUrls,
          isPublic,
          // Store enriched data if schema supports it, otherwise index it
          // Assuming schema doesn't have tags/score yet, we might use metadata if available or just use it for search indexing below
          // Check schema...
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              headline: true,
            },
          },
        },
      });

      // Index in OpenSearch if public
      if (post.isPublic && !post.isHidden) {
        await indexDocument(IndexNames.POSTS, post.id, {
          content: post.content,
          authorName: post.author?.displayName || `${post.author?.firstName} ${post.author?.lastName}`,
          type: post.type,
          hasMedia: post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0,
          createdAt: post.createdAt,
          popularity: 0,
          // Add enriched data to search index
          tags: enrichedData.tags,
          sentiment: enrichedData.sentiment,
          qualityScore: enrichedData.qualityScore
        });
      }

      res.status(201).json({
        success: true,
        message: 'Post created',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SHARE TO FEED
// ===========================================
router.post(
  '/share',
  authenticate,
  [
    body('title').isString().notEmpty().isLength({ max: CONTENT_LIMITS.shareTitle }),
    body('url').isString().notEmpty().isLength({ max: 2048 }),
    body('entityType').optional().isIn(['job', 'course', 'post', 'video', 'resource']),
    body('entityId').optional().isString().isLength({ max: 100 }),
    body('message').optional().isString().isLength({ max: CONTENT_LIMITS.shareMessage }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.shareDescription }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const title = normalizeUserText(req.body.title, {
        field: 'title',
        maxLength: CONTENT_LIMITS.shareTitle,
      });
      const url = normalizeSafeUrl(req.body.url, { field: 'url' });
      const description = normalizeOptionalUserText(req.body.description, {
        field: 'description',
        maxLength: CONTENT_LIMITS.shareDescription,
        allowEmpty: true,
      });
      const message = normalizeOptionalUserText(req.body.message, {
        field: 'message',
        maxLength: CONTENT_LIMITS.shareMessage,
        allowEmpty: true,
      });
      const { entityType = 'resource', entityId } = req.body;

      const content = [
        message || `Shared from ${entityType}`,
        title,
        description,
        url,
      ]
        .filter(Boolean)
        .join('\n');

      const postType = entityType === 'job'
        ? 'JOB_SHARE'
        : entityType === 'course'
        ? 'COURSE_SHARE'
        : 'TEXT';

      await assertContentAllowed(content, { kind: 'post', userId: req.user!.id });

      const post = await prisma.post.create({
        data: {
          authorId: req.user!.id,
          content,
          type: postType,
          isPublic: true,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              headline: true,
            },
          },
        },
      });

      if (entityType === 'post' && entityId) {
        await prisma.post.updateMany({
          where: { id: entityId, isPublic: true, isHidden: false },
          data: { shareCount: { increment: 1 } },
        });
      }

      if (entityType === 'video' && entityId) {
        await prisma.video.updateMany({
          where: { id: entityId, status: 'PUBLISHED', isHidden: false },
          data: { shareCount: { increment: 1 } },
        });
      }

      await indexDocument(IndexNames.POSTS, post.id, {
        content: post.content,
        authorName: post.author?.displayName || `${post.author?.firstName} ${post.author?.lastName}`,
        type: post.type,
        hasMedia: Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0,
        createdAt: post.createdAt,
        popularity: 0,
      });

      res.status(201).json({
        success: true,
        message: 'Shared to feed',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE POST
// ===========================================
router.patch(
  '/:id',
  authenticate,
  [
    body('content').optional().isString().isLength({ max: CONTENT_LIMITS.post }),
    body('isPublic').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, errors.array()[0].msg);
    }

    const { id } = req.params;

    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!existingPost) {
      throw new ApiError(404, 'Post not found');
    }

    if (existingPost.authorId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized to edit this post');
    }

    const data: { content?: string; isPublic?: boolean } = {};
    if (req.body.content !== undefined) {
      data.content = normalizeUserText(req.body.content, {
        field: 'content',
        maxLength: CONTENT_LIMITS.post,
      });
    }
    if (req.body.isPublic !== undefined) {
      data.isPublic = req.body.isPublic;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'No valid post updates provided');
    }

    if (data.content) {
      await assertContentAllowed(data.content, { kind: 'post', userId: req.user!.id });
    }

    const post = await prisma.post.update({
      where: { id },
      data,
    });

    res.json({
      success: true,
      message: 'Post updated',
      data: post,
    });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE POST
// ===========================================
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!existingPost) {
      throw new ApiError(404, 'Post not found');
    }

    if (existingPost.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized to delete this post');
    }

    await prisma.post.delete({ where: { id } });

    // Remove from index
    await deleteDocument(IndexNames.POSTS, id);

    res.json({
      success: true,
      message: 'Post deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LIKE POST
// ===========================================
router.post('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    if (post.isHidden || (!post.isPublic && post.authorId !== req.user!.id)) {
      throw new ApiError(404, 'Post not found');
    }

    // Idempotent. The client toggles optimistically, and a second tap that
    // raced the first, or a stale "not liked" state, used to come back as a
    // 400 that made the client revert a like the server had already stored.
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: req.user!.id,
          postId: id,
        },
      },
    });

    if (existingLike) {
      res.json({ success: true, message: 'Post liked', liked: true });
      return;
    }

    await prisma.like.create({
      data: {
        userId: req.user!.id,
        postId: id,
      },
    });

    // Update like count
    await prisma.post.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });

    await notifySocial({
      recipientId: post.authorId,
      actorId: req.user!.id,
      type: 'LIKE',
      title: 'New like',
      message: (name) => `${name} liked your post`,
      link: socialLinks.post(id),
    });

    res.json({
      success: true,
      message: 'Post liked',
      liked: true,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNLIKE POST
// ===========================================
router.delete('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.like.deleteMany({
      where: {
        userId: req.user!.id,
        postId: id,
      },
    });

    if (deleted.count > 0) {
      await prisma.post.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
    }

    res.json({
      success: true,
      message: 'Like removed',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ADD COMMENT
// ===========================================
router.post(
  '/:id/comments',
  authenticate,
  [
    body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.comment }),
    body('parentId').optional().isString().isLength({ max: 100 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const content = normalizeUserText(req.body.content, {
        field: 'content',
        maxLength: CONTENT_LIMITS.comment,
      });
      const parentId = typeof req.body.parentId === 'string' && req.body.parentId.trim()
        ? req.body.parentId.trim()
        : undefined;

      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        throw new ApiError(404, 'Post not found');
      }

      if (post.isHidden || !post.isPublic) {
        throw new ApiError(404, 'Post not found');
      }

      if (await isBlockedRelationship(req.user!.id, post.authorId)) {
        throw new ApiError(404, 'Post not found');
      }

      await assertContentAllowed(content, { kind: 'comment', userId: req.user!.id });

      if (parentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { postId: true, isHidden: true },
        });

        if (!parent || parent.postId !== id || parent.isHidden) {
          throw new ApiError(400, 'Invalid parent comment');
        }
      }

      const comment = await prisma.comment.create({
        data: {
          postId: id,
          authorId: req.user!.id,
          content,
          parentId,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      // Update comment count
      await prisma.post.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      });

      await notifySocial({
        recipientId: post.authorId,
        actorId: req.user!.id,
        type: 'COMMENT',
        title: 'New comment',
        message: (name) => `${name} commented on your post`,
        link: socialLinks.post(id),
      });

      // A reply also reaches the person being replied to, who may not be the
      // post's author and would otherwise never learn it was there.
      if (parentId) {
        const parentAuthor = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        if (parentAuthor && parentAuthor.authorId !== post.authorId) {
          await notifySocial({
            recipientId: parentAuthor.authorId,
            actorId: req.user!.id,
            type: 'COMMENT',
            title: 'New reply',
            message: (name) => `${name} replied to your comment`,
            link: socialLinks.post(id),
          });
        }
      }

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE COMMENT
// ===========================================
router.delete('/:postId/comments/:commentId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { postId, commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    if (comment.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    await prisma.comment.delete({ where: { id: commentId } });

    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { decrement: 1 } },
    });

    res.json({
      success: true,
      message: 'Comment deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER'S POSTS
// ===========================================
router.get('/user/:userId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const where: any = { authorId: userId };
    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';

    if (req.user && !isAdmin && (await isBlockedRelationship(req.user.id, userId))) {
      throw new ApiError(404, 'User not found');
    }

    // Only show public posts unless viewing own profile
    if (req.user?.id !== userId) {
      where.isPublic = true;
      if (!isAdmin) {
        where.isHidden = false;
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              headline: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAVE / UNSAVE A POST
// ===========================================

// Mirrors the visibility rule the like routes use: a hidden post, or a private
// post belonging to someone else, is treated as absent rather than forbidden.
async function loadVisiblePost(id: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.isHidden || (!post.isPublic && post.authorId !== userId)) {
    throw new ApiError(404, 'Post not found');
  }
  return post;
}

router.get('/me/saved', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const saves = await prisma.postSave.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            author: {
              select: { id: true, displayName: true, avatar: true, headline: true },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: saves.map((save) => ({ ...save.post, isSaved: true })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await loadVisiblePost(id, req.user!.id);

    // Upsert keeps a double-tap idempotent instead of a unique-constraint error.
    await prisma.postSave.upsert({
      where: { postId_userId: { postId: id, userId: req.user!.id } },
      update: {},
      create: { postId: id, userId: req.user!.id },
    });

    res.status(201).json({ success: true, message: 'Post saved' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.postSave.deleteMany({
      where: { postId: id, userId: req.user!.id },
    });

    res.json({ success: true, message: 'Save removed' });
  } catch (error) {
    next(error);
  }
});

export default router;
