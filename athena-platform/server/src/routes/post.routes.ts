import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { indexDocument, deleteDocument, IndexNames } from '../utils/opensearch';
import { aiService } from '../services/ai.service'; // Added import
import { generateFeed, getVideoFeed, recordPostView } from '../services/feed.service';

const router = Router();


// ===========================================
// GET FEED
// ===========================================
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Phase 1 community tabs: "for-you" (ranked) and "following" (only followed users)
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'for-you';
    const typeParam = typeof req.query.type === 'string' ? req.query.type : 'all';
    const algorithmParam = typeof req.query.algorithm === 'string' ? req.query.algorithm : undefined;

    if (tab === 'following' && req.user) {
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.id },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);
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

      const likes = await prisma.like.findMany({
        where: { userId: req.user.id, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      });
      const likedPostIds = new Set(likes.map((l) => l.postId));

      res.json({
        success: true,
        data: posts.map((post) => ({ ...post, isLiked: likedPostIds.has(post.id) })),
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

    res.json({
      success: true,
      data: result.posts,
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

    res.json({
      success: true,
      data: result.videos,
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

    res.json({
      success: true,
      data: {
        ...post,
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
    body('content').notEmpty().trim(),
    body('type').optional().isIn(['TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'JOB_SHARE', 'COURSE_SHARE']),
    body('mediaUrls').optional().isArray(),
    body('isPublic').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { content, type = 'TEXT', mediaUrls, isPublic = true } = req.body;

      // AI Content Enrichment
      let enrichedData = { qualityScore: 0, tags: [], sentiment: 'neutral', isSafe: true };
      try {
        if (process.env.AI_SOCIAL_CONTENT_ENABLED === 'true') {
           enrichedData = await aiService.enrichSocialContent(content, mediaUrls);
        }
      } catch (err) {
        console.warn('AI enrichment skipped:', err);
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
    body('title').notEmpty().isString(),
    body('url').notEmpty().isString(),
    body('entityType').optional().isIn(['job', 'course', 'post', 'video', 'resource']),
    body('entityId').optional().isString(),
    body('message').optional().isString(),
    body('description').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { title, url, description, message, entityType = 'resource', entityId } = req.body;

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
        await prisma.post.update({
          where: { id: entityId },
          data: { shareCount: { increment: 1 } },
        });
      }

      if (entityType === 'video' && entityId) {
        await prisma.video.update({
          where: { id: entityId },
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
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
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

    const { content, isPublic } = req.body;

    const post = await prisma.post.update({
      where: { id },
      data: {
        content,
        isPublic,
      },
    });

    res.json({
      success: true,
      message: 'Post updated',
      data: post,
    });
  } catch (error) {
    next(error);
  }
});

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

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: req.user!.id,
          postId: id,
        },
      },
    });

    if (existingLike) {
      throw new ApiError(400, 'Already liked this post');
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

    // Notify author (if not self)
    if (post.authorId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'LIKE',
          title: 'New like',
          message: 'Someone liked your post',
          link: `/posts/${id}`,
        },
      });
    }

    res.json({
      success: true,
      message: 'Post liked',
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
  [body('content').notEmpty().trim()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, parentId } = req.body;

      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        throw new ApiError(404, 'Post not found');
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

      // Notify author
      if (post.authorId !== req.user!.id) {
        await prisma.notification.create({
          data: {
            userId: post.authorId,
            type: 'COMMENT',
            title: 'New comment',
            message: 'Someone commented on your post',
            link: `/posts/${id}`,
          },
        });
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

export default router;
