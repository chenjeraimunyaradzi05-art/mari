"use strict";
/**
 * Education Marketplace Service - Stub Implementation
 * Course recommendations, learning paths, certifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.educationMarketplaceService = exports.COURSE_PROVIDERS = void 0;
exports.COURSE_PROVIDERS = [
    { id: 'coursera', name: 'Coursera', logoUrl: '/logos/coursera.png' },
    { id: 'udemy', name: 'Udemy', logoUrl: '/logos/udemy.png' },
    { id: 'linkedin', name: 'LinkedIn Learning', logoUrl: '/logos/linkedin.png' },
    { id: 'pluralsight', name: 'Pluralsight', logoUrl: '/logos/pluralsight.png' },
    { id: 'athena', name: 'Athena Academy', logoUrl: '/logos/athena.png' },
];
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
exports.educationMarketplaceService = {
    /**
     * Get personalized course recommendations
     */
    async getCourseRecommendations(_userId, options = {}) {
        const mockCourses = [
            {
                courseId: 'course-1',
                title: 'Advanced TypeScript Development',
                provider: 'Athena Academy',
                matchScore: 95,
                skillGap: ['TypeScript', 'Node.js'],
                careerPathAlignment: 90,
                estimatedCompletion: '4 weeks',
                price: options.budget ? Math.min(99, options.budget) : 99,
                certification: true,
            },
            {
                courseId: 'course-2',
                title: 'Leadership Fundamentals',
                provider: 'Coursera',
                matchScore: 88,
                skillGap: ['Leadership', 'Communication'],
                careerPathAlignment: 85,
                estimatedCompletion: '6 weeks',
                price: 49,
                certification: options.preferCertified || false,
            },
            {
                courseId: 'course-3',
                title: 'Data Analysis with Python',
                provider: 'Udemy',
                matchScore: 82,
                skillGap: ['Python', 'Data Analysis'],
                careerPathAlignment: 75,
                estimatedCompletion: '8 weeks',
                price: 79,
                certification: true,
            },
        ];
        return mockCourses.filter(c => !options.budget || c.price <= options.budget);
    },
    /**
     * Analyze skill gaps
     */
    async analyzeSkillGaps(_userId, targetRole) {
        const gaps = [
            {
                skillId: 'skill-1',
                skillName: 'Leadership',
                currentLevel: 'intermediate',
                targetLevel: 'advanced',
                gapScore: 30,
                recommendedResources: ['Leadership Course', 'Mentor Sessions'],
            },
            {
                skillId: 'skill-2',
                skillName: 'Technical Architecture',
                currentLevel: 'beginner',
                targetLevel: 'advanced',
                gapScore: 60,
                recommendedResources: ['System Design Course', 'Practice Projects'],
            },
        ];
        return { gaps, overallReadiness: 65 };
    },
    /**
     * Create learning path
     */
    async createLearningPath(userId, targetRole, _preferences = {}) {
        return {
            id: generateId(),
            userId,
            targetRole,
            currentProgress: 0,
            estimatedDuration: '12 weeks',
            courses: [
                { courseId: 'course-1', order: 1, required: true, status: 'not_started' },
                { courseId: 'course-2', order: 2, required: true, status: 'not_started' },
                { courseId: 'course-3', order: 3, required: false, status: 'not_started' },
            ],
            milestones: [
                {
                    id: generateId(),
                    title: 'Foundation Skills',
                    description: 'Complete introductory courses',
                    targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                    achieved: false,
                },
                {
                    id: generateId(),
                    title: 'Core Competencies',
                    description: 'Master essential skills',
                    targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                    achieved: false,
                },
            ],
        };
    },
    /**
     * Update course progress
     */
    async updateCourseProgress(_userId, _courseId, progress, _lessonCompleted) {
        const badgesEarned = [];
        if (progress >= 25)
            badgesEarned.push('Quick Starter');
        if (progress >= 50)
            badgesEarned.push('Halfway Hero');
        if (progress >= 75)
            badgesEarned.push('Almost There');
        const certificateEarned = progress >= 100;
        if (certificateEarned)
            badgesEarned.push('Course Completer');
        return { newProgress: progress, certificateEarned, badgesEarned };
    },
    /**
     * Get mentor recommendations
     */
    async getMentorRecommendations(_userId, skillArea) {
        return [
            { mentorId: 'mentor-1', name: 'Jane Smith', expertise: [skillArea, 'Leadership'], matchScore: 92, availability: 'available', hourlyRate: 150 },
            { mentorId: 'mentor-2', name: 'John Doe', expertise: [skillArea], matchScore: 85, availability: 'limited', hourlyRate: 100 },
        ];
    },
    /**
     * Create study group
     */
    async createStudyGroup(creatorId, data) {
        return { studyGroupId: generateId() };
    },
    /**
     * Get course analytics
     */
    async getCourseAnalytics(_instructorId, _courseId) {
        return {
            totalEnrollments: 150,
            completionRate: 72,
            averageRating: 4.5,
            revenue: 14850,
            engagementMetrics: {
                averageWatchTime: 45,
                lessonCompletionRates: {},
                dropOffPoints: [],
            },
        };
    },
};
//# sourceMappingURL=education-marketplace.service.js.map