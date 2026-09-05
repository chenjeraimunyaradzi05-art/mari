import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../gdpr.service', () => ({
  gdprService: {
    createDSARRequest: jest.fn(),
    processExportRequest: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { gdprService as gdprTyped } from '../gdpr.service';
import { runDataExport } from '../data-export.service';

const gdpr: any = gdprTyped;
const expiresAt = new Date('2026-09-08T00:00:00Z');

describe('runDataExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gdpr.processExportRequest.mockResolvedValue({
      requestId: 'dsar-1',
      downloadToken: 'a'.repeat(64),
      downloadUrl: `/api/gdpr/download/${'a'.repeat(64)}`,
      expiresAt,
      data: {},
    });
  });

  it('completes an existing request in process, with the single-use download path', async () => {
    const result = await runDataExport({ userId: 'u1', dsarId: 'dsar-1', exportType: 'gdpr', format: 'json' });

    expect(gdpr.createDSARRequest).not.toHaveBeenCalled();
    expect(gdpr.processExportRequest).toHaveBeenCalledWith('dsar-1');
    expect(result).toEqual({ requestId: 'dsar-1', exportUrl: `/api/gdpr/download/${'a'.repeat(64)}`, expiresAt });
  });

  it('opens a request first when the job has none', async () => {
    gdpr.createDSARRequest.mockResolvedValue({ id: 'dsar-new' });

    await runDataExport({ userId: 'u1', exportType: 'full', format: 'zip' });

    expect(gdpr.createDSARRequest).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'EXPORT',
      requestDetails: 'Queued full export',
    });
    expect(gdpr.processExportRequest).toHaveBeenCalledWith('dsar-new');
  });

  it('lets a failure surface so the queue records the job as failed', async () => {
    gdpr.processExportRequest.mockRejectedValue(new Error('DSAR request not found'));
    await expect(runDataExport({ userId: 'u1', dsarId: 'missing' })).rejects.toThrow('DSAR request not found');
  });
});
