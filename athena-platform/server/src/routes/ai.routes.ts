import { NextFunction, Response, Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest, requirePremium } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { aiService } from '../services/ai.service';
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

function getFreeChatQuotaConfig() {
  const defaultWindowSeconds = 24 * 60 * 60;
  const defaultMaxRequests = 20;

  const windowSeconds = Number.parseInt(
    process.env.AI_CHAT_FREE_WINDOW_SECONDS || String(defaultWindowSeconds),
    10
  );
  const maxRequests = Number.parseInt(
    process.env.AI_CHAT_FREE_MAX_REQUESTS || String(defaultMaxRequests),
    10
  );

  const effectiveWindowSeconds = Number.isFinite(windowSeconds) && windowSeconds > 0
    ? windowSeconds
    : defaultWindowSeconds;
  const effectiveMaxRequests = Number.isFinite(maxRequests) && maxRequests > 0
    ? maxRequests
    : defaultMaxRequests;

  return { windowSeconds: effectiveWindowSeconds, maxRequests: effectiveMaxRequests };
}

/** The free-tier window as every chat response reports it. */
type ChatUsage = { limit: number; remaining: number; resetIn: number; windowSeconds: number };

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
    const topJobs = jobsWithScores.slice(0, 3);
    const enrichedTopJobs = await Promise.all(topJobs.map(async (job) => {
        try {
            const profileContext = `Headline: ${user.headline}. Skills: ${skills.join(', ')}. Experience: ${user.experience.length} roles.`;
            const analysis = await aiService.evaluateJobMatch(profileContext, job.description);
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
        ...jobsWithScores.slice(3, 10)
    ].filter((job) => !Number.isFinite(minMatch) || job.matchScore >= minMatch);

    const opportunities = finalJobs.map(normalizeOpportunity);

    res.json({
      success: true,
      data: {
        jobs: finalJobs,
        opportunities,
        totalMatches: matchingJobs.length,
        scanDate: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
}

router.get('/opportunity-radar', authenticate, requirePremium, aiLimiter, opportunityRadarHandler);
router.post('/opportunity-radar', authenticate, requirePremium, aiLimiter, opportunityRadarHandler);

// ===========================================
// RESUME OPTIMIZER
// ===========================================
router.post('/resume-optimizer', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
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

    const data = await aiService.optimizeResume(resumeBody, jobDescription);

    // Log AI usage
    /*
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        type: 'SYSTEM',
        title: 'Resume Analysis Complete',
        message: 'Your AI resume analysis is ready to view.',
      },
    });
    */

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
router.post('/interview-coach', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { jobId, questionType = 'mixed' } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { description: true, title: true, organization: { select: { name: true } } }
    });

    if (!job) {
        throw new ApiError(404, 'Job not found');
    }

    const data = await aiService.generateInterviewQuestions(job.description, questionType);

    res.json({
      success: true,
      data: {
        ...data,
        jobTitle: job.title,
        company: job.organization?.name
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/interview-coach/feedback', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { question, answer, jobRole, interviewType, difficulty } = req.body;

    if (!question || !answer) {
      throw new ApiError(400, 'Question and answer are required');
    }

    const data = await aiService.evaluateInterviewAnswer({
      question,
      answer,
      jobRole,
      interviewType,
      difficulty,
    });

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
router.get('/career-path', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
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

    const data = await aiService.generateCareerPath(profileSummary);

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
router.post('/career-path', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
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

    const data = await aiService.generateCareerPath(profileSummary);

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
router.post('/content-generator', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
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

    const generated = await aiService.generateContent(topic, kind, platform, tone, context);

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
router.post('/idea-validator', authenticate, requirePremium, aiLimiter, async (req: AuthRequest, res, next) => {
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
      typeof category === 'string' ? category : undefined
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

    if (tier !== 'FREE') {
      return res.json({
        success: true,
        data: {
          tier,
          unlimited: true,
          usage: null,
          timestamp: new Date(),
        },
      });
    }

    const { windowSeconds, maxRequests } = getFreeChatQuotaConfig();
    const shared = await getRateLimitStatus(`ai:chat:${req.user!.id}`, maxRequests, windowSeconds);
    // Whichever window has less left is the one she will actually hit, so it is
    // the one to report. Reading the local window never consumes from it.
    const local = localChatWindow(req.user!.id, windowSeconds, maxRequests, 'peek');
    const binding = local.remaining < shared.remaining ? local : shared;

    return res.json({
      success: true,
      data: {
        tier,
        unlimited: false,
        usage: {
          limit: maxRequests,
          remaining: binding.remaining,
          resetIn: binding.resetIn,
          windowSeconds,
        },
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

    // Check usage limits for free tier
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { subscription: true },
    });

    const tier = user?.subscription?.tier || 'FREE';

    let usage: ChatUsage | undefined;

    if (tier === 'FREE') {
      const { windowSeconds: effectiveWindowSeconds, maxRequests: effectiveMaxRequests } =
        getFreeChatQuotaConfig();

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

      usage = {
        limit: effectiveMaxRequests,
        remaining: rate.remaining,
        resetIn: rate.resetIn,
        windowSeconds: effectiveWindowSeconds,
      };

      if (!shared.allowed || !local.allowed) {
        res.set('Retry-After', String(rate.resetIn));
        throw new ApiError(
          429,
          `AI chat limit reached. Try again in ${rate.resetIn} seconds, or upgrade to Premium.`
        );
      }
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

    const response = await aiService.chat(message, context); // context is passed as history array

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
