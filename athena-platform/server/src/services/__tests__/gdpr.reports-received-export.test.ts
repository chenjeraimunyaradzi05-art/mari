/**
 * What a member who was reported, or blocked, is shown of it in her data export.
 *
 * She is entitled to know a report was made about her and what became of it. She
 * must not be handed who made it, what they wrote, or the copy a report keeps of
 * the thread it is about, which holds the reporter's own earlier messages: in a
 * case of harassment or violence, an export is the way a person would find out
 * who reported them, and a woman who reported a man, or blocked him, is the one
 * who pays when he does. The reporter, for her part, gets her own report back
 * whole.
 *
 * Two tables carry this, and both were exported in full until now: ContentReport
 * (as `reportsReceived`, keyed on the reported member) and SafetyIncident (as
 * `safetyIncidents`, keyed on the member the incident is about, whose reporterId
 * is the reporter, or for a block the blocker).
 */

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findMany: jest.fn(async () => []) },
    contentReport: { findMany: jest.fn() },
    safetyIncident: { findMany: jest.fn() },
  };
  // Every other table in the register reads as empty.
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []) };
      return target[name];
    },
  });
  return { prisma };
});
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  gdprService,
  INCIDENT_COLUMNS_SHOWN_TO_SUBJECT,
  PERSONAL_DATA_MODELS,
  REPORT_COLUMNS_SHOWN_TO_SUBJECT,
} from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const entry = (section: string) => {
  const found = PERSONAL_DATA_MODELS.find((model) => model.section === section);
  if (!found) throw new Error(`no register entry for ${section}`);
  return found;
};

const row = {
  id: 'rep-1',
  reporterId: 'her',
  reportedUserId: 'him',
  contentType: 'MESSAGE',
  contentId: 'msg-1',
  reason: 'harassment',
  description: 'He keeps messaging me at work',
  status: 'RESOLVED',
  reviewerId: 'mod-1',
  reviewNotes: 'Reporter says he waits outside her office; she is frightened',
  action: 'CONTENT_REMOVED',
  actionTakenAt: new Date('2026-10-02T03:00:00Z'),
  aiConfidence: 0.91,
  aiCategory: 'harassment',
  reviewDeadline: new Date('2026-10-02T03:00:00Z'),
  priority: 'HIGH',
  createdAt: new Date('2026-10-01T03:00:00Z'),
  updatedAt: new Date('2026-10-02T03:00:00Z'),
  evidence: {
    ticketId: 'RPT-1',
    contactEmail: 'her.private@example.com',
    messageContext: { before: [{ senderId: 'her', content: 'Please stop' }], reported: { senderId: 'him', content: 'I know where you work' } },
  },
};

const incident = {
  id: 'inc-1',
  userId: 'him',
  type: 'REPORT',
  severity: 'MEDIUM',
  reason: 'harassment',
  reporterId: 'her',
  contentId: 'msg-1',
  contentType: 'MESSAGE',
  verified: true,
  resolvedAt: new Date('2026-10-02T03:00:00Z'),
  resolvedById: 'mod-1',
  metadata: { anonymous: true, contactEmail: 'anon.reporter@example.com', description: 'He follows me home' },
  createdAt: new Date('2026-10-01T03:00:00Z'),
  updatedAt: new Date('2026-10-02T03:00:00Z'),
};

describe('the report a member was reported in', () => {
  it('shows her that a report exists and what became of it', () => {
    const shown = entry('reportsReceived').readable!(row) as Record<string, unknown>;

    expect(shown).toMatchObject({
      id: 'rep-1',
      contentType: 'MESSAGE',
      contentId: 'msg-1',
      reason: 'harassment',
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
    });
    expect(shown.actionTakenAt).toEqual(row.actionTakenAt);
    expect(shown.createdAt).toEqual(row.createdAt);
  });

  it('never shows who reported her, what they typed, what they attached, or what the moderators wrote from it', () => {
    const shown = entry('reportsReceived').readable!(row) as Record<string, unknown>;

    for (const column of ['reporterId', 'description', 'evidence', 'reviewNotes', 'reviewerId', 'aiConfidence', 'aiCategory']) {
      expect(shown).not.toHaveProperty(column);
    }
    const text = JSON.stringify(shown);
    expect(text).not.toContain('her"');
    expect(text).not.toContain('Please stop');
    expect(text).not.toContain('keeps messaging me at work');
    expect(text).not.toContain('her.private@example.com');
    expect(text).not.toContain('waits outside her office');
    expect(text).not.toContain('mod-1');
  });

  it('leaves out a column added to the table later until somebody decides she may have it', () => {
    const shown = entry('reportsReceived').readable!({ ...row, reporterEmail: 'her.private@example.com' }) as Record<string, unknown>;

    expect(shown).not.toHaveProperty('reporterEmail');
    expect(Object.keys(shown).sort()).toEqual([...REPORT_COLUMNS_SHOWN_TO_SUBJECT].sort());
  });

  it('is still found by the account that was reported, and kept when the account is erased', () => {
    const received = entry('reportsReceived');
    expect(received.keys).toEqual(['reportedUserId']);
    expect(received.erasure).toBe('retain');
  });

  it('gives the member who made the report her own report back as it was', () => {
    const submitted = entry('reportsSubmitted');
    expect(submitted.keys).toEqual(['reporterId']);
    expect(submitted.readable).toBeUndefined();
  });
});

describe('the incidents moderation recorded about a member', () => {
  it('shows her what the incident was about and how it ended, and not who raised it or who closed it', () => {
    const shown = entry('safetyIncidents').readable!(incident) as Record<string, unknown>;

    expect(shown).toMatchObject({
      id: 'inc-1',
      type: 'REPORT',
      reason: 'harassment',
      contentType: 'MESSAGE',
      contentId: 'msg-1',
      verified: true,
    });
    for (const column of ['reporterId', 'resolvedById', 'metadata']) {
      expect(shown).not.toHaveProperty(column);
    }
    const text = JSON.stringify(shown);
    expect(text).not.toContain('her"');
    expect(text).not.toContain('mod-1');
    expect(text).not.toContain('anon.reporter@example.com');
    expect(text).not.toContain('follows me home');
  });

  it('leaves out a column added to the table later until somebody decides she may have it', () => {
    const shown = entry('safetyIncidents').readable!({ ...incident, reporterEmail: 'x@example.com' }) as Record<string, unknown>;

    expect(Object.keys(shown).sort()).toEqual([...INCIDENT_COLUMNS_SHOWN_TO_SUBJECT].sort());
  });

  it('does not read the incidents that are blocks, which are never announced to the person blocked', () => {
    // The export reads by the entry's own filter, so a block is not fetched at
    // all, rather than fetched and dropped.
    expect(entry('safetyIncidents').where!('him')).toEqual({ userId: 'him', type: { not: 'BLOCK' } });
    expect(entry('safetyIncidentsBlocks').where!('him')).toEqual({ userId: 'him', type: 'BLOCK' });
    expect(entry('safetyIncidentsBlocks').exportable).toBe(false);
    expect(entry('safetyIncidentsBlocks').reason).toMatch(/who blocked/);
  });

  it('still erases every incident about her, the blocks too, when she asks to be erased', () => {
    expect(entry('safetyIncidents').erasure).toBe('delete');
    expect(entry('safetyIncidentsBlocks').erasure).toBe('delete');
  });
});

describe('the export a reported, or blocked, member is actually given', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'him' });
    prisma.dSARRequest.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ id: 'him', email: 'him@athena.test' });
    prisma.privacyAuditLog.create.mockResolvedValue({});
    prisma.contentReport.findMany.mockResolvedValue([]);
    prisma.safetyIncident.findMany.mockResolvedValue([]);
  });

  it('names nobody who reported or blocked her, and carries no address or words from a reporter', async () => {
    // findMany answers on the filter it is given, so an export that read a table
    // by the wrong column would get nothing and the test would say so.
    prisma.contentReport.findMany.mockImplementation(async ({ where }: any) =>
      where?.reportedUserId === 'him' ? [row] : where?.reporterId === 'him' ? [] : []
    );
    prisma.safetyIncident.findMany.mockImplementation(async ({ where }: any) =>
      where?.userId === 'him' && where?.type?.not === 'BLOCK'
        ? [incident]
        : []
    );

    const { data } = await gdprService.processExportRequest('dsar-1');

    const records: any = data.records;
    expect(records.reportsReceived).toHaveLength(1);
    expect(records.safetyIncidents).toHaveLength(1);

    const bundle = JSON.stringify(data);
    expect(bundle).not.toContain('"her"');
    expect(bundle).not.toContain('her.private@example.com');
    expect(bundle).not.toContain('anon.reporter@example.com');
    expect(bundle).not.toContain('Please stop');
    expect(bundle).not.toContain('keeps messaging me at work');
    expect(bundle).not.toContain('follows me home');
    expect(bundle).not.toContain('waits outside her office');
    expect(bundle).not.toContain('mod-1');
    // What she is entitled to is there.
    expect(records.reportsReceived[0]).toMatchObject({ id: 'rep-1', reason: 'harassment', action: 'CONTENT_REMOVED' });
    expect(records.safetyIncidents[0]).toMatchObject({ id: 'inc-1', type: 'REPORT', reason: 'harassment' });
  });

  it('does not hand a member her own safety score, which is staff’s and says how many people reported or blocked her', async () => {
    // A score that fell the day after a woman blocked him is how he would learn who did.
    prisma.user.findUnique.mockResolvedValue({
      id: 'him',
      email: 'him@athena.test',
      displayName: 'Him',
      safetyScore: 12,
      safetyScoreUpdatedAt: new Date('2026-10-01T03:00:00Z'),
    });

    const { data } = await gdprService.processExportRequest('dsar-1');

    const account: any = data.account;
    expect(account.email).toBe('him@athena.test');
    expect(account).not.toHaveProperty('safetyScore');
    expect(account).not.toHaveProperty('safetyScoreUpdatedAt');
    expect(JSON.stringify(data.account)).not.toContain('12');
    // And it says so, for everyone, so that the silence is not an answer about her.
    expect(data.excluded.find((section) => section.section === 'account.safetyScore')?.reason).toMatch(/staff/);
  });

  it('says that blocks are not included, always, so that its silence about one is not an answer', async () => {
    const { data } = await gdprService.processExportRequest('dsar-1');

    const blocks = data.excluded.find((section) => section.section === 'safetyIncidentsBlocks');
    expect(blocks?.reason).toMatch(/Blocks other members have made/);
    // And no table of blocks was read for the export.
    const readAsBlocks = prisma.safetyIncident.findMany.mock.calls.filter(([args]: any) => args?.where?.type === 'BLOCK');
    expect(readAsBlocks).toHaveLength(0);
  });
});
