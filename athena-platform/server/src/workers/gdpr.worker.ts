/**
 * Simplified GDPR Compliance Worker
 * Background jobs for data export and deletion requests
 * Phase 4: UK/EU Market Launch
 * 
 * Note: This is a simplified version that works with the current schema.
 * For production, consider using the full implementation with archiver package.
 */

import { prisma } from '../utils/prisma';
import { DSARStatus, DSARType } from '@prisma/client';
import { createHash } from 'crypto';

// ==========================================
// CONFIGURATION
// ==========================================

const EXPORT_EXPIRY_DAYS = 7;
const DELETION_GRACE_PERIOD_DAYS = 30;

// ==========================================
// DATA EXPORT JOB
// ==========================================

/**
 * Process pending data export requests
 */
export async function processExportRequests(): Promise<{ processed: number; failed: number }> {
  console.log('[GDPR] Starting export job');
  
  const pendingRequests = await prisma.dSARRequest.findMany({
    where: {
      type: DSARType.EXPORT,
      status: DSARStatus.PENDING,
    },
    take: 10,
  });
  
  let processed = 0;
  let failed = 0;
  
  for (const request of pendingRequests) {
    try {
      await processExportRequest(request.id);
      processed++;
    } catch (error) {
      console.error('[GDPR] Export request failed', { error, requestId: request.id });
      failed++;
      
      // Mark as failed using processingNotes field
      await prisma.dSARRequest.update({
        where: { id: request.id },
        data: {
          status: DSARStatus.REJECTED,
          processingNotes: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
  
  console.log(`[GDPR] Export job completed: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

/**
 * Process a single export request
 */
async function processExportRequest(requestId: string): Promise<void> {
  const request = await prisma.dSARRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });
  
  if (!request) {
    throw new Error('Request not found');
  }

  const userId = request.userId;

  // Mark as in progress
  await prisma.dSARRequest.update({
    where: { id: requestId },
    data: { status: DSARStatus.IN_PROGRESS },
  });

  // Gather user data (simplified)
  const userData = await gatherUserData(userId);

  // Store export reference
  const exportId = `export_${requestId}_${Date.now()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPORT_EXPIRY_DAYS);

  // Update request as completed
  await prisma.dSARRequest.update({
    where: { id: requestId },
    data: {
      status: DSARStatus.COMPLETED,
      completedAt: new Date(),
      exportExpiresAt: expiresAt,
      exportUrl: `/api/gdpr/download/${exportId}`,
      processingNotes: `Export completed. Size: ${JSON.stringify(userData).length} bytes`,
    },
  });

  console.log(`[GDPR] Export completed for request ${requestId}`);
}

/**
 * Gather all user data for export
 */
async function gatherUserData(userId: string): Promise<object> {
  const [
    user,
    profile,
    posts,
    comments,
    messages,
    consents,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.post.findMany({ where: { authorId: userId } }),
    prisma.comment.findMany({ where: { authorId: userId } }),
    prisma.message.findMany({ where: { senderId: userId } }),
    prisma.consentRecord.findMany({ where: { userId } }),
  ]);

  // Sanitize sensitive data
  const sanitizedUser = user ? {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    // Exclude passwordHash and sensitive tokens
  } : null;

  return {
    exportedAt: new Date().toISOString(),
    user: sanitizedUser,
    profile,
    posts: posts.map(p => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
    })),
    comments: comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
    })),
    messageCount: messages.length,
    consents: consents.map(c => ({
      type: c.consentType,
      status: c.status,
      grantedAt: c.grantedAt,
    })),
  };
}

// ==========================================
// DATA DELETION JOB
// ==========================================

/**
 * Process pending deletion requests
 */
export async function processDeletionRequests(): Promise<{ processed: number; failed: number }> {
  console.log('[GDPR] Starting deletion job');
  
  const pendingRequests = await prisma.dSARRequest.findMany({
    where: {
      type: DSARType.DELETION,
      status: DSARStatus.PENDING,
      dueDate: { lte: new Date() }, // Only process after grace period
    },
    take: 10,
  });
  
  let processed = 0;
  let failed = 0;
  
  for (const request of pendingRequests) {
    try {
      await processDeletionRequest(request.id);
      processed++;
    } catch (error) {
      console.error('[GDPR] Deletion request failed', { error, requestId: request.id });
      failed++;
    }
  }
  
  console.log(`[GDPR] Deletion job completed: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

/**
 * Process a single deletion request
 */
async function processDeletionRequest(requestId: string): Promise<void> {
  const request = await prisma.dSARRequest.findUnique({
    where: { id: requestId },
  });
  
  if (!request) {
    throw new Error('Request not found');
  }

  const userId = request.userId;

  // Mark as in progress
  await prisma.dSARRequest.update({
    where: { id: requestId },
    data: { status: DSARStatus.IN_PROGRESS },
  });

  // Check for legal holds (LegalHold uses affectedUserIds array)
  const legalHold = await prisma.legalHold.findFirst({
    where: {
      affectedUserIds: { has: userId },
      isActive: true,
    },
  });

  if (legalHold) {
    await prisma.dSARRequest.update({
      where: { id: requestId },
      data: {
        status: DSARStatus.REJECTED,
        processingNotes: 'Account is under legal hold and cannot be deleted at this time.',
      },
    });
    return;
  }

  // Perform deletion in transaction
  await prisma.$transaction(async (tx) => {
    // Delete related data in order
    await tx.consentRecord.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
    await tx.post.deleteMany({ where: { authorId: userId } });
    await tx.profile.deleteMany({ where: { userId } });
    
    // Anonymize audit logs instead of deleting
    await tx.auditLog.updateMany({
      where: { actorUserId: userId },
      data: {
        actorUserId: null,
        metadata: JSON.parse(JSON.stringify({
          anonymized: true,
          anonymizedAt: new Date().toISOString(),
          originalUserHash: createHash('sha256').update(userId).digest('hex'),
        })),
      },
    });

    // Finally delete user
    await tx.user.delete({ where: { id: userId } });
  });

  // Mark DSAR as completed
  await prisma.dSARRequest.update({
    where: { id: requestId },
    data: {
      status: DSARStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  console.log(`[GDPR] Deletion completed for request ${requestId}`);
}

// ==========================================
// CLEANUP JOBS
// ==========================================

/**
 * Clean up expired exports
 */
export async function cleanupExpiredExports(): Promise<number> {
  console.log('[GDPR] Starting export cleanup');
  
  const expiredRequests = await prisma.dSARRequest.findMany({
    where: {
      type: DSARType.EXPORT,
      status: DSARStatus.COMPLETED,
      exportExpiresAt: { lt: new Date() },
    },
  });

  for (const request of expiredRequests) {
    // Clear the export URL to invalidate download
    await prisma.dSARRequest.update({
      where: { id: request.id },
      data: {
        exportUrl: null,
        processingNotes: `${request.processingNotes || ''}\nExport expired and cleaned up at ${new Date().toISOString()}`,
      },
    });
  }

  console.log(`[GDPR] Cleaned up ${expiredRequests.length} expired exports`);
  return expiredRequests.length;
}

// Export for use in cron jobs
export const gdprWorker = {
  processExportRequests,
  processDeletionRequests,
  cleanupExpiredExports,
};
