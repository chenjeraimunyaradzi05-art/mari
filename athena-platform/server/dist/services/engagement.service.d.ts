/**
 * Engagement Service
 * Gamification, achievements, streaks, and engagement features
 */
export declare const ACHIEVEMENTS: {
    readonly FIRST_POST: {
        readonly id: "first_post";
        readonly name: "First Steps";
        readonly description: "Published your first post";
        readonly icon: "✏️";
        readonly xp: 50;
        readonly category: "content";
    };
    readonly POST_STREAK_7: {
        readonly id: "post_streak_7";
        readonly name: "Week Warrior";
        readonly description: "Posted for 7 days in a row";
        readonly icon: "🔥";
        readonly xp: 200;
        readonly category: "content";
    };
    readonly POST_STREAK_30: {
        readonly id: "post_streak_30";
        readonly name: "Consistency King";
        readonly description: "Posted for 30 days in a row";
        readonly icon: "👑";
        readonly xp: 1000;
        readonly category: "content";
    };
    readonly VIRAL_POST: {
        readonly id: "viral_post";
        readonly name: "Gone Viral";
        readonly description: "A post reached 1000+ views";
        readonly icon: "🚀";
        readonly xp: 500;
        readonly category: "content";
    };
    readonly VIDEO_CREATOR: {
        readonly id: "video_creator";
        readonly name: "Video Star";
        readonly description: "Posted 10 videos";
        readonly icon: "🎬";
        readonly xp: 300;
        readonly category: "content";
    };
    readonly FIRST_FOLLOWER: {
        readonly id: "first_follower";
        readonly name: "First Fan";
        readonly description: "Gained your first follower";
        readonly icon: "🌟";
        readonly xp: 50;
        readonly category: "social";
    };
    readonly HUNDRED_FOLLOWERS: {
        readonly id: "hundred_followers";
        readonly name: "Rising Star";
        readonly description: "Reached 100 followers";
        readonly icon: "💯";
        readonly xp: 500;
        readonly category: "social";
    };
    readonly THOUSAND_FOLLOWERS: {
        readonly id: "thousand_followers";
        readonly name: "Influencer";
        readonly description: "Reached 1000 followers";
        readonly icon: "🌟";
        readonly xp: 2000;
        readonly category: "social";
    };
    readonly HELPFUL_COMMENTER: {
        readonly id: "helpful_commenter";
        readonly name: "Helpful Soul";
        readonly description: "Received 50 likes on comments";
        readonly icon: "💬";
        readonly xp: 300;
        readonly category: "social";
    };
    readonly COURSE_COMPLETE: {
        readonly id: "course_complete";
        readonly name: "Scholar";
        readonly description: "Completed your first course";
        readonly icon: "🎓";
        readonly xp: 200;
        readonly category: "learning";
    };
    readonly COURSE_STREAK: {
        readonly id: "course_streak";
        readonly name: "Dedicated Learner";
        readonly description: "Completed 5 courses";
        readonly icon: "📚";
        readonly xp: 1000;
        readonly category: "learning";
    };
    readonly PROFILE_COMPLETE: {
        readonly id: "profile_complete";
        readonly name: "Ready to Go";
        readonly description: "Completed your profile 100%";
        readonly icon: "✅";
        readonly xp: 100;
        readonly category: "profile";
    };
    readonly FIRST_APPLICATION: {
        readonly id: "first_application";
        readonly name: "Taking Action";
        readonly description: "Applied for your first job";
        readonly icon: "📝";
        readonly xp: 100;
        readonly category: "career";
    };
    readonly INTERVIEW_READY: {
        readonly id: "interview_ready";
        readonly name: "Interview Ready";
        readonly description: "Reached interview stage";
        readonly icon: "🤝";
        readonly xp: 300;
        readonly category: "career";
    };
    readonly MENTOR_FIRST: {
        readonly id: "mentor_first";
        readonly name: "Giving Back";
        readonly description: "Completed your first mentoring session";
        readonly icon: "🧑‍🏫";
        readonly xp: 500;
        readonly category: "community";
    };
    readonly COMMUNITY_BUILDER: {
        readonly id: "community_builder";
        readonly name: "Community Builder";
        readonly description: "Invited 5 friends to join";
        readonly icon: "🏗️";
        readonly xp: 300;
        readonly category: "community";
    };
};
export type AchievementId = keyof typeof ACHIEVEMENTS;
export declare function calculateLevel(xp: number): {
    level: number;
    currentXp: number;
    nextLevelXp: number;
    progress: number;
};
export declare function updateStreak(userId: string, activity: 'post' | 'login' | 'learn'): Promise<{
    currentStreak: number;
    longestStreak: number;
    isNewRecord: boolean;
}>;
export declare function getStreaks(userId: string): Promise<Record<string, {
    current: number;
    longest: number;
    lastActivity: Date;
}>>;
export declare function awardAchievement(userId: string, achievementId: AchievementId): Promise<boolean>;
export declare function getUserAchievements(userId: string): Promise<{
    achievements: ({
        earned: boolean;
        earnedAt: Date | undefined;
        id: "first_post";
        name: "First Steps";
        description: "Published your first post";
        icon: "✏️";
        xp: 50;
        category: "content";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "post_streak_7";
        name: "Week Warrior";
        description: "Posted for 7 days in a row";
        icon: "🔥";
        xp: 200;
        category: "content";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "post_streak_30";
        name: "Consistency King";
        description: "Posted for 30 days in a row";
        icon: "👑";
        xp: 1000;
        category: "content";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "viral_post";
        name: "Gone Viral";
        description: "A post reached 1000+ views";
        icon: "🚀";
        xp: 500;
        category: "content";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "video_creator";
        name: "Video Star";
        description: "Posted 10 videos";
        icon: "🎬";
        xp: 300;
        category: "content";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "first_follower";
        name: "First Fan";
        description: "Gained your first follower";
        icon: "🌟";
        xp: 50;
        category: "social";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "hundred_followers";
        name: "Rising Star";
        description: "Reached 100 followers";
        icon: "💯";
        xp: 500;
        category: "social";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "thousand_followers";
        name: "Influencer";
        description: "Reached 1000 followers";
        icon: "🌟";
        xp: 2000;
        category: "social";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "helpful_commenter";
        name: "Helpful Soul";
        description: "Received 50 likes on comments";
        icon: "💬";
        xp: 300;
        category: "social";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "course_complete";
        name: "Scholar";
        description: "Completed your first course";
        icon: "🎓";
        xp: 200;
        category: "learning";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "course_streak";
        name: "Dedicated Learner";
        description: "Completed 5 courses";
        icon: "📚";
        xp: 1000;
        category: "learning";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "profile_complete";
        name: "Ready to Go";
        description: "Completed your profile 100%";
        icon: "✅";
        xp: 100;
        category: "profile";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "first_application";
        name: "Taking Action";
        description: "Applied for your first job";
        icon: "📝";
        xp: 100;
        category: "career";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "interview_ready";
        name: "Interview Ready";
        description: "Reached interview stage";
        icon: "🤝";
        xp: 300;
        category: "career";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "mentor_first";
        name: "Giving Back";
        description: "Completed your first mentoring session";
        icon: "🧑‍🏫";
        xp: 500;
        category: "community";
    } | {
        earned: boolean;
        earnedAt: Date | undefined;
        id: "community_builder";
        name: "Community Builder";
        description: "Invited 5 friends to join";
        icon: "🏗️";
        xp: 300;
        category: "community";
    })[];
    stats: {
        earned: number;
        total: number;
        progress: number;
        totalXpEarned: number;
    };
}>;
export declare function addXP(userId: string, amount: number, reason: string): Promise<{
    newXp: number;
    levelUp: boolean;
    newLevel: number;
}>;
export declare function getUserXP(userId: string): Promise<{
    level: number;
    currentXp: number;
    nextLevelXp: number;
    progress: number;
}>;
export declare function getXPHistory(userId: string, limit?: number): Promise<{
    id: string;
    createdAt: Date;
    userId: string;
    reason: string;
    amount: number;
    balance: number;
}[]>;
export declare function getLeaderboard(type: 'xp' | 'followers' | 'posts' | 'streak', period?: 'daily' | 'weekly' | 'monthly' | 'alltime', limit?: number): Promise<{
    id: string;
    displayName: string | null;
    avatar: string | null;
    xp: number;
}[] | {
    id: string;
    displayName: string | null;
    avatar: string | null;
    _count: {
        followers: number;
    };
}[] | {
    postCount: number;
    id?: string | undefined;
    displayName?: string | null | undefined;
    avatar?: string | null | undefined;
}[] | ({
    user: {
        id: string;
        displayName: string | null;
        avatar: string | null;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: string;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date;
})[]>;
export declare function checkContentAchievements(userId: string): Promise<void>;
export declare function checkSocialAchievements(userId: string): Promise<void>;
//# sourceMappingURL=engagement.service.d.ts.map