/**
 * The safety score is staff's, and nobody else is shown it.
 *
 * ATHENA works out an account-standing score from reports, blocks, upheld
 * decisions and a few signs of good standing, so that moderators see the
 * accounts most in need of a look first. The score is held back from members on
 * purpose: a woman who has blocked a man must not be able to learn, from a
 * profile or a search result, how many people have reported him, and a woman
 * who was wrongly reported must not carry a number around the platform that
 * nobody has explained to her. The privacy statement says it is used by staff
 * only; this is what keeps that true.
 *
 * Nothing here runs the app. It reads the source, which is the only way to
 * promise something about every route written from now on: a route that
 * selects the column, or asks the service for a member's standing, fails here
 * until somebody has decided it should and said so in this file.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from '@jest/globals';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      found.push(...sourceFiles(path));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) {
      found.push(path);
    }
  }
  return found;
}

/** Code with its comments taken out: a comment that says the score is not served is not serving it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The data export names the column in the list of what it leaves out of a member's
 * own account row (STAFF_ONLY_ACCOUNT_COLUMNS in services/gdpr.service), and in the
 * line of the export that says it was left out. That is the opposite of serving
 * it, so those two are not counted; any other mention in the file still is.
 */
const NAMED_TO_BE_WITHHELD = /STAFF_ONLY_ACCOUNT_COLUMNS\s*=\s*\[[^\]]*\]/;
const NAMED_IN_THE_EXPORT_NOTICE = /section: 'account\.safetyScore'/;
const withoutWhatTheExportWithholds = (code: string) => code.replace(NAMED_TO_BE_WITHHELD, '').replace(NAMED_IN_THE_EXPORT_NOTICE, '');

const files = sourceFiles(SRC).map((path) => ({
  name: relative(SRC, path).split(sep).join('/'),
  code: withoutComments(readFileSync(path, 'utf8')),
}));

describe('the safety score is staff-only', () => {
  it('reads the source it is meant to be checking', () => {
    // A walk that quietly found nothing would turn every assertion below into a pass.
    expect(files.length).toBeGreaterThan(200);
    expect(files.find((file) => file.name === 'services/safety-score.service.ts')?.code).toMatch(/safetyScore/);
    expect(files.find((file) => file.name === 'routes/safety.routes.ts')?.code).toMatch(/getSafetyStatus/);
  });

  it('is selected, returned or written by the scoring service alone', () => {
    // User.safetyScore is a column on the member row. A profile, a search result,
    // a feed author or a mentor card that named it in a select would put it in
    // front of other members. (The routes that answer with a member's row use
    // explicit select lists, so a row is never spread whole; naming the column is
    // the only way it gets out, and this is what catches that.)
    const outside = files
      .filter((file) => file.name !== 'services/safety-score.service.ts')
      .filter((file) => /\bsafetyScore(UpdatedAt)?\b/.test(withoutWhatTheExportWithholds(file.code)))
      .map((file) => file.name);

    expect(outside).toEqual([]);
  });

  it('is left out of the account section of a member’s own data export, and the export says so', () => {
    const exporter = files.find((file) => file.name === 'services/gdpr.service.ts')!.code;

    expect(exporter).toMatch(NAMED_TO_BE_WITHHELD);
    expect(exporter.match(NAMED_TO_BE_WITHHELD)![0]).toContain('safetyScore');
    expect(exporter).toContain("section: 'account.safetyScore'");
  });

  it('is asked of the scoring service by the moderation routes alone', () => {
    // getSafetyStatus and calculateSafetyScore are how a score leaves the
    // service. Whoever imports them can hand it to a caller.
    const importers = files
      .filter((file) => file.name !== 'services/safety-score.service.ts')
      .filter((file) => {
        const imports = file.code.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*safety-score\.service['"]/g) ?? [];
        return imports.some((statement) => /\b(getSafetyStatus|calculateSafetyScore|safetyScoreService)\b/.test(statement));
      })
      .map((file) => file.name);

    expect(importers).toEqual(['routes/safety.routes.ts']);
  });

  it('is reached in the moderation routes only behind the moderator role', () => {
    const routes = files.find((file) => file.name === 'routes/safety.routes.ts')!.code;
    // Each registration, from `router.get(` to the next one.
    const registrations = routes.split(/(?=\brouter\.(?:get|post|put|patch|delete)\s*\()/);
    const readers = registrations.filter((block) => /\b(getSafetyStatus|calculateSafetyScore)\s*\(/.test(block));

    expect(readers.length).toBeGreaterThan(0);
    for (const block of readers) {
      expect(block.slice(0, 400)).toContain("requireRole('MODERATOR', 'ADMIN')");
    }
  });
});
