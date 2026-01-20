/**
 * Creator Economy Service
 * Handles creator monetization, tips/gifts, and creator fund tracking
 */
import Stripe from 'stripe';
export interface CreatorStats {
    totalEarnings: number;
    monthlyEarnings: number;
    totalGifts: number;
    monthlyGifts: number;
    totalFollowers: number;
    totalViews: number;
    engagementRate: number;
}
export interface GiftTransaction {
    id: string;
    senderId: string;
    receiverId: string;
    amount: number;
    giftType: string;
    message?: string;
    createdAt: Date;
}
export interface CreatorTier {
    name: string;
    minFollowers: number;
    revShare: number;
    benefits: string[];
}
export declare const CREATOR_TIERS: CreatorTier[];
export declare const GIFT_TYPES: {
    SPARK: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    STAR: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    ROCKET: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    CROWN: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    DIAMOND: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    TROPHY: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
};
export declare function getCreatorProfile(userId: string): Promise<{
    followerCount: number;
    engagementRate: number;
    tier: CreatorTier;
    user: {
        id: string;
        displayName: string | null;
        avatar: string | null;
        headline: string | null;
        posts: {
            likeCount: number;
            viewCount: number;
        }[];
        followers: {
            id: string;
        }[];
    };
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    isMonetized: boolean;
    stripeAccountId: string | null;
    totalEarnings: number;
    pendingPayout: number;
    isEligible: boolean;
} | null>;
export declare function enableCreatorMode(userId: string, stripeAccountId?: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    isMonetized: boolean;
    tier: string | null;
    stripeAccountId: string | null;
    followerCount: number;
    totalEarnings: number;
    pendingPayout: number;
    isEligible: boolean;
}>;
export declare function getCreatorTier(followerCount: number): CreatorTier;
export declare function sendGift(senderId: string, receiverId: string, giftType: keyof typeof GIFT_TYPES, message?: string): Promise<{
    transaction: {
        id: string;
        createdAt: Date;
        message: string | null;
        senderId: string;
        receiverId: string;
        giftType: string;
        giftValue: number;
        creatorShare: number;
        platformShare: number;
    };
    gift: {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    } | {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    } | {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    } | {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    } | {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    } | {
        id: string;
        name: string;
        value: number;
        icon: string;
        description: string;
    };
    creatorShare: number;
    tier: CreatorTier;
}>;
export declare function purchaseGiftBalance(userId: string, amount: number): Promise<{
    clientSecret: string | null;
    amount: number;
    giftPoints: number;
    currency: string;
}>;
export declare function confirmGiftPurchaseFromPaymentIntent(actorUserId: string, paymentIntent: Stripe.PaymentIntent): Promise<{
    giftPoints: number;
    alreadyProcessed: boolean;
}>;
export declare function confirmGiftPurchase(actorUserId: string, paymentIntentId: string): Promise<{
    giftPoints: number;
    alreadyProcessed: boolean;
}>;
export declare function calculateCreatorFundDistribution(fundAmount: number): Promise<{
    share: number;
    creatorId: string;
    followers: number;
    posts: number;
    engagementRate: number;
    score: number;
}[]>;
export declare function getCreatorAnalytics(userId: string, days?: number): Promise<{
    summary: {
        totalPosts: number;
        totalViews: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
        totalGiftValue: number;
        totalEarningsFromGifts: number;
        newFollowers: number;
        engagementRate: number;
    };
    profile: {
        totalEarnings: number;
        pendingPayout: number;
    };
    dailyStats: {
        views: number;
        likes: number;
        comments: number;
        gifts: number;
        followers: number;
        date: string;
    }[];
    topPosts: {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.PostType;
        likeCount: number;
        commentCount: number;
        shareCount: number;
        viewCount: number;
    }[];
}>;
export declare function requestPayout(userId: string): Promise<{
    amount: number;
    transferId: string;
    status: string;
    currency: string;
}>;
export declare function generateStripeOnboardingLink(userId: string): Promise<string>;
export declare function generateStripeLoginLink(userId: string): Promise<string>;
//# sourceMappingURL=creator.service.d.ts.map