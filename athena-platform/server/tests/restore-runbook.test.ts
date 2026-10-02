/**
 * The restore runbook and the tool it points at have to stay one thing.
 *
 * The runbook used to tell an operator under pressure to re-apply blocks from
 * the API logs. It now points at a script, and a script that selects a column
 * the schema has since renamed, or a runbook that stops naming the tables the
 * script covers, fails at exactly the moment it is needed. These checks run in
 * CI so neither can drift without a build saying so.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { SELECTS } from '../src/scripts/restore-safety-diff';

const server = path.resolve(__dirname, '..');
const platform = path.resolve(server, '..');

const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8');

/** The text of one `model X { ... }` block of schema.prisma. */
function modelBlock(schema: string, name: string): string {
  const start = schema.search(new RegExp(`^model ${name} \\{`, 'm'));
  if (start < 0) throw new Error(`schema.prisma has no model ${name}`);
  return schema.slice(start, schema.indexOf('\n}', start));
}

const fieldsOf = (block: string) =>
  new Set(
    block
      .split(/\r?\n/)
      .slice(1)
      .map((line) => /^\s{2}([A-Za-z_]\w*)\s/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name))
  );

describe('The restore runbook', () => {
  const oncall = read(platform, 'docs', 'runbooks', 'ONCALL.md').replace(/\r\n/g, '\n');
  const start = oncall.indexOf('### Restoring');
  const section = oncall.slice(start, oncall.indexOf('\n---', start));

  it('has a Restoring section to read', () => {
    expect(start).toBeGreaterThan(0);
    expect(section.length).toBeGreaterThan(500);
  });

  it('says to keep production as it stands before anything is overwritten, and why', () => {
    expect(section).toMatch(/Keep production as it stands/);
    expect(section).toMatch(/Neon\s+branch of production/);
    expect(section).toMatch(/`AuditLog` and `SafetyIncident` live in the same database/);
  });

  it('names the tool and the command that runs it', () => {
    expect(section).toContain('npm run restore:safety-diff');
    expect(section).toContain('restore-safety-diff.ts');
    expect(section).toContain('--live');
    expect(section).toContain('--restored');
    expect(section).toContain('--since');
    expect(section).toContain('--emit-sql');
  });

  it('names every table and mirror the tool compares, so the runbook cannot promise less than it does', () => {
    for (const name of [
      'UserSafetySettings',
      'DvSafetyProfile',
      'Profile.isSafeMode',
      'Profile.hideFromSearch',
      'User.allowMessages',
      'BannedIdentity',
      'MODERATION_BAN',
      'MODERATION_SUSPEND',
      'MODERATION_REMOVE',
      'ACCOUNT_DELETE',
    ]) {
      expect(section).toContain(name);
    }
  });

  it('says plainly what the tool will not do: put back a block she removed, and cover safe chats', () => {
    expect(section).toMatch(/never\*\*\s+re-applied/);
    expect(section).toMatch(/Unblocks\s+are\s+not\s+logged/);
    expect(section).toMatch(/`DvSafeChat`/);
  });

  it('has the Neon drill run the tool, and the launch checklist ask for it', () => {
    expect(oncall).toMatch(/run the safety diff with\s+production as `--live`/);
    expect(read(platform, 'docs', 'launch', 'LAUNCH_CHECKLIST.md')).toContain('restore:safety-diff');
  });
});

describe('The restore tool', () => {
  const packageJson = JSON.parse(read(server, 'package.json')) as { scripts: Record<string, string> };

  it('is registered as an npm script that points at a file that exists', () => {
    const command = packageJson.scripts['restore:safety-diff'];
    expect(command).toBeDefined();
    const file = /src\/scripts\/restore-safety-diff\.ts/.exec(command)?.[0];
    expect(file).toBeDefined();
    expect(fs.existsSync(path.join(server, file!))).toBe(true);
    expect(fs.existsSync(path.join(server, 'src', 'utils', 'restore-safety-diff.ts'))).toBe(true);
  });

  it('never imports the shared database client, whose connection is whatever DATABASE_URL says and may be production', () => {
    for (const file of ['src/scripts/restore-safety-diff.ts', 'src/utils/restore-safety-diff.ts']) {
      const source = read(server, file);
      expect(source).not.toMatch(/from ['"][./]*(?:utils\/)?prisma['"]/);
    }
  });

  it('selects only columns that exist in the schema today', () => {
    const schema = read(server, 'prisma', 'schema.prisma');
    const models: Array<[string, Record<string, unknown>]> = [
      ['UserSafetySettings', SELECTS.settings],
      ['DvSafetyProfile', SELECTS.dvProfile],
      ['BannedIdentity', SELECTS.ban],
      ['User', SELECTS.account],
      ['User', SELECTS.liveAccount],
    ];

    for (const [model, select] of models) {
      const fields = fieldsOf(modelBlock(schema, model));
      for (const column of Object.keys(select)) {
        expect({ model, column, exists: fields.has(column) }).toEqual({ model, column, exists: true });
      }
    }

    // The profile relation the mirrors are read through.
    const profile = fieldsOf(modelBlock(schema, 'Profile'));
    for (const column of Object.keys((SELECTS.account.profile as { select: Record<string, boolean> }).select)) {
      expect(profile.has(column)).toBe(true);
    }
  });
});
