/**
 * The part of the restore comparison that touches databases and the command
 * line. What matters here is what it refuses to do: write to either database,
 * compare a database with itself, read an address, or overwrite a file that is
 * already there. The databases are fakes that answer findMany from memory and
 * fail loudly on any other call.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { compareDatabases, parseOptions, writePatch, type SafetyReader } from '../restore-safety-diff';
import { formatReport, renderPatchSql } from '../../utils/restore-safety-diff';

type Row = Record<string, any>;

interface FakeData {
  settings?: Row[];
  dv?: Row[];
  users?: Row[];
  tombstoned?: string[];
  bans?: Row[];
  audit?: Row[];
}

/** A database held in memory. Anything but findMany throws, so a write cannot go unnoticed. */
function fakeDatabase(data: FakeData) {
  const calls: Array<{ model: string; args: Row }> = [];

  const model = (name: string, answer: (args: Row) => Row[]) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => {
          if (method !== 'findMany') throw new Error(`${name}.${method} is not a read`);
          return async (args: Row) => {
            calls.push({ model: name, args });
            return answer(args);
          };
        },
      }
    );

  const reader = {
    userSafetySettings: model('userSafetySettings', () => data.settings ?? []),
    dvSafetyProfile: model('dvSafetyProfile', () => data.dv ?? []),
    bannedIdentity: model('bannedIdentity', () => data.bans ?? []),
    auditLog: model('auditLog', () => data.audit ?? []),
    user: model('user', (args) => {
      const users = data.users ?? [];
      const or: Row[] | undefined = args.where?.OR;
      const named = (user: Row) => !args.where?.id?.in || args.where.id.in.includes(user.id);
      // Who is closed.
      if (or?.some((clause) => 'isSuspended' in clause)) return users.filter((user) => user.isSuspended).map((user) => ({ id: user.id }));
      // Which are tombstones (matched on the address, which is never selected).
      if (or?.some((clause) => 'email' in clause)) {
        return users.filter((user) => named(user) && (data.tombstoned ?? []).includes(user.id)).map((user) => ({ id: user.id }));
      }
      // Every account, ids only.
      if (!args.where) return users.map((user) => ({ id: user.id }));
      return users.filter(named);
    }),
  };

  return { reader: reader as unknown as SafetyReader, calls };
}

const T0 = new Date('2026-09-20T00:00:00Z');
const T1 = new Date('2026-10-02T00:00:00Z');
const SINCE = new Date('2026-10-01T04:30:00Z');

const settingsRow = (userId: string, over: Row = {}): Row => ({
  id: `s-${userId}`,
  userId,
  createdAt: T0,
  updatedAt: T0,
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

const userRow = (id: string, over: Row = {}): Row => ({
  id,
  allowMessages: true,
  isSuspended: false,
  profile: { isSafeMode: false, hideFromSearch: false },
  ...over,
});

describe('Comparing two databases', () => {
  it('reads both with findMany and nothing else, and asks the live audit log only for what happened since', async () => {
    const live = fakeDatabase({
      settings: [settingsRow('her', { blockedUsers: ['him'], updatedAt: T1 })],
      users: [userRow('her')],
    });
    const restored = fakeDatabase({ settings: [settingsRow('her')], users: [userRow('her')] });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);

    expect(plan.counts.reapply).toBe(1);
    expect(plan.findings[0]).toMatchObject({ userId: 'her', field: 'blockedUsers', detail: ['him'] });
    expect(live.calls.length).toBeGreaterThan(0);
    expect(restored.calls.length).toBeGreaterThan(0);

    // The restored copy has no audit log worth reading; the live one is asked only about what is wanted, and since the restore point.
    expect(restored.calls.some((call) => call.model === 'auditLog')).toBe(false);
    const audit = live.calls.find((call) => call.model === 'auditLog')!;
    expect(audit.args.where.createdAt).toEqual({ gte: SINCE });
    expect(audit.args.where.action.in).toEqual(['MODERATION_BAN', 'MODERATION_SUSPEND', 'MODERATION_REMOVE', 'ACCOUNT_DELETE']);
  });

  it('a fake that is written to would be noticed: the guard itself holds', async () => {
    const { reader } = fakeDatabase({});
    expect(() => (reader.userSafetySettings as any).update({})).toThrow(/is not a read/);
    expect(() => (reader.user as any).delete({})).toThrow(/is not a read/);
  });

  it('never selects an address: tombstones are matched on it, and only the id comes back', async () => {
    const live = fakeDatabase({
      settings: [settingsRow('gone-silent')],
      users: [userRow('gone-silent', { isSuspended: true })],
      tombstoned: ['gone-silent'],
    });
    const restored = fakeDatabase({ settings: [settingsRow('gone-silent')], users: [userRow('gone-silent')] });

    await compareDatabases(live.reader, restored.reader, SINCE);

    for (const call of [...live.calls, ...restored.calls].filter((entry) => entry.model === 'user')) {
      const select = call.args.select ?? {};
      expect(select.email).toBeUndefined();
    }
    const tombstoneQuery = live.calls.find((call) => call.model === 'user' && call.args.where?.OR?.some((clause: Row) => 'email' in clause))!;
    expect(tombstoneQuery.args.select).toEqual({ id: true });
  });

  it('finds an account erased after the restore point from the live database, though the audit row names no one', async () => {
    const live = fakeDatabase({
      // Her account is a tombstone, and a retained record keeps her settings row.
      settings: [settingsRow('erased', { blockedUsers: ['him'] })],
      users: [userRow('erased', { isSuspended: true })],
      tombstoned: ['erased'],
      audit: [{ id: 'audit-1', action: 'ACCOUNT_DELETE', targetUserId: null, createdAt: T1, metadata: { requestId: 'dsar-1' } }],
    });
    const restored = fakeDatabase({ settings: [settingsRow('erased')], users: [userRow('erased')] });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);

    expect(plan.findings.filter((finding) => finding.kind === 'erased-since').map((finding) => finding.userId)).toEqual(['erased']);
    expect(plan.statements).toBe(0);
    expect(renderPatchSql(plan)).not.toContain('erased');
  });

  it('lists a member erased since though she never had a safety row, so the erasure is run again for her too', async () => {
    // She asked to be erased after the restore point and had never touched a
    // safety setting. The restored copy holds her account; live has nothing of
    // her. A list drawn only from members with safety rows would leave her off
    // it, and the restored copy would serve with her account back in it.
    const live = fakeDatabase({ users: [userRow('kept')] });
    const restored = fakeDatabase({ users: [userRow('kept'), userRow('quiet'), userRow('tombstoned')] });
    const liveWithTombstone = fakeDatabase({ users: [userRow('kept'), userRow('tombstoned', { isSuspended: true })], tombstoned: ['tombstoned'] });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);
    expect(plan.findings.filter((finding) => finding.kind === 'erased-since').map((finding) => finding.userId)).toEqual(['quiet', 'tombstoned']);

    const withTombstone = await compareDatabases(liveWithTombstone.reader, restored.reader, SINCE);
    expect(withTombstone.findings.filter((finding) => finding.kind === 'erased-since').map((finding) => finding.userId)).toEqual(['quiet', 'tombstoned']);
    // The whole account table is read by id alone, never by address.
    for (const call of [...live.calls, ...liveWithTombstone.calls, ...restored.calls].filter((entry) => entry.model === 'user')) {
      expect(call.args.select).toEqual(expect.objectContaining({ id: true }));
      expect(call.args.select.email).toBeUndefined();
    }
  });

  it('closes again an account staff closed since, and records a ban the restored copy lacks', async () => {
    const hash = 'cd'.repeat(32);
    const live = fakeDatabase({
      users: [userRow('bad', { isSuspended: true, suspensionReason: 'Threats', suspendedAt: T1, suspendedById: 'staff-1', bannedAt: T1, banReason: 'Threats', bannedById: 'staff-1' })],
      bans: [{ id: 'ban-1', emailHash: hash, userId: 'bad', reportId: null, createdById: 'staff-1', reason: 'Threats', createdAt: T1 }],
    });
    const restored = fakeDatabase({ users: [userRow('bad')] });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);

    const patch = renderPatchSql(plan);
    expect(patch).toContain(`UPDATE "User" SET "isSuspended" = true`);
    expect(patch).toContain(`INSERT INTO "BannedIdentity"`);
    expect(patch).toContain(hash);
    expect(formatReport(plan)).not.toContain(hash);
  });

  it('keeps a moderator’s notes out of everything: only the ids of the content are read from an audit row', async () => {
    const live = fakeDatabase({
      users: [userRow('bad')],
      audit: [
        {
          id: 'audit-2',
          action: 'MODERATION_REMOVE',
          targetUserId: 'bad',
          createdAt: T1,
          metadata: { contentType: 'post', contentId: 'post-9', notes: 'She told me her address is 1 Example St', reportId: 'r-1' },
        },
      ],
    });
    const restored = fakeDatabase({ users: [userRow('bad')] });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);

    expect(plan.findings.find((finding) => finding.kind === 'decision')).toMatchObject({ userId: 'bad', detail: ['post:post-9'] });
    expect(JSON.stringify(plan)).not.toContain('Example St');
    expect(formatReport(plan)).not.toContain('Example St');
  });

  it('asks about members in batches, so a large platform does not become one enormous query', async () => {
    const many = Array.from({ length: 1200 }, (_, index) => `member-${index}`);
    const live = fakeDatabase({ settings: many.map((id) => settingsRow(id)), users: many.map((id) => userRow(id)) });
    const restored = fakeDatabase({ settings: many.map((id) => settingsRow(id)), users: many.map((id) => userRow(id)) });

    const plan = await compareDatabases(live.reader, restored.reader, SINCE);

    expect(plan.findings).toEqual([]);
    const lookups = live.calls.filter((call) => call.model === 'user' && call.args.where?.id?.in);
    expect(lookups.length).toBeGreaterThan(2);
    for (const call of lookups) expect(call.args.where.id.in.length).toBeLessThanOrEqual(500);
  });
});

describe('The command line', () => {
  const live = 'postgresql://live.example/athena';
  const restored = 'postgresql://restored.example/athena';

  it('takes the two databases and the restore point', () => {
    const options = parseOptions(['--live', live, '--restored', restored, '--since', '2026-10-01T04:30:00Z', '--emit-sql', 'patch.sql', '--json'], {});

    expect(options).toMatchObject({ live, restored, emitSql: 'patch.sql', json: true });
    expect(options.since.toISOString()).toBe('2026-10-01T04:30:00.000Z');
  });

  it('falls back to the environment the runbook sets, and to no file and the report', () => {
    const options = parseOptions(['--since', '2026-10-01T04:30:00Z'], { DIRECT_DATABASE_URL: live, RESTORE_DIRECT_URL: restored });

    expect(options).toMatchObject({ live, restored, emitSql: null, json: false });
  });

  it('refuses to compare a database with itself', () => {
    expect(() => parseOptions(['--live', live, '--restored', live, '--since', '2026-10-01T04:30:00Z'], {})).toThrow(/same address/);
  });

  it('refuses what it cannot use, and says what to give it', () => {
    expect(() => parseOptions(['--restored', restored, '--since', '2026-10-01T04:30:00Z'], {})).toThrow(/Say which database is live/);
    expect(() => parseOptions(['--live', live, '--since', '2026-10-01T04:30:00Z'], {})).toThrow(/Say which database was restored/);
    expect(() => parseOptions(['--live', live, '--restored', restored], {})).toThrow(/restore point/);
    expect(() => parseOptions(['--live', live, '--restored', restored, '--since', 'yesterday-ish'], {})).toThrow(/not a date/);
    expect(() => parseOptions(['--live', live, '--restored', restored, '--since', '2999-01-01T00:00:00Z'], {})).toThrow(/future/);
    expect(() => parseOptions(['--live', 'mysql://x', '--restored', restored, '--since', '2026-10-01T04:30:00Z'], {})).toThrow(/postgres/);
    expect(() => parseOptions(['--live', live, '--restored', '--since', '2026-10-01T04:30:00Z'], {})).toThrow(/needs a value/);
  });
});

describe('Writing the patch', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-patch-test-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const plan = {
    since: SINCE.toISOString(),
    findings: [],
    counts: { reapply: 0, 'lifted-since': 0, differs: 0, 'carried-over': 0, 'not-in-restored-copy': 0, 'erased-since': 0, decision: 0 },
    changedSince: { settings: 0, dvProfiles: 0 },
    statements: 0,
  };

  it('is written to a new file, and an existing file is never overwritten', () => {
    const file = path.join(dir, 'safety-patch.sql');

    writePatch(file, plan);
    expect(fs.readFileSync(file, 'utf8')).toMatch(/^-- Safety patch/);

    expect(() => writePatch(file, plan)).toThrow(/EEXIST/);
  });

  it('is readable by its owner only, where the platform has such a thing', () => {
    if (process.platform === 'win32') return;
    const file = path.join(dir, 'safety-patch.sql');
    writePatch(file, plan);
    expect(fs.statSync(file).mode & 0o077).toBe(0);
  });
});
