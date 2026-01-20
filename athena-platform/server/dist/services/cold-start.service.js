"use strict";
/**
 * Cold Start Algorithm Service
 * Handles new users with no history using demographic-based recommendations
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.coldStartAlgorithm = void 0;
exports.isUserColdStart = isUserColdStart;
exports.getColdStartScore = getColdStartScore;
exports.getColdStartRecommendations = getColdStartRecommendations;
exports.getOnboardingSuggestions = getOnboardingSuggestions;
const prisma_1 = require("../utils/prisma");
// ==========================================
// DEMOGRAPHIC PROFILES
// ==========================================
// Popular content for each persona
const PERSONA_DEFAULTS = {
    EARLY_CAREER: {
        interests: ['career development', 'networking', 'skill building', 'interview tips'],
        recommendedSkills: ['Communication', 'Problem Solving', 'Time Management', 'Teamwork'],
        contentTypes: ['educational', 'career_tips', 'success_stories'],
    },
    MID_CAREER: {
        interests: ['leadership', 'work-life balance', 'salary negotiation', 'career transition'],
        recommendedSkills: ['Leadership', 'Project Management', 'Strategic Thinking', 'Mentoring'],
        contentTypes: ['industry_insights', 'leadership', 'professional_development'],
    },
    ENTREPRENEUR: {
        interests: ['startup', 'funding', 'business growth', 'networking'],
        recommendedSkills: ['Business Development', 'Financial Management', 'Marketing', 'Sales'],
        contentTypes: ['entrepreneurship', 'funding', 'business_tips'],
    },
    CREATOR: {
        interests: ['content creation', 'personal branding', 'monetization', 'audience growth'],
        recommendedSkills: ['Content Strategy', 'Video Production', 'Social Media', 'Storytelling'],
        contentTypes: ['creator_tips', 'monetization', 'platform_growth'],
    },
    MENTOR: {
        interests: ['coaching', 'leadership', 'giving back', 'professional development'],
        recommendedSkills: ['Coaching', 'Active Listening', 'Goal Setting', 'Feedback'],
        contentTypes: ['mentorship', 'coaching', 'leadership'],
    },
    EDUCATION_PROVIDER: {
        interests: ['curriculum design', 'online learning', 'student engagement', 'EdTech'],
        recommendedSkills: ['Instructional Design', 'Assessment', 'E-learning', 'Facilitation'],
        contentTypes: ['education', 'teaching', 'EdTech'],
    },
    EMPLOYER: {
        interests: ['talent acquisition', 'employer branding', 'diversity hiring', 'retention'],
        recommendedSkills: ['Recruiting', 'Employer Branding', 'Interview Skills', 'DEI'],
        contentTypes: ['recruiting', 'talent', 'workplace_culture'],
    },
    REAL_ESTATE: {
        interests: ['property investment', 'market trends', 'housing', 'commercial real estate'],
        recommendedSkills: ['Market Analysis', 'Negotiation', 'Property Management', 'Investment'],
        contentTypes: ['real_estate', 'investment', 'market_trends'],
    },
    GOVERNMENT_NGO: {
        interests: ['social impact', 'policy', 'community development', 'nonprofit management'],
        recommendedSkills: ['Grant Writing', 'Policy Analysis', 'Community Engagement', 'Program Management'],
        contentTypes: ['social_impact', 'policy', 'community'],
    },
};
// ==========================================
// COLD START DETECTION
// ==========================================
/**
 * Determine if a user is in "cold start" mode
 */
async function isUserColdStart(userId) {
    const [interactions, profileCompletion] = await Promise.all([
        // Check interaction count
        prisma_1.prisma.like.count({ where: { userId } }),
        // Check profile completion
        prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                persona: true,
                currentJobTitle: true,
                profile: { select: { bio: true } },
                skills: { select: { id: true } },
            },
        }),
    ]);
    // Cold start if:
    // - Less than 10 interactions
    // - No persona set
    // - Less than 3 skills
    const hasFewInteractions = interactions < 10;
    const hasNoPersona = !profileCompletion?.persona;
    const hasFewSkills = (profileCompletion?.skills?.length || 0) < 3;
    return hasFewInteractions || hasNoPersona || hasFewSkills;
}
/**
 * Get cold start score (0-100, higher = more cold start)
 */
async function getColdStartScore(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            profile: true,
            skills: true,
            _count: {
                select: {
                    likes: true,
                    posts: true,
                    comments: true,
                    following: true,
                },
            },
        },
    });
    if (!user)
        return 100;
    let score = 100;
    // Profile completion
    if (user.persona)
        score -= 15;
    if (user.currentJobTitle)
        score -= 10;
    if (user.profile?.bio)
        score -= 10;
    if (user.skills.length >= 3)
        score -= 15;
    if (user.skills.length >= 5)
        score -= 10;
    // Interaction history
    if (user._count.likes >= 5)
        score -= 10;
    if (user._count.likes >= 20)
        score -= 10;
    if (user._count.posts >= 1)
        score -= 5;
    if (user._count.comments >= 5)
        score -= 5;
    if (user._count.following >= 5)
        score -= 10;
    return Math.max(0, score);
}
// ==========================================
// COLD START RECOMMENDATIONS
// ==========================================
/**
 * Get recommendations for a cold start user
 */
async function getColdStartRecommendations(userId, limit = 20) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            profile: { select: { location: true } },
            skills: { include: { skill: true } },
        },
    });
    if (!user)
        return [];
    const persona = user.persona || 'EARLY_CAREER';
    const personaDefaults = PERSONA_DEFAULTS[persona];
    const userSkills = user.skills.map((s) => s.skill?.name?.toLowerCase()) || [];
    const location = user.profile?.location;
    const recommendations = [];
    // 1. Recommend popular content for persona
    const popularPosts = await getPopularPostsForPersona(persona, 5);
    recommendations.push(...popularPosts.map((post) => ({
        type: 'POST',
        id: post.id,
        title: post.content?.slice(0, 100) || 'Popular post',
        reason: `Popular in the ${persona.toLowerCase().replace('_', ' ')} community`,
        score: 80,
        data: post,
    })));
    // 2. Recommend skill-building courses
    const recommendedSkills = personaDefaults.recommendedSkills.filter((s) => !userSkills.includes(s.toLowerCase()));
    if (recommendedSkills.length > 0) {
        const courses = await getCoursesForSkills(recommendedSkills, 3);
        recommendations.push(...courses.map((course) => ({
            type: 'COURSE',
            id: course.id,
            title: course.title,
            reason: `Build essential skills for your career`,
            score: 85,
            data: course,
        })));
    }
    // 3. Recommend relevant jobs
    const jobs = await getJobsForPersona(persona, location, 4);
    recommendations.push(...jobs.map((job) => ({
        type: 'JOB',
        id: job.id,
        title: job.title,
        reason: location ? `Jobs near ${location}` : 'Recommended for your profile',
        score: 75,
        data: job,
    })));
    // 4. Recommend mentors
    const mentors = await getMentorsForPersona(persona, 3);
    recommendations.push(...mentors.map((mentor) => ({
        type: 'MENTOR',
        id: mentor.id,
        title: `${mentor.user?.firstName} ${mentor.user?.lastName}`,
        reason: 'Mentor in your field',
        score: 70,
        data: mentor,
    })));
    // 5. Recommend users to follow (similar persona, active)
    const usersToFollow = await getSuggestedUsersForPersona(userId, persona, 5);
    recommendations.push(...usersToFollow.map((u) => ({
        type: 'USER',
        id: u.id,
        title: u.displayName,
        reason: 'Active member in your community',
        score: 65,
        data: u,
    })));
    // 6. Recommend groups
    const groups = await getGroupsForPersona(persona, 3);
    recommendations.push(...groups.map((group) => ({
        type: 'GROUP',
        id: group.id,
        title: group.name,
        reason: `Popular ${persona.toLowerCase().replace('_', ' ')} community`,
        score: 60,
        data: group,
    })));
    // Sort by score and limit
    return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
// ==========================================
// DATA FETCHERS
// ==========================================
async function getPopularPostsForPersona(persona, limit) {
    return prisma_1.prisma.post.findMany({
        where: {
            isPublic: true,
            isHidden: false,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            author: { persona },
        },
        orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
        take: limit,
        include: {
            author: { select: { displayName: true, avatar: true } },
        },
    });
}
async function getCoursesForSkills(skills, limit) {
    return prisma_1.prisma.course.findMany({
        where: {
            status: 'PUBLISHED',
            OR: skills.map((skill) => ({
                title: { contains: skill, mode: 'insensitive' },
            })),
        },
        orderBy: { enrollmentCount: 'desc' },
        take: limit,
        include: {
            instructor: { select: { displayName: true, avatar: true } },
        },
    });
}
async function getJobsForPersona(persona, location, limit) {
    const where = {
        status: 'ACTIVE',
    };
    // Map persona to job types
    if (persona === 'EARLY_CAREER') {
        where.type = { in: ['FULL_TIME', 'INTERNSHIP', 'APPRENTICESHIP'] };
        where.experienceLevel = { in: ['ENTRY', 'JUNIOR'] };
    }
    if (location) {
        where.location = { contains: location, mode: 'insensitive' };
    }
    return prisma_1.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            organization: { select: { name: true, logo: true } },
        },
    });
}
async function getMentorsForPersona(persona, limit) {
    return prisma_1.prisma.mentorProfile.findMany({
        where: {
            isAvailable: true,
            user: { persona },
        },
        orderBy: [{ rating: 'desc' }, { sessionCount: 'desc' }],
        take: limit,
        include: {
            user: { select: { firstName: true, lastName: true, avatar: true, headline: true } },
        },
    });
}
async function getSuggestedUsersForPersona(userId, persona, limit) {
    return prisma_1.prisma.user.findMany({
        where: {
            id: { not: userId },
            persona,
            isActive: true,
            // Has some activity
            posts: { some: {} },
        },
        orderBy: { lastLoginAt: 'desc' },
        take: limit,
        select: {
            id: true,
            displayName: true,
            avatar: true,
            headline: true,
            _count: { select: { posts: true, followers: true } },
        },
    });
}
async function getGroupsForPersona(persona, limit) {
    // Map persona to group categories
    const categoryMap = {
        EARLY_CAREER: ['career', 'networking', 'skills'],
        ENTREPRENEUR: ['startup', 'business', 'funding'],
        CREATOR: ['content', 'creator', 'social media'],
    };
    const categories = categoryMap[persona] || ['general'];
    return prisma_1.prisma.group.findMany({
        where: {
            privacy: 'PUBLIC',
            OR: categories.map((cat) => ({
                name: { contains: cat, mode: 'insensitive' },
            })),
        },
        orderBy: { memberCount: 'desc' },
        take: limit,
        select: {
            id: true,
            name: true,
            description: true,
            avatar: true,
            memberCount: true,
        },
    });
}
// ==========================================
// ONBOARDING SUGGESTIONS
// ==========================================
/**
 * Get personalized onboarding steps for cold start user
 */
async function getOnboardingSuggestions(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            profile: true,
            skills: true,
            _count: {
                select: {
                    following: true,
                    posts: true,
                },
            },
        },
    });
    if (!user)
        return [];
    const suggestions = [];
    // Profile completion
    if (!user.persona) {
        suggestions.push({
            step: 'Select your persona',
            action: '/onboarding/persona',
            priority: 1,
        });
    }
    if (!user.profile?.bio) {
        suggestions.push({
            step: 'Add a bio',
            action: '/settings/profile',
            priority: 2,
        });
    }
    if (user.skills.length < 3) {
        suggestions.push({
            step: 'Add your skills',
            action: '/settings/skills',
            priority: 3,
        });
    }
    if (!user.avatar) {
        suggestions.push({
            step: 'Upload a profile photo',
            action: '/settings/profile',
            priority: 4,
        });
    }
    // Social engagement
    if (user._count.following < 5) {
        suggestions.push({
            step: 'Follow 5 people in your field',
            action: '/discover/people',
            priority: 5,
        });
    }
    if (user._count.posts === 0) {
        suggestions.push({
            step: 'Create your first post',
            action: '/compose',
            priority: 6,
        });
    }
    return suggestions.sort((a, b) => a.priority - b.priority);
}
exports.coldStartAlgorithm = {
    isUserColdStart,
    getColdStartScore,
    getColdStartRecommendations,
    getOnboardingSuggestions,
};
//# sourceMappingURL=cold-start.service.js.map