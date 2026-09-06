/**
 * The blog, as the public reads it.
 *
 * Only published articles whose publish time has passed are served here.
 * Drafts, archived pieces and scheduled ones stay behind the admin routes.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { parsePagination } from '../utils/pagination';

const router = Router();

export const AUTHOR_SELECT = { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true } as const;

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  tags: true,
  publishedAt: true,
  author: { select: AUTHOR_SELECT },
} as const;

/** What the public may see: published, and not before its time. */
export function publicWhere(now = new Date()) {
  return { status: 'PUBLISHED' as const, publishedAt: { lte: now } };
}

/**
 * GET /api/blog?tag=&q=&page=&limit=
 * Published articles, newest first.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const where: Record<string, unknown> = { ...publicWhere() };
    if (tag) where.tags = { has: tag };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.article.findMany({ where, select: LIST_SELECT, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.article.count({ where }),
    ]);

    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/blog/tags
 * Every tag on a published article, with how many carry it.
 */
router.get('/tags', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.article.findMany({ where: publicWhere(), select: { tags: true } });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const data = Array.from(counts, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/blog/:slug
 * One published article, with its body. Reading it counts a view.
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await prisma.article.findFirst({
      where: { slug: req.params.slug, ...publicWhere() },
      include: { author: { select: AUTHOR_SELECT } },
    });
    if (!article) throw new ApiError(404, 'No such article');

    // The read is counted without holding the response for it.
    prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

export default router;
