/**
 * Compare the safety state of a database as it stands with a copy restored
 * from before, and write the patch that puts the protection back.
 *
 * Run it after a restore beside production and before any rows are copied back
 * or the restored copy is made to serve anyone. The comparison and the SQL are
 * in utils/restore-safety-diff.ts, which explains what "only adds protection"
 * means; this is the part that reads the two databases.
 *
 *   node -r ts-node/register src/scripts/restore-safety-diff.ts \
 *     --live "$DIRECT_DATABASE_URL" --restored "$RESTORE_DIRECT_URL" \
 *     --since 2026-10-01T04:30:00Z [--emit-sql safety-patch.sql] [--json]
 *
 *   npm run restore:safety-diff -- --since 2026-10-01T04:30:00Z
 *
 * --live is the database as it stands, which has to still be intact: take a
 * Neon branch of production before anything is overwritten and point this at
 * that branch if production itself is no longer trustworthy. --restored is the
 * copy restored beside it. --since is the restore point. With no --live or
 * --restored, the URLs come from DIRECT_DATABASE_URL and RESTORE_DIRECT_URL.
 *
 * It reads. Every call it makes is a findMany, through a type that exposes
 * nothing else, so it cannot write to either database, and it refuses two
 * addresses that name the same database. Use a read-only role if there is one.
 * It never imports utils/prisma, whose connection is whatever DATABASE_URL
 * says, and that may be production.
 *
 * The report names members by id and nothing else. --emit-sql writes the patch
 * to a file that is created fresh and readable by its owner only; it holds ban
 * hashes and emergency-contact details, so keep it like the dump and shred it
 * afterwards. Nothing is run for you: a person reads the patch first.
 */

import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import {
  classifyAccounts,
  formatReport,
  planRestoreSafety,
  renderPatchSql,
  type AccountRow,
  type BanRow,
  type DecisionRow,
  type DvProfileRow,
  type RestorePlan,
  type SafetySnapshot,
  type SettingsRow,
} from '../utils/restore-safety-diff';

/**
 * What this script may ask a database. A PrismaClient satisfies it, and nothing
 * on it can write.
 */
export interface SafetyReader {
  userSafetySettings: { findMany(args: object): Promise<unknown[]> };
  dvSafetyProfile: { findMany(args: object): Promise<unknown[]> };
  user: { findMany(args: object): Promise<unknown[]> };
  bannedIdentity: { findMany(args: object): Promise<unknown[]> };
  auditLog: { findMany(args: object): Promise<unknown[]> };
}

const CHUNK = 500;
const chunks = <T>(values: T[]): T[][] => {
  const out: T[][] = [];
  for (let at = 0; at < values.length; at += CHUNK) out.push(values.slice(at, at + CHUNK));
  return out;
};

/** The audit rows that say what staff or a member decided after the restore point. */
const DECISION_ACTIONS = ['MODERATION_BAN', 'MODERATION_SUSPEND', 'MODERATION_REMOVE', 'ACCOUNT_DELETE'];

const SETTINGS_SELECT = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  allowMessagesFrom: true,
  filterOffensiveContent: true,
  hideReadReceipts: true,
  profileVisibility: true,
  hideOnlineStatus: true,
  hideLastSeen: true,
  enableSafetyAlerts: true,
  blockedUsers: true,
  blockedKeywords: true,
};

const DV_SELECT = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  isSafeMode: true,
  hideFromSearch: true,
  allowMessages: true,
  safeExitEnabled: true,
  safeExitUrl: true,
  panicButtonEnabled: true,
  activityLogEnabled: true,
  disguisedAppIcon: true,
  notificationsSafe: true,
  emergencyContacts: true,
  blockedUserIds: true,
};

// The columns of a suspension are read from the live database only: the
// restored copy needs to say whether the account is closed, nothing more.
const ACCOUNT_SELECT = {
  id: true,
  allowMessages: true,
  isSuspended: true,
  profile: { select: { isSafeMode: true, hideFromSearch: true } },
};
const LIVE_ACCOUNT_SELECT = {
  ...ACCOUNT_SELECT,
  suspensionReason: true,
  suspendedAt: true,
  suspendedById: true,
  bannedAt: true,
  banReason: true,
  bannedById: true,
};

const BAN_SELECT = { id: true, emailHash: true, userId: true, reportId: true, createdById: true, reason: true, createdAt: true };

/** What this script selects, so a test can check every column still exists in the schema. */
export const SELECTS = {
  settings: SETTINGS_SELECT,
  dvProfile: DV_SELECT,
  account: ACCOUNT_SELECT,
  liveAccount: LIVE_ACCOUNT_SELECT,
  ban: BAN_SELECT,
};

type Raw = Record<string, unknown>;

function toAccount(row: Raw): AccountRow {
  const profile = (row.profile ?? null) as { isSafeMode: boolean; hideFromSearch: boolean } | null;
  const account: AccountRow = {
    userId: String(row.id),
    allowMessages: row.allowMessages as boolean,
    isSuspended: row.isSuspended as boolean,
    profileIsSafeMode: profile ? profile.isSafeMode : null,
    profileHideFromSearch: profile ? profile.hideFromSearch : null,
  };
  if ('suspensionReason' in row) {
    account.suspensionReason = row.suspensionReason as string | null;
    account.suspendedAt = row.suspendedAt as Date | null;
    account.suspendedById = row.suspendedById as string | null;
    account.bannedAt = row.bannedAt as Date | null;
    account.banReason = row.banReason as string | null;
    account.bannedById = row.bannedById as string | null;
  }
  return account;
}

async function accountsFor(db: SafetyReader, ids: string[], live: boolean): Promise<AccountRow[]> {
  const rows: Raw[] = [];
  for (const part of chunks(ids)) {
    rows.push(
      ...((await db.user.findMany({
        where: { id: { in: part } },
        select: live ? LIVE_ACCOUNT_SELECT : ACCOUNT_SELECT,
      })) as Raw[])
    );
  }
  return rows.map(toAccount);
}

/** Of these accounts, which have been reduced to a tombstone by an erasure. The address is matched, never read. */
async function tombstonedIn(db: SafetyReader, ids: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const part of chunks(ids)) {
    const rows = (await db.user.findMany({
      where: {
        id: { in: part },
        OR: [{ email: { endsWith: '@erased.invalid' } }, { email: { endsWith: '@example.invalid' } }],
      },
      select: { id: true },
    })) as Array<{ id: string }>;
    found.push(...rows.map((row) => row.id));
  }
  return found;
}

/** The ids and nothing else out of an audit row's metadata; notes and reasons are never read. */
function referenceIn(metadata: unknown): { contentType: string | null; contentId: string | null } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { contentType: null, contentId: null };
  const { contentType, contentId } = metadata as Raw;
  return {
    contentType: typeof contentType === 'string' ? contentType.slice(0, 40) : null,
    contentId: typeof contentId === 'string' ? contentId : null,
  };
}

/** Both databases, compared. Reads only. */
export async function compareDatabases(live: SafetyReader, restored: SafetyReader, since: Date): Promise<RestorePlan> {
  const [liveSettings, restoredSettings, liveDv, restoredDv, liveBans, restoredBans] = await Promise.all([
    live.userSafetySettings.findMany({ select: SETTINGS_SELECT }) as Promise<SettingsRow[]>,
    restored.userSafetySettings.findMany({ select: SETTINGS_SELECT }) as Promise<SettingsRow[]>,
    live.dvSafetyProfile.findMany({ select: DV_SELECT }) as Promise<DvProfileRow[]>,
    restored.dvSafetyProfile.findMany({ select: DV_SELECT }) as Promise<DvProfileRow[]>,
    live.bannedIdentity.findMany({ select: BAN_SELECT }) as Promise<BanRow[]>,
    restored.bannedIdentity.findMany({ select: BAN_SELECT }) as Promise<BanRow[]>,
  ]);

  // Staff decisions and erasures since the restore point exist only live.
  const auditRows = (await live.auditLog.findMany({
    where: { createdAt: { gte: since }, action: { in: DECISION_ACTIONS } },
    select: { id: true, action: true, targetUserId: true, createdAt: true, metadata: true },
    orderBy: { createdAt: 'asc' },
  })) as Array<{ id: string; action: string; targetUserId: string | null; createdAt: Date; metadata: unknown }>;
  const decisions: DecisionRow[] = auditRows.map((row) => ({
    id: row.id,
    action: row.action,
    targetUserId: row.targetUserId,
    createdAt: row.createdAt,
    ...referenceIn(row.metadata),
  }));

  // Every member either copy has a safety row for, and everyone live has closed.
  const closedLive = (await live.user.findMany({
    where: { OR: [{ isSuspended: true }, { bannedAt: { not: null } }] },
    select: { id: true },
  })) as Array<{ id: string }>;
  const ids = [
    ...new Set([
      ...liveSettings.map((row) => row.userId),
      ...restoredSettings.map((row) => row.userId),
      ...liveDv.map((row) => row.userId),
      ...restoredDv.map((row) => row.userId),
      ...closedLive.map((row) => row.id),
      ...decisions.flatMap((row) => (row.targetUserId ? [row.targetUserId] : [])),
    ]),
  ];

  const [liveAccounts, restoredAccounts, liveTombstoned] = await Promise.all([
    accountsFor(live, ids, true),
    accountsFor(restored, ids, false),
    tombstonedIn(live, ids),
  ]);

  const { erased } = classifyAccounts({
    restoredPresent: restoredAccounts.map((account) => account.userId),
    livePresent: liveAccounts.map((account) => account.userId),
    liveTombstoned,
    auditErased: decisions.flatMap((row) => (row.action === 'ACCOUNT_DELETE' && row.targetUserId ? [row.targetUserId] : [])),
  });

  const snapshot = (
    settings: SettingsRow[],
    dvProfiles: DvProfileRow[],
    accounts: AccountRow[],
    bans: BanRow[]
  ): SafetySnapshot => ({ settings, dvProfiles, accounts, bans });

  return planRestoreSafety({
    since,
    live: snapshot(liveSettings, liveDv, liveAccounts, liveBans),
    restored: snapshot(restoredSettings, restoredDv, restoredAccounts, restoredBans),
    decisions,
    erasedUserIds: erased,
  });
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

export interface Options {
  live: string;
  restored: string;
  since: Date;
  emitSql: string | null;
  json: boolean;
}

function valueOf(args: string[], name: string): string | null {
  const at = args.indexOf(name);
  if (at < 0) return null;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

export function parseOptions(args: string[], env: NodeJS.ProcessEnv): Options {
  const live = valueOf(args, '--live') ?? env.DIRECT_DATABASE_URL ?? '';
  const restored = valueOf(args, '--restored') ?? env.RESTORE_DIRECT_URL ?? '';
  const sinceText = valueOf(args, '--since');

  if (!live) throw new Error('Say which database is live: --live <url>, or set DIRECT_DATABASE_URL');
  if (!restored) throw new Error('Say which database was restored: --restored <url>, or set RESTORE_DIRECT_URL');
  if (!sinceText) throw new Error('Say when the restore point was: --since <ISO date and time>, such as 2026-10-01T04:30:00Z');

  for (const [name, url] of [['--live', live], ['--restored', restored]] as const) {
    if (!/^postgres(ql)?:\/\//i.test(url)) throw new Error(`${name} has to be a postgres:// address`);
  }
  // The same database twice would compare it with itself and report that all is well.
  if (live.trim() === restored.trim()) {
    throw new Error('--live and --restored are the same address. Restore beside production, then point them at two different databases.');
  }

  const since = new Date(sinceText);
  if (Number.isNaN(since.getTime())) throw new Error(`--since is not a date: ${sinceText}`);
  if (since.getTime() > Date.now()) throw new Error('--since is in the future');

  return { live, restored, since, emitSql: valueOf(args, '--emit-sql'), json: args.includes('--json') };
}

/** The patch goes to a new file, readable by its owner only; an existing file is never overwritten. */
export function writePatch(file: string, plan: RestorePlan): void {
  fs.writeFileSync(file, renderPatchSql(plan), { flag: 'wx', mode: 0o600 });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2), process.env);

  const live = new PrismaClient({ datasourceUrl: options.live, log: [] });
  const restored = new PrismaClient({ datasourceUrl: options.restored, log: [] });
  try {
    const plan = await compareDatabases(live, restored, options.since);

    if (options.json) {
      // The patch text is left out: it holds hashes and contact details.
      console.log(JSON.stringify({ ...plan, findings: plan.findings.map(({ sql, ...rest }) => ({ ...rest, statements: sql?.length ?? 0 })) }, null, 2));
    } else {
      console.log(formatReport(plan));
    }

    if (options.emitSql) {
      writePatch(options.emitSql, plan);
      console.error(`\nPatch written to ${options.emitSql} (${plan.statements} statements). Read it before running it; shred it afterwards.`);
    }
  } finally {
    await Promise.allSettled([live.$disconnect(), restored.$disconnect()]);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
