/**
 * Mentor Service
 * Management of mentor profiles, sessions, and reviews
 */
import { MentorSessionStatus } from '@prisma/client';
export interface MentorFilters {
    specialization?: string;
    minRate?: number;
    maxRate?: number;
    available?: boolean;
    search?: string;
}
/**
 * Get mentors with filtering
 */
export declare function getMentors(filters: MentorFilters, page?: number, limit?: number): Promise<{
    mentors: ({
        user: {
            id: string;
            displayName: string | null;
            avatar: string | null;
            bio: string | null;
            headline: string | null;
        };
    } & {
        id: string;
        yearsExperience: number | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        isMonetized: boolean;
        hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
        isAvailable: boolean;
        rating: import("@prisma/client/runtime/library").Decimal | null;
        reviewCount: number;
        stripeAccountId: string | null;
        specializations: import("@prisma/client/runtime/library").JsonValue | null;
        sessionCount: number;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
/**
 * Get a specific mentor profile
 */
export declare function getMentorProfile(userId: string): Promise<({
    user: {
        id: string;
        displayName: string | null;
        avatar: string | null;
        bio: string | null;
        headline: string | null;
        education: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            institution: string;
            degree: string | null;
            fieldOfStudy: string | null;
            startDate: Date | null;
            endDate: Date | null;
            current: boolean;
            description: string | null;
        }[];
        experience: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            startDate: Date;
            endDate: Date | null;
            current: boolean;
            description: string | null;
            company: string;
            title: string;
            location: string | null;
        }[];
    };
} & {
    id: string;
    yearsExperience: number | null;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    isMonetized: boolean;
    hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
    isAvailable: boolean;
    rating: import("@prisma/client/runtime/library").Decimal | null;
    reviewCount: number;
    stripeAccountId: string | null;
    specializations: import("@prisma/client/runtime/library").JsonValue | null;
    sessionCount: number;
}) | null>;
/**
 * Create or update mentor profile
 */
export declare function updateMentorProfile(userId: string, data: {
    specializations?: string[];
    hourlyRate?: number;
    yearsExperience?: number;
    isAvailable?: boolean;
}): Promise<{
    id: string;
    yearsExperience: number | null;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    isMonetized: boolean;
    hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
    isAvailable: boolean;
    rating: import("@prisma/client/runtime/library").Decimal | null;
    reviewCount: number;
    stripeAccountId: string | null;
    specializations: import("@prisma/client/runtime/library").JsonValue | null;
    sessionCount: number;
}>;
/**
 * Enable mentor monetization (Stripe Connect)
 */
export declare function enableMentorMonetization(userId: string): Promise<{
    id: string;
    yearsExperience: number | null;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    isMonetized: boolean;
    hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
    isAvailable: boolean;
    rating: import("@prisma/client/runtime/library").Decimal | null;
    reviewCount: number;
    stripeAccountId: string | null;
    specializations: import("@prisma/client/runtime/library").JsonValue | null;
    sessionCount: number;
}>;
export declare function generateMentorStripeOnboardingLink(userId: string): Promise<string>;
export declare function generateMentorStripeLoginLink(userId: string): Promise<string>;
/**
 * Request a mentorship session
 */
export declare function requestSession(menteeId: string, mentorId: string, data: {
    scheduledAt: Date;
    durationMinutes?: number;
    note?: string;
}): Promise<{
    session: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.MentorSessionStatus;
        scheduledAt: Date | null;
        durationMinutes: number;
        platformFee: import("@prisma/client/runtime/library").Decimal;
        stripePaymentIntentId: string | null;
        mentorProfileId: string;
        menteeId: string;
        note: string | null;
        currency: string;
        sessionAmount: import("@prisma/client/runtime/library").Decimal;
        mentorPayout: import("@prisma/client/runtime/library").Decimal;
        paymentStatus: import(".prisma/client").$Enums.MentorPaymentStatus;
        paymentAuthorizedAt: Date | null;
        paymentCapturedAt: Date | null;
        paymentCanceledAt: Date | null;
        paymentFailedAt: Date | null;
    };
    paymentIntentClientSecret: string | null;
}>;
/**
 * Update session status (Accept, Reject, Cancel, Complete)
 */
export declare function updateSessionStatus(sessionId: string, userId: string, status: MentorSessionStatus, actionBy: 'mentor' | 'mentee'): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.MentorSessionStatus;
    scheduledAt: Date | null;
    durationMinutes: number;
    platformFee: import("@prisma/client/runtime/library").Decimal;
    stripePaymentIntentId: string | null;
    mentorProfileId: string;
    menteeId: string;
    note: string | null;
    currency: string;
    sessionAmount: import("@prisma/client/runtime/library").Decimal;
    mentorPayout: import("@prisma/client/runtime/library").Decimal;
    paymentStatus: import(".prisma/client").$Enums.MentorPaymentStatus;
    paymentAuthorizedAt: Date | null;
    paymentCapturedAt: Date | null;
    paymentCanceledAt: Date | null;
    paymentFailedAt: Date | null;
}>;
/**
 * Get session by ID
 */
export declare function getSession(sessionId: string): Promise<({
    mentorProfile: {
        id: string;
        yearsExperience: number | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        isMonetized: boolean;
        hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
        isAvailable: boolean;
        rating: import("@prisma/client/runtime/library").Decimal | null;
        reviewCount: number;
        stripeAccountId: string | null;
        specializations: import("@prisma/client/runtime/library").JsonValue | null;
        sessionCount: number;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.MentorSessionStatus;
    scheduledAt: Date | null;
    durationMinutes: number;
    platformFee: import("@prisma/client/runtime/library").Decimal;
    stripePaymentIntentId: string | null;
    mentorProfileId: string;
    menteeId: string;
    note: string | null;
    currency: string;
    sessionAmount: import("@prisma/client/runtime/library").Decimal;
    mentorPayout: import("@prisma/client/runtime/library").Decimal;
    paymentStatus: import(".prisma/client").$Enums.MentorPaymentStatus;
    paymentAuthorizedAt: Date | null;
    paymentCapturedAt: Date | null;
    paymentCanceledAt: Date | null;
    paymentFailedAt: Date | null;
}) | null>;
/**
 * Get sessions for a user (as mentor or mentee)
 */
export declare function getUserSessions(userId: string, role: 'mentor' | 'mentee'): Promise<({
    mentee: {
        id: string;
        displayName: string | null;
        avatar: string | null;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.MentorSessionStatus;
    scheduledAt: Date | null;
    durationMinutes: number;
    platformFee: import("@prisma/client/runtime/library").Decimal;
    stripePaymentIntentId: string | null;
    mentorProfileId: string;
    menteeId: string;
    note: string | null;
    currency: string;
    sessionAmount: import("@prisma/client/runtime/library").Decimal;
    mentorPayout: import("@prisma/client/runtime/library").Decimal;
    paymentStatus: import(".prisma/client").$Enums.MentorPaymentStatus;
    paymentAuthorizedAt: Date | null;
    paymentCapturedAt: Date | null;
    paymentCanceledAt: Date | null;
    paymentFailedAt: Date | null;
})[] | ({
    mentorProfile: {
        user: {
            id: string;
            displayName: string | null;
            avatar: string | null;
        };
    } & {
        id: string;
        yearsExperience: number | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        isMonetized: boolean;
        hourlyRate: import("@prisma/client/runtime/library").Decimal | null;
        isAvailable: boolean;
        rating: import("@prisma/client/runtime/library").Decimal | null;
        reviewCount: number;
        stripeAccountId: string | null;
        specializations: import("@prisma/client/runtime/library").JsonValue | null;
        sessionCount: number;
    };
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: import(".prisma/client").$Enums.MentorSessionStatus;
    scheduledAt: Date | null;
    durationMinutes: number;
    platformFee: import("@prisma/client/runtime/library").Decimal;
    stripePaymentIntentId: string | null;
    mentorProfileId: string;
    menteeId: string;
    note: string | null;
    currency: string;
    sessionAmount: import("@prisma/client/runtime/library").Decimal;
    mentorPayout: import("@prisma/client/runtime/library").Decimal;
    paymentStatus: import(".prisma/client").$Enums.MentorPaymentStatus;
    paymentAuthorizedAt: Date | null;
    paymentCapturedAt: Date | null;
    paymentCanceledAt: Date | null;
    paymentFailedAt: Date | null;
})[]>;
//# sourceMappingURL=mentor.service.d.ts.map