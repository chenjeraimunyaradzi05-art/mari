/**
 * The marketing hub and the go-to-market board, for admins. Campaigns with a
 * channel and a budget; leads with a source, a status and an owner; the
 * funnel counted from the platform's own tables; launch initiatives on a
 * board. Mounted at /api/admin/marketing, admin-only throughout.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

const CHANNELS = ['EMAIL', 'SOCIAL', 'PAID_SOCIAL', 'SEARCH', 'PARTNER', 'EVENT', 'PRESS', 'REFERRAL', 'IN_APP', 'INFLUENCER'];
const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED'];
const LEAD_SOURCES = ['WAITLIST', 'CONTACT_SALES', 'PARTNER', 'PRESS', 'INFLUENCER', 'EVENT', 'REFERRAL', 'WEBSITE', 'IMPORT', 'OTHER'];
const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const INITIATIVE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const INITIATIVE_AREAS = ['launch', 'channels', 'funnel', 'partnerships', 'press', 'product'];

const DAY = 24 * 60 * 60 * 1000;

function bad(req: AuthRequest) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array()[0].msg);
  }
}

const str = (v: unknown, max: number): string | null | undefined => (v === undefined ? undefined : typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown, name: string): Date | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `${name} must be a date`);
  return d;
};
const int = (v: unknown): number | null | undefined => (v === undefined ? undefined : v === null || v === '' ? null : Math.max(0, Math.round(Number(v))));

// ---------------------------------------------------------------- overview and funnel
router.get('/overview', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const since30 = new Date(Date.now() - 30 * DAY);
    const [registered30d, verified30d, active30d, paid, waitlist, leadsBySource, leadsByStatus, campaignsActive, campaignsTotal, referralsTotal, referralsCompleted, referralsRewarded] =
      await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: since30 } } }),
        prisma.user.count({ where: { createdAt: { gte: since30 }, emailVerified: true } }),
        prisma.user.count({ where: { lastLoginAt: { gte: since30 } } }),
        prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, tier: { not: 'FREE' } } }),
        prisma.lead.count({ where: { source: 'WAITLIST' } }),
        prisma.lead.groupBy({ by: ['source'], _count: { _all: true } }),
        prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.marketingCampaign.count({ where: { status: 'ACTIVE' } }),
        prisma.marketingCampaign.count(),
        prisma.referral.count(),
        prisma.referral.count({ where: { status: 'COMPLETED' } }),
        prisma.referral.count({ where: { rewardGranted: true } }),
      ]);

    res.json({
      success: true,
      data: {
        funnel: { waitlist, registered30d, verified30d, active30d, paid },
        leads: {
          bySource: Object.fromEntries(leadsBySource.map((r) => [r.source, r._count._all])),
          byStatus: Object.fromEntries(leadsByStatus.map((r) => [r.status, r._count._all])),
        },
        campaigns: { active: campaignsActive, total: campaignsTotal },
        referrals: { total: referralsTotal, completed: referralsCompleted, rewarded: referralsRewarded },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- campaigns
router.get('/campaigns', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && CAMPAIGN_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const campaigns = await prisma.marketingCampaign.findMany({
      where: status ? { status: status as any } : {},
      include: { _count: { select: { leads: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
});

const campaignValidators = [
  body('name').optional().isString().trim().notEmpty().isLength({ max: 160 }),
  body('channel').optional().isIn(CHANNELS),
  body('status').optional().isIn(CAMPAIGN_STATUSES),
  body('objective').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
  body('audience').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  body('notes').optional({ values: 'null' }).isString().isLength({ max: 4000 }),
  body('utmCampaign').optional({ values: 'null' }).isString().isLength({ max: 100 }),
];

function campaignData(b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const name = str(b.name, 160);
  if (name) data.name = name;
  if (typeof b.channel === 'string') data.channel = b.channel;
  if (typeof b.status === 'string') data.status = b.status;
  for (const key of ['objective', 'audience', 'notes'] as const) {
    const v = str(b[key], key === 'notes' ? 4000 : 2000);
    if (v !== undefined) data[key] = v;
  }
  const utm = str(b.utmCampaign, 100);
  if (utm !== undefined) data.utmCampaign = utm ? utm.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') : null;
  for (const key of ['budgetCents', 'spentCents'] as const) {
    const v = int(b[key]);
    if (v !== undefined) data[key] = v;
  }
  for (const key of ['startsAt', 'endsAt'] as const) {
    const v = date(b[key], key);
    if (v !== undefined) data[key] = v;
  }
  return data;
}

router.post('/campaigns', ...adminOnly, campaignValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const data = campaignData(req.body ?? {});
    if (!data.name || !data.channel) {
      throw new ApiError(400, 'A campaign needs a name and a channel');
    }
    const campaign = await prisma.marketingCampaign.create({ data: { ...data, createdById: req.user!.id } as any });
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

router.patch('/campaigns/:id', ...adminOnly, campaignValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const existing = await prisma.marketingCampaign.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Campaign not found');
    const campaign = await prisma.marketingCampaign.update({ where: { id: req.params.id }, data: campaignData(req.body ?? {}) as any });
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

router.delete('/campaigns/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.marketingCampaign.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Campaign not found');
    await prisma.marketingCampaign.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- leads
router.get('/leads', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const source = typeof req.query.source === 'string' && LEAD_SOURCES.includes(req.query.source) ? req.query.source : undefined;
    const status = typeof req.query.status === 'string' && LEAD_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const leads = await prisma.lead.findMany({
      where: {
        ...(source ? { source: source as any } : {}),
        ...(status ? { status: status as any } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { organisation: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { campaign: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ success: true, data: leads });
  } catch (error) {
    next(error);
  }
});

const leadValidators = [
  body('email').optional().isEmail().isLength({ max: 254 }),
  body('source').optional().isIn(LEAD_SOURCES),
  body('status').optional().isIn(LEAD_STATUSES),
  body('name').optional({ values: 'null' }).isString().isLength({ max: 120 }),
  body('organisation').optional({ values: 'null' }).isString().isLength({ max: 160 }),
  body('role').optional({ values: 'null' }).isString().isLength({ max: 120 }),
  body('notes').optional({ values: 'null' }).isString().isLength({ max: 4000 }),
  body('interest').optional({ values: 'null' }).isString().isLength({ max: 200 }),
  body('campaignId').optional({ values: 'null' }).isString(),
  body('ownerId').optional({ values: 'null' }).isString(),
];

function leadData(b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof b.email === 'string') data.email = b.email.trim().toLowerCase();
  if (typeof b.source === 'string') data.source = b.source;
  if (typeof b.status === 'string') data.status = b.status;
  for (const key of ['name', 'organisation', 'role', 'interest', 'notes', 'campaignId', 'ownerId'] as const) {
    const v = str(b[key], key === 'notes' ? 4000 : 200);
    if (v !== undefined) data[key] = v;
  }
  const contacted = date(b.lastContactedAt, 'lastContactedAt');
  if (contacted !== undefined) data.lastContactedAt = contacted;
  return data;
}

router.post('/leads', ...adminOnly, leadValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const data = leadData(req.body ?? {});
    if (!data.email) throw new ApiError(400, 'A lead needs an email');
    const source = (data.source as string) || 'OTHER';
    const lead = await prisma.lead.upsert({
      where: { email_source: { email: data.email as string, source: source as any } },
      create: { ...data, source } as any,
      update: data as any,
    });
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Rows pasted from a spreadsheet; the same email and source twice is one lead.
router.post('/leads/import', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : [];
    if (rows.length === 0) throw new ApiError(400, 'rows is required');
    const source = typeof req.body?.source === 'string' && LEAD_SOURCES.includes(req.body.source) ? req.body.source : 'IMPORT';
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const email = typeof row?.email === 'string' ? row.email.trim().toLowerCase() : '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        skipped += 1;
        continue;
      }
      await prisma.lead.upsert({
        where: { email_source: { email, source: source as any } },
        create: { email, source: source as any, name: str(row.name, 120) ?? null, organisation: str(row.organisation, 160) ?? null, role: str(row.role, 120) ?? null },
        update: { ...(str(row.name, 120) ? { name: str(row.name, 120) } : {}), ...(str(row.organisation, 160) ? { organisation: str(row.organisation, 160) } : {}) },
      });
      imported += 1;
    }
    logger.info('Leads imported', { imported, skipped, source, by: req.user!.id });
    res.json({ success: true, data: { imported, skipped } });
  } catch (error) {
    next(error);
  }
});

router.patch('/leads/:id', ...adminOnly, leadValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!existing) throw new ApiError(404, 'Lead not found');
    const data = leadData(req.body ?? {});
    // Moving to "contacted" stamps the time unless the caller gave one.
    if (data.status === 'CONTACTED' && data.lastContactedAt === undefined && existing.status !== 'CONTACTED') {
      data.lastContactedAt = new Date();
    }
    if (data.status === 'CONVERTED' && typeof req.body?.convertedUserId === 'string') {
      data.convertedUserId = req.body.convertedUserId;
    }
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: data as any });
    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

router.delete('/leads/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Lead not found');
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- go-to-market initiatives
router.get('/initiatives', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const initiatives = await prisma.gtmInitiative.findMany({ orderBy: [{ area: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] });
    res.json({ success: true, data: initiatives });
  } catch (error) {
    next(error);
  }
});

const initiativeValidators = [
  body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
  body('area').optional().isIn(INITIATIVE_AREAS),
  body('status').optional().isIn(INITIATIVE_STATUSES),
  body('ownerId').optional({ values: 'null' }).isString(),
  body('position').optional().isInt({ min: 0 }),
];

function initiativeData(b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const title = str(b.title, 200);
  if (title) data.title = title;
  const description = str(b.description, 2000);
  if (description !== undefined) data.description = description;
  if (typeof b.area === 'string') data.area = b.area;
  if (typeof b.status === 'string') {
    data.status = b.status;
    data.completedAt = b.status === 'DONE' ? new Date() : null;
  }
  const owner = str(b.ownerId, 64);
  if (owner !== undefined) data.ownerId = owner;
  const due = date(b.dueAt, 'dueAt');
  if (due !== undefined) data.dueAt = due;
  if (typeof b.position === 'number') data.position = b.position;
  return data;
}

router.post('/initiatives', ...adminOnly, initiativeValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const data = initiativeData(req.body ?? {});
    if (!data.title) throw new ApiError(400, 'An initiative needs a title');
    const area = (data.area as string) || 'launch';
    const position = await prisma.gtmInitiative.count({ where: { area } });
    const initiative = await prisma.gtmInitiative.create({ data: { ...data, area, position, status: 'PLANNED' } as any });
    res.status(201).json({ success: true, data: initiative });
  } catch (error) {
    next(error);
  }
});

router.patch('/initiatives/:id', ...adminOnly, initiativeValidators, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    bad(req);
    const existing = await prisma.gtmInitiative.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Initiative not found');
    const initiative = await prisma.gtmInitiative.update({ where: { id: req.params.id }, data: initiativeData(req.body ?? {}) as any });
    res.json({ success: true, data: initiative });
  } catch (error) {
    next(error);
  }
});

router.delete('/initiatives/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.gtmInitiative.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Initiative not found');
    await prisma.gtmInitiative.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
