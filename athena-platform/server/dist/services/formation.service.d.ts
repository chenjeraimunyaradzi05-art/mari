/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
export declare function createRegistration(userId: string, type: BusinessType, businessName: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function updateRegistration(userId: string, registrationId: string, data: any): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function submitRegistration(userId: string, registrationId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function getUserRegistrations(userId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}[]>;
export declare function getRegistration(userId: string, registrationId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
export declare function adminUpdateStatus(registrationId: string, status: BusinessStatus, abn?: string, acn?: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    type: import(".prisma/client").$Enums.BusinessType;
    status: import(".prisma/client").$Enums.BusinessStatus;
    data: Prisma.JsonValue | null;
    submittedAt: Date | null;
    businessName: string | null;
    abn: string | null;
    acn: string | null;
    documents: Prisma.JsonValue | null;
    approvedAt: Date | null;
}>;
//# sourceMappingURL=formation.service.d.ts.map