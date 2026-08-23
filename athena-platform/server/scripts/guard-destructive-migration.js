#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Refuses to run a destructive Prisma command against a database this schema
 * does not fully own.
 *
 * Why this exists: as of 2026-08-23 the configured database also carries tables
 * belonging to a separate application (a `Nexus*` set, plus PartnerCampaign and
 * WaitlistSignup) applied by 9 migrations that exist nowhere in this repo. They
 * are absent from schema.prisma, so `prisma migrate dev` and `prisma db push`
 * both plan to DROP them. `prisma migrate deploy` is unaffected — it only applies
 * migration files and never diffs against the live schema.
 *
 * Usage:
 *   node scripts/guard-destructive-migration.js
 *
 * Override (only when you are certain the target database is exclusively ours,
 * e.g. a scratch database):
 *   ALLOW_DESTRUCTIVE_MIGRATION=true npm run db:migrate
 */

const { execFileSync } = require('child_process');
const path = require('path');

if (process.env.ALLOW_DESTRUCTIVE_MIGRATION === 'true') {
  console.log('[guard] ALLOW_DESTRUCTIVE_MIGRATION=true — skipping the drift check.');
  process.exit(0);
}

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

let sql;
try {
  sql = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-schema-datasource',
      schemaPath,
      '--to-schema-datamodel',
      schemaPath,
      '--script',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );
} catch (error) {
  console.error('[guard] Could not diff the database against schema.prisma.');
  console.error('[guard] Refusing to continue, because an unchecked diff is the risky case.');
  console.error(String(error.stderr || error.message || error).trim());
  process.exit(1);
}

const drops = sql
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^DROP (TABLE|TYPE)\b/i.test(line) || /\bDROP COLUMN\b/i.test(line));

if (drops.length === 0) {
  console.log('[guard] No destructive statements planned. Continuing.');
  process.exit(0);
}

const shown = drops.slice(0, 15);

console.error('');
console.error('  ┌─────────────────────────────────────────────────────────────┐');
console.error('  │  BLOCKED: this command would DROP objects from the database │');
console.error('  └─────────────────────────────────────────────────────────────┘');
console.error('');
console.error(`  ${drops.length} destructive statement(s) planned, including:`);
console.error('');
for (const line of shown) console.error(`    ${line}`);
if (drops.length > shown.length) console.error(`    ...and ${drops.length - shown.length} more`);
console.error('');
console.error('  These objects exist in the database but not in schema.prisma. That');
console.error('  usually means the database is shared with another application, not');
console.error('  that the objects are obsolete.');
console.error('');
console.error('  To apply pending migration FILES safely, use:');
console.error('      npm run db:migrate:deploy');
console.error('');
console.error('  If you are certain this database is exclusively ours, re-run with:');
console.error('      ALLOW_DESTRUCTIVE_MIGRATION=true <your command>');
console.error('');

process.exit(1);
