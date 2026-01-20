import { AuditAction, Prisma } from '@prisma/client';
export declare function logAudit(params: {
    action: AuditAction;
    actorUserId?: string | null;
    targetUserId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue | null;
}): Promise<void>;
//# sourceMappingURL=audit.d.ts.map