import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
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
// GET COURSE BY SLUG
// ===========================================
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Support fetching by either slug or id to match client usage.
    const course = await prisma.course.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        organization: true,
      },
    });

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
