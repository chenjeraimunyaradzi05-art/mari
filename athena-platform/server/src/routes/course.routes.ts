import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { parsePagination } from '../utils/pagination';
import { body, validationResult } from 'express-validator';
import { randomBytes } from 'crypto';

const router = Router();

const personaPreferredCourseTypes: Record<string, string[]> = {
  EARLY_CAREER: ['bootcamp', 'certificate', 'short_course', 'diploma'],
  MID_CAREER: ['diploma', 'degree', 'certificate'],
  ENTREPRENEUR: ['bootcamp', 'short_course', 'certificate'],
  CREATOR: ['bootcamp', 'short_course', 'certificate'],
  MENTOR: ['short_course', 'certificate', 'degree'],
  EDUCATION_PROVIDER: [],
  EMPLOYER: [],
  REAL_ESTATE: [],
  GOVERNMENT_NGO: [],
};

function normalizeCourseType(type: unknown): string | null {
  if (typeof type !== 'string') return null;
  return type.trim().toLowerCase() || null;
}

function normalizeStudyModes(studyMode: unknown): string[] {
  if (Array.isArray(studyMode)) {
    return studyMode
      .map((m) => (typeof m === 'string' ? m.trim().toLowerCase() : null))
      .filter((m): m is string => Boolean(m));
  }
  return [];
}

function recommendedStudyModesFromSignals(remotePreference: unknown): string[] {
  const pref = typeof remotePreference === 'string' ? remotePreference.trim().toLowerCase() : '';
  if (pref === 'remote') return ['online', 'part-time'];
  if (pref === 'hybrid') return ['online', 'part-time', 'full-time'];
  if (pref === 'onsite') return ['full-time', 'part-time'];
  return ['online', 'part-time', 'full-time'];
}

function extractKeywords(raw: Array<string | null | undefined>, limit = 12): string[] {
  const joined = raw.filter(Boolean).join(' ').toLowerCase();
  const tokens = joined
    .split(/[^a-z0-9+.#]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  const deduped: string[] = [];
  for (const t of tokens) {
    if (!deduped.includes(t)) deduped.push(t);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function keywordScore(text: string, keywords: string[], weight: number): number {
  if (!text || keywords.length === 0) return 0;
  const hay = text.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (hay.includes(k)) score += weight;
  }
  return score;
}

function scoreCourse(params: {
  courseEmploymentRate: number | null;
  courseType: string | null;
  courseStudyModes: string[];
  preferredTypes: string[];
  preferredStudyModes: string[];
  keywords: string[];
  title: string;
  description: string;
}): number {
  const employment = typeof params.courseEmploymentRate === 'number' ? params.courseEmploymentRate : 0;
  let score = employment;

  if (params.courseType) {
    const idx = params.preferredTypes.indexOf(params.courseType);
    if (idx >= 0) {
      score += Math.max(10, 30 - idx * 5);
    } else if (params.preferredTypes.length > 0) {
      // Small nudge away from non-preferred types when we have a persona signal.
      score -= 5;
    }
  }

  if (params.preferredStudyModes.length > 0 && params.courseStudyModes.length > 0) {
    const matches = params.preferredStudyModes.some((m) => params.courseStudyModes.includes(m));
    if (matches) score += 15;
  }

  // Keyword relevance (skills, headline, current role) — lightweight Phase 1 signal.
  // Title matches matter more than description matches.
  score += Math.min(60, keywordScore(params.title, params.keywords, 12) + keywordScore(params.description, params.keywords, 4));

  return score;
}

// ===========================================
// GET MY COURSES (ENROLLED)
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: req.user!.id },
      include: {
        course: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Client expects an array from response.data.data
    res.json({
      success: true,
      data: enrollments.map((e) => ({
        ...e.course,
        enrollment: {
          id: e.id,
          progress: e.progress,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET ALL COURSES
// ===========================================
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const type = req.query.type as string;
    const search = req.query.search as string;
    const studyMode = req.query.studyMode as string;

    const where: any = { isActive: true };
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (studyMode) {
      where.studyMode = { has: studyMode };
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    res.json({
      success: true,
      data: courses,
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
// GET RECOMMENDED COURSES
// ===========================================
router.get('/recommendations/for-me', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    // Anonymous users: keep simple popularity-based recommendations.
    if (!req.user) {
      const courses = await prisma.course.findMany({
        where: { isActive: true },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
        orderBy: { employmentRate: 'desc' },
        take: 10,
      });

      return res.json({
        success: true,
        data: courses,
      });
    }

    // Authenticated users: lightweight personalization (Phase 1-friendly).
    const [user, enrollments, userSkills] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          persona: true,
          currentJobTitle: true,
          headline: true,
          profile: {
            select: {
              remotePreference: true,
            },
          },
        },
      }),
      prisma.courseEnrollment.findMany({
        where: { userId: req.user.id },
        select: { courseId: true },
      }),
      prisma.userSkill.findMany({
        where: { userId: req.user.id },
        select: {
          skill: {
            select: {
              name: true,
            },
          },
        },
        take: 20,
      }),
    ]);

    const enrolledIds = enrollments.map((e) => e.courseId);
    const persona = user?.persona || req.user.persona;

    const preferredTypes = personaPreferredCourseTypes[String(persona)] || [];
    const preferredStudyModes = recommendedStudyModesFromSignals(user?.profile?.remotePreference);

    const keywords = extractKeywords([
      user?.currentJobTitle ?? null,
      user?.headline ?? null,
      ...(userSkills || []).map((s) => s.skill?.name ?? null),
    ]);

    const candidates = await prisma.course.findMany({
      where: {
        isActive: true,
        ...(enrolledIds.length > 0 ? { id: { notIn: enrolledIds } } : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: [{ employmentRate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const ranked = candidates
      .map((c) => {
        const studyModes = normalizeStudyModes((c as any).studyMode);
        const type = normalizeCourseType((c as any).type);
        return {
          course: c,
          score: scoreCourse({
            courseEmploymentRate: (c as any).employmentRate ?? null,
            courseType: type,
            courseStudyModes: studyModes,
            preferredTypes,
            preferredStudyModes,
            keywords,
            title: String((c as any).title ?? ''),
            description: String((c as any).description ?? ''),
          }),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.course);

    const courses = ranked;

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ENROLL IN COURSE
// ===========================================
router.post('/:courseId/enroll', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, isActive: true },
    });

    if (!course || !course.isActive) {
      throw new ApiError(404, 'Course not found');
    }

    const enrollment = await prisma.courseEnrollment.upsert({
      where: {
        userId_courseId: {
          userId: req.user!.id,
          courseId,
        },
      },
      create: {
        userId: req.user!.id,
        courseId,
      },
      update: {
        // Touch updatedAt
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Enrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CURRICULUM: BUILDER, CLASSROOM, CERTIFICATES
// ===========================================
// A course can carry its own lessons on ATHENA: modules of video, article and
// resource lessons the provider's team builds here, a classroom where an
// enrolled learner works through them, and a certificate with a public code
// once every lesson is done.

const LESSON_TYPES = ['VIDEO', 'ARTICLE', 'RESOURCE'];

const curriculumInclude = {
  modules: {
    orderBy: { position: 'asc' as const },
    include: { lessons: { orderBy: { position: 'asc' as const } } },
  },
};

type LessonRow = { id: string; isPreview: boolean; content: string | null; videoUrl: string | null; resourceUrl: string | null };

// Someone not enrolled sees the shape of the course and the preview lessons;
// the rest of the content stays behind enrolment.
function withLockedContent<M extends { lessons: LessonRow[] }>(modules: M[], unlocked: boolean) {
  return modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) =>
      unlocked || l.isPreview ? { ...l, locked: false } : { ...l, content: null, videoUrl: null, resourceUrl: null, locked: true }
    ),
  }));
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'course';
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await prisma.course.findUnique({ where: { slug }, select: { id: true } }); i += 1) {
    slug = `${base}-${i}`;
  }
  return slug;
}

async function isOrganizationMember(organizationId: string, user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { id: true },
  });
  return Boolean(membership);
}

async function assertOrganizationMember(organizationId: string, user: { id: string; role: string }) {
  if (!(await isOrganizationMember(organizationId, user))) {
    throw new ApiError(403, 'Only the provider’s team can do that');
  }
}

async function assertCourseEditor(courseId: string, user: { id: string; role: string }) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, organizationId: true, title: true } });
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }
  if (user.role !== 'ADMIN') {
    if (!course.organizationId) {
      throw new ApiError(403, 'This course is not managed by an organisation you belong to');
    }
    await assertOrganizationMember(course.organizationId, user);
  }
  return course;
}

async function progressFor(courseId: string, userId: string) {
  const [lessons, done, certificate] = await Promise.all([
    prisma.courseLesson.findMany({ where: { module: { courseId } }, select: { id: true } }),
    prisma.lessonProgress.findMany({ where: { userId, lesson: { module: { courseId } } }, select: { lessonId: true } }),
    prisma.courseCertificate.findUnique({ where: { courseId_userId: { courseId, userId } }, select: { code: true, issuedAt: true } }),
  ]);
  const total = lessons.length;
  const completedLessonIds = done.map((d) => d.lessonId);
  const percent = total === 0 ? 0 : Math.round((completedLessonIds.length / total) * 100);
  return { total, completed: completedLessonIds.length, percent, completedLessonIds, certificate };
}

function pickLessonFields(bodyIn: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof bodyIn.title === 'string' && bodyIn.title.trim()) data.title = bodyIn.title.trim();
  if (typeof bodyIn.type === 'string' && LESSON_TYPES.includes(bodyIn.type)) data.type = bodyIn.type;
  for (const key of ['content', 'videoUrl', 'resourceUrl'] as const) {
    if (typeof bodyIn[key] === 'string') data[key] = (bodyIn[key] as string).trim() || null;
  }
  if (bodyIn.durationMinutes !== undefined) {
    data.durationMinutes = bodyIn.durationMinutes === null || bodyIn.durationMinutes === '' ? null : Number(bodyIn.durationMinutes);
  }
  if (typeof bodyIn.isPreview === 'boolean') data.isPreview = bodyIn.isPreview;
  if (typeof bodyIn.position === 'number') data.position = bodyIn.position;
  return data;
}

// GET /api/courses/certificates/:code - Anyone can check that a certificate is real
router.get('/certificates/:code', async (req, res, next) => {
  try {
    const certificate = await prisma.courseCertificate.findUnique({
      where: { code: String(req.params.code).toUpperCase() },
      include: {
        course: { select: { id: true, title: true, slug: true, providerName: true, organization: { select: { name: true } } } },
        user: { select: { firstName: true, lastName: true, displayName: true } },
      },
    });
    if (!certificate) {
      throw new ApiError(404, 'No certificate with that code');
    }
    res.json({
      success: true,
      data: {
        code: certificate.code,
        issuedAt: certificate.issuedAt,
        course: {
          id: certificate.course.id,
          title: certificate.course.title,
          slug: certificate.course.slug,
          provider: certificate.course.organization?.name ?? certificate.course.providerName ?? 'ATHENA',
        },
        learner:
          certificate.user.displayName?.trim() ||
          [certificate.user.firstName, certificate.user.lastName].filter(Boolean).join(' ') ||
          'A member',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/courses/by-organization/:orgId - The provider's own courses, drafts included
router.get('/by-organization/:orgId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await assertOrganizationMember(req.params.orgId, req.user!);
    const courses = await prisma.course.findMany({
      where: { organizationId: req.params.orgId },
      include: { _count: { select: { enrollments: true, modules: true, certificates: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

// POST /api/courses - Start a course; it stays a draft until published
router.post(
  '/',
  authenticate,
  [
    body('title').isString().trim().notEmpty().isLength({ max: 200 }),
    body('description').isString().trim().notEmpty().isLength({ max: 5000 }),
    body('organizationId').optional().isString(),
    body('type').optional().isString().isLength({ max: 40 }),
    body('durationMonths').optional({ values: 'null' }).isInt({ min: 0 }),
    body('cost').optional({ values: 'null' }).isInt({ min: 0 }),
    body('studyMode').optional().isArray({ max: 5 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { title, description, organizationId, type, durationMonths, cost, studyMode } = req.body;
      if (organizationId) {
        await assertOrganizationMember(organizationId, req.user!);
      } else if (req.user!.role !== 'ADMIN') {
        throw new ApiError(400, 'Choose the organisation this course belongs to');
      }

      const course = await prisma.course.create({
        data: {
          title: String(title).trim(),
          slug: await uniqueSlug(String(title)),
          description: String(description).trim(),
          organizationId: organizationId ?? null,
          type: typeof type === 'string' ? type : null,
          durationMonths: durationMonths ?? null,
          cost: cost ?? null,
          studyMode: Array.isArray(studyMode) ? studyMode : undefined,
          isActive: false,
        },
      });
      res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/courses/:courseId - Edit the course, or publish and unpublish it
router.patch('/:courseId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await assertCourseEditor(req.params.courseId, req.user!);
    const b = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof b.title === 'string' && b.title.trim()) data.title = b.title.trim();
    if (typeof b.description === 'string') data.description = b.description;
    if (typeof b.type === 'string') data.type = b.type;
    if (typeof b.providerName === 'string') data.providerName = b.providerName.trim() || null;
    for (const key of ['durationMonths', 'cost', 'employmentRate', 'avgStartingSalary'] as const) {
      if (b[key] !== undefined) data[key] = b[key] === null || b[key] === '' ? null : Number(b[key]);
    }
    if (Array.isArray(b.studyMode)) data.studyMode = b.studyMode;
    if (Array.isArray(b.fundingOptions)) data.fundingOptions = b.fundingOptions;
    if (typeof b.isActive === 'boolean') data.isActive = b.isActive;

    const updated = await prisma.course.update({ where: { id: req.params.courseId }, data: data as any });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/courses/:courseId/builder - The whole course as its editors see it
router.get('/:courseId/builder', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await assertCourseEditor(req.params.courseId, req.user!);
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: {
        ...curriculumInclude,
        organization: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, certificates: true } },
      },
    });
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:courseId/modules',
  authenticate,
  [body('title').isString().trim().notEmpty().isLength({ max: 200 }), body('description').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { courseId } = req.params;
      await assertCourseEditor(courseId, req.user!);
      const position = await prisma.courseModule.count({ where: { courseId } });
      const module = await prisma.courseModule.create({
        data: { courseId, title: String(req.body.title).trim(), description: typeof req.body.description === 'string' ? req.body.description : null, position },
      });
      res.status(201).json({ success: true, data: module });
    } catch (error) {
      next(error);
    }
  }
);

async function loadModuleOf(courseId: string, moduleId: string) {
  const module = await prisma.courseModule.findUnique({ where: { id: moduleId }, select: { id: true, courseId: true } });
  if (!module || module.courseId !== courseId) {
    throw new ApiError(404, 'Module not found');
  }
  return module;
}

router.patch('/:courseId/modules/:moduleId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId, moduleId } = req.params;
    await assertCourseEditor(courseId, req.user!);
    await loadModuleOf(courseId, moduleId);
    const data: Record<string, unknown> = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) data.title = req.body.title.trim();
    if (typeof req.body.description === 'string') data.description = req.body.description.trim() || null;
    if (typeof req.body.position === 'number') data.position = req.body.position;
    const updated = await prisma.courseModule.update({ where: { id: moduleId }, data });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:courseId/modules/:moduleId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId, moduleId } = req.params;
    await assertCourseEditor(courseId, req.user!);
    await loadModuleOf(courseId, moduleId);
    await prisma.courseModule.delete({ where: { id: moduleId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:courseId/modules/:moduleId/lessons',
  authenticate,
  [body('title').isString().trim().notEmpty().isLength({ max: 200 }), body('type').optional().isIn(LESSON_TYPES)],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { courseId, moduleId } = req.params;
      await assertCourseEditor(courseId, req.user!);
      await loadModuleOf(courseId, moduleId);
      const position = await prisma.courseLesson.count({ where: { moduleId } });
      const lesson = await prisma.courseLesson.create({
        data: { moduleId, position, ...pickLessonFields(req.body) } as any,
      });
      res.status(201).json({ success: true, data: lesson });
    } catch (error) {
      next(error);
    }
  }
);

async function loadLessonOf(courseId: string, lessonId: string) {
  const lesson = await prisma.courseLesson.findUnique({ where: { id: lessonId }, select: { id: true, module: { select: { courseId: true } } } });
  if (!lesson || lesson.module.courseId !== courseId) {
    throw new ApiError(404, 'Lesson not found');
  }
  return lesson;
}

router.patch('/:courseId/lessons/:lessonId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    await assertCourseEditor(courseId, req.user!);
    await loadLessonOf(courseId, lessonId);
    const updated = await prisma.courseLesson.update({ where: { id: lessonId }, data: pickLessonFields(req.body) as any });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:courseId/lessons/:lessonId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    await assertCourseEditor(courseId, req.user!);
    await loadLessonOf(courseId, lessonId);
    await prisma.courseLesson.delete({ where: { id: lessonId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/courses/:courseId/classroom - Every lesson, for an enrolled learner (or the course's editors)
router.get('/:courseId/classroom', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.id;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { ...curriculumInclude, organization: { select: { id: true, name: true, logo: true } } },
    });
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }
    const enrollment = await prisma.courseEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (!enrollment) {
      const editor = course.organizationId ? await isOrganizationMember(course.organizationId, req.user!) : req.user!.role === 'ADMIN';
      if (!editor) {
        throw new ApiError(403, 'Enrol in this course to open the classroom');
      }
    }
    const progress = await progressFor(courseId, userId);
    res.json({
      success: true,
      data: {
        course: { id: course.id, title: course.title, slug: course.slug, description: course.description, organization: course.organization, providerName: course.providerName },
        modules: course.modules,
        enrollment,
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/courses/:courseId/lessons/:lessonId/complete - Tick a lesson off; the last one earns the certificate
router.post('/:courseId/lessons/:lessonId/complete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user!.id;
    const enrollment = await prisma.courseEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true } });
    if (!enrollment) {
      throw new ApiError(403, 'Enrol in this course first');
    }
    await loadLessonOf(courseId, lessonId);

    await prisma.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId, userId } },
      create: { lessonId, userId },
      update: {},
    });
    const progress = await progressFor(courseId, userId);
    await prisma.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: progress.percent } });

    let certificate = progress.certificate;
    if (progress.total > 0 && progress.percent === 100 && !certificate) {
      // Every lesson done: issued once, with a code anyone can check.
      certificate = await prisma.courseCertificate.create({
        data: { courseId, userId, code: randomBytes(5).toString('hex').toUpperCase() },
        select: { code: true, issuedAt: true },
      });
    }
    res.json({ success: true, data: { ...progress, certificate } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET COURSE BY SLUG
// ===========================================
router.get('/:slug', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { slug } = req.params;

    // Support fetching by either slug or id to match client usage.
    const course = await prisma.course.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        organization: true,
        ...curriculumInclude,
      },
    });

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    // Enrolment and progress ride along for a signed-in viewer; the lessons'
    // content only for someone enrolled (or the provider's own team).
    const viewer = req.user;
    let enrollment: { id: string; progress: number } | null = null;
    let progress: Awaited<ReturnType<typeof progressFor>> | null = null;
    let canEdit = false;
    if (viewer) {
      const row = await prisma.courseEnrollment.findUnique({ where: { userId_courseId: { userId: viewer.id, courseId: course.id } }, select: { id: true, progress: true } });
      enrollment = row ?? null;
      canEdit = course.organizationId ? await isOrganizationMember(course.organizationId, viewer) : viewer.role === 'ADMIN';
      if (enrollment) progress = await progressFor(course.id, viewer.id);
    }
    const modules = withLockedContent(course.modules ?? [], Boolean(enrollment) || canEdit);

    res.json({
      success: true,
      data: { ...course, modules, enrollment, progress, canEdit },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
