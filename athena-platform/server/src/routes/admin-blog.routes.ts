/**
 * The blog, as staff write it: drafts, publishing, archiving.
 *
 * A slug is made from the title unless one is given, and is kept unique by
 * a numeric suffix. Publishing stamps the publish time if none is set, so
 * an article can also be scheduled by giving a future time.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AUTHOR_SELECT } from './blog.routes';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
type Status = (typeof STATUSES)[number];

/** Lower-case, ASCII, hyphenated, at most 80 characters. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Tags are lower-case slugs, at most ten, none empty, none repeated. */
function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = slugify(raw).slice(0, 40);
    if (tag) seen.add(tag);
    if (seen.size >= 10) break;
  }
  return Array.from(seen);
}

/** The given slug, or the next free one with a numeric suffix. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || 'article';
  for (let n = 1; n < 100; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === exceptId) return candidate;
  }
  throw new ApiError(409, 'Could not find a free slug for that title');
}

const validators = (partial: boolean) => [
  (partial ? body('title').optional() : body('title')).isString().trim().isLength({ min: 3, max: 200 }).withMessage('A title of 3 to 200 characters is needed'),
  (partial ? body('body').optional() : body('body')).isString().isLength({ min: 1, max: 200000 }).withMessage('The article needs a body'),
  body('excerpt').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('slug').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body('coverImage').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('tags').optional().isArray({ max: 10 }),
  body('status').optional().isIn(STATUSES as unknown as string[]),
  body('publishedAt').optional({ nullable: true }).isISO8601(),
];

function check(req: AuthRequest) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);
}

/** GET /api/admin/blog?status= — every article, most recently edited first. */
router.get('/', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && (STATUSES as readonly string[]).includes(req.query.status) ? (req.query.status as Status) : undefined;
    const items = await prisma.article.findMany({
      where: status ? { status } : {},
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

/** POST /api/admin/blog — a new article, a draft unless told otherwise. */
router.post('/', ...adminOnly, validators(false), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    check(req);
    const status: Status = req.body.status ?? 'DRAFT';
    const publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : status === 'PUBLISHED' ? new Date() : null;
    const article = await prisma.article.create({
      data: {
        title: req.body.title,
        slug: await uniqueSlug(req.body.slug || req.body.title),
        excerpt: req.body.excerpt || null,
        body: req.body.body,
        coverImage: req.body.coverImage || null,
        tags: cleanTags(req.body.tags),
        status,
        publishedAt,
        authorId: req.user!.id,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/blog/:id — edit, publish, schedule, archive. */
router.patch('/:id', ...adminOnly, validators(true), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    check(req);
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'No such article');

    const data: Record<string, unknown> = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.body !== undefined) data.body = req.body.body;
    if (req.body.excerpt !== undefined) data.excerpt = req.body.excerpt || null;
    if (req.body.coverImage !== undefined) data.coverImage = req.body.coverImage || null;
    if (req.body.tags !== undefined) data.tags = cleanTags(req.body.tags);
    if (req.body.slug !== undefined && req.body.slug && slugify(req.body.slug) !== existing.slug) {
      data.slug = await uniqueSlug(req.body.slug, existing.id);
    }
    if (req.body.publishedAt !== undefined) data.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : null;
    if (req.body.status !== undefined) {
      data.status = req.body.status;
      if (req.body.status === 'PUBLISHED' && !existing.publishedAt && data.publishedAt === undefined) data.publishedAt = new Date();
    }

    const article = await prisma.article.update({ where: { id: existing.id }, data, include: { author: { select: AUTHOR_SELECT } } });
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/admin/blog/:id — gone for good; archive instead to keep it. */
router.delete('/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'No such article');
    await prisma.article.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
