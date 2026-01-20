"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const ai_service_1 = require("../services/ai.service");
const cache_1 = require("../utils/cache");
function getFreeChatQuotaConfig() {
    const defaultWindowSeconds = 24 * 60 * 60;
    const defaultMaxRequests = 20;
    const windowSeconds = Number.parseInt(process.env.AI_CHAT_FREE_WINDOW_SECONDS || String(defaultWindowSeconds), 10);
    const maxRequests = Number.parseInt(process.env.AI_CHAT_FREE_MAX_REQUESTS || String(defaultMaxRequests), 10);
    const effectiveWindowSeconds = Number.isFinite(windowSeconds) && windowSeconds > 0
        ? windowSeconds
        : defaultWindowSeconds;
    const effectiveMaxRequests = Number.isFinite(maxRequests) && maxRequests > 0
        ? maxRequests
        : defaultMaxRequests;
    return { windowSeconds: effectiveWindowSeconds, maxRequests: effectiveMaxRequests };
}
const router = (0, express_1.Router)();
// ===========================================
// OPPORTUNITY RADAR - Personalized Job Matches
// ===========================================
router.get('/opportunity-radar', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                profile: true,
                skills: { include: { skill: true } },
                experience: true,
                education: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        // Get matching jobs based on user profile
        const skills = user.skills.map(us => us.skill.name);
        const matchingJobs = await prisma_1.prisma.job.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { title: { contains: user.headline || '', mode: 'insensitive' } },
                    { skills: { some: { skill: { name: { in: skills } } } } },
                ],
            },
            include: {
                organization: {
                    select: { name: true, logo: true, slug: true },
                },
                skills: {
                    include: { skill: true },
                },
            },
            take: 20,
        });
        // Calculate match scores using AI
        const jobsWithScores = await Promise.all(matchingJobs.map(async (job) => {
            const jobSkillNames = job.skills.map(js => js.skill.name);
            const matchedSkills = jobSkillNames.filter(s => skills.includes(s));
            const matchScore = Math.min(100, (matchedSkills.length / Math.max(jobSkillNames.length, 1)) * 100);
            return {
                ...job,
                matchScore: Math.round(matchScore),
                matchedSkills,
                aiInsight: null, // Will be populated by AI in premium tier
            };
        }));
        // Sort by match score
        jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);
        // AI Enrich the top 3 matches with deeper analysis
        const topJobs = jobsWithScores.slice(0, 3);
        const enrichedTopJobs = await Promise.all(topJobs.map(async (job) => {
            const profileContext = `Headline: ${user.headline}. Skills: ${skills.join(', ')}. Experience: ${user.experience.length} roles.`;
            const analysis = await ai_service_1.aiService.evaluateJobMatch(profileContext, job.description);
            return {
                ...job,
                matchScore: analysis.score || job.matchScore, // Prefer AI score
                aiInsight: analysis.analysis,
                missingSkills: analysis.missingSkills
            };
        }));
        // Combine enriched top jobs with the rest (unenriched)
        const finalJobs = [
            ...enrichedTopJobs,
            ...jobsWithScores.slice(3, 10)
        ];
        res.json({
            success: true,
            data: {
                jobs: finalJobs,
                totalMatches: matchingJobs.length,
                scanDate: new Date(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// RESUME OPTIMIZER
// ===========================================
router.post('/resume-optimizer', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const { resumeText, targetJobId } = req.body;
        if (!resumeText) {
            throw new errorHandler_1.ApiError(400, 'Resume text is required');
        }
        let targetJobTitle = null;
        let jobDescription = undefined;
        if (targetJobId) {
            const targetJob = await prisma_1.prisma.job.findUnique({
                where: { id: targetJobId },
                select: { title: true, description: true }
            });
            if (targetJob) {
                targetJobTitle = targetJob.title;
                jobDescription = targetJob.description;
            }
        }
        const data = await ai_service_1.aiService.optimizeResume(resumeText, jobDescription);
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// INTERVIEW COACH
// ===========================================
router.post('/interview-coach', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const { jobId, questionType = 'mixed' } = req.body;
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: jobId },
            select: { description: true, title: true, organization: { select: { name: true } } }
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        const data = await ai_service_1.aiService.generateInterviewQuestions(job.description, questionType);
        res.json({
            success: true,
            data: {
                ...data,
                jobTitle: job.title,
                company: job.organization?.name
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CAREER PATH ANALYZER
// ===========================================
router.get('/career-path', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                profile: true,
                skills: { include: { skill: true } },
                experience: { orderBy: { startDate: 'desc' } },
                education: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
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
        const data = await ai_service_1.aiService.generateCareerPath(profileSummary);
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CONTENT GENERATOR (For Creators)
// ===========================================
router.post('/content-generator', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const { contentType, topic, tone, platform, wordCount } = req.body;
        if (!topic) {
            throw new errorHandler_1.ApiError(400, 'Topic is required');
        }
        const content = await ai_service_1.aiService.generateContent(topic, contentType, platform);
        res.json({
            success: true,
            data: {
                contentType: contentType || 'post',
                topic,
                platform: platform || 'LinkedIn',
                content,
                generatedAt: new Date(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// BUSINESS IDEA VALIDATOR (For Entrepreneurs)
// ===========================================
router.post('/idea-validator', auth_1.authenticate, auth_1.requirePremium, async (req, res, next) => {
    try {
        const { idea, targetMarket, problemSolved } = req.body;
        if (!idea) {
            throw new errorHandler_1.ApiError(400, 'Business idea is required');
        }
        const analysis = await ai_service_1.aiService.validateBusinessIdea(idea, targetMarket, problemSolved);
        res.json({
            success: true,
            data: {
                idea,
                targetMarket,
                analysis,
                validatedAt: new Date(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// AI CHAT ASSISTANT
// ===========================================
router.get('/chat/usage', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
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
        const rate = await (0, cache_1.getRateLimitStatus)(`ai:chat:${req.user.id}`, maxRequests, windowSeconds);
        return res.json({
            success: true,
            data: {
                tier,
                unlimited: false,
                usage: {
                    limit: maxRequests,
                    remaining: rate.remaining,
                    resetIn: rate.resetIn,
                    windowSeconds,
                },
                timestamp: new Date(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/chat', auth_1.authenticate, async (req, res, next) => {
    try {
        const { message, context } = req.body;
        if (!message) {
            throw new errorHandler_1.ApiError(400, 'Message is required');
        }
        // Check usage limits for free tier
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { subscription: true },
        });
        const tier = user?.subscription?.tier || 'FREE';
        let usage;
        if (tier === 'FREE') {
            const { windowSeconds: effectiveWindowSeconds, maxRequests: effectiveMaxRequests } = getFreeChatQuotaConfig();
            const rate = await (0, cache_1.checkRateLimit)(`ai:chat:${req.user.id}`, effectiveMaxRequests, effectiveWindowSeconds);
            usage = {
                limit: effectiveMaxRequests,
                remaining: rate.remaining,
                resetIn: rate.resetIn,
                windowSeconds: effectiveWindowSeconds,
            };
            if (!rate.allowed) {
                res.set('Retry-After', String(rate.resetIn));
                throw new errorHandler_1.ApiError(429, `AI chat limit reached. Try again in ${rate.resetIn} seconds, or upgrade to Premium.`);
            }
        }
        const response = await ai_service_1.aiService.chat(message, context); // context is passed as history array
        res.json({
            success: true,
            data: {
                response,
                timestamp: new Date(),
                usage,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=ai.routes.js.map