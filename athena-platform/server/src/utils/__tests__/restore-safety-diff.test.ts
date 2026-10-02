/**
 * The comparison a restore needs before it can be trusted with safety state.
 *
 * Every case here is fabricated rows in memory, two copies of a database held
 * as plain objects. What each one pins down is a line the tool must never
 * cross: it may add protection, and it may never take any away, bring back an
 * erased member, or print a member's details.
 */

import { describe, expect, it } from '@jest/globals';
import {
  classifyAccounts,
  formatReport,
  planRestoreSafety,
  renderPatchSql,
  type AccountRow,
  type BanRow,
  type DvProfileRow,
  type Finding,
  type SafetySnapshot,
  type SettingsRow,
} from '../restore-safety-diff';

const SINCE = new Date('2026-10-01T04:30:00Z');
const BEFORE = new Date('2026-09-20T00:00:00Z');
const AFTER = new Date('2026-10-01T09:00:00Z');

const settings = (userId: string, over: Partial<SettingsRow> = {}): SettingsRow => ({
  id: `settings-${userId}`,
  userId,
  createdAt: BEFORE,
  updatedAt: BEFORE,
  allowMessagesFrom: 'connections',
  filterOffensiveContent: true,
  hideReadReceipts: false,
  profileVisibility: 'public',
  hideOnlineStatus: false,
  hideLastSeen: false,
  enableSafetyAlerts: true,
  blockedUsers: [],
  blockedKeywords: [],
  ...over,
});

const dv = (userId: string, over: Partial<DvProfileRow> = {}): DvProfileRow => ({
  id: `dv-${userId}`,
  userId,
  createdAt: BEFORE,
  updatedAt: BEFORE,
  isSafeMode: false,
  hideFromSearch: false,
  allowMessages: true,
  safeExitEnabled: false,
  safeExitUrl: 'https://www.google.com',
  panicButtonEnabled: false,
  activityLogEnabled: true,
  disguisedAppIcon: false,
  notificationsSafe: true,
  emergencyContacts: [],
  blockedUserIds: [],
  ...over,
});

const account = (userId: string, over: Partial<AccountRow> = {}): AccountRow => ({
  userId,
  allowMessages: true,
  isSuspended: false,
  profileIsSafeMode: false,
  profileHideFromSearch: false,
  ...over,
});

const HASH = 'ab'.repeat(32);
const ban = (over: Partial<BanRow> = {}): BanRow => ({
  id: 'ban-1',
  emailHash: HASH,
  userId: 'banned-1',
  reportId: 'report-1',
  createdById: 'staff-1',
  reason: 'Threatened a member',
  createdAt: AFTER,
  ...over,
});

const snapshot = (parts: Partial<SafetySnapshot> = {}): SafetySnapshot => ({
  settings: [],
  dvProfiles: [],
  accounts: [],
  bans: [],
  ...parts,
});

const plan = (live: Partial<SafetySnapshot>, restored: Partial<SafetySnapshot>, extra: { erased?: string[]; decisions?: any[] } = {}) =>
  planRestoreSafety({
    since: SINCE,
    live: snapshot(live),
    restored: snapshot(restored),
    decisions: extra.decisions ?? [],
    erasedUserIds: extra.erased ?? [],
  });

const of = (p: { findings: Finding[] }, kind: Finding['kind']) => p.findings.filter((finding) => finding.kind === kind);
const sqlOf = (p: { findings: Finding[] }) => p.findings.flatMap((finding) => finding.sql ?? []);

describe('Blocks', () => {
  it('a block placed after the restore point is put back', () => {
    const result = plan(
      { settings: [settings('her', { blockedUsers: ['him', 'other'], updatedAt: AFTER })], accounts: [account('her')] },
      { settings: [settings('her', { blockedUsers: ['other'] })], accounts: [account('her')] }
    );

    const [finding] = of(result, 'reapply');
    expect(finding).toMatchObject({ userId: 'her', table: 'UserSafetySettings', field: 'blockedUsers', detail: ['him'] });
    expect(finding.sql).toEqual([
      `UPDATE "UserSafetySettings" SET "blockedUsers" = ARRAY(SELECT DISTINCT unnest("blockedUsers" || ARRAY['him']::text[])), "updatedAt" = now() ` +
        `WHERE "userId" = 'her' AND NOT ("blockedUsers" @> ARRAY['him']::text[]);`,
    ]);
  });

  it('a block she removed after the restore point is listed and never put back', () => {
    const result = plan(
      { settings: [settings('her', { blockedUsers: [] })], accounts: [account('her')] },
      { settings: [settings('her', { blockedUsers: ['him'] })], accounts: [account('her')] }
    );

    expect(of(result, 'lifted-since')).toHaveLength(1);
    expect(of(result, 'lifted-since')[0]).toMatchObject({ userId: 'her', field: 'blockedUsers', detail: ['him'] });
    expect(of(result, 'reapply')).toHaveLength(0);
    // Not in any statement: "him" would be put back only by a statement that names him.
    expect(sqlOf(result).join('\n')).not.toContain('him');
    expect(renderPatchSql(result)).not.toContain("'him'");
  });

  it('a Safe Mode block is compared on its own, on the DvSafetyProfile row', () => {
    const result = plan(
      { dvProfiles: [dv('her', { blockedUserIds: ['him'] })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { blockedUserIds: [] })], accounts: [account('her')] }
    );

    expect(of(result, 'reapply')[0]).toMatchObject({ table: 'DvSafetyProfile', field: 'blockedUserIds', detail: ['him'] });
    expect(of(result, 'reapply')[0].sql![0]).toContain(`UPDATE "DvSafetyProfile" SET "blockedUserIds" = ARRAY(SELECT DISTINCT unnest("blockedUserIds" || ARRAY['him']::text[]))`);
  });

  it('muted words added since are put back, and removed ones are not', () => {
    const result = plan(
      { settings: [settings('her', { blockedKeywords: ['alpha', 'beta'] })], accounts: [account('her')] },
      { settings: [settings('her', { blockedKeywords: ['beta', 'gamma'] })], accounts: [account('her')] }
    );

    expect(of(result, 'reapply')[0].sql![0]).toContain(`ARRAY['alpha']::text[]`);
    expect(of(result, 'lifted-since')[0]).toMatchObject({ field: 'blockedKeywords' });
    expect(sqlOf(result).join('\n')).not.toContain('gamma');
  });

  it('every block statement is a union guarded by "not already there", so running the patch twice changes nothing', () => {
    const result = plan(
      { settings: [settings('her', { blockedUsers: ['a', 'b'] })], dvProfiles: [dv('her', { blockedUserIds: ['a'] })], accounts: [account('her')] },
      { settings: [settings('her')], dvProfiles: [dv('her')], accounts: [account('her')] }
    );

    for (const statement of sqlOf(result)) {
      expect(statement).toMatch(/unnest\("blocked\w+" \|\| ARRAY\[/);
      expect(statement).toMatch(/AND NOT \("blocked\w+" @> ARRAY\[/);
    }
    expect(sqlOf(result)).toHaveLength(2);
  });
});

describe('Rows that exist only live', () => {
  it('a member’s settings live-only row is carried over, with her blocks, only if her account is there to hold it', () => {
    const result = plan(
      { settings: [settings('her', { blockedUsers: ['him'], profileVisibility: 'private' })], accounts: [account('her')] },
      { accounts: [account('her')] }
    );

    const [finding] = of(result, 'carried-over');
    expect(finding).toMatchObject({ userId: 'her', table: 'UserSafetySettings', detail: ['him'] });
    const statement = finding.sql![0];
    expect(statement).toContain('INSERT INTO "UserSafetySettings"');
    expect(statement).toContain(`ARRAY['him']::text[]`);
    expect(statement).toContain(`'private'`);
    // Needs the account to exist, and does nothing if the row is already there.
    expect(statement).toContain(`WHERE EXISTS (SELECT 1 FROM "User" WHERE "id" = 'her')`);
    expect(statement).toContain('ON CONFLICT ("userId") DO NOTHING;');
  });

  it('a Safe Mode profile that exists only live is carried over with its switches, blocks and contacts', () => {
    const contacts = [{ id: 'c1', name: 'Jo Citizen', phone: '0400 111 222', relationship: 'sister', notifyOnPanic: true }];
    const result = plan(
      { dvProfiles: [dv('her', { isSafeMode: true, blockedUserIds: ['him'], emergencyContacts: contacts })], accounts: [account('her')] },
      { accounts: [account('her')] }
    );

    const [finding] = of(result, 'carried-over');
    expect(finding.table).toBe('DvSafetyProfile');
    expect(finding.sql![0]).toContain('INSERT INTO "DvSafetyProfile"');
    expect(finding.sql![0]).toContain('true'); // isSafeMode
    expect(finding.sql![0]).toContain(`ARRAY['him']::text[]`);
    expect(finding.sql![0]).toContain('Jo Citizen'); // the statement has to carry the contact
    expect(finding.sql![0]).toContain('ON CONFLICT ("userId") DO NOTHING;');
    // The summary says what this tool does not hold.
    expect(finding.summary).toMatch(/safe chats/);
  });

  it('a member who joined after the restore point cannot be put back, and nothing is written for her', () => {
    const result = plan({ settings: [settings('newer', { blockedUsers: ['him'] })], dvProfiles: [dv('newer')], accounts: [account('newer')] }, {});

    expect(of(result, 'not-in-restored-copy').map((finding) => finding.table).sort()).toEqual(['DvSafetyProfile', 'UserSafetySettings']);
    expect(sqlOf(result)).toEqual([]);
  });
});

describe('Erased accounts', () => {
  it('are never brought back: left out of every statement, and listed so the erasure is run again', () => {
    const result = plan(
      {
        settings: [settings('erased', { blockedUsers: ['him'], profileVisibility: 'private' }), settings('kept', { blockedUsers: ['x'] })],
        dvProfiles: [dv('erased', { isSafeMode: true, blockedUserIds: ['him'] })],
        accounts: [account('erased', { isSuspended: true }), account('kept')],
      },
      {
        settings: [settings('erased'), settings('kept')],
        dvProfiles: [dv('erased')],
        accounts: [account('erased'), account('kept')],
      },
      { erased: ['erased'] }
    );

    expect(of(result, 'erased-since').map((finding) => finding.userId)).toEqual(['erased']);
    const everything = sqlOf(result).join('\n');
    expect(everything).not.toContain('erased');
    // A tombstone is "suspended" to the database, and must not be re-suspended as if staff had done it.
    expect(everything).not.toContain('"isSuspended"');
    // The member who was not erased is still handled.
    expect(everything).toContain(`'kept'`);
  });

  it('an erased member’s bans against her are not touched, only her own rows are left out', () => {
    const result = plan(
      { settings: [settings('other', { blockedUsers: ['erased'] })], accounts: [account('other')] },
      { settings: [settings('other')], accounts: [account('other')] },
      { erased: ['erased'] }
    );

    // A block outlives the account it was placed against (gdpr.service says so).
    expect(of(result, 'reapply')[0].detail).toEqual(['erased']);
  });

  describe('which accounts count as erased', () => {
    it('one in the restored copy that is gone live, or only a tombstone live, or named by the audit log', () => {
      const result = classifyAccounts({
        restoredPresent: ['gone', 'tombstone', 'fine', 'named'],
        livePresent: ['tombstone', 'fine', 'named', 'new'],
        liveTombstoned: ['tombstone'],
        auditErased: ['named', 'not-in-either'],
      });

      expect(result.erased).toEqual(['gone', 'named', 'not-in-either', 'tombstone']);
      expect(result.joinedAfter).toEqual(['new']);
    });

    it('a request-based erasure leaves no id in the audit log, and is still found', () => {
      const result = classifyAccounts({ restoredPresent: ['her'], livePresent: [], liveTombstoned: [], auditErased: [] });
      expect(result.erased).toEqual(['her']);
    });
  });
});

describe('Switches', () => {
  it('a switch turned to the safer side since is turned again', () => {
    const result = plan(
      {
        settings: [settings('her', { profileVisibility: 'private', allowMessagesFrom: 'none', hideLastSeen: true, enableSafetyAlerts: true })],
        accounts: [account('her')],
      },
      {
        settings: [settings('her', { profileVisibility: 'public', allowMessagesFrom: 'connections', hideLastSeen: false })],
        accounts: [account('her')],
      }
    );

    const fields = of(result, 'reapply').map((finding) => finding.field).sort();
    expect(fields).toEqual(['allowMessagesFrom', 'hideLastSeen', 'profileVisibility']);
    const statements = sqlOf(result).join('\n');
    expect(statements).toContain(`SET "profileVisibility" = 'private', "updatedAt" = now() WHERE "userId" = 'her' AND "profileVisibility" IS DISTINCT FROM 'private';`);
    expect(statements).toContain(`SET "hideLastSeen" = true`);
  });

  it('a switch she relaxed since is listed and never applied, whichever way the switch points', () => {
    const result = plan(
      {
        settings: [settings('her', { profileVisibility: 'public', allowMessagesFrom: 'all', hideOnlineStatus: false })],
        dvProfiles: [dv('her', { isSafeMode: false, allowMessages: true, hideFromSearch: false })],
        accounts: [account('her')],
      },
      {
        settings: [settings('her', { profileVisibility: 'private', allowMessagesFrom: 'none', hideOnlineStatus: true })],
        dvProfiles: [dv('her', { isSafeMode: true, allowMessages: false, hideFromSearch: true })],
        accounts: [account('her')],
      }
    );

    expect(of(result, 'lifted-since').map((finding) => finding.field).sort()).toEqual([
      'allowMessages',
      'allowMessagesFrom',
      'hideFromSearch',
      'hideOnlineStatus',
      'isSafeMode',
      'profileVisibility',
    ]);
    expect(of(result, 'reapply')).toHaveLength(0);
    expect(sqlOf(result)).toEqual([]);
  });

  it('a Safe Mode profile closed to messages is the safer side, so allowMessages false is the one put back', () => {
    const result = plan(
      { dvProfiles: [dv('her', { allowMessages: false })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { allowMessages: true })], accounts: [account('her')] }
    );

    expect(of(result, 'reapply')[0]).toMatchObject({ field: 'allowMessages' });
    expect(sqlOf(result)[0]).toContain('SET "allowMessages" = false');
  });

  it('a switch with no safer side is listed and left, and its value is not printed', () => {
    const result = plan(
      { dvProfiles: [dv('her', { activityLogEnabled: false, safeExitUrl: 'https://secret.example/where-she-goes' })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { activityLogEnabled: true })], accounts: [account('her')] }
    );

    expect(of(result, 'differs').map((finding) => finding.field).sort()).toEqual(['activityLogEnabled', 'safeExitUrl']);
    expect(sqlOf(result)).toEqual([]);
    expect(formatReport(result)).not.toContain('secret.example');
  });

  it('a level that is not on the ladder is not ranked, so it is not applied either way', () => {
    const result = plan(
      { settings: [settings('her', { profileVisibility: 'friends-of-friends' })], accounts: [account('her')] },
      { settings: [settings('her', { profileVisibility: 'public' })], accounts: [account('her')] }
    );

    expect(of(result, 'differs')[0]).toMatchObject({ field: 'profileVisibility' });
    expect(sqlOf(result)).toEqual([]);
  });

  describe('the mirrors a Safe Mode switch is written through to', () => {
    it('Profile.isSafeMode, Profile.hideFromSearch and User.allowMessages are put back when live has them safer', () => {
      const result = plan(
        {
          dvProfiles: [dv('her', { isSafeMode: true })],
          accounts: [account('her', { profileIsSafeMode: true, profileHideFromSearch: true, allowMessages: false })],
        },
        {
          dvProfiles: [dv('her', { isSafeMode: true })],
          accounts: [account('her', { profileIsSafeMode: false, profileHideFromSearch: false, allowMessages: true })],
        }
      );

      const statements = sqlOf(result);
      expect(statements).toContain(`UPDATE "Profile" SET "isSafeMode" = true WHERE "userId" = 'her' AND "isSafeMode" IS DISTINCT FROM true;`);
      expect(statements).toContain(`UPDATE "Profile" SET "hideFromSearch" = true WHERE "userId" = 'her' AND "hideFromSearch" IS DISTINCT FROM true;`);
      expect(statements).toContain(`UPDATE "User" SET "allowMessages" = false WHERE "id" = 'her' AND "allowMessages" IS DISTINCT FROM false;`);
    });

    it('a member with no Safe Mode profile is not checked for them, and a missing profile row is not a difference', () => {
      const none = plan(
        { accounts: [account('her', { profileIsSafeMode: true })] },
        { accounts: [account('her', { profileIsSafeMode: false })] }
      );
      expect(none.findings).toEqual([]);

      const noProfile = plan(
        { dvProfiles: [dv('her')], accounts: [account('her', { profileIsSafeMode: null, profileHideFromSearch: null })] },
        { dvProfiles: [dv('her')], accounts: [account('her', { profileIsSafeMode: false, profileHideFromSearch: false })] }
      );
      expect(noProfile.findings).toEqual([]);
    });
  });
});

describe('Emergency contacts', () => {
  const contact = (id: string, name: string) => ({ id, name, phone: '0400 111 222', relationship: 'friend', notifyOnPanic: true });

  it('a contact added since is put back, matched on its own id, once', () => {
    const result = plan(
      { dvProfiles: [dv('her', { emergencyContacts: [contact('c1', 'Jo Citizen'), contact('c2', 'Sam Smith')] })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { emergencyContacts: [contact('c1', 'Jo Citizen')] })], accounts: [account('her')] }
    );

    const [finding] = of(result, 'reapply');
    expect(finding).toMatchObject({ field: 'emergencyContacts', detail: ['c2'] });
    expect(finding.sql).toHaveLength(1);
    expect(finding.sql![0]).toContain('Sam Smith');
    expect(finding.sql![0]).not.toContain('Jo Citizen');
    // Guarded on the contact's own id so a second run adds nothing.
    expect(finding.sql![0]).toContain(`NOT EXISTS (SELECT 1 FROM jsonb_array_elements("emergencyContacts") AS contact WHERE contact->>'id' = 'c2')`);
  });

  it('a contact she removed since is listed by id and never put back', () => {
    const result = plan(
      { dvProfiles: [dv('her', { emergencyContacts: [] })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { emergencyContacts: [contact('c1', 'Jo Citizen')] })], accounts: [account('her')] }
    );

    expect(of(result, 'lifted-since')[0]).toMatchObject({ field: 'emergencyContacts', detail: ['c1'] });
    expect(sqlOf(result)).toEqual([]);
  });

  it('a column that is not a list of contacts with ids holds none', () => {
    const result = plan(
      { dvProfiles: [dv('her', { emergencyContacts: { not: 'a list' } })], accounts: [account('her')] },
      { dvProfiles: [dv('her', { emergencyContacts: [{ name: 'no id' }, 'text'] })], accounts: [account('her')] }
    );
    expect(result.findings).toEqual([]);
  });
});

describe('Suspensions and bans', () => {
  it('an account staff closed after the restore point is closed again, as it was recorded', () => {
    const result = plan(
      {
        accounts: [
          account('bad', { isSuspended: true, suspensionReason: 'Threats', suspendedAt: AFTER, suspendedById: 'staff-1', bannedAt: AFTER, banReason: 'Threats', bannedById: 'staff-1' }),
        ],
      },
      { accounts: [account('bad')] }
    );

    const [finding] = of(result, 'reapply');
    expect(finding).toMatchObject({ userId: 'bad', table: 'User', field: 'isSuspended' });
    expect(finding.sql![0]).toBe(
      `UPDATE "User" SET "isSuspended" = true, "suspensionReason" = 'Threats', "suspendedAt" = '2026-10-01T09:00:00.000Z'::timestamp(3), "suspendedById" = 'staff-1', ` +
        `"bannedAt" = '2026-10-01T09:00:00.000Z'::timestamp(3), "banReason" = 'Threats', "bannedById" = 'staff-1' WHERE "id" = 'bad' AND "isSuspended" = false;`
    );
  });

  it('a suspension lifted since is listed for a person, not re-applied', () => {
    const result = plan({ accounts: [account('her')] }, { accounts: [account('her', { isSuspended: true })] });

    expect(of(result, 'lifted-since')[0]).toMatchObject({ userId: 'her', field: 'isSuspended' });
    expect(sqlOf(result)).toEqual([]);
  });

  it('a person banned after the restore point can no longer register again, because the ban is recorded again', () => {
    const result = plan({ bans: [ban()] }, { bans: [] });

    const [finding] = of(result, 'reapply');
    expect(finding).toMatchObject({ table: 'BannedIdentity', userId: 'banned-1' });
    expect(finding.sql![0]).toBe(
      `INSERT INTO "BannedIdentity" ("id", "emailHash", "userId", "reportId", "createdById", "reason", "createdAt") VALUES ` +
        `('ban-1', '${HASH}', 'banned-1', 'report-1', 'staff-1', 'Threatened a member', '2026-10-01T09:00:00.000Z'::timestamp(3)) ON CONFLICT ("emailHash") DO NOTHING;`
    );
  });

  it('a ban the restored copy already has is left alone', () => {
    expect(plan({ bans: [ban()] }, { bans: [ban({ id: 'other-id' })] }).findings).toEqual([]);
  });

  it('a ban for an address with no account has no member id, and a reason with a quote in it cannot break the statement', () => {
    const result = plan({ bans: [ban({ userId: null, reportId: null, reason: "It's a threat" })] }, {});

    expect(of(result, 'reapply')[0].userId).toBeNull();
    expect(of(result, 'reapply')[0].sql![0]).toContain(`'It''s a threat'`);
    expect(of(result, 'reapply')[0].sql![0]).toContain('NULL, NULL');
  });
});

describe('Staff decisions since the restore point', () => {
  it('are listed with their audit row, never re-run, and carry the ids of the content only', () => {
    const result = plan(
      {},
      {},
      {
        decisions: [
          { id: 'audit-2', action: 'MODERATION_REMOVE', targetUserId: 'bad', createdAt: AFTER, contentType: 'post', contentId: 'post-9' },
          { id: 'audit-1', action: 'ACCOUNT_DELETE', targetUserId: null, createdAt: new Date('2026-10-01T05:00:00Z') },
        ],
      }
    );

    const decisions = of(result, 'decision');
    expect(decisions.map((finding) => finding.field)).toEqual(['ACCOUNT_DELETE', 'MODERATION_REMOVE']);
    expect(decisions[1]).toMatchObject({ userId: 'bad', detail: ['post:post-9'] });
    expect(decisions[1].summary).toMatch(/run the removal again/);
    expect(sqlOf(result)).toEqual([]);
  });
});

describe('What the tool prints and writes', () => {
  const contact = { id: 'c2', name: 'Sam Smith', phone: '0400 999 888', email: 'sam@example.org', relationship: 'friend', notifyOnPanic: true };
  const busy = () =>
    plan(
      {
        settings: [settings('her', { blockedUsers: ['him'], profileVisibility: 'private' })],
        dvProfiles: [dv('her', { emergencyContacts: [contact], safeExitUrl: 'https://secret.example/where', isSafeMode: true })],
        accounts: [account('her', { profileIsSafeMode: true }), account('bad', { isSuspended: true, banReason: 'Threats' })],
        bans: [ban({ reason: 'A private reason' })],
      },
      {
        settings: [settings('her')],
        dvProfiles: [dv('her')],
        accounts: [account('her'), account('bad')],
        bans: [],
      }
    );

  it('the report names members by id and carries no name, address, number, hash, reason or link', () => {
    const report = formatReport(busy());

    expect(report).toContain('her');
    expect(report).toContain('him');
    for (const secret of ['Sam Smith', '0400 999 888', 'sam@example.org', 'secret.example', HASH, 'A private reason', 'Threats']) {
      expect(report).not.toContain(secret);
    }
  });

  it('the patch holds what it needs to put protection back, and says to treat it as sensitive', () => {
    const patch = renderPatchSql(busy());

    expect(patch).toContain('Sam Smith');
    expect(patch).toContain(HASH);
    expect(patch.split('\n').slice(0, 8).join('\n')).toMatch(/keep it as private as the dump, and shred it/);
    expect(patch).toMatch(/BEGIN;[\s\S]*COMMIT;\n$/);
  });

  it('the patch only ever adds: no delete, no drop, no truncate, no assignment that clears a column', () => {
    const patch = renderPatchSql(busy());

    expect(patch).not.toMatch(/\b(DELETE|DROP|TRUNCATE|ALTER)\b/i);
    for (const statement of sqlOf(busy())) {
      expect(statement).toMatch(/^(UPDATE|INSERT INTO) /);
      // An UPDATE is guarded so it can only change a row that is less protected than live.
      if (statement.startsWith('UPDATE')) expect(statement).toMatch(/WHERE .*(IS DISTINCT FROM|NOT \(|NOT EXISTS|"isSuspended" = false)/);
      expect(statement).not.toMatch(/SET "blocked\w+" = (?!ARRAY\(SELECT DISTINCT unnest\()/);
    }
  });

  it('counts what it found, and how many live rows were written since', () => {
    const result = plan(
      { settings: [settings('her', { updatedAt: AFTER, blockedUsers: ['him'] }), settings('old')], dvProfiles: [dv('her', { updatedAt: AFTER })], accounts: [account('her'), account('old')] },
      { settings: [settings('her'), settings('old')], dvProfiles: [dv('her')], accounts: [account('her'), account('old')] }
    );

    expect(result.changedSince).toEqual({ settings: 1, dvProfiles: 1 });
    expect(result.counts.reapply).toBe(1);
    expect(result.statements).toBe(1);
    expect(formatReport(result)).toMatch(/put back 1/);
    expect(formatReport(result)).toMatch(/1 statement in the patch/);
  });

  it('says so when nothing differs', () => {
    const same = plan(
      { settings: [settings('her')], dvProfiles: [dv('her')], accounts: [account('her')] },
      { settings: [settings('her')], dvProfiles: [dv('her')], accounts: [account('her')] }
    );

    expect(same.findings).toEqual([]);
    expect(formatReport(same)).toMatch(/Nothing differs/);
  });
});

describe('A damaged row cannot become a different statement', () => {
  it('refuses an id that is not the shape of one', () => {
    const hostile = "x'; DROP TABLE \"User\"; --";
    expect(() =>
      plan(
        { settings: [settings('her', { blockedUsers: [hostile] })], accounts: [account('her')] },
        { settings: [settings('her')], accounts: [account('her')] }
      )
    ).toThrow(/unexpected shape/);
  });

  it('refuses a ban hash that is not a hash', () => {
    expect(() => plan({ bans: [ban({ emailHash: "x'); --" })] }, {})).toThrow(/ban hash/);
  });

  it('quotes free text and refuses a NUL', () => {
    const result = plan(
      { accounts: [account('bad', { isSuspended: true, suspensionReason: "can't \\ stay" })] },
      { accounts: [account('bad')] }
    );
    expect(sqlOf(result)[0]).toContain(`'can''t \\ stay'`);

    expect(() => plan({ accounts: [account('bad', { isSuspended: true, suspensionReason: 'a\0b' })] }, { accounts: [account('bad')] })).toThrow(/NUL/);
  });
});
