/**
 * Education Marketplace Service - Stub Implementation
 * Course recommendations, learning paths, certifications
 */
export interface CourseRecommendation {
    courseId: string;
    title: string;
    provider: string;
    matchScore: number;
    skillGap: string[];
    careerPathAlignment: number;
    estimatedCompletion: string;
    price: number;
    certification: boolean;
}
export interface LearningPath {
    id: string;
    userId: string;
    targetRole: string;
    currentProgress: number;
    estimatedDuration: string;
    courses: {
        courseId: string;
        order: number;
        required: boolean;
        status: string;
    }[];
    milestones: {
        id: string;
        title: string;
        description: string;
        targetDate: Date;
        achieved: boolean;
    }[];
}
export interface SkillAssessment {
    skillId: string;
    skillName: string;
    currentLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    targetLevel: string;
    gapScore: number;
    recommendedResources: string[];
}
export declare const COURSE_PROVIDERS: {
    id: string;
    name: string;
    logoUrl: string;
}[];
export declare const educationMarketplaceService: {
    /**
     * Get personalized course recommendations
     */
    getCourseRecommendations(_userId: string, options?: {
        targetRole?: string;
        budget?: number;
        timeCommitment?: string;
        preferCertified?: boolean;
    }): Promise<CourseRecommendation[]>;
    /**
     * Analyze skill gaps
     */
    analyzeSkillGaps(_userId: string, targetRole?: string): Promise<{
        gaps: SkillAssessment[];
        overallReadiness: number;
    }>;
    /**
     * Create learning path
     */
    createLearningPath(userId: string, targetRole: string, _preferences?: {
        timeline?: string;
        budget?: number;
        hoursPerWeek?: number;
    }): Promise<LearningPath>;
    /**
     * Update course progress
     */
    updateCourseProgress(_userId: string, _courseId: string, progress: number, _lessonCompleted?: string): Promise<{
        newProgress: number;
        certificateEarned: boolean;
        badgesEarned: string[];
    }>;
    /**
     * Get mentor recommendations
     */
    getMentorRecommendations(_userId: string, skillArea: string): Promise<{
        mentorId: string;
        name: string;
        expertise: string[];
        matchScore: number;
        availability: string;
        hourlyRate: number;
    }[]>;
    /**
     * Create study group
     */
    createStudyGroup(creatorId: string, data: {
        courseId: string;
        name: string;
        maxParticipants: number;
        scheduledTime: Date;
        duration: number;
    }): Promise<{
        studyGroupId: string;
    }>;
    /**
     * Get course analytics
     */
    getCourseAnalytics(_instructorId: string, _courseId: string): Promise<{
        totalEnrollments: number;
        completionRate: number;
        averageRating: number;
        revenue: number;
        engagementMetrics: {
            averageWatchTime: number;
            lessonCompletionRates: Record<string, number>;
            dropOffPoints: string[];
        };
    }>;
};
//# sourceMappingURL=education-marketplace.service.d.ts.map