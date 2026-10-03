/**
 * The rest of what an export could say about who reported, blocked or contacted a
 * member.
 *
 * The report and the safety incident are withheld from the member they are about
 * (gdpr.reports-received-export.test.ts), and so is the safety score. Four other
 * places say the same thing in other words, and each is closed here:
 *
 *   - the stored trust record, which counts a block as a report against her and
 *     keeps the date of the last one (trust.service);
 *   - the standing figure on her own account row, which moves with it;
 *   - the staff flags, one of which states the safety score in its reason and two
 *     of which count, or list, the accounts that reported, blocked or contacted her;
 *   - the audit trail of what staff did to her, which keeps a copy of the
 *     moderator's note on a report, and the moderator's account, address and
 *     browser.
 */

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findMany: jest.fn(async () => []) },
    userTrustScore: { findMany: jest.fn() },
    adminFlag: { findMany: jest.fn() },
    auditLog: { findMany: jest.fn() },
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

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  FLAG_COLUMNS_SHOWN_TO_SUBJECT,
  gdprService,
  PERSONAL_DATA_MODELS,
  STAFF_MEASURE_FLAG_TYPES,
  TRUST_RECORD_COLUMNS_SHOWN_TO_SUBJECT,
} from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const SRC = join(__dirname, '..', '..');
const schema = readFileSync(join(SRC, '..', 'prisma', 'schema.prisma'), 'utf8');

const entry = (section: string) => {
  const found = PERSONAL_DATA_MODELS.find((model) => model.section === section);
  if (!found) throw new Error(`no register entry for ${section}`);
  return found;
};

/** The scalar columns of a model, read from the schema the database is built from. */
function columnsOf(model: string): string[] {
  const block = schema.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!block) throw new Error(`no model ${model} in the schema`);
  const found: string[] = [];
  for (const raw of block[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const field = line.match(/^(\w+)\s+(\S+)/);
    if (!field) continue;
    // A relation to another model, or a list of them, is not a column.
    if (/^[A-Z]/.test(field[2]) && !/^(String|Int|Float|Boolean|DateTime|Json|Decimal|BigInt|Bytes)/.test(field[2])) continue;
    found.push(field[1]);
  }
  return found;
}

describe('the stored trust record a member is handed', () => {
  const stored = {
    id: 'trust-1',
    userId: 'him',
    trustScore: 44,
    identityVerified: true,
    identityScore: 25,
    accountAge: 400,
    accountAgeScore: 12,
    communityFeedback: 46,
    engagementScore: 50,
    professionalScore: 5,
    badges: ['VERIFIED_IDENTITY'],
    warningsCount: 1,
    suspensionsCount: 0,
    lastIncidentAt: new Date('2026-09-30T03:00:00Z'),
    reportsAgainst: 2,
    reportsSubmitted: 3,
    reportAccuracy: 0.8,
    createdAt: new Date('2026-09-30T03:00:00Z'),
    updatedAt: new Date('2026-09-30T03:00:00Z'),
  };

  it('does not say that a report or a block was made, or when', () => {
    const shown = entry('trustScore').readable!(stored) as Record<string, unknown>;

    // recordUserBlock counts a block as a report against the member, so the count,
    // the community figure, the stored score and the dates all move with one.
    for (const column of ['trustScore', 'communityFeedback', 'reportsAgainst', 'lastIncidentAt', 'createdAt', 'updatedAt']) {
      expect(shown).not.toHaveProperty(column);
    }
    expect(shown).toMatchObject({ id: 'trust-1', identityVerified: true, badges: ['VERIFIED_IDENTITY'], warningsCount: 1, reportsSubmitted: 3 });
  });

  it('classifies every column of the table, so a new one is not exported until somebody decides it may be', () => {
    const withheld = ['trustScore', 'communityFeedback', 'reportsAgainst', 'lastIncidentAt', 'createdAt', 'updatedAt'];

    expect([...TRUST_RECORD_COLUMNS_SHOWN_TO_SUBJECT, ...withheld].sort()).toEqual(columnsOf('UserTrustScore').sort());
    const shown = entry('trustScore').readable!({ ...stored, somethingAddedLater: 'x' }) as Record<string, unknown>;
    expect(shown).not.toHaveProperty('somethingAddedLater');
  });

  it('is still erased with the account', () => {
    expect(entry('trustScore')).toMatchObject({ keys: ['userId'], erasure: 'delete' });
  });
});

describe('the stored standing figures stay with the code that keeps them', () => {
  // User.trustScore and the penalty columns of UserTrustScore are moved by reports
  // and blocks, and are shown to no member (the Trust page works its figure out
  // from her profile). Naming one in a select would put it in front of other
  // members, as naming the safety score would, so this reads the source and says
  // which files may.
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
      return name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts') ? [path] : [];
    });
  const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('are named by the trust service that keeps them and by the export that withholds them, and by nothing else', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(200);

    const naming = files
      .filter((path) => /\b(trustScore|trustScoreUpdatedAt|reportsAgainst|communityFeedback)\b/.test(withoutComments(readFileSync(path, 'utf8'))))
      .map((path) => path.slice(SRC.length + 1).split(sep).join('/'))
      .sort();

    expect(naming).toEqual(['services/gdpr.service.ts', 'services/trust.service.ts']);
  });
});

describe('the staff flags about a member', () => {
  const flag = (over: Record<string, unknown>) => ({
    id: 'flag-1',
    userId: 'him',
    type: 'SAFETY_CONCERN',
    reason: 'a reason',
    severity: 'HIGH',
    flaggedById: 'system',
    resolvedAt: null,
    resolvedById: null,
    notes: 'some notes',
    isActive: true,
    createdAt: new Date('2026-09-30T03:00:00Z'),
    updatedAt: new Date('2026-09-30T03:00:00Z'),
    ...over,
  });

  it('names the kinds that are made of other members’ reports, blocks and contact, and the register keeps them apart', () => {
    const shown = entry('adminFlags');
    const kept = entry('adminFlagsStaffMeasures');

    expect(shown.where!('him')).toEqual({ userId: 'him', type: { notIn: [...STAFF_MEASURE_FLAG_TYPES] } });
    expect(kept.where!('him')).toEqual({ userId: 'him', type: { in: [...STAFF_MEASURE_FLAG_TYPES] } });
    expect(kept.exportable).toBe(false);
    expect(kept.reason).toMatch(/reported or blocked/);
    // Both are erased with the account.
    expect(shown.erasure).toBe('delete');
    expect(kept.erasure).toBe('delete');
  });

  it('uses the names the services that raise these flags use', () => {
    // The list in the register is a copy of three names defined in three services.
    // If one is renamed there, a flag of the new name would be exported.
    const defined = (file: string, pattern: RegExp) => expect(readFileSync(join(SRC, 'services', file), 'utf8')).toMatch(pattern);

    defined('safety-score.service.ts', /type:\s*'SAFETY_CRITICAL'/);
    defined('unwanted-contact.service.ts', /UNWANTED_CONTACT_FLAG\s*=\s*'UNWANTED_CONTACT'/);
    defined('pile-on.service.ts', /PILE_ON_FLAG_TYPE\s*=\s*'PILE_ON'/);
    expect([...STAFF_MEASURE_FLAG_TYPES].sort()).toEqual(['PILE_ON', 'SAFETY_CRITICAL', 'UNWANTED_CONTACT']);
  });

  it('shows what is hers about a flag and not staff’s words, scores, counts or account ids', () => {
    const shown = entry('adminFlags').readable!(
      flag({ reason: 'Safety score dropped to 12', notes: 'Accounts, most recent first:\nacct-9', flaggedById: 'mod-1', resolvedById: 'mod-2' })
    ) as Record<string, unknown>;

    for (const column of ['reason', 'notes', 'flaggedById', 'resolvedById', 'isActive']) {
      expect(shown).not.toHaveProperty(column);
    }
    expect(Object.keys(shown).sort()).toEqual([...FLAG_COLUMNS_SHOWN_TO_SUBJECT].sort());
    expect(shown).toMatchObject({ id: 'flag-1', type: 'SAFETY_CONCERN', severity: 'HIGH' });
  });

  it('classifies every column of the table', () => {
    const withheld = ['reason', 'flaggedById', 'resolvedById', 'notes', 'isActive'];

    expect([...FLAG_COLUMNS_SHOWN_TO_SUBJECT, ...withheld].sort()).toEqual(columnsOf('AdminFlag').sort());
  });
});

describe('the audit trail about a member', () => {
  const entryAboutHer = {
    id: 'audit-1',
    action: 'MODERATION_WARN',
    actorUserId: 'mod-1',
    targetUserId: 'him',
    ipAddress: '203.0.113.7',
    userAgent: 'Moderator Browser/1.0',
    metadata: {
      reportId: 'rep-1',
      moderationAction: 'warn',
      contentType: 'MESSAGE',
      notes: 'Reporter says he waits outside her office',
      reviewNotes: 'more of the same',
      contactEmail: 'her.private@example.com',
    },
    createdAt: new Date('2026-10-01T03:00:00Z'),
  };

  it('tells her what was done and when, and not who did it, from where, or what they wrote', () => {
    const shown = entry('auditTrailAsTarget').readable!(entryAboutHer) as Record<string, any>;

    for (const column of ['actorUserId', 'ipAddress', 'userAgent']) {
      expect(shown).not.toHaveProperty(column);
    }
    expect(shown).toMatchObject({ id: 'audit-1', action: 'MODERATION_WARN', targetUserId: 'him' });
    expect(shown.metadata).toEqual({ reportId: 'rep-1', moderationAction: 'warn', contentType: 'MESSAGE' });
    const text = JSON.stringify(shown);
    expect(text).not.toContain('waits outside');
    expect(text).not.toContain('her.private@example.com');
    expect(text).not.toContain('mod-1');
    expect(text).not.toContain('203.0.113.7');
  });

  it('gives her back what she did to herself as it was', () => {
    const own = { ...entryAboutHer, actorUserId: 'him', ipAddress: '198.51.100.2', userAgent: 'Her Browser', metadata: { field: 'email' } };

    expect(entry('auditTrailAsTarget').readable!(own)).toEqual(own);
  });

  it('copes with an entry that has no details', () => {
    const bare = { ...entryAboutHer, metadata: null };
    const shown = entry('auditTrailAsTarget').readable!(bare) as Record<string, unknown>;

    expect(shown).not.toHaveProperty('actorUserId');
    expect(shown.metadata).toBeNull();
    const none = entry('auditTrailAsTarget').readable!({ id: 'audit-2', action: 'X', targetUserId: 'him', actorUserId: null }) as Record<string, unknown>;
    expect(none).not.toHaveProperty('metadata');
  });

  it('is still kept without the member link when she is erased', () => {
    expect(entry('auditTrailAsTarget')).toMatchObject({ keys: ['targetUserId'], erasure: 'detach' });
  });
});

describe('the export a reported, or blocked, member is actually given', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'him' });
    prisma.dSARRequest.update.mockResolvedValue({});
    prisma.privacyAuditLog.create.mockResolvedValue({});
    prisma.userTrustScore.findMany.mockResolvedValue([]);
    prisma.adminFlag.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it('carries nothing that a block, a report or a pile-on against her was made of', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'him',
      email: 'him@athena.test',
      displayName: 'Him',
      safetyScore: 12,
      safetyScoreUpdatedAt: new Date('2026-09-30T03:00:00Z'),
      trustScore: 44,
      trustScoreUpdatedAt: new Date('2026-09-30T03:15:00Z'),
    });
    prisma.userTrustScore.findMany.mockImplementation(async ({ where }: any) =>
      where?.userId === 'him'
        ? [
            {
              id: 'trust-1',
              userId: 'him',
              trustScore: 44,
              communityFeedback: 46,
              reportsAgainst: 2,
              lastIncidentAt: new Date('2026-09-30T03:15:00Z'),
              identityVerified: true,
              badges: [],
              createdAt: new Date('2026-09-30T03:15:00Z'),
              updatedAt: new Date('2026-09-30T03:15:00Z'),
            },
          ]
        : []
    );
    // The mock answers on the filter it is given, as the database would, so an
    // export that read the flags by the wrong filter would be told so.
    const flags = [
      { id: 'f-crit', userId: 'him', type: 'SAFETY_CRITICAL', reason: 'Safety score dropped to 12', notes: null, severity: 'HIGH', flaggedById: 'system', createdAt: new Date('2026-09-30T03:15:00Z') },
      { id: 'f-unw', userId: 'him', type: 'UNWANTED_CONTACT', reason: '3 members declined, blocked or reported this account', notes: 'Blocked after a request: 2', severity: 'MEDIUM', flaggedById: 'system', createdAt: new Date('2026-09-30T03:15:00Z') },
      { id: 'f-pile', userId: 'him', type: 'PILE_ON', reason: 'Many accounts reached her', notes: 'Accounts:\nstranger-account-77', severity: 'HIGH', flaggedById: 'system', createdAt: new Date('2026-09-30T03:15:00Z') },
      { id: 'f-own', userId: 'him', type: 'SAFETY_CONCERN', reason: 'Language about self-harm in the AI chat', notes: 'Matched: a phrase', severity: 'HIGH', flaggedById: 'system', createdAt: new Date('2026-09-30T03:15:00Z') },
    ];
    prisma.adminFlag.findMany.mockImplementation(async ({ where }: any) =>
      flags.filter((f) => f.userId === where?.userId && (!where?.type?.in || where.type.in.includes(f.type)) && (!where?.type?.notIn || !where.type.notIn.includes(f.type)))
    );
    prisma.auditLog.findMany.mockImplementation(async ({ where }: any) =>
      where?.targetUserId === 'him'
        ? [
            {
              id: 'audit-1',
              action: 'MODERATION_WARN',
              actorUserId: 'mod-77',
              targetUserId: 'him',
              ipAddress: '203.0.113.7',
              userAgent: 'Moderator Browser/1.0',
              metadata: { reportId: 'rep-1', notes: 'Reporter says he waits outside her office' },
              createdAt: new Date('2026-10-01T03:00:00Z'),
            },
          ]
        : []
    );

    const { data } = await gdprService.processExportRequest('dsar-1');

    // What she is handed: her account and her records. (The list of what was left out
    // names these sections, on purpose, for everyone.)
    const bundle = JSON.stringify({ account: data.account, records: data.records });
    // The score, and the figures that move with it.
    for (const leaked of ['safetyScore', 'trustScoreUpdatedAt', 'Safety score dropped', 'reportsAgainst', 'communityFeedback', 'lastIncidentAt']) {
      expect(bundle).not.toContain(leaked);
    }
    expect(bundle).not.toMatch(/"trustScore":\d/);
    // The flags made of other members' reports, blocks and contact.
    expect(bundle).not.toContain('f-crit');
    expect(bundle).not.toContain('f-unw');
    expect(bundle).not.toContain('f-pile');
    expect(bundle).not.toContain('stranger-account-77');
    expect(bundle).not.toContain('declined, blocked or reported');
    // What staff did, and not who or what they wrote.
    for (const leaked of ['mod-77', '203.0.113.7', 'Moderator Browser', 'waits outside her office']) {
      expect(bundle).not.toContain(leaked);
    }

    // What is hers is there.
    const records: any = data.records;
    expect(records.trustScore).toHaveLength(1);
    expect(records.trustScore[0]).toMatchObject({ id: 'trust-1', identityVerified: true });
    expect(records.adminFlags.map((f: any) => f.id)).toEqual(['f-own']);
    expect(records.auditTrailAsTarget[0]).toMatchObject({ id: 'audit-1', action: 'MODERATION_WARN', metadata: { reportId: 'rep-1' } });
    expect((data.account as any).email).toBe('him@athena.test');

    // And the export says what it left out, for everyone, so that its silence is not an answer about her.
    const left = data.excluded.map((section) => section.section);
    expect(left).toEqual(expect.arrayContaining(['account.safetyScore', 'account.trustScore', 'adminFlagsStaffMeasures', 'safetyIncidentsBlocks']));
    expect(data.excluded.find((section) => section.section === 'account.trustScore')?.reason).toMatch(/Trust page/);
  });
});
