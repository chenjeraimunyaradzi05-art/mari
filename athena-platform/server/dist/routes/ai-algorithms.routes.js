"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// =============================================
// CAREER COMPASS - Career Trajectory Prediction
// =============================================
// Get user's career predictions
router.get('/career-compass', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const prediction = await prisma.careerPrediction.findFirst({
            where: {
                userId,
                expiresAt: { gte: new Date() },
            },
            orderBy: { generatedAt: 'desc' },
        });
        res.json({ data: prediction });
    }
    catch (error) {
        console.error('Error fetching career prediction:', error);
        res.status(500).json({ error: 'Failed to fetch career prediction' });
    }
});
// Generate new career prediction
router.post('/career-compass/generate', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // In production, this would call the ML model
        // For now, create a placeholder prediction
        const prediction = await prisma.careerPrediction.create({
            data: {
                userId,
                predictedRoles: [
                    { role: 'Senior Software Engineer', probability: 75, expectedSalary: '$150,000 - $180,000', timeline: '12 months', skillsGap: ['System Design', 'Leadership'] },
                    { role: 'Engineering Manager', probability: 45, expectedSalary: '$180,000 - $220,000', timeline: '24 months', skillsGap: ['People Management', 'Strategic Planning'] },
                ],
                prioritySkills: [
                    { skill: 'System Design', salaryLift: 15000, learningTime: 120, difficulty: 7 },
                    { skill: 'Cloud Architecture', salaryLift: 12000, learningTime: 80, difficulty: 6 },
                    { skill: 'Leadership', salaryLift: 20000, learningTime: 200, difficulty: 8 },
                ],
                mentorRecommendations: [],
                opportunitiesToTrack: [],
                riskFactors: {
                    attritionRisk: 25,
                    burnoutIndicators: 15,
                    wageGapExposure: 8,
                },
                modelVersion: 'v1.0.0',
                confidenceScore: 0.78,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });
        res.json({ data: prediction });
    }
    catch (error) {
        console.error('Error generating career prediction:', error);
        res.status(500).json({ error: 'Failed to generate career prediction' });
    }
});
// =============================================
// OPPORTUNITY SCAN - Real-Time Opportunity Surfacing
// =============================================
// Get matched opportunities
router.get('/opportunity-scan', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { type, viewed } = req.query;
        const opportunities = await prisma.opportunityMatch.findMany({
            where: {
                userId,
                ...(type && { opportunityType: type }),
                ...(viewed === 'false' && { isViewed: false }),
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: new Date() } },
                ],
            },
            orderBy: { matchScore: 'desc' },
            take: 20,
        });
        res.json({ data: opportunities });
    }
    catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
});
// Mark opportunity as viewed
router.patch('/opportunity-scan/:id/view', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const opportunity = await prisma.opportunityMatch.update({
            where: { id, userId },
            data: {
                isViewed: true,
                viewedAt: new Date(),
            },
        });
        res.json({ data: opportunity });
    }
    catch (error) {
        console.error('Error marking opportunity viewed:', error);
        res.status(500).json({ error: 'Failed to update opportunity' });
    }
});
// Record interest/feedback on opportunity
router.patch('/opportunity-scan/:id/feedback', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { isInterested, feedback } = req.body;
        const opportunity = await prisma.opportunityMatch.update({
            where: { id, userId },
            data: {
                isInterested,
                feedback,
                interactionAt: new Date(),
            },
        });
        res.json({ data: opportunity });
    }
    catch (error) {
        console.error('Error recording feedback:', error);
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});
// =============================================
// SALARY EQUITY - Pay Gap Detection
// =============================================
// Submit anonymous salary data
router.post('/salary-equity/submit', async (req, res) => {
    try {
        const userId = req.user?.id; // Optional for anonymous
        const { jobTitle, company, companySize, industry, city, state, country, isRemote, baseSalary, currency, bonus, equity, yearsExperience, yearsInRole, educationLevel, gender, ageRange, } = req.body;
        if (!jobTitle || !baseSalary) {
            return res.status(400).json({ error: 'Job title and base salary are required' });
        }
        const dataPoint = await prisma.salaryDataPoint.create({
            data: {
                userId,
                jobTitle,
                normalizedTitle: jobTitle.toLowerCase().trim(),
                company,
                companySize,
                industry,
                city,
                state,
                country: country || 'Australia',
                isRemote: isRemote || false,
                baseSalary,
                currency: currency || 'AUD',
                bonus,
                equity,
                totalComp: baseSalary + (bonus || 0) + (equity || 0),
                yearsExperience,
                yearsInRole,
                educationLevel,
                gender,
                ageRange,
            },
        });
        res.json({ data: { id: dataPoint.id }, message: 'Salary data submitted successfully' });
    }
    catch (error) {
        console.error('Error submitting salary data:', error);
        res.status(500).json({ error: 'Failed to submit salary data' });
    }
});
// Get salary analysis for a role
router.get('/salary-equity/analyze', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { role, location, company } = req.query;
        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }
        // Get salary data points for analysis
        const salaryData = await prisma.salaryDataPoint.findMany({
            where: {
                normalizedTitle: { contains: role.toLowerCase() },
                ...(location && { city: { contains: location } }),
            },
            select: {
                baseSalary: true,
                totalComp: true,
                gender: true,
                yearsExperience: true,
                educationLevel: true,
                companySize: true,
            },
        });
        if (salaryData.length < 5) {
            return res.json({
                data: null,
                message: 'Insufficient data for analysis. Need at least 5 salary data points.',
            });
        }
        // Calculate statistics
        const salaries = salaryData.map(d => Number(d.baseSalary)).sort((a, b) => a - b);
        const median = salaries[Math.floor(salaries.length / 2)];
        const p10 = salaries[Math.floor(salaries.length * 0.1)];
        const p25 = salaries[Math.floor(salaries.length * 0.25)];
        const p75 = salaries[Math.floor(salaries.length * 0.75)];
        const p90 = salaries[Math.floor(salaries.length * 0.9)];
        // Gender gap analysis
        const womenSalaries = salaryData.filter(d => d.gender === 'WOMAN').map(d => Number(d.baseSalary));
        const menSalaries = salaryData.filter(d => d.gender === 'MAN').map(d => Number(d.baseSalary));
        let genderGapAmount = null;
        let genderGapPercent = null;
        if (womenSalaries.length >= 3 && menSalaries.length >= 3) {
            const womenMedian = womenSalaries.sort((a, b) => a - b)[Math.floor(womenSalaries.length / 2)];
            const menMedian = menSalaries.sort((a, b) => a - b)[Math.floor(menSalaries.length / 2)];
            genderGapAmount = menMedian - womenMedian;
            genderGapPercent = ((menMedian - womenMedian) / menMedian) * 100;
        }
        // Save or update analysis
        const analysis = await prisma.salaryAnalysis.create({
            data: {
                userId,
                targetRole: role,
                targetLocation: location,
                targetCompany: company,
                marketMedian: median,
                genderGapAmount,
                genderGapPercent,
                sampleSize: salaryData.length,
                salaryBands: { p10, p25, p50: median, p75, p90 },
                negotiationTips: [
                    { tip: 'Research comparable roles at similar companies', priority: 1 },
                    { tip: 'Highlight your unique skills and accomplishments', priority: 2 },
                    { tip: 'Practice your negotiation with a mentor', priority: 3 },
                ],
            },
        });
        res.json({ data: analysis });
    }
    catch (error) {
        console.error('Error analyzing salary:', error);
        res.status(500).json({ error: 'Failed to analyze salary data' });
    }
});
// Get user's salary analyses history
router.get('/salary-equity/my-analyses', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const analyses = await prisma.salaryAnalysis.findMany({
            where: { userId },
            orderBy: { generatedAt: 'desc' },
            take: 10,
        });
        res.json({ data: analyses });
    }
    catch (error) {
        console.error('Error fetching analyses:', error);
        res.status(500).json({ error: 'Failed to fetch salary analyses' });
    }
});
// =============================================
// MENTOR MATCH - AI-Powered Mentor Pairing
// =============================================
// Get mentor recommendations
router.get('/mentor-match', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const matches = await prisma.mentorMatchScore.findMany({
            where: {
                menteeId: userId,
                isActive: true,
            },
            orderBy: { overallScore: 'desc' },
            take: 10,
            include: {
                mentor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        headline: true,
                        avatar: true,
                    },
                },
            },
        });
        res.json({ data: matches });
    }
    catch (error) {
        console.error('Error fetching mentor matches:', error);
        res.status(500).json({ error: 'Failed to fetch mentor matches' });
    }
});
// Get match details with a specific mentor
router.get('/mentor-match/:mentorId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { mentorId } = req.params;
        const match = await prisma.mentorMatchScore.findUnique({
            where: {
                menteeId_mentorId: {
                    menteeId: userId,
                    mentorId,
                },
            },
            include: {
                mentor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        headline: true,
                        avatar: true,
                        bio: true,
                    },
                },
            },
        });
        res.json({ data: match });
    }
    catch (error) {
        console.error('Error fetching mentor match:', error);
        res.status(500).json({ error: 'Failed to fetch mentor match' });
    }
});
// =============================================
// SAFETY SCORE - Trust & Verification
// =============================================
// Get user's trust score
router.get('/trust-score', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let trustScore = await prisma.userTrustScore.findUnique({
            where: { userId },
        });
        // Create default trust score if doesn't exist
        if (!trustScore) {
            trustScore = await prisma.userTrustScore.create({
                data: {
                    userId,
                    trustScore: 50,
                    badges: [],
                },
            });
        }
        res.json({ data: trustScore });
    }
    catch (error) {
        console.error('Error fetching trust score:', error);
        res.status(500).json({ error: 'Failed to fetch trust score' });
    }
});
// Get trust score for another user (limited info)
router.get('/trust-score/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const trustScore = await prisma.userTrustScore.findUnique({
            where: { userId },
            select: {
                trustScore: true,
                badges: true,
                identityVerified: true,
            },
        });
        res.json({ data: trustScore });
    }
    catch (error) {
        console.error('Error fetching user trust score:', error);
        res.status(500).json({ error: 'Failed to fetch trust score' });
    }
});
// Report content
router.post('/report', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { contentType, contentId, reportedUserId, reason, description } = req.body;
        if (!contentType || !contentId || !reportedUserId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const report = await prisma.contentReport.create({
            data: {
                reporterId: userId,
                contentType,
                contentId,
                reportedUserId,
                reason,
                description,
            },
        });
        res.json({ data: { id: report.id }, message: 'Report submitted successfully' });
    }
    catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});
// =============================================
// INCOME STREAM - Creator Analytics
// =============================================
// Get creator analytics
router.get('/creator-analytics', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let analytics = await prisma.creatorAnalytics.findUnique({
            where: { userId },
        });
        // Create default analytics if doesn't exist
        if (!analytics) {
            analytics = await prisma.creatorAnalytics.create({
                data: {
                    userId,
                    creatorTier: 'BRONZE',
                },
            });
        }
        res.json({ data: analytics });
    }
    catch (error) {
        console.error('Error fetching creator analytics:', error);
        res.status(500).json({ error: 'Failed to fetch creator analytics' });
    }
});
// Get income projections
router.get('/creator-analytics/projections', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const analytics = await prisma.creatorAnalytics.findUnique({
            where: { userId },
            select: {
                followerCount: true,
                avgEngagementRate: true,
                creatorTier: true,
                projectedIncome: true,
                topRevenueStreams: true,
                monetizationRoadmap: true,
            },
        });
        if (!analytics) {
            return res.json({ data: null });
        }
        // Generate projections if not cached
        if (!analytics.projectedIncome) {
            const followers = analytics.followerCount;
            const engagement = analytics.avgEngagementRate || 0.05;
            const projections = {
                conservative: Math.floor(followers * 0.001 * engagement * 100),
                realistic: Math.floor(followers * 0.003 * engagement * 100),
                optimistic: Math.floor(followers * 0.008 * engagement * 100),
            };
            await prisma.creatorAnalytics.update({
                where: { userId },
                data: {
                    projectedIncome: projections,
                    topRevenueStreams: [
                        { stream: 'Ad Revenue', potential: projections.realistic * 0.3, effort: 'LOW' },
                        { stream: 'Sponsorships', potential: projections.realistic * 0.5, effort: 'MEDIUM' },
                        { stream: 'Digital Products', potential: projections.realistic * 0.2, effort: 'HIGH' },
                    ],
                },
            });
            return res.json({
                data: {
                    ...analytics,
                    projectedIncome: projections,
                },
            });
        }
        res.json({ data: analytics });
    }
    catch (error) {
        console.error('Error fetching projections:', error);
        res.status(500).json({ error: 'Failed to fetch income projections' });
    }
});
// =============================================
// FEED PREFERENCES - OpportunityVerse Algorithm
// =============================================
// Get feed preferences
router.get('/feed-preferences', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let prefs = await prisma.userFeedPreferences.findUnique({
            where: { userId },
        });
        // Create default preferences if doesn't exist
        if (!prefs) {
            prefs = await prisma.userFeedPreferences.create({
                data: {
                    userId,
                    followedCategories: [],
                    followedHashtags: [],
                    blockedHashtags: [],
                    blockedCreators: [],
                    searchHistory: [],
                },
            });
        }
        res.json({ data: prefs });
    }
    catch (error) {
        console.error('Error fetching feed preferences:', error);
        res.status(500).json({ error: 'Failed to fetch feed preferences' });
    }
});
// Update feed preferences
router.patch('/feed-preferences', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { followedCategories, followedHashtags, blockedHashtags, blockedCreators, inNetworkRatio, outNetworkRatio, trendingRatio, preferredDuration, autoplayEnabled, } = req.body;
        const prefs = await prisma.userFeedPreferences.upsert({
            where: { userId },
            update: {
                ...(followedCategories && { followedCategories }),
                ...(followedHashtags && { followedHashtags }),
                ...(blockedHashtags && { blockedHashtags }),
                ...(blockedCreators && { blockedCreators }),
                ...(inNetworkRatio !== undefined && { inNetworkRatio }),
                ...(outNetworkRatio !== undefined && { outNetworkRatio }),
                ...(trendingRatio !== undefined && { trendingRatio }),
                ...(preferredDuration && { preferredDuration }),
                ...(autoplayEnabled !== undefined && { autoplayEnabled }),
            },
            create: {
                userId,
                followedCategories: followedCategories || [],
                followedHashtags: followedHashtags || [],
                blockedHashtags: blockedHashtags || [],
                blockedCreators: blockedCreators || [],
                searchHistory: [],
                inNetworkRatio: inNetworkRatio || 0.3,
                outNetworkRatio: outNetworkRatio || 0.5,
                trendingRatio: trendingRatio || 0.2,
                preferredDuration,
                autoplayEnabled: autoplayEnabled ?? true,
            },
        });
        res.json({ data: prefs });
    }
    catch (error) {
        console.error('Error updating feed preferences:', error);
        res.status(500).json({ error: 'Failed to update feed preferences' });
    }
});
// Add to search history
router.post('/feed-preferences/search', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const prefs = await prisma.userFeedPreferences.findUnique({
            where: { userId },
        });
        const currentHistory = prefs?.searchHistory || [];
        // Keep last 50 searches, remove duplicates
        const newHistory = [query, ...currentHistory.filter(q => q !== query)].slice(0, 50);
        await prisma.userFeedPreferences.upsert({
            where: { userId },
            update: { searchHistory: newHistory },
            create: {
                userId,
                followedCategories: [],
                followedHashtags: [],
                blockedHashtags: [],
                blockedCreators: [],
                searchHistory: newHistory,
            },
        });
        res.json({ message: 'Search recorded' });
    }
    catch (error) {
        console.error('Error recording search:', error);
        res.status(500).json({ error: 'Failed to record search' });
    }
});
exports.default = router;
//# sourceMappingURL=ai-algorithms.routes.js.map