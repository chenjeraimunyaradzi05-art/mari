import { prisma } from './prisma';
import { AuditAction, Prisma } from '@prisma/client';

export async function logAudit(params: {
  action: AuditAction;
  actorUserId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const {
    action,
    actorUserId = null,
    targetUserId = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
  } = params;

  const sanitizedMetadata = metadata
    ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue)
    : null;

  await prisma.auditLog.create({
    data: {
      action,
      actorUserId,
      targetUserId,
      ipAddress,
      userAgent,
      metadata: sanitizedMetadata ?? undefined,
    },
  });
}
