/**
 * What a database restore would undo on the safety side, and the patch that
 * puts the protection back.
 *
 * Restoring from before an incident undoes every write since the restore point.
 * On this platform that includes the writes that matter most: a block a member
 * placed against someone, a Safe Mode switch she turned on, a person staff
 * banned, an account she asked to have erased. A restore that quietly lifts a
 * block or resurrects a deleted account is a safety incident of its own, and
 * the runbook used to answer it with "re-apply them from the API logs". This is
 * the comparison that replaces the logs.
 *
 * Two copies go in: the database as it stands ("live", which must be kept
 * intact until this has been run, for instance as a Neon branch taken before
 * anything is overwritten) and the copy restored beside it. What comes out is a
 * plan: findings by member id, and for each one that is safe to apply, the SQL
 * that applies it.
 *
 * The rule the whole file is built on: **a patch only ever adds protection.**
 *
 *   - A block live has and the restored copy lacks is added back. A block the
 *     restored copy has and live lacks is one she removed since; it is listed
 *     and never re-applied, because putting back a block she took off is its
 *     own harm, and she should be asked.
 *   - A switch live has turned to the safer side is turned again. One live has
 *     turned to the less safe side is listed, not applied, for the same reason.
 *   - A ban or a suspension live has is applied again. One that was lifted
 *     since is listed.
 *   - Nobody erased since is brought back: their rows are left out of every
 *     statement, and their ids are listed so the erasure is run again.
 *
 * This module only compares rows and writes text. It opens no connection and
 * runs nothing; scripts/restore-safety-diff.ts reads the two databases (reads
 * only) and a person reads the SQL before running it anywhere.
 */

// ---------------------------------------------------------------------------
// Rows, as the two databases hold them
// ---------------------------------------------------------------------------

export interface SettingsRow {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  allowMessagesFrom: string;
  filterOffensiveContent: boolean;
  hideReadReceipts: boolean;
  profileVisibility: string;
  hideOnlineStatus: boolean;
  hideLastSeen: boolean;
  enableSafetyAlerts: boolean;
  blockedUsers: string[];
  blockedKeywords: string[];
}

export interface DvProfileRow {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  isSafeMode: boolean;
  hideFromSearch: boolean;
  allowMessages: boolean;
  safeExitEnabled: boolean;
  safeExitUrl: string;
  panicButtonEnabled: boolean;
  activityLogEnabled: boolean;
  disguisedAppIcon: boolean;
  notificationsSafe: boolean;
  /** [{ id, name, phone, email?, relationship, notifyOnPanic }] */
  emergencyContacts: unknown;
  blockedUserIds: string[];
}

/** What an account row says that a safety switch is mirrored onto, and whether staff closed it. */
export interface AccountRow {
  userId: string;
  allowMessages: boolean;
  isSuspended: boolean;
  /** Profile.isSafeMode and Profile.hideFromSearch; null when she has no profile row. */
  profileIsSafeMode: boolean | null;
  profileHideFromSearch: boolean | null;
  /** Why and by whom, as a suspension or ban recorded them. Only the live copy needs these. */
  suspensionReason?: string | null;
  suspendedAt?: Date | null;
  suspendedById?: string | null;
  bannedAt?: Date | null;
  banReason?: string | null;
  bannedById?: string | null;
}

export interface BanRow {
  id: string;
  emailHash: string;
  userId: string | null;
  reportId: string | null;
  createdById: string;
  reason: string | null;
  createdAt: Date;
}

/** One safety state: either database, read the same way. */
export interface SafetySnapshot {
  settings: SettingsRow[];
  dvProfiles: DvProfileRow[];
  accounts: AccountRow[];
  bans: BanRow[];
}

/** A staff decision or an erasure written to the audit log after the restore point. Live only. */
export interface DecisionRow {
  id: string;
  action: string;
  targetUserId: string | null;
  createdAt: Date;
  contentType?: string | null;
  contentId?: string | null;
}

export interface RestoreComparison {
  since: Date;
  live: SafetySnapshot;
  restored: SafetySnapshot;
  /** Audit rows after `since`: MODERATION_BAN, MODERATION_SUSPEND, MODERATION_REMOVE and ACCOUNT_DELETE. */
  decisions: DecisionRow[];
  /**
   * Members whose account was erased after the restore point, as the caller
   * worked it out (see classifyAccounts). The audit rows alone are not enough:
   * a request-based erasure deliberately leaves the member's id off its row.
   */
  erasedUserIds: string[];
}

// ---------------------------------------------------------------------------
// What comes out
// ---------------------------------------------------------------------------

export type FindingKind =
  /** Live has it, the restored copy lacks it, and it is protective: put back. */
  | 'reapply'
  /** Live has removed or relaxed it since. Listed for a person; never put back. */
  | 'lifted-since'
  /** Differs, and neither side is the safer one (an exit link, an activity log). Listed. */
  | 'differs'
  /** A row that exists only live, carried over. */
  | 'carried-over'
  /** Something the restored copy cannot hold: the member joined after the restore point. */
  | 'not-in-restored-copy'
  /** Erased since the restore point. Left out of every statement. */
  | 'erased-since'
  /** A staff decision made after the restore point, for a person to re-run. */
  | 'decision';

export interface Finding {
  kind: FindingKind;
  /** The member it is about; null for a ban recorded against an address with no account. */
  userId: string | null;
  table: string;
  field?: string;
  /** What it is, in words that carry no name, address or number. */
  summary: string;
  /** The ids or values involved, when they are ids or plain switch values; never contact details. */
  detail?: string[];
  /** The statements that apply it. Present only for findings that are applied. */
  sql?: string[];
}

export interface RestorePlan {
  since: string;
  findings: Finding[];
  counts: Record<FindingKind, number>;
  /** How many of live's rows were written after the restore point (by updatedAt), whether or not they differ. */
  changedSince: { settings: number; dvProfiles: number };
  /** How many statements the patch holds. */
  statements: number;
}

// ---------------------------------------------------------------------------
// SQL text
// ---------------------------------------------------------------------------

// Every value that reaches a statement is checked or quoted here, so a damaged
// row cannot turn a patch into something else. Ids are the shape this
// platform's cuid and uuid columns have; anything else stops the run.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const HASH = /^[0-9a-f]{64}$/;

function id(value: string): string {
  if (!SAFE_ID.test(value)) throw new Error('Refusing to write an identifier of an unexpected shape into SQL');
  return `'${value}'`;
}

function text(value: string): string {
  if (value.includes('\0')) throw new Error('Refusing to write text with a NUL character into SQL');
  return `'${value.replace(/'/g, "''")}'`;
}

function bool(value: boolean): string {
  return value ? 'true' : 'false';
}

function when(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Refusing to write an invalid date into SQL');
  return `'${value.toISOString()}'::timestamp(3)`;
}

function nullable(value: string | null | undefined, render: (value: string) => string = text): string {
  return value === null || value === undefined ? 'NULL' : render(value);
}

function idArray(values: string[]): string {
  return `ARRAY[${values.map(id).join(', ')}]::text[]`;
}

function textArray(values: string[]): string {
  return `ARRAY[${values.map(text).join(', ')}]::text[]`;
}

const quoted = (name: string) => `"${name}"`;

// ---------------------------------------------------------------------------
// Comparing one switch
// ---------------------------------------------------------------------------

/** Higher is safer. A value off the ladder cannot be ranked. */
type Ladder = readonly string[];

interface SwitchRule {
  field: string;
  /** For a yes/no switch: the value that is the safer one. */
  safer?: boolean;
  /** For a list of named levels, lowest to safest. */
  ladder?: Ladder;
}

type Verdict = 'same' | 'tightened' | 'relaxed' | 'differs';

function judge(rule: SwitchRule, live: unknown, restored: unknown): Verdict {
  if (live === restored) return 'same';

  if (rule.safer !== undefined) {
    if (typeof live !== 'boolean' || typeof restored !== 'boolean') return 'differs';
    return live === rule.safer ? 'tightened' : 'relaxed';
  }

  if (rule.ladder) {
    const liveRank = typeof live === 'string' ? rule.ladder.indexOf(live) : -1;
    const restoredRank = typeof restored === 'string' ? rule.ladder.indexOf(restored) : -1;
    if (liveRank < 0 || restoredRank < 0) return 'differs';
    return liveRank > restoredRank ? 'tightened' : 'relaxed';
  }

  return 'differs';
}

const SETTINGS_SWITCHES: SwitchRule[] = [
  { field: 'profileVisibility', ladder: ['public', 'connections', 'private'] },
  { field: 'allowMessagesFrom', ladder: ['all', 'connections', 'none'] },
  { field: 'filterOffensiveContent', safer: true },
  { field: 'hideReadReceipts', safer: true },
  { field: 'hideOnlineStatus', safer: true },
  { field: 'hideLastSeen', safer: true },
  { field: 'enableSafetyAlerts', safer: true },
];

const DV_SWITCHES: SwitchRule[] = [
  { field: 'isSafeMode', safer: true },
  { field: 'hideFromSearch', safer: true },
  // Closed to messages is the safer side.
  { field: 'allowMessages', safer: false },
  { field: 'notificationsSafe', safer: true },
  { field: 'safeExitEnabled', safer: true },
  { field: 'panicButtonEnabled', safer: true },
  { field: 'disguisedAppIcon', safer: true },
  // Neither side of these is the safer one: a log she may want off, a page she chose.
  { field: 'activityLogEnabled' },
  { field: 'safeExitUrl' },
];

const ACCOUNT_SWITCHES: Array<SwitchRule & { table: string; column: string; key: keyof AccountRow }> = [
  { field: 'Profile.isSafeMode', table: 'Profile', column: 'isSafeMode', key: 'profileIsSafeMode', safer: true },
  { field: 'Profile.hideFromSearch', table: 'Profile', column: 'hideFromSearch', key: 'profileHideFromSearch', safer: true },
  { field: 'User.allowMessages', table: 'User', column: 'allowMessages', key: 'allowMessages', safer: false },
];

const missingFrom = (have: string[], lack: string[]) => have.filter((value) => !lack.includes(value));

// ---------------------------------------------------------------------------
// Emergency contacts
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  raw: Record<string, unknown>;
}

/** The contacts in a Json column, by their own ids. A value that is not a list of objects with ids holds none. */
function contactsOf(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.id === 'string' && SAFE_ID.test(record.id) ? [{ id: record.id, raw: record }] : [];
  });
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

const KINDS: FindingKind[] = [
  'reapply',
  'lifted-since',
  'differs',
  'carried-over',
  'not-in-restored-copy',
  'erased-since',
  'decision',
];

const byUser = <T extends { userId: string }>(rows: T[]) => new Map(rows.map((row) => [row.userId, row]));

export function planRestoreSafety(input: RestoreComparison): RestorePlan {
  const findings: Finding[] = [];
  const erased = new Set(input.erasedUserIds);

  const liveSettings = byUser(input.live.settings);
  const restoredSettings = byUser(input.restored.settings);
  const liveDv = byUser(input.live.dvProfiles);
  const restoredDv = byUser(input.restored.dvProfiles);
  const liveAccounts = byUser(input.live.accounts);
  const restoredAccounts = byUser(input.restored.accounts);

  // A member is in the restored copy if her account row is. One who is not
  // joined after the restore point, and nothing about her can be put back.
  const inRestoredCopy = (userId: string) => restoredAccounts.has(userId);

  // ---- erased since -------------------------------------------------------
  for (const userId of [...erased].sort()) {
    findings.push({
      kind: 'erased-since',
      userId,
      table: 'User',
      summary:
        'Erased after the restore point. Nothing of hers is carried over, and her erasure must be run again on the restored copy before it serves anyone.',
    });
  }

  // ---- UserSafetySettings -------------------------------------------------
  for (const [userId, live] of [...liveSettings].sort(([a], [b]) => a.localeCompare(b))) {
    if (erased.has(userId)) continue;
    const restored = restoredSettings.get(userId);

    if (!restored) {
      if (!inRestoredCopy(userId)) {
        findings.push({
          kind: 'not-in-restored-copy',
          userId,
          table: 'UserSafetySettings',
          summary: 'Her account is not in the restored copy (she joined after the restore point), so her settings and blocks cannot be put back.',
        });
        continue;
      }
      findings.push({
        kind: 'carried-over',
        userId,
        table: 'UserSafetySettings',
        summary: 'Her safety settings exist only live: the restored copy has none. Carried over with her blocks.',
        detail: live.blockedUsers,
        sql: [insertSettings(live)],
      });
      continue;
    }

    const toAdd = missingFrom(live.blockedUsers, restored.blockedUsers);
    if (toAdd.length > 0) {
      findings.push({
        kind: 'reapply',
        userId,
        table: 'UserSafetySettings',
        field: 'blockedUsers',
        summary: `${toAdd.length} block${toAdd.length === 1 ? '' : 's'} placed after the restore point, put back.`,
        detail: toAdd,
        sql: [
          `UPDATE ${quoted('UserSafetySettings')} SET ${quoted('blockedUsers')} = ARRAY(SELECT DISTINCT unnest(${quoted('blockedUsers')} || ${idArray(toAdd)})), ${quoted('updatedAt')} = now() ` +
            `WHERE ${quoted('userId')} = ${id(userId)} AND NOT (${quoted('blockedUsers')} @> ${idArray(toAdd)});`,
        ],
      });
    }
    const removed = missingFrom(restored.blockedUsers, live.blockedUsers);
    if (removed.length > 0) {
      findings.push({
        kind: 'lifted-since',
        userId,
        table: 'UserSafetySettings',
        field: 'blockedUsers',
        summary: `${removed.length} block${removed.length === 1 ? '' : 's'} she removed after the restore point. Not put back: ask her.`,
        detail: removed,
      });
    }

    const keywordsToAdd = missingFrom(live.blockedKeywords, restored.blockedKeywords);
    if (keywordsToAdd.length > 0) {
      findings.push({
        kind: 'reapply',
        userId,
        table: 'UserSafetySettings',
        field: 'blockedKeywords',
        summary: `${keywordsToAdd.length} muted word${keywordsToAdd.length === 1 ? '' : 's'} added after the restore point, put back.`,
        sql: [
          `UPDATE ${quoted('UserSafetySettings')} SET ${quoted('blockedKeywords')} = ARRAY(SELECT DISTINCT unnest(${quoted('blockedKeywords')} || ${textArray(keywordsToAdd)})), ${quoted('updatedAt')} = now() ` +
            `WHERE ${quoted('userId')} = ${id(userId)} AND NOT (${quoted('blockedKeywords')} @> ${textArray(keywordsToAdd)});`,
        ],
      });
    }
    const keywordsRemoved = missingFrom(restored.blockedKeywords, live.blockedKeywords);
    if (keywordsRemoved.length > 0) {
      findings.push({
        kind: 'lifted-since',
        userId,
        table: 'UserSafetySettings',
        field: 'blockedKeywords',
        summary: `${keywordsRemoved.length} muted word${keywordsRemoved.length === 1 ? '' : 's'} she removed after the restore point. Not put back.`,
      });
    }

    for (const rule of SETTINGS_SWITCHES) {
      const liveValue = (live as unknown as Record<string, unknown>)[rule.field];
      const restoredValue = (restored as unknown as Record<string, unknown>)[rule.field];
      pushSwitch(findings, judge(rule, liveValue, restoredValue), {
        userId,
        table: 'UserSafetySettings',
        rule,
        liveValue,
        restoredValue,
        statement:
          typeof liveValue === 'string' || typeof liveValue === 'boolean'
            ? `UPDATE ${quoted('UserSafetySettings')} SET ${quoted(rule.field)} = ${typeof liveValue === 'string' ? text(liveValue) : bool(liveValue)}, ${quoted('updatedAt')} = now() ` +
              `WHERE ${quoted('userId')} = ${id(userId)} AND ${quoted(rule.field)} IS DISTINCT FROM ${typeof liveValue === 'string' ? text(liveValue) : bool(liveValue)};`
            : null,
      });
    }
  }

  // ---- DvSafetyProfile ----------------------------------------------------
  for (const [userId, live] of [...liveDv].sort(([a], [b]) => a.localeCompare(b))) {
    if (erased.has(userId)) continue;
    const restored = restoredDv.get(userId);

    if (!restored) {
      if (!inRestoredCopy(userId)) {
        findings.push({
          kind: 'not-in-restored-copy',
          userId,
          table: 'DvSafetyProfile',
          summary: 'Her account is not in the restored copy (she joined after the restore point), so her Safe Mode profile cannot be put back.',
        });
        continue;
      }
      findings.push({
        kind: 'carried-over',
        userId,
        table: 'DvSafetyProfile',
        summary:
          'Her Safe Mode profile exists only live: the restored copy has none. Its switches, blocks and emergency contacts are carried over. Her safe chats and panic-alert history are not held by this tool; copy them with the other damaged rows.',
        detail: live.blockedUserIds,
        sql: [insertDvProfile(live)],
      });
      continue;
    }

    const toAdd = missingFrom(live.blockedUserIds, restored.blockedUserIds);
    if (toAdd.length > 0) {
      findings.push({
        kind: 'reapply',
        userId,
        table: 'DvSafetyProfile',
        field: 'blockedUserIds',
        summary: `${toAdd.length} Safe Mode block${toAdd.length === 1 ? '' : 's'} placed after the restore point, put back.`,
        detail: toAdd,
        sql: [
          `UPDATE ${quoted('DvSafetyProfile')} SET ${quoted('blockedUserIds')} = ARRAY(SELECT DISTINCT unnest(${quoted('blockedUserIds')} || ${idArray(toAdd)})), ${quoted('updatedAt')} = now() ` +
            `WHERE ${quoted('userId')} = ${id(userId)} AND NOT (${quoted('blockedUserIds')} @> ${idArray(toAdd)});`,
        ],
      });
    }
    const removed = missingFrom(restored.blockedUserIds, live.blockedUserIds);
    if (removed.length > 0) {
      findings.push({
        kind: 'lifted-since',
        userId,
        table: 'DvSafetyProfile',
        field: 'blockedUserIds',
        summary: `${removed.length} Safe Mode block${removed.length === 1 ? '' : 's'} she removed after the restore point. Not put back: ask her.`,
        detail: removed,
      });
    }

    for (const rule of DV_SWITCHES) {
      const liveValue = (live as unknown as Record<string, unknown>)[rule.field];
      const restoredValue = (restored as unknown as Record<string, unknown>)[rule.field];
      pushSwitch(findings, judge(rule, liveValue, restoredValue), {
        userId,
        table: 'DvSafetyProfile',
        rule,
        liveValue,
        restoredValue,
        statement:
          typeof liveValue === 'string' || typeof liveValue === 'boolean'
            ? `UPDATE ${quoted('DvSafetyProfile')} SET ${quoted(rule.field)} = ${typeof liveValue === 'string' ? text(liveValue) : bool(liveValue)}, ${quoted('updatedAt')} = now() ` +
              `WHERE ${quoted('userId')} = ${id(userId)} AND ${quoted(rule.field)} IS DISTINCT FROM ${typeof liveValue === 'string' ? text(liveValue) : bool(liveValue)};`
            : null,
      });
    }

    // Emergency contacts, matched on their own ids. Only the count and the
    // ids are ever printed; the statement carries the contact because it has
    // to, and the file it is written to is as sensitive as the database.
    const liveContacts = contactsOf(live.emergencyContacts);
    const restoredContacts = contactsOf(restored.emergencyContacts);
    const restoredIds = new Set(restoredContacts.map((contact) => contact.id));
    const liveIds = new Set(liveContacts.map((contact) => contact.id));
    const addedContacts = liveContacts.filter((contact) => !restoredIds.has(contact.id));
    const removedContacts = restoredContacts.filter((contact) => !liveIds.has(contact.id));

    if (addedContacts.length > 0) {
      findings.push({
        kind: 'reapply',
        userId,
        table: 'DvSafetyProfile',
        field: 'emergencyContacts',
        summary: `${addedContacts.length} emergency contact${addedContacts.length === 1 ? '' : 's'} added after the restore point, put back.`,
        detail: addedContacts.map((contact) => contact.id),
        sql: addedContacts.map(
          (contact) =>
            `UPDATE ${quoted('DvSafetyProfile')} SET ${quoted('emergencyContacts')} = ${quoted('emergencyContacts')} || jsonb_build_array(${text(JSON.stringify(contact.raw))}::jsonb), ${quoted('updatedAt')} = now() ` +
            `WHERE ${quoted('userId')} = ${id(userId)} AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${quoted('emergencyContacts')}) AS contact WHERE contact->>'id' = ${text(contact.id)});`
        ),
      });
    }
    if (removedContacts.length > 0) {
      findings.push({
        kind: 'lifted-since',
        userId,
        table: 'DvSafetyProfile',
        field: 'emergencyContacts',
        summary: `${removedContacts.length} emergency contact${removedContacts.length === 1 ? '' : 's'} she removed after the restore point. Not put back: ask her.`,
        detail: removedContacts.map((contact) => contact.id),
      });
    }
  }

  // ---- The mirrors: Profile.isSafeMode, Profile.hideFromSearch, User.allowMessages
  for (const [userId, live] of [...liveAccounts].sort(([a], [b]) => a.localeCompare(b))) {
    if (erased.has(userId)) continue;
    const restored = restoredAccounts.get(userId);
    // Only the members a Safe Mode profile writes these through for.
    if (!restored || !(liveDv.has(userId) || restoredDv.has(userId))) continue;

    for (const rule of ACCOUNT_SWITCHES) {
      const liveValue = live[rule.key];
      const restoredValue = restored[rule.key];
      // A profile row that is not there on one side has nothing to compare.
      if (liveValue === null || restoredValue === null) continue;
      pushSwitch(findings, judge(rule, liveValue, restoredValue), {
        userId,
        table: rule.table,
        rule,
        liveValue,
        restoredValue,
        statement:
          typeof liveValue === 'boolean'
            ? `UPDATE ${quoted(rule.table)} SET ${quoted(rule.column)} = ${bool(liveValue)} ` +
              `WHERE ${quoted(rule.table === 'User' ? 'id' : 'userId')} = ${id(userId)} AND ${quoted(rule.column)} IS DISTINCT FROM ${bool(liveValue)};`
            : null,
      });
    }
  }

  // ---- Suspensions and bans -----------------------------------------------
  for (const [userId, live] of [...liveAccounts].sort(([a], [b]) => a.localeCompare(b))) {
    if (erased.has(userId)) continue;
    const restored = restoredAccounts.get(userId);
    if (!restored) continue;

    if (live.isSuspended && !restored.isSuspended) {
      findings.push({
        kind: 'reapply',
        userId,
        table: 'User',
        field: 'isSuspended',
        summary: live.bannedAt
          ? 'Banned after the restore point, so the restored copy has her account open. Closed again, with the ban as it was recorded.'
          : 'Suspended after the restore point, so the restored copy has her account open. Closed again, with the suspension as it was recorded.',
        sql: [suspendAccount(live)],
      });
    } else if (!live.isSuspended && restored.isSuspended) {
      findings.push({
        kind: 'lifted-since',
        userId,
        table: 'User',
        field: 'isSuspended',
        summary: 'A suspension lifted after the restore point; the restored copy still has her account closed. Not changed: an appeal decides.',
      });
    }
  }

  // Banned people: by the keyed hash of the address, which is the only way the
  // table can be compared and is never printed.
  const restoredHashes = new Set(input.restored.bans.map((ban) => ban.emailHash));
  for (const ban of [...input.live.bans].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (restoredHashes.has(ban.emailHash)) continue;
    findings.push({
      kind: 'reapply',
      userId: ban.userId,
      table: 'BannedIdentity',
      summary: `A ban recorded on ${ban.createdAt.toISOString().slice(0, 10)} that the restored copy lacks, so the person could register again. Recorded again. The address hash is in the patch, not in this report.`,
      sql: [insertBan(ban)],
    });
  }

  // ---- Staff decisions and erasures after the restore point ---------------
  for (const decision of [...input.decisions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const content =
      decision.contentType && decision.contentId && SAFE_ID.test(decision.contentId) ? [`${decision.contentType}:${decision.contentId}`] : undefined;
    findings.push({
      kind: 'decision',
      userId: decision.targetUserId,
      table: 'AuditLog',
      field: decision.action,
      summary:
        decision.action === 'MODERATION_REMOVE'
          ? `Content removed on ${decision.createdAt.toISOString().slice(0, 10)}. Removing content is not something this tool can redo: run the removal again from the report (audit row ${decision.id}).`
          : decision.action === 'ACCOUNT_DELETE'
            ? `An erasure completed on ${decision.createdAt.toISOString().slice(0, 10)} (audit row ${decision.id}). Check it is in the erased list above.`
            : `${decision.action} on ${decision.createdAt.toISOString().slice(0, 10)} (audit row ${decision.id}). A ban or suspension on an account is re-applied above when the account is in the restored copy.`,
      detail: content,
    });
  }

  const counts = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<FindingKind, number>;
  for (const finding of findings) counts[finding.kind] += 1;

  const after = (row: { updatedAt: Date }) => row.updatedAt.getTime() >= input.since.getTime();

  return {
    since: input.since.toISOString(),
    findings,
    counts,
    changedSince: {
      settings: input.live.settings.filter(after).length,
      dvProfiles: input.live.dvProfiles.filter(after).length,
    },
    statements: findings.reduce((total, finding) => total + (finding.sql?.length ?? 0), 0),
  };
}

function pushSwitch(
  findings: Finding[],
  verdict: Verdict,
  context: {
    userId: string;
    table: string;
    rule: SwitchRule;
    liveValue: unknown;
    restoredValue: unknown;
    statement: string | null;
  }
): void {
  if (verdict === 'same') return;
  const { userId, table, rule, liveValue, restoredValue, statement } = context;
  const shown = (value: unknown) => (typeof value === 'string' || typeof value === 'boolean' ? String(value) : 'unknown');
  // A switch's value is a yes/no or a named level, so it is safe to print.
  // The exit link is the one free-text switch and is never printed.
  const detail = rule.field === 'safeExitUrl' ? undefined : [`live: ${shown(liveValue)}`, `restored: ${shown(restoredValue)}`];

  if (verdict === 'tightened' && statement) {
    findings.push({
      kind: 'reapply',
      userId,
      table,
      field: rule.field,
      summary: `${rule.field} was made safer after the restore point, put back.`,
      detail,
      sql: [statement],
    });
  } else if (verdict === 'relaxed') {
    findings.push({
      kind: 'lifted-since',
      userId,
      table,
      field: rule.field,
      summary: `${rule.field} was made less strict after the restore point. Not put back: ask her.`,
      detail,
    });
  } else {
    findings.push({
      kind: 'differs',
      userId,
      table,
      field: rule.field,
      summary: `${rule.field} differs and neither side is the safer one. Not changed; copy it by hand if she asks.`,
      detail,
    });
  }
}

// ---------------------------------------------------------------------------
// Statements for a row that exists only live
// ---------------------------------------------------------------------------

// Each is an INSERT ... SELECT that only runs when the member's account is in
// the database the patch is applied to (the foreign key needs it), and that
// does nothing if the row is already there.

function insertSettings(row: SettingsRow): string {
  const columns = [
    'id',
    'userId',
    'allowMessagesFrom',
    'filterOffensiveContent',
    'hideReadReceipts',
    'profileVisibility',
    'hideOnlineStatus',
    'hideLastSeen',
    'blockedUsers',
    'blockedKeywords',
    'enableSafetyAlerts',
    'createdAt',
    'updatedAt',
  ];
  const values = [
    id(row.id),
    id(row.userId),
    text(row.allowMessagesFrom),
    bool(row.filterOffensiveContent),
    bool(row.hideReadReceipts),
    text(row.profileVisibility),
    bool(row.hideOnlineStatus),
    bool(row.hideLastSeen),
    idArray(row.blockedUsers),
    textArray(row.blockedKeywords),
    bool(row.enableSafetyAlerts),
    when(row.createdAt),
    'now()',
  ];
  return (
    `INSERT INTO ${quoted('UserSafetySettings')} (${columns.map(quoted).join(', ')}) ` +
    `SELECT ${values.join(', ')} WHERE EXISTS (SELECT 1 FROM ${quoted('User')} WHERE ${quoted('id')} = ${id(row.userId)}) ` +
    `ON CONFLICT (${quoted('userId')}) DO NOTHING;`
  );
}

function insertDvProfile(row: DvProfileRow): string {
  const contacts = JSON.stringify(Array.isArray(row.emergencyContacts) ? row.emergencyContacts : []);
  const columns = [
    'id',
    'userId',
    'isSafeMode',
    'hideFromSearch',
    'allowMessages',
    'safeExitEnabled',
    'safeExitUrl',
    'panicButtonEnabled',
    'activityLogEnabled',
    'disguisedAppIcon',
    'notificationsSafe',
    'emergencyContacts',
    'blockedUserIds',
    'createdAt',
    'updatedAt',
  ];
  const values = [
    id(row.id),
    id(row.userId),
    bool(row.isSafeMode),
    bool(row.hideFromSearch),
    bool(row.allowMessages),
    bool(row.safeExitEnabled),
    text(row.safeExitUrl),
    bool(row.panicButtonEnabled),
    bool(row.activityLogEnabled),
    bool(row.disguisedAppIcon),
    bool(row.notificationsSafe),
    `${text(contacts)}::jsonb`,
    idArray(row.blockedUserIds),
    when(row.createdAt),
    'now()',
  ];
  return (
    `INSERT INTO ${quoted('DvSafetyProfile')} (${columns.map(quoted).join(', ')}) ` +
    `SELECT ${values.join(', ')} WHERE EXISTS (SELECT 1 FROM ${quoted('User')} WHERE ${quoted('id')} = ${id(row.userId)}) ` +
    `ON CONFLICT (${quoted('userId')}) DO NOTHING;`
  );
}

function insertBan(ban: BanRow): string {
  if (!HASH.test(ban.emailHash)) throw new Error('Refusing to write a ban hash of an unexpected shape into SQL');
  const columns = ['id', 'emailHash', 'userId', 'reportId', 'createdById', 'reason', 'createdAt'];
  const values = [
    id(ban.id),
    text(ban.emailHash),
    nullable(ban.userId, id),
    nullable(ban.reportId, id),
    id(ban.createdById),
    nullable(ban.reason),
    when(ban.createdAt),
  ];
  return `INSERT INTO ${quoted('BannedIdentity')} (${columns.map(quoted).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (${quoted('emailHash')}) DO NOTHING;`;
}

function suspendAccount(live: AccountRow): string {
  const sets = ['"isSuspended" = true'];
  if (live.suspensionReason !== undefined) sets.push(`"suspensionReason" = ${nullable(live.suspensionReason)}`);
  if (live.suspendedAt !== undefined) sets.push(`"suspendedAt" = ${live.suspendedAt ? when(live.suspendedAt) : 'NULL'}`);
  if (live.suspendedById !== undefined) sets.push(`"suspendedById" = ${nullable(live.suspendedById, id)}`);
  if (live.bannedAt !== undefined) sets.push(`"bannedAt" = ${live.bannedAt ? when(live.bannedAt) : 'NULL'}`);
  if (live.banReason !== undefined) sets.push(`"banReason" = ${nullable(live.banReason)}`);
  if (live.bannedById !== undefined) sets.push(`"bannedById" = ${nullable(live.bannedById, id)}`);
  return `UPDATE ${quoted('User')} SET ${sets.join(', ')} WHERE ${quoted('id')} = ${id(live.userId)} AND ${quoted('isSuspended')} = false;`;
}

// ---------------------------------------------------------------------------
// Which accounts were erased
// ---------------------------------------------------------------------------

/**
 * Which members were erased after the restore point, and which joined after it.
 *
 * An erasure leaves one of two things behind. When nothing has to be kept the
 * account row is deleted. When a retained record still points at it, the row
 * stays as a tombstone: a reserved-domain address, a name of "Erased", closed.
 * So a member in the restored copy is erased if her live row is missing or is
 * a tombstone. The audit log is read too (an ACCOUNT_DELETE row names her when
 * she erased herself) but cannot be relied on alone: an erasure carried out on
 * request leaves her id off its row on purpose.
 */
export function classifyAccounts(input: {
  /** Ids of members the restored copy holds an account for. */
  restoredPresent: Iterable<string>;
  /** Ids the live database holds an account for, and which of them are tombstones. */
  livePresent: Iterable<string>;
  liveTombstoned: Iterable<string>;
  /** ACCOUNT_DELETE audit rows after the restore point that name a member. */
  auditErased: Iterable<string>;
}): { erased: string[]; joinedAfter: string[] } {
  const restored = new Set(input.restoredPresent);
  const live = new Set(input.livePresent);
  const tombstoned = new Set(input.liveTombstoned);

  const erased = new Set<string>();
  for (const userId of restored) {
    if (!live.has(userId) || tombstoned.has(userId)) erased.add(userId);
  }
  // Named by the audit log, whether or not the restored copy holds her.
  for (const userId of input.auditErased) erased.add(userId);

  const joinedAfter = [...live].filter((userId) => !restored.has(userId) && !tombstoned.has(userId));
  return { erased: [...erased].sort(), joinedAfter: joinedAfter.sort() };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const HEADINGS: Record<FindingKind, string> = {
  reapply: 'Put back (the patch does this)',
  'lifted-since': 'Removed or relaxed since: NOT put back, ask the member',
  differs: 'Differ with no safer side: not changed',
  'carried-over': 'Rows that exist only live: carried over',
  'not-in-restored-copy': 'Joined after the restore point: cannot be put back',
  'erased-since': 'Erased since: leave out, and run the erasure again',
  decision: 'Staff decisions and erasures since: for a person',
};

const SHORT: Record<FindingKind, string> = {
  reapply: 'put back',
  'lifted-since': 'removed since',
  differs: 'differ',
  'carried-over': 'carried over',
  'not-in-restored-copy': 'joined after',
  'erased-since': 'erased',
  decision: 'decisions',
};

/**
 * The report a person reads. It names members by id and nothing else: no
 * names, no addresses, no phone numbers, no hashes, no exit links.
 */
export function formatReport(plan: RestorePlan): string {
  const lines: string[] = [];
  lines.push(`Safety state: live database compared with the restored copy, since ${plan.since}`);
  lines.push('Member ids only. No names, addresses, phone numbers or ban hashes are printed.');
  lines.push('');
  lines.push(`Live rows written since: ${plan.changedSince.settings} safety settings, ${plan.changedSince.dvProfiles} Safe Mode profiles.`);
  lines.push(KINDS.map((kind) => `${SHORT[kind]} ${plan.counts[kind]}`).join('  |  '));

  for (const kind of KINDS) {
    const section = plan.findings.filter((finding) => finding.kind === kind);
    if (section.length === 0) continue;
    lines.push('');
    lines.push(`== ${HEADINGS[kind]} (${section.length})`);
    for (const finding of section) {
      const who = finding.userId ?? 'no account';
      const what = finding.field ? `${finding.table}.${finding.field}` : finding.table;
      lines.push(`- ${who}  ${what}: ${finding.summary}${finding.detail && finding.detail.length > 0 ? ` [${finding.detail.join(', ')}]` : ''}`);
    }
  }

  if (plan.findings.length === 0) {
    lines.push('');
    lines.push('Nothing differs: the restored copy holds every safety setting, block, ban and suspension that live does.');
  }

  lines.push('');
  lines.push(`${plan.statements} statement${plan.statements === 1 ? '' : 's'} in the patch. The tool wrote to neither database.`);
  return lines.join('\n');
}

/**
 * The patch: every statement of every finding that is applied. Idempotent, so
 * running it twice changes nothing the second time, and it only adds
 * protection. A person reads it before it is run anywhere.
 */
export function renderPatchSql(plan: RestorePlan): string {
  const statements = plan.findings.flatMap((finding) => (finding.sql ?? []).map((sql) => ({ finding, sql })));

  const out: string[] = [
    '-- Safety patch: puts back protection that live had and the restored copy lacks.',
    `-- Compared since ${plan.since}. Generated by scripts/restore-safety-diff.ts, which wrote to no database.`,
    '-- Run it against the database that will serve members (the restored copy, or production',
    '-- after rows were copied back), after reading it. It only adds protection and is safe to run twice.',
    '-- This file holds ban hashes and emergency-contact details: keep it as private as the dump, and shred it afterwards.',
    '',
    'BEGIN;',
  ];

  let last = '';
  for (const { finding, sql } of statements) {
    const heading = `${finding.table}${finding.field ? `.${finding.field}` : ''}`;
    if (heading !== last) {
      out.push('', `-- ${heading}`);
      last = heading;
    }
    out.push(`-- member ${finding.userId ?? 'none'}: ${finding.summary.split('.')[0]}`);
    out.push(sql);
  }

  out.push('', 'COMMIT;', '');
  return out.join('\n');
}
