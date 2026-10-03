import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import {
  CONTENT_LIMITS,
  normalizeOptionalUserText,
  normalizeSafeUrl,
  normalizeStringList,
  normalizeUserText,
} from '../utils/contentSafety';
import { assertContentAllowed } from '../services/moderation.service';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import { assertSoundExists, attachSounds, recordSoundUse } from '../services/sound.service';
import { enqueueVideoProcessing } from '../services/video-pipeline.service';
import { bestEffort } from '../utils/best-effort';
import { viewerContextFor, visibleAuthorWhere } from '../services/search.service';
import { authorVisibleWhere, blockedEitherWayIds, canViewAuthor, isBlockedEitherWay } from '../services/audience.service';
import { createRateLimiter } from '../middleware/rateLimiter';
import { COUNTED_VIEW_WINDOW_MS } from '../services/creator-content-analytics.service';
import { commentLimiter, postLimiter, reactionLimiter, withinTargetLimit } from '../middleware/socialLimits';

const router = Router();

/**
 * The member behind a request on a route mounted behind `authenticate`. The
 * middleware has always set her, so the refusal is never reached in practice;
 * the check is what lets a handler read her without a `req.user!` assertion.
 */
function member(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

// How long one member's watch of one reel stands for a single counted view
// lives with the creator dashboard, which replays the same rule over the stored
// watches to say how many views fell on each day. One constant keeps the view
// route and the dashboard agreeing about what a view is.

/**
 * Reels had no ceiling of any kind: publishing, commenting, reacting and the
 * view ping were all governed only by the global tier limit. The view ping is
 * the one with no account behind it, so it is keyed by member where there is
 * one and by address where there is not, and set well above what continuous
 * scrolling produces — a reel is watched in seconds, not tenths of a second.
 */
const viewPingLimiter = createRateLimiter({
  max: 600,
  windowMs: 10 * 60 * 1000,
  skip: () => process.env.NODE_ENV === 'test' || !process.env.REDIS_URL,
  keyGenerator: (req) => `video:view:${(req as AuthRequest).user?.id || req.ip}`,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'You are doing that a lot. Take a short break and try again in a few minutes.',
    });
  },
});

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// Topics are stored lowercase without the hash so "#Career", "career" and
// "CAREER" are one tag. The same normalisation is applied to a filter.
function normalizeHashtag(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^#+/, '').toLowerCase() : '';
}

const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,64})/gu;

// Tags typed into a caption count as tags. Without this, a reel captioned
// "#salary talk" was only findable by topic if the uploader also filled in a
// separate tags field, which nobody did.
function hashtagsIn(...texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(HASHTAG_PATTERN)) {
      found.add(match[1].toLowerCase());
    }
  }
  return Array.from(found);
}

function mergeHashtags(explicit: string[], implied: string[]): string[] {
  const merged = new Set<string>();
  for (const tag of [...explicit, ...implied]) {
    const clean = normalizeHashtag(tag);
    if (clean) merged.add(clean);
  }
  return Array.from(merged).slice(0, 20);
}

// Every video list carries the viewer's own like and save state. Before this,
// the reels player only knew what it had persisted in the browser, so a like
// made on a phone showed as un-liked on a laptop and pressing the heart there
// was answered with "Already liked this video".
// A duet names the reel it answers: the player shows "Duet with @name" and
// links to it. One query for the page, like sounds.
//
// The original's author is named only to a viewer who may be shown her: a duet
// of a reel by a member in Safe Mode would otherwise carry her id and name into
// a list that her closed profile is meant to keep her out of. The same goes for
// an author on either side of a block with the viewer (the reply is in her list,
// the reel it answers is by someone she blocked), and for an original that has
// since been taken down or is not published: its title, picture and author are
// not for a list to carry once nobody can open it.
async function attachDuets<T extends { id: string; duetOfVideoId?: string | null }>(videos: T[], viewerId?: string) {
  const ids = Array.from(
    new Set(videos.map((v) => v.duetOfVideoId).filter((id): id is string => typeof id === 'string' && id.length > 0))
  );
  if (ids.length === 0) return videos.map((video) => ({ ...video, duetOf: null as null }));
  const originals = await prisma.video.findMany({
    where: { id: { in: ids }, ...PUBLIC_VIDEO_WHERE, ...(await visibleAuthorWhere(viewerId)) },
    select: { id: true, title: true, thumbnailUrl: true, author: { select: { id: true, displayName: true } } },
  });
  const byId = new Map(originals.map((o) => [o.id, o]));
  return videos.map((video) => ({
    ...video,
    duetOf: video.duetOfVideoId ? byId.get(video.duetOfVideoId) ?? null : null,
  }));
}

// Every list also carries the reel's sound (`sound`), looked up in one query,
// so the player can show and link it.
async function withViewerState<T extends { id: string; audioTrackId?: string | null; duetOfVideoId?: string | null }>(
  videos: T[],
  userId?: string
) {
  if (!userId || videos.length === 0) {
    return attachDuets(await attachSounds(videos.map((video) => ({ ...video, isLiked: false, isSaved: false }))), userId);
  }

  const ids = videos.map((video) => video.id);
  const [likes, saves] = await Promise.all([
    prisma.videoLike.findMany({
      where: { userId, videoId: { in: ids } },
      select: { videoId: true },
    }),
    prisma.videoSave.findMany({
      where: { userId, videoId: { in: ids } },
      select: { videoId: true },
    }),
  ]);
  const liked = new Set(likes.map((like) => like.videoId));
  const saved = new Set(saves.map((save) => save.videoId));

  return attachDuets(
    await attachSounds(
      videos.map((video) => ({
        ...video,
        isLiked: liked.has(video.id),
        isSaved: saved.has(video.id),
      }))
    ),
    userId
  );
}

const PUBLIC_VIDEO_WHERE = { status: 'PUBLISHED' as const, isHidden: false };

const AUTHOR_SELECT = {
  author: {
    select: { id: true, displayName: true, avatar: true, headline: true },
  },
};

const COMMENT_AUTHOR_SELECT = {
  author: { select: { id: true, displayName: true, avatar: true } },
};

// ===========================================
// VIDEO FEED
// ===========================================
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    // The explore tabs pick a feed; `type` stays available for VideoType filtering.
    const feed = typeof req.query.feed === 'string' ? req.query.feed : undefined;
    // The homepage topic circles open a slice of the feed by tag.
    const hashtag = normalizeHashtag(req.query.hashtag);
    // A sound's page opens the feed sliced to every reel that uses it.
    const sound = typeof req.query.sound === 'string' ? req.query.sound.trim() : '';

    const where: any = {
      status: 'PUBLISHED',
      isHidden: false,
    };

    if (type) {
      where.type = type;
    }

    if (hashtag) {
      where.hashtags = { has: hashtag };
    }

    if (sound) {
      where.audioTrackId = sound;
    }

    if (feed === 'following') {
      // A signed-out viewer follows nobody, so the tab is honestly empty for them
      // rather than silently falling back to the chronological feed.
      const following = req.user
        ? await prisma.follow.findMany({
            where: { followerId: req.user.id },
            select: { followingId: true },
          })
        : [];

      where.authorId = { in: following.map((f) => f.followingId) };
    }

    // "See fewer from this creator" applies to reels as it does to posts. The
    // preference is best-effort: a failed lookup must not take the feed down.
    //
    // This deliberately fails OPEN. If the preferences row cannot be read the
    // feed is served with nobody hidden, because the alternative — refusing the
    // feed, or hiding everyone — is worse for a member than one pass of it
    // showing a creator she had asked to see less of. That is a choice with a
    // cost, which is exactly why it has to be visible: the catch here was
    // empty, so a preferences table that had stopped answering looked
    // identical to a member who had muted no one. Note that muting is a
    // preference, not a safety control; a safety block belongs behind a rule
    // that fails closed, not this one.
    //
    // The safety block is the rule below, and until now it was missing: the
    // reels feed never read either block list, so a blocked abuser's reels
    // reached her For You tab and hers reached his. viewerContextFor reads
    // both stores (the platform-wide list and the DV safety profile's) in both
    // directions and is not best-effort: if it cannot be read the feed fails,
    // because an empty list standing in for one that could not be read is
    // exactly how he would come back. The author clause covers a member who
    // blocked the viewer from her DV safety page before that block reached
    // the platform-wide store. search.service's hiddenMemberWhere is not used
    // whole, because its hide-from-search clauses are about being found by
    // name: a woman who asked for that did not ask for her reels to stop
    // reaching the feed.
    if (req.user) {
      const viewerId = req.user.id;
      const [prefs, viewer] = await Promise.all([
        bestEffort('video.feed-blocked-creators', () =>
          prisma.userFeedPreferences.findUnique({
            where: { userId: viewerId },
            select: { blockedCreators: true },
          })
        ),
        viewerContextFor(viewerId),
      ]);
      const hidden = Array.from(new Set([...(prefs?.blockedCreators ?? []), ...viewer.blockedIds]));
      if (hidden.length > 0) {
        where.authorId = { ...(where.authorId ?? {}), notIn: hidden };
      }
      where.author = {
        ...(where.author ?? {}),
        NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: viewerId } } } },
      };
    }

    // A member in Safe Mode is discreet: her reels reach herself and her
    // verified connections, and no one else's feed, signed in or not. A reel
    // carries her name and picture, so leaving them in For You and Trending
    // named her to the strangers her closed profile is meant to be closed to.
    // This is not the hide-from-search rule the comment above sets aside: that
    // switch is about being found by name and Safe Mode is about being known.
    // The same goes for a member whose profile is private, or connections-only
    // and the viewer does not follow her: the settings page promises that her
    // posts appear in no one else's feed, and her reels are posts to her.
    where.AND = [...(where.AND ?? []), { author: authorVisibleWhere(req.user?.id) }];

    const orderBy: any[] =
      feed === 'trending'
        ? [{ engagementScore: 'desc' }, { viewCount: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const videos = await prisma.video.findMany({
      where,
      orderBy,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
      include: AUTHOR_SELECT,
    });

    const hasMore = videos.length > limit;
    const result = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor = hasMore ? result[result.length - 1]?.id : null;

    res.json({
      success: true,
      data: await withViewerState(result, req.user?.id),
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

// The literal-path routes below must stay above `/:id`, or Express hands
// "trending", "bookmarked" and friends to the lookup-by-id handler.

function parsePage(value: unknown): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

/**
 * The clause that keeps reels between two members who have blocked each other
 * out of each other's lists, and a discreet member's reels out of the lists of
 * everyone who is not her verified connection: the same rules the feed above
 * applies, for the trending, category and per-author lists that browse the
 * same reels, and a member whose profile is private (or connections-only, for
 * a viewer who does not follow her) out of the lists of everyone outside her
 * audience, as her posts are. A signed-out viewer has blocked nobody but is
 * still a stranger to a discreet or private member. Fails closed, like the feed.
 */
async function blockedAuthorsWhere(viewerId: string | undefined): Promise<Record<string, unknown>> {
  // One definition for every list of reels, kept in the search service beside
  // the rule for members: a sound's page asks the same question.
  return { ...(await visibleAuthorWhere(viewerId)) };
}

// Page-based listing shared by the trending, category and per-author routes.
async function listVideos(
  baseWhere: Record<string, unknown>,
  req: AuthRequest,
  orderBy: Record<string, string>[] = [{ createdAt: 'desc' }]
) {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit, 20, 50);
  const where = { AND: [baseWhere, await blockedAuthorsWhere(req.user?.id)] };

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: AUTHOR_SELECT,
    }),
    prisma.video.count({ where }),
  ]);

  return {
    data: await withViewerState(videos, req.user?.id),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ===========================================
// TRENDING
// ===========================================
const TRENDING_PERIOD_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

router.get('/trending', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : 'week';
    const days = TRENDING_PERIOD_DAYS[period];
    if (!days) {
      throw new ApiError(400, 'period must be one of: day, week, month');
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await listVideos(
      { ...PUBLIC_VIDEO_WHERE, publishedAt: { gte: since } },
      req,
      [{ engagementScore: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }]
    );

    res.json({ success: true, ...result, period });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAVED / BOOKMARKED VIDEOS
// ===========================================
router.get('/bookmarked', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const viewerId = member(req).id;
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20, 50);
    // A reel she saved stays in her list only while she may still be shown its
    // author. A member who has since blocked her, or gone into Safe Mode, drops
    // out of it, rather than her list going on carrying that member's name and
    // picture to the very person she closed her profile to.
    const where = { userId: viewerId, video: { AND: [PUBLIC_VIDEO_WHERE, await blockedAuthorsWhere(viewerId)] } };

    const [saves, total] = await Promise.all([
      prisma.videoSave.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { video: { include: AUTHOR_SELECT } },
      }),
      prisma.videoSave.count({ where }),
    ]);

    const videos = await withViewerState(
      saves.map((save) => save.video),
      viewerId
    );

    res.json({
      success: true,
      data: videos.map((video) => ({ ...video, isSaved: true })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// BROWSE BY CATEGORY
// ===========================================
const VIDEO_TYPES = ['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY'];

// A Video has no `category` column. The closest thing the model offers is
// `type`, so a category that names a VideoType filters on that; anything else
// is treated as a hashtag, which is how the rest of the app tags topics.
router.get('/category/:category', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const raw = req.params.category;
    const asType = raw.toUpperCase().replace(/-/g, '_');

    const where = VIDEO_TYPES.includes(asType)
      ? { ...PUBLIC_VIDEO_WHERE, type: asType as never }
      : { ...PUBLIC_VIDEO_WHERE, hashtags: { has: normalizeHashtag(raw) } };

    const result = await listVideos(where, req);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// A USER'S VIDEOS
// ===========================================
router.get('/user/:userId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    // Authors (and admins) see their own drafts and processing uploads; everyone
    // else sees only what is published.
    const isSelf = req.user?.id === userId || req.user?.role === 'ADMIN';
    const where = isSelf
      ? { authorId: userId, isHidden: false }
      : { ...PUBLIC_VIDEO_WHERE, authorId: userId };

    const result = await listVideos(where, req);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET VIDEO BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id },
      include: AUTHOR_SELECT,
    });

    const canViewUnpublished = req.user?.id === video?.authorId || req.user?.role === 'ADMIN';
    if (!video || video.isHidden || (video.status !== 'PUBLISHED' && !canViewUnpublished)) {
      throw new ApiError(404, 'Video not found');
    }

    // A shared link reaches past every list: a reel between two members who
    // have blocked each other is not found, the same answer as one that does
    // not exist, so the link does not confirm the block either.
    if (req.user && req.user.role !== 'ADMIN' && (await isBlockedEitherWay(req.user.id, video.authorId))) {
      throw new ApiError(404, 'Video not found');
    }

    // The same answer for a reel whose author the viewer may not be shown: a
    // discreet member's, for anyone who is neither her nor her verified
    // connection, and one whose profile is private, or connections-only for a
    // viewer who does not follow her. A link that confirmed the reel exists
    // would confirm who made it, and the lists above already leave it out.
    // Staff reach it through moderation.
    if (req.user?.role !== 'ADMIN' && !(await canViewAuthor(req.user?.id, video.authorId))) {
      throw new ApiError(404, 'Video not found');
    }

    const [decorated] = await withViewerState([video], req.user?.id);
    res.json({ success: true, data: decorated });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PROCESSING STATUS
// ===========================================
// The creator studio polls this after publishing (and listens for
// video:progress / video:processed on the socket) until the reel is live.
router.get('/:id/processing', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorId: true,
        status: true,
        processingProgress: true,
        processingError: true,
        processedAt: true,
        thumbnailUrl: true,
        videoUrl: true,
        duration: true,
        width: true,
        height: true,
        aspectRatio: true,
        audioTrackId: true,
      },
    });
    if (!video || (video.authorId !== req.user!.id && req.user!.role !== 'ADMIN')) {
      throw new ApiError(404, 'Video not found');
    }
    const { authorId: _authorId, ...status } = video;
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE VIDEO
// ===========================================
// The reel is created PROCESSING and handed to the pipeline, which probes it,
// makes a poster frame and a web rendition, registers its original sound and
// publishes it. See video-pipeline.service for what happens when ffmpeg is
// not available: the reel is still published, as uploaded.
router.post(
  '/',
  authenticate,
  postLimiter,
  [
    body('videoUrl').isString().notEmpty().isLength({ max: 2048 }),
    body('title').optional().isString().isLength({ max: CONTENT_LIMITS.videoTitle }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.videoDescription }),
    body('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    body('thumbnailUrl').optional().isString().isLength({ max: 2048 }),
    body('duration').optional().isInt({ min: 1 }),
    body('aspectRatio').optional().isString(),
    body('hashtags').optional().isArray(),
    body('mentionedUserIds').optional().isArray(),
    body('location').optional().isString(),
    body('audioTrackId').optional({ values: 'null' }).isString().isLength({ max: 64 }),
    body('duetOfVideoId').optional({ values: 'null' }).isString().isLength({ max: 64 }),
    body('captionsUrl').optional({ values: 'null' }).isString().isLength({ max: 2048 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const author = member(req);

      const title = normalizeOptionalUserText(req.body.title, {
        field: 'title',
        maxLength: CONTENT_LIMITS.videoTitle,
        allowEmpty: true,
      });
      const description = normalizeOptionalUserText(req.body.description, {
        field: 'description',
        maxLength: CONTENT_LIMITS.videoDescription,
        allowEmpty: true,
      });

      const audioTrackId: string | undefined = req.body.audioTrackId || undefined;
      if (audioTrackId) {
        await assertSoundExists(audioTrackId);
      }

      // A duet answers a published reel; the pipeline composes the two side
      // by side. The original has to be one anyone could watch.
      const duetOfVideoId: string | undefined = req.body.duetOfVideoId || undefined;
      if (duetOfVideoId) {
        const original = await prisma.video.findUnique({
          where: { id: duetOfVideoId },
          select: { id: true, authorId: true, status: true, isHidden: true },
        });
        if (!original || original.isHidden || original.status !== 'PUBLISHED') {
          throw new ApiError(400, 'That reel cannot be duetted');
        }
        // A duet carries the original's picture and sound into a reel of her own,
        // which is public. A reel she may not be shown (its author has blocked
        // her, is in Safe Mode, or has a private or connections-only profile she
        // is outside of) is not one she may re-publish, and the answer is the one
        // for a reel that is not there.
        if (!(await canViewAuthor(author.id, original.authorId))) {
          throw new ApiError(400, 'That reel cannot be duetted');
        }
      }

      const captionsUrl = req.body.captionsUrl
        ? normalizeSafeUrl(req.body.captionsUrl, { field: 'captionsUrl', allowRelativeUploads: true })
        : undefined;

      const videoUrl = normalizeSafeUrl(req.body.videoUrl, {
        field: 'videoUrl',
        allowRelativeUploads: true,
      });

      // The caption is published to the public feed as soon as the pipeline
      // finishes with the file, and it is the part of a reel that carries a
      // slur or somebody's address. Title and description go in one call
      // because they are read as one caption.
      const caption = [title, description].filter(Boolean).join('\n');
      if (caption) {
        await assertContentAllowed(caption, { kind: 'caption', userId: author.id });
      }

      const created = await prisma.video.create({
        data: {
          authorId: author.id,
          title,
          description,
          type: req.body.type,
          status: 'PROCESSING',
          videoUrl,
          sourceUrl: videoUrl,
          thumbnailUrl: req.body.thumbnailUrl
            ? normalizeSafeUrl(req.body.thumbnailUrl, { field: 'thumbnailUrl', allowRelativeUploads: true })
            : undefined,
          duration: req.body.duration,
          aspectRatio: req.body.aspectRatio,
          audioTrackId,
          duetOfVideoId,
          captionsUrl,
          hasAutoCaption: false,
          hashtags: mergeHashtags(
            normalizeStringList(req.body.hashtags, 'hashtags', 20, 64),
            hashtagsIn(title, description)
          ),
          mentionedUserIds: normalizeStringList(req.body.mentionedUserIds, 'mentionedUserIds', 50, 100),
          location: normalizeOptionalUserText(req.body.location, {
            field: 'location',
            maxLength: 120,
            allowEmpty: true,
          }),
        },
      });

      if (audioTrackId) {
        await recordSoundUse(audioTrackId);
      }
      if (duetOfVideoId) {
        await prisma.video.update({ where: { id: duetOfVideoId }, data: { duetCount: { increment: 1 } } });
      }
      enqueueVideoProcessing(created.id, author.id);

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE VIDEO
// ===========================================
router.patch(
  '/:id',
  authenticate,
  [
    body('title').optional().isString().isLength({ max: CONTENT_LIMITS.videoTitle }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.videoDescription }),
    body('status').optional().isIn(['PROCESSING', 'PUBLISHED', 'HIDDEN', 'REMOVED']),
    body('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    body('thumbnailUrl').optional().isString().isLength({ max: 2048 }),
    body('hashtags').optional().isArray(),
    body('mentionedUserIds').optional().isArray(),
    body('location').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const existing = await prisma.video.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, 'Video not found');
      }

      if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const data: any = {};

      if (req.body.title !== undefined) {
        data.title = normalizeOptionalUserText(req.body.title, {
          field: 'title',
          maxLength: CONTENT_LIMITS.videoTitle,
          allowEmpty: true,
        }) ?? null;
      }
      if (req.body.description !== undefined) {
        data.description = normalizeOptionalUserText(req.body.description, {
          field: 'description',
          maxLength: CONTENT_LIMITS.videoDescription,
          allowEmpty: true,
        }) ?? null;
      }
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.type !== undefined) data.type = req.body.type;
      if (req.body.thumbnailUrl !== undefined) {
        data.thumbnailUrl = normalizeSafeUrl(req.body.thumbnailUrl, {
          field: 'thumbnailUrl',
          allowRelativeUploads: true,
        });
      }
      if (req.body.hashtags !== undefined) {
        data.hashtags = mergeHashtags(
          normalizeStringList(req.body.hashtags, 'hashtags', 20, 64),
          []
        );
      }
      if (req.body.mentionedUserIds !== undefined) {
        data.mentionedUserIds = normalizeStringList(req.body.mentionedUserIds, 'mentionedUserIds', 50, 100);
      }
      if (req.body.location !== undefined) {
        data.location = normalizeOptionalUserText(req.body.location, {
          field: 'location',
          maxLength: 120,
          allowEmpty: true,
        }) ?? null;
      }

      // Recaptioning republishes the reel to everyone who can see it, so the
      // new wording is screened the way the original was. Clearing a caption
      // leaves nothing to screen.
      const recaption = [data.title, data.description].filter(Boolean).join('\n');
      if (recaption) {
        await assertContentAllowed(recaption, { kind: 'caption', userId: req.user!.id });
      }

      const updated = await prisma.video.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE VIDEO
// ===========================================
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.video.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, 'Video not found');
    }

    if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    // Likes, comments, saves and views all cascade from the Video row.
    await prisma.video.delete({ where: { id } });

    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
});

// A hidden or unpublished reel is treated as absent for everyone, and so is one
// by an author the viewer may not be shown: either side of a block, a member in
// Safe Mode she is not a verified connection of, a profile that is private or
// connections-only to someone outside it. The read route applies the same rule
// (GET /:id), but a like, a save, a comment or the comments list only asked
// whether the reel existed, so a woman's reel could be commented on, and its
// thread read, by an account she had blocked who held its id. Staff reach a reel
// through moderation. A block or Safe Mode lookup that fails fails the request.
// `viewer` is whoever is asking, or undefined for a signed-out visitor, who is
// still a stranger to a private or discreet author.
async function loadPublicVideo(id: string, viewer?: { id: string; role?: string }) {
  const video = await loadPublishedVideo(id);
  if (viewer?.role !== 'ADMIN' && !(await canViewAuthor(viewer?.id, video.authorId))) {
    throw new ApiError(404, 'Video not found');
  }
  return video;
}

// Only that the reel exists and is published: for the one route that answers
// nothing about the reel and is called on every watch.
async function loadPublishedVideo(id: string) {
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.isHidden || video.status !== 'PUBLISHED') {
    throw new ApiError(404, 'Video not found');
  }
  return video;
}

// ===========================================
// LIKE VIDEO
// ===========================================
router.post('/:id/like', authenticate, reactionLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const video = await loadPublicVideo(id, req.user);

    // Idempotent: the player toggles optimistically, and a second tap or a
    // stale local state used to get a 400 that reverted a like the server
    // already held.
    const existing = await prisma.videoLike.findUnique({
      where: { videoId_userId: { videoId: id, userId: req.user!.id } },
    });

    if (existing) {
      res.json({ success: true, message: 'Video liked', liked: true });
      return;
    }

    await prisma.videoLike.create({
      data: { videoId: id, userId: req.user!.id },
    });

    await prisma.video.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });

    await notifySocial({
      recipientId: video.authorId,
      actorId: req.user!.id,
      type: 'LIKE',
      title: 'New like',
      message: (name) => `${name} liked your reel`,
      link: socialLinks.video(id),
    });

    res.json({ success: true, message: 'Video liked', liked: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNLIKE VIDEO
// ===========================================
router.delete('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.videoLike.deleteMany({
      where: { videoId: id, userId: req.user!.id },
    });

    if (deleted.count > 0) {
      await prisma.video.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Like removed', liked: false });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// COMMENTS
// ===========================================
router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseLimit(req.query.limit, 20, 50);

    // The thread of a reel she may not open is not hers to read either: the
    // same answer as the reel (a hidden, unpublished or closed-off reel, or one
    // by someone across a block, is not found). This list was open to anyone who
    // held a reel's id.
    await loadPublicVideo(id, req.user);

    // And the comments of someone she has blocked, or who has blocked her, in
    // either store, are left out in the query, so a page is full: a woman's own
    // thread was a place the person she blocked went on speaking to her. Staff
    // read the whole thread, as on a post.
    const blocked = req.user && req.user.role !== 'ADMIN' ? await blockedEitherWayIds(req.user.id) : [];
    const notBlocked = blocked.length > 0 ? { authorId: { notIn: blocked } } : {};

    // A pinned comment is the creator's chosen opener, so it leads.
    const comments = await prisma.videoComment.findMany({
      where: { videoId: id, parentId: null, isHidden: false, ...notBlocked },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        ...COMMENT_AUTHOR_SELECT,
        replies: {
          where: { isHidden: false, ...notBlocked },
          include: COMMENT_AUTHOR_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/comments',
  authenticate,
  commentLimiter,
  [
    body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.comment }).withMessage('Comment max 2000 characters'),
    body('parentId').optional().isString().isLength({ max: 100 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const viewer = member(req);
      const video = await loadPublicVideo(id, viewer);

      // The per-member limit above is across everything a member does; this is
      // across what she does to one member. Her own reel is never limited, and
      // the count is the one comments under that member's posts share.
      if (video.authorId !== viewer.id && !(await withinTargetLimit('comment', viewer.id, video.authorId))) {
        throw new ApiError(429, 'You have commented a lot on reels by this member in the last hour. Please give the conversation a rest for a while.');
      }

      const parentId = typeof req.body.parentId === 'string' && req.body.parentId.trim()
        ? req.body.parentId.trim()
        : undefined;

      let parentAuthorId: string | undefined;
      if (parentId) {
        const parent = await prisma.videoComment.findUnique({
          where: { id: parentId },
          select: { videoId: true, isHidden: true, authorId: true, parentId: true },
        });

        if (!parent || parent.videoId !== id || parent.isHidden) {
          throw new ApiError(400, 'Invalid parent comment');
        }
        // Threads are one level deep; a reply to a reply hangs off the same
        // top-level comment so the thread never nests out of view.
        parentAuthorId = parent.authorId;
        if (parent.parentId) {
          req.body.parentId = parent.parentId;
        }
      }

      const resolvedParentId = parentId ? String(req.body.parentId) : undefined;

      const content = normalizeUserText(req.body.content, {
        field: 'content',
        maxLength: CONTENT_LIMITS.comment,
      });

      // Screened once the reel and the parent comment are known to be real, and
      // before the row exists, so a comment a provider refuses is never shown
      // under somebody's reel and never notifies her that it arrived.
      await assertContentAllowed(content, { kind: 'comment', userId: viewer.id });

      const comment = await prisma.videoComment.create({
        data: {
          videoId: id,
          authorId: viewer.id,
          content,
          parentId: resolvedParentId,
        },
        include: COMMENT_AUTHOR_SELECT,
      });

      await prisma.video.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      });

      await notifySocial({
        recipientId: video.authorId,
        actorId: viewer.id,
        type: 'COMMENT',
        title: 'New comment',
        message: (name) => `${name} commented on your reel`,
        link: socialLinks.video(id),
      });

      if (parentAuthorId && parentAuthorId !== video.authorId) {
        await notifySocial({
          recipientId: parentAuthorId,
          actorId: viewer.id,
          type: 'COMMENT',
          title: 'New reply',
          message: (name) => `${name} replied to your comment`,
          link: socialLinks.video(id),
        });
      }

      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }
);

// The creator of a reel can pin one comment to the top of its thread. Only
// the creator (or an admin): a pin is an editorial act on their own video.
router.patch('/:id/comments/:commentId/pin', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id, commentId } = req.params;
    const video = await loadPublicVideo(id, req.user);

    if (video.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Only the creator can pin a comment');
    }

    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId },
      select: { id: true, videoId: true, isPinned: true, parentId: true, isHidden: true },
    });
    if (!comment || comment.videoId !== id || comment.isHidden) {
      throw new ApiError(404, 'Comment not found');
    }
    if (comment.parentId) {
      throw new ApiError(400, 'Only a top-level comment can be pinned');
    }

    // One pin per reel. Pinning a second comment unpins the first rather than
    // leaving two rows fighting for the top of the thread.
    const nextPinned = !comment.isPinned;
    if (nextPinned) {
      await prisma.videoComment.updateMany({
        where: { videoId: id, isPinned: true },
        data: { isPinned: false },
      });
    }

    const updated = await prisma.videoComment.update({
      where: { id: commentId },
      data: { isPinned: nextPinned },
      include: COMMENT_AUTHOR_SELECT,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// A comment can be removed by whoever wrote it, by the creator of the reel it
// sits on, or by an admin. Replies go with it.
router.delete('/:id/comments/:commentId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id, commentId } = req.params;

    const [video, comment] = await Promise.all([
      prisma.video.findUnique({ where: { id }, select: { id: true, authorId: true } }),
      prisma.videoComment.findUnique({
        where: { id: commentId },
        select: { id: true, videoId: true, authorId: true },
      }),
    ]);

    if (!video || !comment || comment.videoId !== id) {
      throw new ApiError(404, 'Comment not found');
    }

    const isAuthor = comment.authorId === req.user!.id;
    const isCreator = video.authorId === req.user!.id;
    if (!isAuthor && !isCreator && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Not authorized');
    }

    // Replies cascade from the parent row, so the count has to come off for
    // them too or the reel keeps advertising comments nobody can open.
    const replyCount = await prisma.videoComment.count({ where: { parentId: commentId } });

    await prisma.videoComment.delete({ where: { id: commentId } });

    await prisma.video.update({
      where: { id },
      data: { commentCount: { decrement: 1 + replyCount } },
    });

    res.json({ success: true, message: 'Comment deleted', removed: 1 + replyCount });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAVE VIDEO
// ===========================================
router.post('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await loadPublicVideo(id, req.user);

    const existing = await prisma.videoSave.findUnique({
      where: { videoId_userId: { videoId: id, userId: req.user!.id } },
    });

    if (existing) {
      res.json({ success: true, message: 'Video saved', saved: true });
      return;
    }

    await prisma.videoSave.create({
      data: { videoId: id, userId: req.user!.id },
    });

    await prisma.video.update({
      where: { id },
      data: { saveCount: { increment: 1 } },
    });

    res.json({ success: true, message: 'Video saved', saved: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.videoSave.deleteMany({
      where: { videoId: id, userId: req.user!.id },
    });

    if (deleted.count > 0) {
      await prisma.video.update({
        where: { id },
        data: { saveCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Save removed', saved: false });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RECORD VIEW
// ===========================================
router.post(
  '/:id/view',
  optionalAuth,
  viewPingLimiter,
  [
    body('watchDuration').isInt({ min: 1 }),
    body('completionPct').isFloat({ min: 0, max: 100 }),
    body('source').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      // Not held to the viewer's audience as the reel's other routes are: this
      // is a ping that returns nothing of the reel, it arrives for every watch,
      // and a watch is of a reel the player already showed her.
      const video = await loadPublishedVideo(id);
      const viewerId = req.user?.id;

      // viewCount is not analytics. It is printed on the reel, it is the
      // second sort key on the trending tab, and a creator's standing is read
      // off it. It used to be incremented once per call on an endpoint that
      // needs no account and had no ceiling, so a loop put any reel at the top
      // of trending in a minute, and a creator refreshing her own page watched
      // her own numbers climb.
      //
      // It now counts distinct viewers rather than calls: the author's own
      // watches never count, an unauthenticated watch is recorded but not
      // counted because there is nobody to count it as, and a signed-in member
      // counts once per reel per COUNTED_VIEW_WINDOW_MS however many times she
      // rewatches it. Checked before the row below is written, so this watch
      // is not mistaken for an earlier one.
      const countable =
        !!viewerId &&
        viewerId !== video.authorId &&
        !(await prisma.videoView.findFirst({
          where: {
            videoId: id,
            userId: viewerId,
            createdAt: { gte: new Date(Date.now() - COUNTED_VIEW_WINDOW_MS) },
          },
          select: { id: true },
        }));

      // Every watch is still recorded whether or not it counts: watch duration
      // and completion are the creator's real analytics, and a second watch of
      // the same reel is a second watch.
      await prisma.videoView.create({
        data: {
          videoId: id,
          userId: viewerId,
          watchDuration: Number(req.body.watchDuration),
          completionPct: Number(req.body.completionPct),
          source: normalizeOptionalUserText(req.body.source, {
            field: 'source',
            maxLength: 80,
            allowEmpty: true,
          }),
        },
      });

      if (countable) {
        await prisma.video.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        });
      }

      res.json({ success: true, message: 'View recorded' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
