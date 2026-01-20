"use strict";
/**
 * Data Pipeline ETL Service
 * =========================
 * Extracts interaction data for ML model training and analytics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractInteractionEvents = extractInteractionEvents;
exports.extractUserProfiles = extractUserProfiles;
exports.extractJobData = extractJobData;
exports.runDailyETL = runDailyETL;
exports.generateTrainingDataset = generateTrainingDataset;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const storage_1 = require("../utils/storage");
const date_fns_1 = require("date-fns");
// ===========================================
// EXTRACTION FUNCTIONS
// ===========================================
/**
 * Extract user interaction events for ML training
 */
async function extractInteractionEvents(config) {
    const events = [];
    let offset = 0;
    logger_1.logger.info('Starting interaction event extraction', {
        startDate: config.startDate,
        endDate: config.endDate,
    });
    while (true) {
        // Extract post interactions
        const postInteractions = await prisma_1.prisma.postLike.findMany({
            where: {
                createdAt: {
                    gte: config.startDate,
                    lte: config.endDate,
                },
            },
            include: {
                post: {
                    select: { authorId: true, type: true },
                },
            },
            skip: offset,
            take: config.batchSize,
        });
        if (postInteractions.length === 0)
            break;
        for (const interaction of postInteractions) {
            events.push({
                eventId: interaction.id,
                userId: interaction.userId,
                eventType: 'like',
                targetType: 'post',
                targetId: interaction.postId,
                metadata: {
                    postType: interaction.post.type,
                    authorId: interaction.post.authorId,
                },
                timestamp: interaction.createdAt,
            });
        }
        offset += config.batchSize;
        if (postInteractions.length < config.batchSize)
            break;
    }
    // Extract job applications
    offset = 0;
    while (true) {
        const applications = await prisma_1.prisma.application.findMany({
            where: {
                createdAt: {
                    gte: config.startDate,
                    lte: config.endDate,
                },
            },
            include: {
                job: {
                    select: { organizationId: true, type: true },
                },
            },
            skip: offset,
            take: config.batchSize,
        });
        if (applications.length === 0)
            break;
        for (const app of applications) {
            events.push({
                eventId: app.id,
                userId: app.userId,
                eventType: 'apply',
                targetType: 'job',
                targetId: app.jobId,
                metadata: {
                    status: app.status,
                    jobType: app.job.type,
                    organizationId: app.job.organizationId,
                },
                timestamp: app.createdAt,
            });
        }
        offset += config.batchSize;
        if (applications.length < config.batchSize)
            break;
    }
    logger_1.logger.info('Interaction event extraction complete', { totalEvents: events.length });
    return events;
}
/**
 * Extract user profiles for ML features
 */
async function extractUserProfiles(config) {
    const profiles = [];
    let offset = 0;
    logger_1.logger.info('Starting user profile extraction');
    while (true) {
        const users = await prisma_1.prisma.user.findMany({
            where: {
                updatedAt: {
                    gte: config.startDate,
                    lte: config.endDate,
                },
            },
            select: {
                id: true,
                persona: true,
                industry: true,
                skills: true,
                createdAt: true,
                isVerified: true,
                subscriptionTier: true,
                _count: {
                    select: {
                        posts: true,
                        applications: true,
                        mentorSessions: true,
                    },
                },
            },
            skip: offset,
            take: config.batchSize,
        });
        if (users.length === 0)
            break;
        for (const user of users) {
            profiles.push({
                userId: user.id,
                persona: user.persona,
                industry: user.industry,
                skillsCount: user.skills?.length || 0,
                accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
                isVerified: user.isVerified,
                subscriptionTier: user.subscriptionTier,
                postsCount: user._count.posts,
                applicationsCount: user._count.applications,
                mentorSessionsCount: user._count.mentorSessions,
            });
        }
        offset += config.batchSize;
        if (users.length < config.batchSize)
            break;
    }
    logger_1.logger.info('User profile extraction complete', { totalProfiles: profiles.length });
    return profiles;
}
/**
 * Extract job posting data for recommendation training
 */
async function extractJobData(config) {
    const jobs = [];
    let offset = 0;
    logger_1.logger.info('Starting job data extraction');
    while (true) {
        const jobRecords = await prisma_1.prisma.job.findMany({
            where: {
                createdAt: {
                    gte: config.startDate,
                    lte: config.endDate,
                },
            },
            select: {
                id: true,
                title: true,
                type: true,
                salaryMin: true,
                salaryMax: true,
                remote: true,
                skills: true,
                status: true,
                createdAt: true,
                expiresAt: true,
                _count: {
                    select: {
                        applications: true,
                    },
                },
            },
            skip: offset,
            take: config.batchSize,
        });
        if (jobRecords.length === 0)
            break;
        for (const job of jobRecords) {
            jobs.push({
                jobId: job.id,
                title: job.title,
                type: job.type,
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
                remote: job.remote,
                skillsCount: job.skills?.length || 0,
                skills: job.skills,
                status: job.status,
                applicationCount: job._count.applications,
                daysActive: job.expiresAt
                    ? Math.floor((job.expiresAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24))
                    : null,
            });
        }
        offset += config.batchSize;
        if (jobRecords.length < config.batchSize)
            break;
    }
    logger_1.logger.info('Job data extraction complete', { totalJobs: jobs.length });
    return jobs;
}
// ===========================================
// EXPORT FUNCTIONS
// ===========================================
/**
 * Run daily ETL pipeline and upload to S3
 */
async function runDailyETL() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const dateStr = (0, date_fns_1.format)(endDate, 'yyyy-MM-dd');
    const files = [];
    try {
        logger_1.logger.info('Starting daily ETL pipeline', { date: dateStr });
        // Extract and upload interaction events
        const events = await extractInteractionEvents({
            startDate,
            endDate,
            batchSize: 1000,
            outputFormat: 'json',
        });
        if (events.length > 0) {
            const eventsKey = `data-lake/interactions/${dateStr}/events.json`;
            await (0, storage_1.uploadFile)(Buffer.from(JSON.stringify(events, null, 2)), eventsKey, 'application/json', storage_1.BUCKETS.EXPORTS);
            files.push(eventsKey);
        }
        // Extract and upload user profiles
        const profiles = await extractUserProfiles({
            startDate: new Date(0), // All profiles
            endDate,
            batchSize: 1000,
            outputFormat: 'json',
        });
        if (profiles.length > 0) {
            const profilesKey = `data-lake/profiles/${dateStr}/users.json`;
            await (0, storage_1.uploadFile)(Buffer.from(JSON.stringify(profiles, null, 2)), profilesKey, 'application/json', storage_1.BUCKETS.EXPORTS);
            files.push(profilesKey);
        }
        // Extract and upload job data
        const jobs = await extractJobData({
            startDate: new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            endDate,
            batchSize: 1000,
            outputFormat: 'json',
        });
        if (jobs.length > 0) {
            const jobsKey = `data-lake/jobs/${dateStr}/listings.json`;
            await (0, storage_1.uploadFile)(Buffer.from(JSON.stringify(jobs, null, 2)), jobsKey, 'application/json', storage_1.BUCKETS.EXPORTS);
            files.push(jobsKey);
        }
        logger_1.logger.info('Daily ETL pipeline complete', { files });
        return { success: true, files };
    }
    catch (error) {
        logger_1.logger.error('Daily ETL pipeline failed', { error: error.message });
        throw error;
    }
}
/**
 * Generate training dataset for a specific model
 */
async function generateTrainingDataset(modelName, config) {
    logger_1.logger.info('Generating training dataset', { modelName });
    let data = [];
    switch (modelName) {
        case 'career_compass':
            data = await extractUserProfiles(config);
            break;
        case 'job_ranker':
            data = await extractJobData(config);
            break;
        case 'feed':
            data = await extractInteractionEvents(config);
            break;
        default:
            throw new Error(`Unknown model: ${modelName}`);
    }
    const dateStr = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd-HHmmss');
    const key = `training-data/${modelName}/${dateStr}/dataset.json`;
    await (0, storage_1.uploadFile)(Buffer.from(JSON.stringify(data, null, 2)), key, 'application/json', storage_1.BUCKETS.EXPORTS);
    logger_1.logger.info('Training dataset generated', { modelName, key, recordCount: data.length });
    return key;
}
//# sourceMappingURL=etl.service.js.map