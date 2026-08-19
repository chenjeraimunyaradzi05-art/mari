/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
export declare function createRegistration(userId: string, type: BusinessType, businessName: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function updateRegistration(userId: string, registrationId: string, data: any): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function submitRegistration(userId: string, registrationId: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
/**
 * Confirm formation payment after Stripe checkout
 */
export declare function confirmFormationPayment(userId: string, registrationId: string, paymentIntentId: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function getUserRegistrations(userId: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}[]>;
export declare function getRegistration(userId: string, registrationId: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function adminUpdateStatus(registrationId: string, status: BusinessStatus, abn?: string, acn?: string): Promise<{
    data: Prisma.JsonValue | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    stateHistory: Prisma.JsonValue | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
//# sourceMappingURL=formation.service.d.ts.map