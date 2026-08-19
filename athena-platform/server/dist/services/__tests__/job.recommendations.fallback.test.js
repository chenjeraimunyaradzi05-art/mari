"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/opensearch', () => ({
    getOpenSearchClient: () => null,
    IndexNames: {},
}));
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        user: {
            findUnique: globals_1.jest.fn(),
        },
        jobApplication: {
            findMany: globals_1.jest.fn(),
        },
        job: {
            findMany: globals_1.jest.fn(),
        },
    },
}));
const prisma_1 = require("../../utils/prisma");
const search_service_1 = require("../search.service");
(0, globals_1.describe)('getRecommendedJobs (Prisma fallback)', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('ranks jobs using skills + remote preference and excludes applied jobs', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({
            id: 'user-123',
            city: 'Sydney',
            state: 'NSW',
            country: 'Australia',
            currentJobTitle: 'Data Analyst',
            headline: 'Analytics and insights',
            profile: { remotePreference: 'remote' },
            skills: [{ skill: { name: 'sql' } }, { skill: { name: 'data' } }],
        });
        prisma_1.prisma.jobApplication.findMany.mockResolvedValue([{ jobId: 'job-applied' }]);
        const jobApplied = {
            id: 'job-applied',
            title: 'SQL Analyst',
            description: 'Work with data and SQL',
            isRemote: true,
            city: 'Sydney',
            state: 'NSW',
            salaryMin: 0,
            salaryMax: 0,
            createdAt: new Date('2026-01-01'),
            publishedAt: new Date('2026-01-02'),
            organization: { id: 'o1', name: 'Org', logo: null },
            skills: [{ skill: { name: 'sql' } }],
        };
        const jobRemoteSkillMatch = {
            id: 'job-remote',
            title: 'Data Analyst (Remote)',
            description: 'Data analytics, SQL dashboards',
            isRemote: true,
            city: 'Melbourne',
            state: 'VIC',
            salaryMin: 0,
            salaryMax: 0,
            createdAt: new Date('2026-01-03'),
            publishedAt: new Date('2026-01-10'),
            organization: { id: 'o1', name: 'Org', logo: null },
            skills: [{ skill: { name: 'data' } }, { skill: { name: 'sql' } }],
        };
        const jobOnsiteNoMatch = {
            id: 'job-onsite',
            title: 'Office Manager',
            description: 'Operations and admin',
            isRemote: false,
            city: 'Sydney',
            state: 'NSW',
            salaryMin: 0,
            salaryMax: 0,
            createdAt: new Date('2026-01-05'),
            publishedAt: new Date('2026-01-09'),
            organization: { id: 'o1', name: 'Org', logo: null },
            skills: [{ skill: { name: 'excel' } }],
        };
        prisma_1.prisma.job.findMany.mockResolvedValue([jobApplied, jobRemoteSkillMatch, jobOnsiteNoMatch]);
        const results = await (0, search_service_1.getRecommendedJobs)('user-123', 2);
        (0, globals_1.expect)(results.map((r) => r.id)).toEqual(['job-remote', 'job-onsite']);
        (0, globals_1.expect)(results.find((r) => r.id === 'job-applied')).toBeUndefined();
    });
});
//# sourceMappingURL=job.recommendations.fallback.test.js.map