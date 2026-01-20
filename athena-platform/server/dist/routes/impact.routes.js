"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// ===========================================
// IMPACT METRICS & REPORTS
// ===========================================
// GET /api/impact/metrics - Get user's impact metrics
router.get('/metrics', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const metrics = await prisma.impactMetric.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        console.error('Error fetching impact metrics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact metrics' });
    }
});
// POST /api/impact/metrics - Record an impact metric
router.post('/metrics', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { metricType, value, description, evidenceUrl, communityType, programId } = req.body;
        if (!metricType) {
            return res.status(400).json({ success: false, error: 'Metric type is required' });
        }
        const metric = await prisma.impactMetric.create({
            data: {
                userId,
                metricType,
                value: value ? parseFloat(value) : null,
                description,
                evidenceUrl,
                communityType,
                programId,
            },
        });
        res.status(201).json({ success: true, data: metric });
    }
    catch (error) {
        console.error('Error recording impact metric:', error);
        res.status(500).json({ success: false, error: 'Failed to record impact metric' });
    }
});
// GET /api/impact/reports - Get impact reports (public)
router.get('/reports', async (req, res) => {
    try {
        const { communityType, region, period } = req.query;
        const where = {};
        if (communityType)
            where.communityType = communityType;
        if (region)
            where.region = region;
        if (period)
            where.reportPeriod = period;
        const reports = await prisma.impactReport.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        res.json({ success: true, data: reports });
    }
    catch (error) {
        console.error('Error fetching impact reports:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact reports' });
    }
});
// GET /api/impact/reports/:id - Get specific impact report
router.get('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const report = await prisma.impactReport.findUnique({
            where: { id },
        });
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        res.json({ success: true, data: report });
    }
    catch (error) {
        console.error('Error fetching impact report:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact report' });
    }
});
// GET /api/impact/summary - Get user's impact summary
router.get('/summary', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const metrics = await prisma.impactMetric.findMany({
            where: { userId },
        });
        // Aggregate metrics by type
        const summary = metrics.reduce((acc, metric) => {
            const type = metric.metricType;
            if (!acc[type]) {
                acc[type] = { count: 0, totalValue: 0 };
            }
            acc[type].count += 1;
            if (metric.value) {
                acc[type].totalValue += parseFloat(metric.value.toString());
            }
            return acc;
        }, {});
        // Get program enrollments
        const enrollments = await prisma.programEnrollment.count({
            where: { userId },
        });
        const completedPrograms = await prisma.programEnrollment.count({
            where: { userId, status: 'COMPLETED' },
        });
        res.json({
            success: true,
            data: {
                metricsSummary: summary,
                totalMetrics: metrics.length,
                programsEnrolled: enrollments,
                programsCompleted: completedPrograms,
            },
        });
    }
    catch (error) {
        console.error('Error fetching impact summary:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact summary' });
    }
});
// ===========================================
// IMPACT PARTNERS
// ===========================================
// GET /api/impact/partners - List impact partners
router.get('/partners', async (req, res) => {
    try {
        const { region, type, focusArea } = req.query;
        const where = { isActive: true };
        if (region)
            where.region = region;
        if (type)
            where.type = type;
        if (focusArea)
            where.focusAreas = { has: focusArea };
        const partners = await prisma.impactPartner.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: partners });
    }
    catch (error) {
        console.error('Error fetching impact partners:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact partners' });
    }
});
// GET /api/impact/partners/:id - Get specific partner
router.get('/partners/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await prisma.impactPartner.findUnique({
            where: { id },
        });
        if (!partner) {
            return res.status(404).json({ success: false, error: 'Partner not found' });
        }
        res.json({ success: true, data: partner });
    }
    catch (error) {
        console.error('Error fetching impact partner:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch impact partner' });
    }
});
// ===========================================
// DV SUPPORT SERVICES
// ===========================================
// GET /api/impact/dv-services - List DV support services
router.get('/dv-services', async (req, res) => {
    try {
        const { state, type, national } = req.query;
        const where = {};
        if (state)
            where.state = state;
        if (type)
            where.type = type;
        if (national === 'true')
            where.isNational = true;
        const services = await prisma.dVSupportService.findMany({
            where,
            orderBy: [{ isNational: 'desc' }, { name: 'asc' }],
        });
        res.json({ success: true, data: services });
    }
    catch (error) {
        console.error('Error fetching DV services:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch DV services' });
    }
});
// ===========================================
// SAFETY PLAN (Private, encrypted)
// ===========================================
// GET /api/impact/safety-plan - Get user's safety plan
router.get('/safety-plan', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const safetyPlan = await prisma.safetyPlan.findUnique({
            where: { userId },
        });
        res.json({ success: true, data: safetyPlan });
    }
    catch (error) {
        console.error('Error fetching safety plan:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch safety plan' });
    }
});
// POST /api/impact/safety-plan - Create/update safety plan
router.post('/safety-plan', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { emergencyContacts, safeLocations, warningTriggers, exitStrategies, importantDocs, financialPlan, legalContacts, } = req.body;
        const safetyPlan = await prisma.safetyPlan.upsert({
            where: { userId },
            create: {
                userId,
                emergencyContacts,
                safeLocations,
                warningTriggers,
                exitStrategies,
                importantDocs,
                financialPlan,
                legalContacts,
                lastReviewedAt: new Date(),
            },
            update: {
                emergencyContacts,
                safeLocations,
                warningTriggers,
                exitStrategies,
                importantDocs,
                financialPlan,
                legalContacts,
                lastReviewedAt: new Date(),
            },
        });
        res.json({ success: true, data: safetyPlan });
    }
    catch (error) {
        console.error('Error saving safety plan:', error);
        res.status(500).json({ success: false, error: 'Failed to save safety plan' });
    }
});
// ===========================================
// ACCESSIBILITY PROFILE
// ===========================================
// GET /api/impact/accessibility - Get user's accessibility profile
router.get('/accessibility', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await prisma.accessibilityProfile.findUnique({
            where: { userId },
        });
        res.json({ success: true, data: profile });
    }
    catch (error) {
        console.error('Error fetching accessibility profile:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch accessibility profile' });
    }
});
// POST /api/impact/accessibility - Create/update accessibility profile
router.post('/accessibility', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { hasVisionImpairment, hasHearingImpairment, hasMobilityImpairment, hasCognitiveDisability, usesScreenReader, usesVoiceControl, preferredFontSize, highContrastMode, reducedMotion, captionsRequired, otherNeeds, workAccommodations, } = req.body;
        const profile = await prisma.accessibilityProfile.upsert({
            where: { userId },
            create: {
                userId,
                hasVisionImpairment: hasVisionImpairment ?? false,
                hasHearingImpairment: hasHearingImpairment ?? false,
                hasMobilityImpairment: hasMobilityImpairment ?? false,
                hasCognitiveDisability: hasCognitiveDisability ?? false,
                usesScreenReader: usesScreenReader ?? false,
                usesVoiceControl: usesVoiceControl ?? false,
                preferredFontSize,
                highContrastMode: highContrastMode ?? false,
                reducedMotion: reducedMotion ?? false,
                captionsRequired: captionsRequired ?? false,
                otherNeeds,
                workAccommodations: workAccommodations ?? [],
            },
            update: {
                hasVisionImpairment,
                hasHearingImpairment,
                hasMobilityImpairment,
                hasCognitiveDisability,
                usesScreenReader,
                usesVoiceControl,
                preferredFontSize,
                highContrastMode,
                reducedMotion,
                captionsRequired,
                otherNeeds,
                workAccommodations,
            },
        });
        res.json({ success: true, data: profile });
    }
    catch (error) {
        console.error('Error saving accessibility profile:', error);
        res.status(500).json({ success: false, error: 'Failed to save accessibility profile' });
    }
});
// GET /api/impact/disability-friendly-employers - List disability-friendly employers
router.get('/disability-friendly-employers', async (req, res) => {
    try {
        const { hasRemote, hasFlexible, minRating } = req.query;
        const where = {};
        if (hasRemote === 'true')
            where.hasRemoteOptions = true;
        if (hasFlexible === 'true')
            where.hasFlexibleWork = true;
        if (minRating)
            where.accessibilityRating = { gte: parseInt(minRating) };
        const employers = await prisma.disabilityFriendlyEmployer.findMany({
            where,
            include: {
                organization: {
                    select: { id: true, name: true, logoUrl: true, industry: true },
                },
            },
            orderBy: { accessibilityRating: 'desc' },
        });
        res.json({ success: true, data: employers });
    }
    catch (error) {
        console.error('Error fetching disability-friendly employers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch employers' });
    }
});
exports.default = router;
//# sourceMappingURL=impact.routes.js.map