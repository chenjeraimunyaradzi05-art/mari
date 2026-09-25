import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { parsePagination } from '../utils/pagination';
import { body, validationResult } from 'express-validator';
import { randomBytes } from 'crypto';
import { normalizeSafeUrl } from '../utils/contentSafety';

const router = Router();

/**
 * The five kinds of course the catalogue knows about.
 *
 * `type` is not decoration: it is the filter on /courses and /certifications,
 * the key the persona table below matches on, and the label the public course
 * page prints. The create form has always been a select of exactly these
 * values, but the server took any string and the provider's edit form was a
 * free-text box — so a provider who tidied "short_course" into "Short Course"
 * silently removed her own course from every type filter on the platform and
 * from the list of courses that issue a certificate, with no error and no way
 * to tell what had happened. The server is the only place that can hold this.
 */
const COURSE_TYPES = ['short_course', 'certificate', 'diploma', 'bootcamp', 'degree'] as const;
const COURSE_TYPES_SENTENCE = COURSE_TYPES.join(', ');

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

/**
 * The study modes as the catalogue filter will look for them.
 *
 * The filter on /courses and /dashboard/learn is an exact jsonb containment
 * match, so every write path has to agree on the spelling or a course quietly
 * drops out of a filter it belongs in. Lowercase and trimmed is the spelling
 * the seed and the PATCH already use.
 */
function normalizeStudyModeList(studyMode: unknown[]): string[] {
  return studyMode.map((m) => String(m).trim().toLowerCase()).filter((m) => m.length > 0);
}

/**
 * A figure on a course listing: a number the provider published, or nothing.
 *
 * The validators below let '' and null through on purpose, so a provider can
 * clear a figure she has not published. `optional({ values: 'falsy' })` lets
 * `false`, `0` and `[]` past them too, and those all went through a bare
 * `Number()`: `false` and `[]` became 0, and the public course page then
 * printed "0% of graduates, as the provider reports" — a figure nobody
 * reported — while an object became NaN and reached Prisma as a 500. A figure
 * is a number, or a string that is one, and anything else is a 400.
 */
function courseFigure(key: string, value: unknown): number | null {
  if (value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new ApiError(400, `${key} must be a number, or empty to clear it`);
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
// MY CERTIFICATES
// ===========================================

/**
 * GET /api/courses/me/certificates
 * The certificates the signed-in learner has earned, newest first, each with
 * the code an employer can check at /certificates/:code.
 */
router.get('/me/certificates', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const certificates = await prisma.courseCertificate.findMany({
      where: { userId: req.user!.id },
      include: { course: { select: { id: true, title: true, slug: true, providerName: true, type: true, durationMonths: true } } },
      orderBy: { issuedAt: 'desc' },
    });
    res.json({
      success: true,
      data: certificates.map((c) => ({ id: c.id, code: c.code, issuedAt: c.issuedAt, course: c.course })),
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
    const withLessons = String(req.query.withLessons ?? '') === 'true';

    const where: any = { isActive: true };
    if (withLessons) {
      // The courses that can actually earn an ATHENA certificate.
      //
      // A certificate is issued by POST /:courseId/lessons/:lessonId/complete
      // when every lesson of a course is ticked off, so the courses that issue
      // one are the courses that have lessons here — nothing to do with
      // `type`. /certifications used to ask for `type=certificate` under the
      // heading "Courses that issue a certificate", which put a Graduate
      // Certificate with no lessons on ATHENA in a list of things that will
      // never issue anything, and left out every bootcamp that would.
      where.modules = { some: { lessons: { some: {} } } };
    }
    // Both write paths store the type lowercase — the create validator only
    // accepts the five lowercase values and the PATCH lowercases what it is
    // given — so the filter has to arrive lowercase too, or a pill labelled
    // "Certificate" finds nothing.
    if (type) where.type = String(type).trim().toLowerCase();
    if (search) {
      // `mode: 'insensitive'` is not optional on Postgres: without it `contains`
      // is a case-sensitive LIKE, so a woman typing "data" into the catalogue
      // search box was told there was no match for "Graduate Certificate in
      // Data Science". Every other list route in this domain already passes it.
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (studyMode) {
      // `Course.studyMode` is a Json column holding an array, not a Postgres
      // scalar list, and Prisma has no `has` filter for Json. The query this
      // route used to build was rejected by the client before it ever reached
      // the database, so every choice in the Online / Part-time / Full-time
      // dropdown on /dashboard/learn came back as a 500 rather than as a
      // filtered catalogue — and because the `where` is typed `any`, nothing
      // caught it at compile time either. `array_contains` is the Json
      // equivalent and compiles to the jsonb containment operator.
      //
      // Lowercased for the same reason the type is: the stored modes are
      // lowercase, and a dropdown value that is not would silently match
      // nothing at all, which looks exactly like an empty catalogue.
      where.studyMode = { array_contains: [String(studyMode).trim().toLowerCase()] };
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
    // Anonymous visitors get the courses ATHENA members have actually enrolled
    // in, most enrolled first. This used to order on employmentRate alone and
    // called itself popularity, which was two claims neither of which held:
    // enrolment is the only popularity signal the platform has, and
    // employmentRate is null on every course in the catalogue because nothing
    // in the product writes it (the seed deliberately leaves it null and the
    // provider's course builder has no field for it). Postgres sorts nulls
    // first on a DESC order, so "recommended" was in practice whatever order
    // the database felt like. Enrolment count is a real number; a reported
    // outcome rate, when a provider ever sets one, breaks the ties.
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
        orderBy: [
          { enrollments: { _count: 'desc' } },
          { employmentRate: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
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
      // Same reason as the anonymous branch: employmentRate is null across the
      // catalogue and Postgres would put those nulls at the front, so the
      // fifty-row pool the scorer ranks was being chosen arbitrarily. Nulls
      // last means the pool is the courses with a reported outcome plus the
      // newest of the rest, which is a defensible fifty.
      orderBy: [{ employmentRate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
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
  if (typeof bodyIn.content === 'string') data.content = bodyIn.content.trim() || null;
  // A lesson's video and resource addresses used to be stored as whatever
  // string arrived, trimmed — so `javascript:...` went into the column and out
  // again to the classroom page as the href a learner is invited to click.
  // Everywhere else that takes an address from a member runs it through
  // normalizeSafeUrl first, which insists on http(s) or one of ATHENA's own
  // upload paths; this route is no different, and an empty string still means
  // "no address" rather than an error.
  for (const key of ['videoUrl', 'resourceUrl'] as const) {
    if (typeof bodyIn[key] === 'string') {
      const raw = (bodyIn[key] as string).trim();
      data[key] = raw
        ? normalizeSafeUrl(raw, { field: key, allowRelativeUploads: true, allowAuthenticatedMedia: true })
        : null;
    }
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
    body('type')
      .optional({ values: 'falsy' })
      .isIn(COURSE_TYPES)
      .withMessage(`type must be one of ${COURSE_TYPES_SENTENCE}`),
    body('durationMonths').optional({ values: 'null' }).isInt({ min: 0, max: 120 }),
    body('cost').optional({ values: 'null' }).isInt({ min: 0, max: 1_000_000 }),
    body('studyMode').optional().isArray({ max: 5 }),
    body('studyMode.*').isString().trim().notEmpty().isLength({ max: 40 }),
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
          type: typeof type === 'string' ? type.trim().toLowerCase() : null,
          durationMonths: durationMonths ?? null,
          cost: cost ?? null,
          // Lowercased here as well as on the PATCH. The catalogue's study-mode
          // filter is an exact jsonb containment match, so a course created
          // with "Online" was invisible to the "Online" pill for the rest of
          // its life, with nothing anywhere to say why.
          studyMode: Array.isArray(studyMode) ? normalizeStudyModeList(studyMode) : undefined,
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
//
// This route is where a provider's listing becomes a public claim, and until
// now it was the only write route in the file with no validator on it at all.
// The numbers went through a bare Number(), so `employmentRate: 9999` and
// `avgStartingSalary: -1` were both stored and then printed on the public
// course page as "9999% of graduates, as the provider reports"; a non-numeric
// string became NaN and reached Prisma as a 500 rather than a 400. And
// `isActive` flipped with no questions asked, although the rule that a course
// needs a lesson before it can be published existed — only as a `disabled`
// attribute on a button, which is not a rule, it is a suggestion. A direct
// call put an empty course in the catalogue for a learner to enrol in and hold
// a nought-lesson enrolment.
//
// The bounds are the ones the figures mean: a proportion of graduates is 0 to
// 100, a starting salary is a real Australian salary, a course runs for a
// number of months a person could sit through.
const courseDetailsValidators = [
  body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('type')
    .optional({ values: 'falsy' })
    .isIn(COURSE_TYPES)
    .withMessage(`type must be one of ${COURSE_TYPES_SENTENCE}`),
  body('providerName').optional({ values: 'null' }).isString().isLength({ max: 200 }),
  body('durationMonths').optional({ values: 'falsy' }).isInt({ min: 0, max: 120 }).withMessage('durationMonths must be a whole number of months'),
  body('cost').optional({ values: 'falsy' }).isInt({ min: 0, max: 1_000_000 }).withMessage('cost must be a whole number of dollars'),
  // A whole number, not a float: the column is an Int, so 87.5 passed the
  // validator and then failed in Prisma as a 500 the provider could do nothing
  // with. The percentages QILT and NCVER publish are whole numbers anyway.
  body('employmentRate')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 100 })
    .withMessage('employmentRate is a whole percentage of graduates, between 0 and 100'),
  body('avgStartingSalary')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 10_000_000 })
    .withMessage('avgStartingSalary must be a whole number of dollars'),
  body('studyMode').optional().isArray({ max: 5 }),
  body('studyMode.*').isString().trim().notEmpty().isLength({ max: 40 }),
  body('fundingOptions').optional().isArray({ max: 10 }),
  body('fundingOptions.*').isString().trim().notEmpty().isLength({ max: 80 }),
  // The public course page prints the intakes as a fact of the listing, and
  // until now the only thing in the whole product that could write them was
  // the demo seed — so on a real database the "Intakes" line never appeared
  // however many times a provider was asked when her course starts.
  body('intakeDates').optional().isArray({ max: 24 }),
  body('intakeDates.*').isISO8601().withMessage('each intake date must be a date'),
  body('isActive').optional().isBoolean(),
];

router.patch(
  '/:courseId',
  authenticate,
  courseDetailsValidators,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      await assertCourseEditor(req.params.courseId, req.user!);
      const b = req.body as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (typeof b.title === 'string' && b.title.trim()) data.title = b.title.trim();
      if (typeof b.description === 'string') data.description = b.description;
      if (typeof b.type === 'string' && b.type.trim()) data.type = b.type.trim().toLowerCase();
      if (typeof b.providerName === 'string') data.providerName = b.providerName.trim() || null;
      // An empty string and an explicit null both mean "the provider has not
      // published this figure", which the public page renders as the fact being
      // absent rather than as a zero.
      for (const key of ['durationMonths', 'cost', 'employmentRate', 'avgStartingSalary'] as const) {
        if (b[key] !== undefined) data[key] = courseFigure(key, b[key]);
      }
      if (Array.isArray(b.studyMode)) data.studyMode = normalizeStudyModeList(b.studyMode);
      if (Array.isArray(b.fundingOptions)) data.fundingOptions = b.fundingOptions.map((f) => String(f).trim());
      // Stored the way the seed stores them and the way the public page reads
      // them: ISO strings, so the page's date formatting has one shape to deal
      // with whoever wrote the row.
      if (Array.isArray(b.intakeDates)) {
        data.intakeDates = b.intakeDates.map((d) => new Date(String(d)).toISOString());
      }

      if (typeof b.isActive === 'boolean') {
        if (b.isActive) {
          const lessons = await prisma.courseLesson.count({ where: { module: { courseId: req.params.courseId } } });
          if (lessons === 0) {
            throw new ApiError(400, 'Add at least one lesson before publishing this course');
          }
        }
        data.isActive = b.isActive;
      }

      const updated = await prisma.course.update({ where: { id: req.params.courseId }, data: data as any });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

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
