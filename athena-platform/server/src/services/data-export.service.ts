/**
 * Data export jobs, in process.
 *
 * A member's export has always been produced by gdpr.service itself: it mints
 * a single-use download path and rebuilds the bundle when that path is
 * fetched, so no copy of anyone's data sits on disk. The queue worker used to
 * hand the job to an external processor instead, which meant a queued export
 * in production went nowhere unless that processor had been built. The worker
 * now runs the same in-process export the API route runs.
 */

import { DSARType } from '@prisma/client';
import { gdprService } from './gdpr.service';
import { logger } from '../utils/logger';

export interface DataExportJobInput {
  userId: string;
  /** An existing request to complete; a new one is opened when absent. */
  dsarId?: string;
  exportType?: 'gdpr' | 'analytics' | 'full';
  format?: 'json' | 'csv' | 'zip';
}

export interface DataExportJobResult {
  requestId: string;
  exportUrl: string;
  expiresAt: Date;
}

export async function runDataExport(input: DataExportJobInput): Promise<DataExportJobResult> {
  let dsarId = input.dsarId;
  if (!dsarId) {
    const created = await gdprService.createDSARRequest({
      userId: input.userId,
      type: DSARType.EXPORT,
      requestDetails: `Queued ${input.exportType ?? 'gdpr'} export`,
    });
    dsarId = created.id as string;
  }

  const result = await gdprService.processExportRequest(dsarId);
  logger.info('Data export completed in process', { userId: input.userId, requestId: result.requestId });
  return { requestId: result.requestId, exportUrl: result.downloadUrl, expiresAt: result.expiresAt };
}
