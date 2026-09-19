/**
 * Admin grant programmes
 *
 * The grants directory (/grants, /dashboard/grants and the strategy page's
 * ranked matches) reads the Grant table, and until this router existed nothing
 * could write to it: no create route, no admin screen and, deliberately, no
 * seed. Real programmes change and a seeded list would go stale and mislead a
 * founder into a wasted application.
 *
 * So a programme is entered here by staff from the funder's own published
 * page, and the official application link is required for that reason: every
 * listing points back at the page it was taken from. Every field collected is
 * one the match scorers read (industries, stages, regions, the funding band,
 * the closing date or rolling flag, and the tags the strategy ranking uses
 * for women-led, First Nations and regional programmes).
 *
 * Guards are attached per route rather than with router.use so this router
 * can sit in front of admin.routes.ts without re-authenticating every
 * /api/admin request it does not handle. The application review routes
 * (GET/PATCH /admin/grants/applications...) stay in admin.routes.ts; nothing
 * here registers a GET /grants/:id, so that literal path is not shadowed.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

export const GRANT_PROVIDER_TYPES = ['FEDERAL', 'STATE', 'PRIVATE_FOUNDATION', 'CORPORATE', 'INTERNATIONAL'] as const;

/**
 * A full http(s) link and nothing else. The application URL is rendered as a
 * link the member clicks, so a javascript: or data: value here would run in
 * her browser; anything that is not http(s) is refused rather than sanitised.
 */
export const httpUrl = z
  .string()
  .trim()
  .min(1, 'is required')
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be a full http(s) link to the funder\'s page');

const blankToNull = (value: unknown) => (value === '' || value === undefined || value === null ? null : value);

const optionalMoney = z.preprocess(blankToNull, z.coerce.number().min(0).max(1_000_000_000).nullable());
const optionalDate = z.preprocess(blankToNull, z.coerce.date().nullable());
const tagList = z.array(z.string().trim().min(1).max(60)).max(30);

const programmeFields = {
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(4000),
  provider: z.string().trim().min(2).max(160),
  providerType: z.enum(GRANT_PROVIDER_TYPES),
  minFunding: optionalMoney.optional(),
  maxFunding: optionalMoney.optional(),
  industries: tagList.optional(),
  stages: tagList.optional(),
  regions: tagList.optional(),
  tags: tagList.optional(),
  // Free text from the funder's eligibility section, kept as it was written.
  requirements: z.string().trim().max(4000).nullable().optional(),
  applicationUrl: httpUrl,
  deadline: optionalDate.optional(),
  isRolling: z.boolean().optional(),
};

type ProgrammeShape = {
  minFunding?: number | null;
  maxFunding?: number | null;
  deadline?: Date | null;
  isRolling?: boolean;
};

/** The checks that need more than one field: a sensible band and a usable closing date. */
function checkProgramme(data: ProgrammeShape, ctx: z.RefinementCtx, creating: boolean) {
  if (data.minFunding != null && data.maxFunding != null && data.minFunding > data.maxFunding) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxFunding'], message: 'must be at least the minimum' });
  }
  if (data.deadline && Number.isNaN(data.deadline.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deadline'], message: 'is not a date' });
    return;
  }
  // A programme that has already closed is not something to list as open;
  // it goes in when the next round opens. Editing an existing listing is
  // allowed to record the date that passed.
  if (creating && !data.isRolling && data.deadline && data.deadline.getTime() < Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deadline'], message: 'has already passed; list the programme when its next round opens' });
  }
}

const createSchema = z.object(programmeFields).superRefine((data, ctx) => checkProgramme(data, ctx, true));

const updateSchema = z
  .object({ ...programmeFields, isActive: z.boolean() })
  .partial()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nothing to change' });
    }
    checkProgramme(data, ctx, false);
  });

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

const dedupe = (tags: string[] | undefined) => (tags ? Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))) : undefined);

/** What is stored for the requirements column: the text as written, or nothing. */
const requirementsJson = (text: string | null | undefined) => (text === undefined ? undefined : text ? { text } : Prisma.DbNull);

const programmeSelect = {
  id: true,
  name: true,
  description: true,
  provider: true,
  providerType: true,
  minFunding: true,
  maxFunding: true,
  industries: true,
  stages: true,
  regions: true,
  requirements: true,
  applicationUrl: true,
  deadline: true,
  isRolling: true,
  tags: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { applications: true } },
} as const;

// ============================================================================
// LIST — every programme, paused ones included
// ============================================================================

router.get('/grants', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const grants = await prisma.grant.findMany({
      where: active === undefined ? {} : { isActive: active },
      select: programmeSelect,
      orderBy: [{ isActive: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    res.json({ success: true, data: grants });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CREATE — from the funder's published page
// ============================================================================

router.post('/grants', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(createSchema, req.body);

    const duplicate = await prisma.grant.findFirst({
      where: {
        name: { equals: input.name, mode: 'insensitive' },
        provider: { equals: input.provider, mode: 'insensitive' },
      },
      select: { id: true, isActive: true },
    });
    if (duplicate) {
      throw new ApiError(409, duplicate.isActive ? 'That programme is already listed' : 'That programme is already listed but paused; reactivate it instead');
    }

    const grant = await prisma.grant.create({
      data: {
        name: input.name,
        description: input.description,
        provider: input.provider,
        providerType: input.providerType,
        minFunding: input.minFunding ?? null,
        maxFunding: input.maxFunding ?? null,
        industries: dedupe(input.industries) ?? [],
        stages: dedupe(input.stages) ?? [],
        regions: dedupe(input.regions) ?? [],
        tags: dedupe(input.tags) ?? [],
        requirements: requirementsJson(input.requirements),
        applicationUrl: input.applicationUrl,
        isRolling: input.isRolling ?? false,
        deadline: input.isRolling ? null : (input.deadline ?? null),
        isActive: true,
      },
      select: programmeSelect,
    });

    logger.info('Grant programme listed', { grantId: grant.id, by: req.user!.id });
    res.status(201).json({ success: true, data: grant });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// UPDATE — edit, pause or reactivate
// ============================================================================

router.patch('/grants/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(updateSchema, req.body);

    const existing = await prisma.grant.findUnique({ where: { id: req.params.id }, select: { id: true, isRolling: true } });
    if (!existing) {
      throw new ApiError(404, 'Programme not found');
    }

    // Marking a programme rolling clears any date it carried, so the two
    // never disagree on the public card.
    const rolling = input.isRolling ?? existing.isRolling;
    const deadline = rolling ? null : input.deadline;

    const grant = await prisma.grant.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.provider !== undefined && { provider: input.provider }),
        ...(input.providerType !== undefined && { providerType: input.providerType }),
        ...(input.minFunding !== undefined && { minFunding: input.minFunding }),
        ...(input.maxFunding !== undefined && { maxFunding: input.maxFunding }),
        ...(input.industries !== undefined && { industries: dedupe(input.industries) }),
        ...(input.stages !== undefined && { stages: dedupe(input.stages) }),
        ...(input.regions !== undefined && { regions: dedupe(input.regions) }),
        ...(input.tags !== undefined && { tags: dedupe(input.tags) }),
        ...(input.requirements !== undefined && { requirements: requirementsJson(input.requirements) }),
        ...(input.applicationUrl !== undefined && { applicationUrl: input.applicationUrl }),
        ...(input.isRolling !== undefined && { isRolling: input.isRolling }),
        ...(deadline !== undefined && { deadline }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: programmeSelect,
    });

    logger.info('Grant programme updated', { grantId: grant.id, by: req.user!.id, fields: Object.keys(input) });
    res.json({ success: true, data: grant });
  } catch (error) {
    next(error);
  }
});

export default router;
