import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import {
  ASSESSING_BODIES_AS_AT,
  englishSupportFor,
  listAssessingBodies,
  suggestPathway,
} from '../services/community-support/assessing-bodies';

const router = Router();

function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  try {
    return schema.parse(input ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
    }
    throw error;
  }
}

// ===========================================
// PAGING THE PUBLIC CATALOGUES
// ===========================================
// The four public catalogue listings below ran findMany with no take, so each
// request built the entire table into one response and grew slower with every
// program, community and resource added. Fifty is a page of cards; a hundred
// (parsePagination's own ceiling) is the most the server will assemble at
// once. Everything goes through parsePagination because a limit of "abc" or
// "-5" typed into the query string would otherwise reach Prisma as a NaN skip
// or a negative take and fail the query outright.
//
// Every one of those listings also ends its orderBy with `{ id: 'asc' }`. Sorting
// by name, title or membersCount alone is not a total order: two programs called
// the same thing, or two communities with the same member count, have no defined
// order between them, and Postgres is free to return them in a different order on
// each query. With skip/take that is not cosmetic — a row can land on page one and
// page two, while another is never returned at all. id is the @id column, so it
// breaks every tie and pins the page boundary.
const CATALOGUE_PAGE_SIZE = 50;

// (page - 1) * limit has to stay something Postgres will accept as an OFFSET, so
// a page number of twenty digits — which parses to a number too large to be exact
// — is capped rather than handed on. At 100 rows a page this is still further than
// any catalogue reaches.
const MAX_CATALOGUE_PAGE = 100_000;

function cataloguePage(query: Request['query']) {
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  // parsePagination defaults to 20 when it cannot read a limit; these
  // catalogues want 50, so an absent or unusable limit is replaced here first.
  // parseInt is what keeps a fractional limit away from Prisma: "7.5" truncates
  // to 7 and "abc" becomes NaN, which falls through to the default, so take and
  // skip are always non-negative integers.
  const requested = Number.parseInt(text(query.limit) ?? '', 10);
  const limit = Number.isFinite(requested) && requested > 0 ? requested : CATALOGUE_PAGE_SIZE;
  const requestedPage = Number.parseInt(text(query.page) ?? '', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, MAX_CATALOGUE_PAGE) : 1;
  return parsePagination({ page: String(page), limit: String(limit) });
}

// `data` stays a bare array: every client page reads `res.data.data` and maps
// over it, so the total travels beside it in `pagination` rather than wrapping
// it. The header is a convenience for clients that read counts from headers.
// The web app does not need it, because buildPaginationMeta already puts the
// same number in `pagination.total` in the body, and the three pages on this
// data read `pagination.hasMore` from there to decide whether to offer a
// "show more" button.
//
// This used to say the web app *cannot* read the header, because index.ts
// does not list X-Total-Count in the CORS exposedHeaders. The premise is true
// — that cors() call sets origin, credentials, methods and allowedHeaders and
// nothing else — but the conclusion does not follow for these endpoints. The
// client's axios baseURL is the relative '/api', so the pages that read this
// data go to the Next.js origin, which forwards them (the proxy.ts rewrite
// locally, app/api/[...path] on Netlify, and that handler copies every
// upstream response header except four hop-by-hop ones). The response those
// pages see is same-origin, so X-Total-Count is readable there.
//
// Not because nothing ever reaches this server cross-origin — something does:
// components/status/StatusLive.tsx fetches API_ORIGIN directly, deliberately
// bypassing the proxy so the status page can tell "the API is down" apart from
// "the proxy in front of it is down". That call is subject to exposedHeaders,
// and would not see this header. It does not read counts, so nothing is
// missing today; anything new that reads a header cross-origin has to be added
// to exposedHeaders first.
function sendCatalogue(res: Response, data: unknown[], total: number, page: number, limit: number) {
  res.setHeader('X-Total-Count', String(total));
  res.json({ success: true, data, pagination: buildPaginationMeta(total, page, limit) });
}

// ===========================================
// COMMUNITY SUPPORT PROGRAMS
// ===========================================

// GET /api/community-support/programs - List support programs
router.get('/programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityType, region, active } = req.query;
    const { page, limit, skip } = cataloguePage(req.query);

    const where: Record<string, unknown> = {};
    if (communityType) where.communityType = communityType;
    if (region) where.region = region;
    if (active !== 'false') where.isActive = true;

    const [programs, total] = await Promise.all([
      prisma.communitySupportProgram.findMany({
        where,
        include: {
          milestones: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.communitySupportProgram.count({ where }),
    ]);

    sendCatalogue(res, programs, total, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/community-support/programs/:id - Get specific program
router.get('/programs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const program = await prisma.communitySupportProgram.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

// POST /api/community-support/programs/:id/enroll - Enroll in a program
router.post('/programs/:id/enroll', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    // Goals are a short list of sentences the member wrote; anything else is refused rather than stored.
    const rawGoals = req.body?.goalsSet;
    if (rawGoals !== undefined && (!Array.isArray(rawGoals) || rawGoals.length > 20 || rawGoals.some((g) => typeof g !== 'string' || g.trim().length === 0 || g.length > 300))) {
      return res.status(400).json({ success: false, error: 'goalsSet must be a list of up to 20 short sentences' });
    }
    const goalsSet = rawGoals === undefined ? undefined : (rawGoals as string[]).map((g) => g.trim());

    // Check if program exists and has capacity
    const program = await prisma.communitySupportProgram.findUnique({
      where: { id },
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ success: false, error: 'Program not found or inactive' });
    }

    if (program.maxParticipants && program.currentParticipants >= program.maxParticipants) {
      return res.status(400).json({ success: false, error: 'Program is at capacity' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.programEnrollment.findUnique({
      where: { programId_userId: { programId: id, userId } },
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, error: 'Already enrolled in this program' });
    }

    // Create enrollment
    const enrollment = await prisma.programEnrollment.create({
      data: {
        programId: id,
        userId,
        goalsSet,
      },
      include: {
        program: true,
      },
    });

    // Update participant count
    await prisma.communitySupportProgram.update({
      where: { id },
      data: { currentParticipants: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

// GET /api/community-support/my/enrollments - Get user's enrollments
router.get('/my/enrollments', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const enrollments = await prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            milestones: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        milestoneProgress: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/community-support/enrollments/:id/milestone - Update milestone progress
router.patch('/enrollments/:id/milestone', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { milestoneId, isCompleted, evidence } = req.body;

    // Verify enrollment belongs to user
    const enrollment = await prisma.programEnrollment.findFirst({
      where: { id, userId },
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }

    const progress = await prisma.milestoneProgress.upsert({
      where: {
        enrollmentId_milestoneId: { enrollmentId: id, milestoneId },
      },
      create: {
        enrollmentId: id,
        milestoneId,
        isCompleted: isCompleted ?? false,
        completedAt: isCompleted ? new Date() : null,
        evidence,
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        evidence,
      },
    });

    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// INDIGENOUS COMMUNITIES
// ===========================================

// GET /api/community-support/indigenous/communities - List indigenous communities
router.get('/indigenous/communities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { region, womenOnly, verified } = req.query;
    const { page, limit, skip } = cataloguePage(req.query);

    const where: Record<string, unknown> = {};
    if (region) where.region = region;
    if (womenOnly === 'true') where.isWomenOnly = true;
    if (verified === 'true') where.isVerified = true;

    const [communities, total] = await Promise.all([
      prisma.indigenousCommunityPage.findMany({
        where,
        orderBy: [{ membersCount: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.indigenousCommunityPage.count({ where }),
    ]);

    sendCatalogue(res, communities, total, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/community-support/indigenous/communities/:id - Get specific community
router.get('/indigenous/communities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const community = await prisma.indigenousCommunityPage.findUnique({
      where: { id },
      include: {
        resources: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    res.json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
});

// POST /api/community-support/indigenous/communities/:id/join - Join community
router.post('/indigenous/communities/:id/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const community = await prisma.indigenousCommunityPage.findUnique({
      where: { id },
    });

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    const membership = await prisma.indigenousCommunityMember.create({
      data: {
        communityId: id,
        userId,
      },
    });

    // Update member count
    await prisma.indigenousCommunityPage.update({
      where: { id },
      data: { membersCount: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: membership });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Already a member' });
    }
    next(error);
  }
});

// GET /api/community-support/indigenous/resources - List indigenous resources
router.get('/indigenous/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, national } = req.query;
    const { page, limit, skip } = cataloguePage(req.query);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (national === 'true') where.isNational = true;

    const [resources, total] = await Promise.all([
      prisma.indigenousResource.findMany({
        where,
        orderBy: [{ isNational: 'desc' }, { title: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.indigenousResource.count({ where }),
    ]);

    sendCatalogue(res, resources, total, page, limit);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// REFUGEE & IMMIGRANT INTEGRATION
// ===========================================

// GET /api/community-support/language-profile - Get user's language profile
router.get('/language-profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.languageProfile.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// POST /api/community-support/language-profile - Create/update language profile
router.post('/language-profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      primaryLanguage,
      primaryProficiency,
      englishProficiency,
      otherLanguages,
      needsInterpreter,
      preferredInterpreterLang,
    } = req.body;

    if (!primaryLanguage) {
      return res.status(400).json({ success: false, error: 'Primary language is required' });
    }

    const profile = await prisma.languageProfile.upsert({
      where: { userId },
      create: {
        userId,
        primaryLanguage,
        primaryProficiency: primaryProficiency || 'NATIVE',
        englishProficiency: englishProficiency || 'INTERMEDIATE',
        otherLanguages,
        needsInterpreter: needsInterpreter ?? false,
        preferredInterpreterLang,
      },
      update: {
        primaryLanguage,
        primaryProficiency,
        englishProficiency,
        otherLanguages,
        needsInterpreter,
        preferredInterpreterLang,
      },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// GET /api/community-support/credentials - Get user's international credentials
router.get('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const credentials = await prisma.internationalCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: credentials });
  } catch (error) {
    next(error);
  }
});

// POST /api/community-support/credentials - Add international credential
router.post('/credentials', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      originalCountry,
      credentialType,
      credentialName,
      institution,
      yearObtained,
      fieldOfStudy,
      documentUrl,
    } = req.body;

    if (!originalCountry || !credentialType || !credentialName || !institution) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const credential = await prisma.internationalCredential.create({
      data: {
        userId,
        originalCountry,
        credentialType,
        credentialName,
        institution,
        yearObtained: yearObtained ? parseInt(yearObtained) : null,
        fieldOfStudy,
        documentUrl,
      },
    });

    res.status(201).json({ success: true, data: credential });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREDENTIAL PATHWAY: WHO ASSESSES WHAT
// ===========================================
// A credential on its own tells a member nothing about what to do next. The
// pathway names the Australian body that assesses her profession, the
// bridging programs on the platform that match it, and, when her English is
// below vocational level, the free Commonwealth English program. The table
// is public reference data (services/community-support/assessing-bodies.ts);
// what the body eventually decides is recorded by her or by staff.

// GET /api/community-support/assessing-bodies - The public reference table
router.get('/assessing-bodies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { asAt: ASSESSING_BODIES_AS_AT, bodies: listAssessingBodies() } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/community-support/credentials/pathway
 * ?credentialId=  one of the member's own credentials, or
 * ?fieldOfStudy=&credentialName=  the words she is typing before saving one.
 * With neither, only the English support is returned.
 * Registered before /credentials/:id so the literal path is never shadowed.
 */
router.get('/credentials/pathway', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const q = (key: string) => (typeof req.query[key] === 'string' ? (req.query[key] as string).slice(0, 300) : undefined);

    let subject: { fieldOfStudy?: string | null; credentialName?: string | null } = { fieldOfStudy: q('fieldOfStudy'), credentialName: q('credentialName') };
    const credentialId = q('credentialId');
    if (credentialId) {
      const credential = await prisma.internationalCredential.findFirst({
        where: { id: credentialId, userId },
        select: { fieldOfStudy: true, credentialName: true },
      });
      if (!credential) {
        return res.status(404).json({ success: false, error: 'Credential not found' });
      }
      subject = credential;
    }

    const hasText = Boolean(subject.fieldOfStudy?.trim() || subject.credentialName?.trim());
    const pathway = hasText ? suggestPathway(subject) : null;

    const bridgingPrograms = pathway && pathway.bridgingKeywords.length > 0
      ? await prisma.bridgingProgram.findMany({
          where: {
            isActive: true,
            OR: pathway.bridgingKeywords.map((word) => ({ profession: { contains: word, mode: 'insensitive' as const } })),
          },
          // Only twelve of the matches are shown, so which twelve must not depend
          // on how Postgres happened to break ties between programs of the same name.
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: 12,
        })
      : [];

    const language = await prisma.languageProfile.findUnique({ where: { userId }, select: { englishProficiency: true } });

    res.json({
      success: true,
      data: {
        asAt: ASSESSING_BODIES_AS_AT,
        pathway,
        bridgingPrograms,
        englishSupport: englishSupportFor(language?.englishProficiency),
      },
    });
  } catch (error) {
    next(error);
  }
});

const CREDENTIAL_STATUSES = ['PENDING_REVIEW', 'RECOGNIZED', 'PARTIALLY_RECOGNIZED', 'BRIDGING_REQUIRED', 'NOT_RECOGNIZED'] as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const recordOutcomeSchema = z
  .object({
    status: z.enum(CREDENTIAL_STATUSES).optional(),
    australianEquiv: optionalText(200),
    bridgingRequired: optionalText(500),
    assessmentBody: optionalText(200),
    assessmentDate: z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), 'must be a date')
      .nullable()
      .optional(),
    notes: optionalText(2000),
  })
  .strict();

/**
 * PATCH /api/community-support/credentials/:id
 * The member records what the assessing body wrote to her: the outcome, the
 * Australian equivalent it named, any bridging it asked for. Only her own.
 */
router.patch('/credentials/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const body = parse(recordOutcomeSchema, req.body);
    if (Object.keys(body).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to record' });
    }

    const credential = await prisma.internationalCredential.findFirst({ where: { id: req.params.id, userId } });
    if (!credential) {
      return res.status(404).json({ success: false, error: 'Credential not found' });
    }

    const empty = (value: string | null | undefined) => (value === undefined ? undefined : value === null || value === '' ? null : value);
    const updated = await prisma.internationalCredential.update({
      where: { id: credential.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.australianEquiv !== undefined ? { australianEquiv: empty(body.australianEquiv) } : {}),
        ...(body.bridgingRequired !== undefined ? { bridgingRequired: empty(body.bridgingRequired) } : {}),
        ...(body.assessmentBody !== undefined ? { assessmentBody: empty(body.assessmentBody) } : {}),
        ...(body.assessmentDate !== undefined ? { assessmentDate: body.assessmentDate ? new Date(body.assessmentDate) : null } : {}),
        ...(body.notes !== undefined ? { notes: empty(body.notes) } : {}),
      },
    });

    logger.info('Credential outcome recorded by member', { credentialId: credential.id, userId, status: body.status });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/community-support/bridging-programs - List bridging programs
router.get('/bridging-programs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profession, region, fundingAvailable } = req.query;
    const { page, limit, skip } = cataloguePage(req.query);

    const where: Record<string, unknown> = { isActive: true };
    if (profession) where.profession = profession;
    if (region) where.region = region;
    if (fundingAvailable === 'true') where.fundingAvailable = true;

    const [programs, total] = await Promise.all([
      prisma.bridgingProgram.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.bridgingProgram.count({ where }),
    ]);

    sendCatalogue(res, programs, total, page, limit);
  } catch (error) {
    next(error);
  }
});

// POST /api/community-support/bridging-programs/:id/enroll - Enroll in bridging program
router.post('/bridging-programs/:id/enroll', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { credentialId } = req.body;

    const program = await prisma.bridgingProgram.findUnique({
      where: { id },
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ success: false, error: 'Program not found or inactive' });
    }

    const enrollment = await prisma.bridgingEnrollment.create({
      data: {
        programId: id,
        userId,
        credentialId,
      },
      include: {
        program: true,
      },
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Already enrolled' });
    }
    next(error);
  }
});

// GET /api/community-support/my/bridging-enrollments - Get user's bridging enrollments
router.get('/my/bridging-enrollments', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const enrollments = await prisma.bridgingEnrollment.findMany({
      where: { userId },
      include: {
        program: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});

export default router;
