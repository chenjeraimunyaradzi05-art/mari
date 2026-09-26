import { NextFunction, Response, Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { aiService } from '../services/ai.service';
import { checkAiBudget } from '../services/ai-budget.service';
import {
  AI_CHAT_DISCLAIMER,
  crisisReply,
  detectChatCrisis,
  raiseChatCrisisFlag,
  screenAssistantReply,
  screenMemberMessage,
  WITHHELD_REPLY,
  type FlaggedChatCrisis,
} from '../services/ai-safety.service';
import { checkRateLimit, getRateLimitStatus } from '../utils/cache';

/**
 * The free-tier chat window, measured in this process as well as in Redis.
 *
 * `checkRateLimit` in utils/cache answers `{ allowed: true, remaining: max }`
 * whenever Redis is absent and again whenever the pipeline throws, so the only
 * ceiling on a free member's OpenAI calls disappeared the moment the cache did.
 * A Redis outage handed every free account unlimited spend on the platform's
 * card, with nothing in the response to show it had happened. The middleware
 * rate limiters already answer this with an in-process sliding window
 * (middleware/rateLimiter memorySlidingWindow); this is the same idea for the
 * daily quota, which lives here rather than in middleware because the number
 * of messages she has left is part of the chat response body.
 *
 * Not shared between instances — the same trade-off accepted there. With Redis
 * up the shared window is the binding one; with Redis down a free member gets
 * at most the quota per instance rather than no quota at all.
 */
const localChatWindows = new Map<string, number[]>();
const LOCAL_WINDOW_SWEEP_AT = 20_000;

function localChatWindow(
  userId: string,
  windowSeconds: number,
  maxRequests: number,
  mode: 'peek' | 'consume'
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const since = now - windowMs;
  const stamps = (localChatWindows.get(userId) ?? []).filter((at) => at > since);
  const allowed = stamps.length < maxRequests;

  if (mode === 'consume') {
    if (allowed) stamps.push(now);
    localChatWindows.set(userId, stamps);

    if (localChatWindows.size > LOCAL_WINDOW_SWEEP_AT) {
      for (const [key, list] of localChatWindows) {
        if (list.every((at) => at <= since)) localChatWindows.delete(key);
      }
    }
  }

  return {
    allowed,
    remaining: Math.max(0, maxRequests - stamps.length),
    resetIn: stamps.length ? Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000)) : windowSeconds,
  };
}

/** For tests, which share a module registry across cases. */
export function resetLocalChatWindows(): void {
  localChatWindows.clear();
}

function quotaFromEnv(
  windowName: string,
  maxName: string,
  defaults: { windowSeconds: number; maxRequests: number }
): { windowSeconds: number; maxRequests: number } {
  const windowSeconds = Number.parseInt(process.env[windowName] || String(defaults.windowSeconds), 10);
  const maxRequests = Number.parseInt(process.env[maxName] || String(defaults.maxRequests), 10);

  return {
    windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : defaults.windowSeconds,
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : defaults.maxRequests,
  };
}

function getFreeChatQuotaConfig() {
  return quotaFromEnv('AI_CHAT_FREE_WINDOW_SECONDS', 'AI_CHAT_FREE_MAX_REQUESTS', {
    windowSeconds: 24 * 60 * 60,
    maxRequests: 20,
  });
}

/**
 * Premium chat had no period quota at all: the quota block ran only when the
 * tier was FREE, so a paying account's one ceiling was aiLimiter's ten a minute
 * — fourteen thousand completions a day — and /chat/usage told her she was
 * "unlimited". Premium now buys a much larger window rather than none, and the
 * daily token budget in ai-budget.service sits behind both.
 */
function getPremiumChatQuotaConfig() {
  return quotaFromEnv('AI_CHAT_PREMIUM_WINDOW_SECONDS', 'AI_CHAT_PREMIUM_MAX_REQUESTS', {
    windowSeconds: 24 * 60 * 60,
    maxRequests: 200,
  });
}

/** The chat window as every chat response reports it, whichever tier she is on. */
type ChatUsage = { limit: number; remaining: number; resetIn: number; windowSeconds: number };

/**
 * Whether a subscription row buys the premium AI tools today.
 *
 * The one rule, used by the gate on every premium route, by GET /access that
 * the web app asks before it draws a premium page, and by the chat to pick a
 * quota — so the page, the route and the quota cannot disagree about who has
 * paid. It is the rule requirePremium in middleware/auth applied: a tier other
 * than FREE, and a subscription that is ACTIVE or TRIALING. A lapsed or
 * past-due Premium is not Premium, whatever tier the row still names.
 */
type SubscriptionStanding = { tier: string; status: string } | null | undefined;

export function hasActivePremium(subscription: SubscriptionStanding): boolean {
  return Boolean(
    subscription &&
      subscription.tier !== 'FREE' &&
      (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING')
  );
}

/**
 * The premium gate on this router.
 *
 * It used to be requirePremium, which refused with 401 through
 * UnauthorizedError. A 401 is what the web app's axios interceptor reads as an
 * expired session, so every paywall refusal made the client rotate the member's
 * refresh token and retry before it gave up and showed the error. Refusing a
 * signed-in member for her plan is a 403, and it carries a code the client can
 * recognise without parsing the sentence.
 */
async function requireAiPremium(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
      select: { tier: true, status: true },
    });

    if (hasActivePremium(subscription)) return next();

    const lapsed = Boolean(subscription && subscription.tier !== 'FREE');
    return res.status(403).json({
      success: false,
      code: 'PREMIUM_REQUIRED',
      message: lapsed
        ? `Your ATHENA Pro subscription is ${subscription!.status.toLowerCase().replace(/_/g, ' ')}, so this tool is paused. Update your billing to use it again.`
        : 'This tool is part of ATHENA Pro.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * The daily token budget, in front of every route that calls the model. It
 * runs after the rate limiter so a burst is refused cheaply before anything
 * reads a counter. See ai-budget.service for the two budgets and why.
 */
async function aiBudgetGate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const verdict = await checkAiBudget(req.user!.id);
    if (verdict.allowed) return next();
    res.set('Retry-After', String(verdict.resetIn));
    return next(new ApiError(verdict.scope === 'global' ? 503 : 429, verdict.message));
  } catch (error) {
    next(error);
  }
}

/**
 * The one place the chat answers a member in crisis, so that the three ways of
 * reaching it — her words, the moderation provider reading her message, and the
 * provider reading the model's reply — cannot drift into three different
 * answers. It raises the staff flag first and sends the numbers second: both
 * happen, and the order only decides which one is awaited.
 */
async function respondWithCrisis(
  res: Response,
  userId: string,
  check: FlaggedChatCrisis,
  usage: ChatUsage | undefined
) {
  await raiseChatCrisisFlag(userId, check);
  const reply = crisisReply(check.kind);

  return res.json({
    success: true,
    data: {
      response: reply.text,
      crisis: { flagged: true, kind: check.kind, lines: reply.lines },
      disclaimer: AI_CHAT_DISCLAIMER,
      timestamp: new Date(),
      usage,
    },
  });
}

const router = Router();

// ===========================================
// ACCESS - what her plan opens, asked of the server
// ===========================================
//
// The web app's premium gate read `user.subscriptionTier`, a field no server
// response has ever set: /auth/me sends `subscription: { tier, status }`, and
// login, register and refresh send no tier at all. So the gate saw undefined for
// everyone — paying members were shown "Upgrade to Pro" in place of the tool
// they had paid for — while the AI hub, testing `!== 'FREE'` against the same
// undefined, sent free members straight through. Neither looked at the status,
// which the server's own gate does. Rather than teach the client to recompute
// the rule from whichever response last filled its store, it asks the rule.
router.get('/access', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
      select: { tier: true, status: true },
    });

    res.json({
      success: true,
      data: {
        premium: hasActivePremium(subscription),
        tier: subscription?.tier ?? 'FREE',
        status: subscription?.status ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// OPPORTUNITY RADAR - Personalized Job Matches
// ===========================================
function getPostedLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatJobLocation(job: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isRemote?: boolean;
}): string {
  const base = [job.city, job.state, job.country].filter(Boolean).join(', ') || 'Location not specified';
  return job.isRemote ? `${base} (Remote)` : base;
}

function normalizeOpportunity(job: any) {
  const skills = (job.skills || []).map((jobSkill: any) => jobSkill.skill?.name).filter(Boolean);
  const matchedSkills = Array.isArray(job.matchedSkills) ? job.matchedSkills : [];
  // The fallback used to be the sentence "Profile and role requirements are
  // aligned", printed under the heading "Why you match" on every role with no
  // skill in common with her — which is the opposite of what the scan found.
  // A role with nothing to say for itself now says nothing.
  const matchReasons = [
    ...matchedSkills.map((skill: string) => `Matches ${skill}`),
    ...(job.aiInsight ? [job.aiInsight] : []),
  ].slice(0, 4);

  return {
    id: job.id,
    title: job.title,
    company: job.organization?.name || 'Independent employer',
    companyLogo: job.organization?.logo || null,
    location: formatJobLocation(job),
    salary: {
      min: job.showSalary ? job.salaryMin || 0 : 0,
      max: job.showSalary ? job.salaryMax || job.salaryMin || 0 : 0,
    },
    type: job.type,
    matchScore: job.matchScore,
    skillsMatched: matchedSkills.length,
    skillsRequired: skills.length,
    // The model's own 0-100 read of the fit, on the top few only, and never
    // folded into matchScore: see the comment on the enrichment pass below.
    aiMatchScore: typeof job.aiMatchScore === 'number' ? job.aiMatchScore : null,
    matchReasons,
    skills,
    postedAt: getPostedLabel(job.publishedAt || job.createdAt),
    url: `/dashboard/jobs/${job.id}`,
  };
}

async function opportunityRadarHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filters = req.method === 'POST' ? req.body?.filters || {} : req.query || {};
    const minMatch = Number(filters.minMatch ?? 0);
    const remoteOnly = filters.remoteOnly === true || filters.remoteOnly === 'true';
    const includePartTime = filters.includePartTime === true || filters.includePartTime === 'true';

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: true,
        skills: { include: { skill: true } },
        experience: true,
        education: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Get matching jobs based on user profile
    const skills = user.skills.map(us => us.skill.name);
    const jobSignals: any[] = [];

    if (user.headline) {
      jobSignals.push({ title: { contains: user.headline, mode: 'insensitive' } });
    }

    if (skills.length > 0) {
      jobSignals.push({ skills: { some: { skill: { name: { in: skills } } } } });
    }
    
    const matchingJobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        ...(remoteOnly ? { isRemote: true } : {}),
        ...(includePartTime ? {} : { type: { not: 'PART_TIME' } }),
        ...(jobSignals.length > 0 ? { OR: jobSignals } : {}),
      },
      include: {
        organization: {
          select: { name: true, logo: true, slug: true },
        },
        skills: {
          include: { skill: true },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    // Overlap scoring only, so nothing here awaits. The AI pass happens below,
    // against the top few once they are ranked.
    const jobsWithScores = matchingJobs.map((job) => {
      const jobSkillNames = job.skills.map(js => js.skill.name);
      const matchedSkills = jobSkillNames.filter(s => skills.includes(s));
      const matchScore = Math.min(100, (matchedSkills.length / Math.max(jobSkillNames.length, 1)) * 100);

      return {
        ...job,
        matchScore: Math.round(matchScore),
        matchedSkills,
        aiInsight: null as string | null,
        aiMatchScore: null as number | null,
      };
    });

    // Sort by match score
    jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);

    // AI-enrich the top three matches. The AI reading is an upgrade, never a
    // requirement: when it is null or fails, the job keeps its skill-overlap
    // score and simply carries no insight, and one bad enrichment cannot take
    // the other recommendations down with it.
    //
    // The model's number goes into its own field and never into matchScore.
    // It used to overwrite it, which put two incompatible scales in one column:
    // matchScore is the share of a role's listed skills she already holds, and
    // the model's score is its own judgement of fit. The list was then filtered
    // on the mixture as though the two meant the same thing, so a role the
    // model liked jumped a threshold the overlap said it should not clear, and
    // three roles were measured one way while the other seven were measured
    // another. One column, one meaning.
    //
    // The enrichment is the one AI call on this route, and it is optional, so
    // the daily budget skips it rather than refusing the scan: a member whose
    // allowance is used still gets her skill-overlap matches, and is told why
    // they carry no AI reading.
    const budget = await checkAiBudget(req.user!.id);
    const topJobs = budget.allowed ? jobsWithScores.slice(0, 3) : [];
    const enrichedTopJobs = await Promise.all(topJobs.map(async (job) => {
        try {
            const profileContext = `Headline: ${user.headline}. Skills: ${skills.join(', ')}. Experience: ${user.experience.length} roles.`;
            const analysis = await aiService.evaluateJobMatch(profileContext, job.description, { userId: req.user!.id });
            if (!analysis) return job;
            return {
                ...job,
                aiMatchScore: analysis.score,
                aiInsight: analysis.analysis,
                missingSkills: analysis.missingSkills,
            };
        } catch {
            return job;
        }
    }));

    // Combine enriched top jobs with the rest (unenriched). The order is the
    // skill-overlap order established above and nothing below re-sorts it.
    const finalJobs = [
        ...enrichedTopJobs,
        ...jobsWithScores.slice(topJobs.length, 10)
    ].filter((job) => !Number.isFinite(minMatch) || job.matchScore >= minMatch);

    const opportunities = finalJobs.map(normalizeOpportunity);

    res.json({
      success: true,
      data: {
        jobs: finalJobs,
        opportunities,
        totalMatches: matchingJobs.length,
        scanDate: new Date(),
        aiInsightsWithheld: budget.allowed ? null : budget.message,
      },
    });
  } catch (error) {
    next(error);
  }
}

router.get('/opportunity-radar', authenticate, requireAiPremium, aiLimiter, opportunityRadarHandler);
router.post('/opportunity-radar', authenticate, requireAiPremium, aiLimiter, opportunityRadarHandler);

// ===========================================
// RESUME OPTIMIZER
// ===========================================
router.post('/resume-optimizer', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    // Both resume screens have always posted `resume` and a pasted
    // `jobDescription`; this handler read `resumeText` and `targetJobId`, so
    // every submission failed validation and the feature never ran end to end.
    // Both spellings are accepted, and a pasted description is used directly.
    const { resumeText, resume, targetJobId, jobDescription: pastedDescription } = req.body;
    const resumeBody = resumeText || resume;

    if (!resumeBody || typeof resumeBody !== 'string') {
      throw new ApiError(400, 'Resume text is required');
    }

    let targetJobTitle = null;
    let jobDescription: string | undefined =
      typeof pastedDescription === 'string' && pastedDescription.trim() ? pastedDescription : undefined;

    if (!jobDescription && targetJobId) {
      const targetJob = await prisma.job.findUnique({
        where: { id: targetJobId },
        select: { title: true, description: true }
      });
      if (targetJob) {
        targetJobTitle = targetJob.title;
        jobDescription = targetJob.description;
      }
    }

    const data = await aiService.optimizeResume(resumeBody, jobDescription, { userId: req.user!.id });

    // Nothing here is stored: there is no table for an analysis yet, so the
    // result lives in her browser tab and nowhere else. The commented-out
    // "analysis complete" notification that sat here would have pointed her at
    // a record that does not exist, so it is gone rather than kept for later.

    res.json({
      success: true,
      data: {
        ...data,
        targetJob: targetJobTitle,
      }
    });

  } catch (error) {
    next(error);
  }
});

// ===========================================
// INTERVIEW COACH
// ===========================================
//
// Two ways in. With a `jobId` the questions are drawn from that listing's own
// description, which is what this route always did and nothing on the web app
// ever called. With a `jobRole` — the role she typed on the coach screen — they
// are drawn from the role. The screen used to open every session with one of
// four fixed sentences keyed only by interview type, whatever role she had
// entered, beside a hub card promising "questions tailored to your target
// role"; the role form is what makes that true.
router.post('/interview-coach', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    const { jobId } = req.body;
    const questionType =
      typeof req.body.questionType === 'string'
        ? req.body.questionType
        : typeof req.body.interviewType === 'string'
          ? req.body.interviewType
          : 'mixed';
    const jobRole = typeof req.body.jobRole === 'string' ? req.body.jobRole.trim().slice(0, 200) : '';

    let description: string;
    let jobTitle: string;
    let company: string | null = null;

    if (typeof jobId === 'string' && jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { description: true, title: true, organization: { select: { name: true } } }
      });

      if (!job) {
          throw new ApiError(404, 'Job not found');
      }
      description = job.description;
      jobTitle = job.title;
      company = job.organization?.name ?? null;
    } else if (jobRole) {
      description = `The candidate is preparing to interview for this role: ${jobRole}. No job advertisement was supplied; ask what an interviewer for that role would ask.`;
      jobTitle = jobRole;
    } else {
      throw new ApiError(400, 'A job or the role you are interviewing for is required');
    }

    const data = await aiService.generateInterviewQuestions(description, questionType, { userId: req.user!.id });

    res.json({
      success: true,
      data: {
        ...data,
        jobTitle,
        company,
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/interview-coach/feedback', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    const { question, answer, jobRole, interviewType, difficulty } = req.body;

    if (!question || !answer || typeof question !== 'string' || typeof answer !== 'string') {
      throw new ApiError(400, 'Question and answer are required');
    }

    const data = await aiService.evaluateInterviewAnswer(
      {
        question,
        answer,
        jobRole: typeof jobRole === 'string' ? jobRole : undefined,
        interviewType: typeof interviewType === 'string' ? interviewType : undefined,
        difficulty: typeof difficulty === 'string' ? difficulty : undefined,
      },
      { userId: req.user!.id }
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CAREER PATH ANALYZER
// ===========================================
router.get('/career-path', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: true,
        skills: { include: { skill: true } },
        experience: { orderBy: { startDate: 'desc' } },
        education: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const profileSummary = `
Current Role: ${user.headline || 'Not specified'}
Persona: ${user.persona}
Skills: ${user.skills.map(s => `${s.skill.name} (${s.level})`).join(', ')}
Experience: 
${user.experience.map(e => `- ${e.title} at ${e.company} (${e.startDate?.getFullYear()} - ${e.endDate?.getFullYear() || 'Present'})`).join('\n')}
Education:
${user.education.map(e => `- ${e.degree} in ${e.fieldOfStudy || 'N/A'} from ${e.institution}`).join('\n')}
    `;

    const data = await aiService.generateCareerPath(profileSummary, undefined, { userId: req.user!.id });

    res.json({
      success: true,
      data: {
        ...data,
        currentProfile: {
          headline: user.headline,
          persona: user.persona,
          skillCount: user.skills.length,
          yearsExperience: user.experience.length > 0
            ? new Date().getFullYear() - (user.experience[user.experience.length - 1].startDate?.getFullYear() || new Date().getFullYear())
            : 0,
        },
        analyzedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CAREER PATH (targeted)
// ===========================================
// The GET above derives everything from the stored profile. The career-path page
// asks the user for a current role, a target role, and years of experience, so
// this variant plans against the goal they typed rather than only their history.
router.post('/career-path', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    const currentRole = typeof req.body.currentRole === 'string' ? req.body.currentRole.trim() : '';
    const targetRole = typeof req.body.targetRole === 'string' ? req.body.targetRole.trim() : '';

    if (!currentRole || !targetRole) {
      throw new ApiError(400, 'currentRole and targetRole are required');
    }

    const parsedYears = Number.parseInt(String(req.body.yearsExperience ?? ''), 10);
    const yearsExperience = Number.isFinite(parsedYears) && parsedYears >= 0 ? parsedYears : null;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { skills: { include: { skill: true } } },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const profileSummary = `
Current Role: ${currentRole.slice(0, 200)}
Target Role: ${targetRole.slice(0, 200)}
Years of Experience: ${yearsExperience ?? 'Not specified'}
Persona: ${user.persona}
Skills: ${user.skills.map((s) => `${s.skill.name} (${s.level})`).join(', ') || 'Not specified'}
    `;

    const data = await aiService.generateCareerPath(profileSummary, undefined, { userId: req.user!.id });

    res.json({
      success: true,
      data: {
        ...data,
        currentProfile: {
          headline: currentRole,
          targetRole,
          persona: user.persona,
          skillCount: user.skills.length,
          yearsExperience: yearsExperience ?? 0,
        },
        analyzedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CONTENT GENERATOR (For Creators)
// ===========================================
router.post('/content-generator', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    // The generator screen has always sent `type`, `tone` and `context`; this
    // handler read `contentType` and passed only the topic on, so every choice
    // on that screen except the topic was quietly discarded. Both spellings
    // are accepted so no caller breaks.
    const { contentType, type, topic, tone, platform, context } = req.body;
    const kind = contentType || type;

    if (!topic) {
      throw new ApiError(400, 'Topic is required');
    }

    const generated = await aiService.generateContent(topic, kind, platform, tone, context, { userId: req.user!.id });

    res.json({
      success: true,
      data: {
        contentType: kind || 'post',
        topic,
        platform: platform || 'LinkedIn',
        tone: tone || null,
        content: generated.content,
        // True only when no model was configured and nothing was written. The
        // screen shows the reason instead of an empty output pane.
        simulated: generated.simulated,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// BUSINESS IDEA VALIDATOR (For Entrepreneurs)
// ===========================================
router.post('/idea-validator', authenticate, requireAiPremium, aiLimiter, aiBudgetGate, async (req: AuthRequest, res, next) => {
  try {
    // The validator screen has always sent `category`, which this handler
    // discarded, and has never sent `problemSolved`, which it read — so the
    // prompt was built around a variable that was always undefined and the
    // one thing the member did choose never reached the model. Both are now
    // accepted, and `problem` is taken as well because that is what the field
    // is called on the screen.
    const { idea, targetMarket, problemSolved, problem, category } = req.body;

    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      throw new ApiError(400, 'Business idea is required');
    }

    const validation = await aiService.validateBusinessIdea(
      idea,
      typeof targetMarket === 'string' ? targetMarket : undefined,
      typeof problemSolved === 'string' ? problemSolved : typeof problem === 'string' ? problem : undefined,
      typeof category === 'string' ? category : undefined,
      { userId: req.user!.id }
    );

    res.json({
      success: true,
      data: {
        idea,
        targetMarket: targetMarket || null,
        category: category || null,
        ...validation,
        validatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// AI CHAT ASSISTANT
// ===========================================
router.get('/chat/usage', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { subscription: true },
    });

    const tier = user?.subscription?.tier || 'FREE';
    const premium = hasActivePremium(user?.subscription);

    // Every tier has a window now, so every tier is told where it stands. The
    // premium answer used to be `unlimited: true` with no usage at all, which
    // was never true: the per-minute limiter always applied, and now there is
    // a daily window as well.
    const { windowSeconds, maxRequests } = premium ? getPremiumChatQuotaConfig() : getFreeChatQuotaConfig();
    const shared = await getRateLimitStatus(`ai:chat:${req.user!.id}`, maxRequests, windowSeconds);
    // Whichever window has less left is the one she will actually hit, so it is
    // the one to report. Reading the local window never consumes from it.
    const local = localChatWindow(req.user!.id, windowSeconds, maxRequests, 'peek');
    const binding = local.remaining < shared.remaining ? local : shared;

    return res.json({
      success: true,
      data: {
        tier,
        premium,
        unlimited: false,
        usage: {
          limit: maxRequests,
          remaining: binding.remaining,
          resetIn: binding.resetIn,
          windowSeconds,
        },
        // What ATHENA Pro would give her, so the upgrade offer can name a
        // number rather than promise "unlimited".
        premiumLimit: premium ? null : getPremiumChatQuotaConfig().maxRequests,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * /chat was the only AI route on this router without `aiLimiter`: every other
 * one carries it, and this is the one that talks to OpenAI on every single
 * call. A premium account had no per-minute ceiling at all, so a loop against
 * this endpoint billed the platform for as long as it ran.
 *
 * The limiter is wrapped rather than mounted directly because of what it would
 * otherwise do to the crisis path. A member who has just sent ten messages and
 * then writes that she cannot go on must not be answered with 429. The phrase
 * check is local and costs nothing, the handler runs it again as its first act,
 * and a message that trips it goes straight through — it never reaches the
 * model, so it costs nothing to let past.
 */
const chatLimiter = (req: AuthRequest, res: Response, next: NextFunction) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : '';
  if (detectChatCrisis(message).flagged) return next();
  return aiLimiter(req, res, next);
};

router.post('/chat', authenticate, chatLimiter, async (req: AuthRequest, res, next) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const context = req.body?.context;

    if (!message) {
      throw new ApiError(400, 'Message is required');
    }
    if (message.length > 4000) {
      throw new ApiError(400, 'Message is too long (4000 characters at most)');
    }
    // The context is the conversation so far: a short list of role and content pairs, nothing else.
    if (context !== undefined && (!Array.isArray(context) || context.length > 40 || context.some((turn) => !turn || typeof turn !== 'object' || typeof (turn as { role?: unknown }).role !== 'string' || typeof (turn as { content?: unknown }).content !== 'string' || ((turn as { content: string }).content).length > 8000))) {
      throw new ApiError(400, 'Context must be a list of up to 40 turns, each with a role and content');
    }

    // The crisis screen runs before anything else in this handler, and in
    // particular before the free-tier quota. It is a local phrase check, so it
    // costs nothing to run first, and a member who has spent all twenty of her
    // free messages and then writes that she cannot go on must not be met with
    // "upgrade to Premium". She gets the numbers, the model is never called,
    // and the message does not count against her window.
    const crisis = detectChatCrisis(message);
    if (crisis.flagged && crisis.kind) {
      return await respondWithCrisis(res, req.user!.id, { ...crisis, flagged: true, kind: crisis.kind }, undefined);
    }

    // The chat window for her plan. Premium used to skip this block entirely,
    // which left aiLimiter's ten a minute as the only ceiling on a paying
    // account; it now has a larger window of its own.
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { subscription: true },
    });

    const premium = hasActivePremium(user?.subscription);
    const { windowSeconds: effectiveWindowSeconds, maxRequests: effectiveMaxRequests } = premium
      ? getPremiumChatQuotaConfig()
      : getFreeChatQuotaConfig();

    // Both windows are consumed and both must allow. The shared one is the
    // real quota; the local one is what is left of it when Redis is not
    // there to keep it. See localChatWindow above for why that matters.
    const shared = await checkRateLimit(
      `ai:chat:${req.user!.id}`,
      effectiveMaxRequests,
      effectiveWindowSeconds
    );
    const local = localChatWindow(
      req.user!.id,
      effectiveWindowSeconds,
      effectiveMaxRequests,
      'consume'
    );
    const rate = local.remaining < shared.remaining ? local : shared;

    const usage: ChatUsage = {
      limit: effectiveMaxRequests,
      remaining: rate.remaining,
      resetIn: rate.resetIn,
      windowSeconds: effectiveWindowSeconds,
    };

    if (!shared.allowed || !local.allowed) {
      res.set('Retry-After', String(rate.resetIn));
      throw new ApiError(
        429,
        premium
          ? `AI chat limit reached. Try again in ${rate.resetIn} seconds.`
          : `AI chat limit reached. Try again in ${rate.resetIn} seconds, or upgrade to ATHENA Pro.`
      );
    }

    // The provider screen, which reads what a phrase list cannot: it routes a
    // self-harm disclosure to the crisis reply rather than refusing it, and
    // refuses only what is aimed at somebody else. See ai-safety.service.
    const screening = await screenMemberMessage(message);
    if (screening.decision === 'block') {
      throw new ApiError(400, screening.reason);
    }
    if (screening.decision === 'crisis') {
      return await respondWithCrisis(res, req.user!.id, screening.check, usage);
    }

    // The daily token budget is read here, after both crisis screens and
    // immediately before the one call that costs money. Placed any earlier, a
    // member whose disclosure only the provider recognised would be told the
    // AI was paused instead of being given the numbers.
    const budget = await checkAiBudget(req.user!.id);
    if (!budget.allowed) {
      res.set('Retry-After', String(budget.resetIn));
      throw new ApiError(budget.scope === 'global' ? 503 : 429, budget.message);
    }

    const response = await aiService.chat(message, context, { userId: req.user!.id }); // context is passed as history array

    // The model's reply is screened too. It is a general-purpose model behind a
    // short system prompt, and what it says is published to a member in her own
    // dashboard with nobody else in the room.
    const replyScreening = await screenAssistantReply(response);
    if (replyScreening.decision === 'crisis') {
      return await respondWithCrisis(res, req.user!.id, replyScreening.check, usage);
    }

    res.json({
      success: true,
      data: {
        response: replyScreening.decision === 'block' ? WITHHELD_REPLY : response,
        crisis: { flagged: false },
        disclaimer: AI_CHAT_DISCLAIMER,
        timestamp: new Date(),
        usage,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
