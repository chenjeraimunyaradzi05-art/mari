/**
 * Seal again, under the current key, everything a retired key sealed.
 *
 * This is the last step of a key rotation (docs/runbooks/ENCRYPTION.md has the
 * whole procedure). The platform is already running with the new key as
 * DV_ENCRYPTION_KEY and the old one in DV_ENCRYPTION_KEY_PREVIOUS, so nothing
 * has stopped working: every value is opened under whichever key sealed it
 * (utils/encryption-key.ts). What is left is that rows still hold the old key's
 * seal, and the old key cannot be thrown away until none do.
 *
 *   npm run rotate:encryption-keys                  count what would change
 *   npm run rotate:encryption-keys -- --apply       seal it again
 *
 * It looks at every sealed column: safe-chat messages, health entries,
 * medications, health notes, booking reasons, authenticator seeds and the seven
 * parts of each safety plan. A value the current key opens is left alone, so it
 * is safe to run twice, and again after a deploy. A value only a retired key
 * opens is sealed again, and the new seal is opened under the current key
 * before anything is written: a key that cannot read back what it wrote
 * changes nothing. A value no configured key opens is never touched and is
 * counted, because it means a retired key is missing from the *_PREVIOUS
 * variables, and the old key must not be retired while that is so.
 *
 * Each write is matched on what was read (the value itself, or for a plan the
 * time she last saved it), so a row she changed while this ran is skipped, not
 * overwritten with a sealed copy of the older one. Run it again until skipped is
 * zero.
 *
 * It opens the database through utils/prisma, so it writes to whatever
 * DATABASE_URL names. Set DATABASE_URL to the database you mean to change, the
 * value the API host uses, before running it: a shell that still holds a
 * development URL would re-seal development rows and report success.
 *
 * It needs the same keys the API runs with, whatever NODE_ENV is: the new key
 * in the *_ENCRYPTION_KEY variables and the old one in *_PREVIOUS. The
 * development fallback key is refused, because it would seal under a key anyone
 * can read in the source.
 *
 * It prints counts and nothing else, never an id, a key or a word of what it
 * holds.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  configuredKeyProblem,
  hasConfiguredKey,
  isSealed,
  openSealedText,
  sealText,
  type KeyPurpose,
} from '../utils/encryption-key';
import { SAFETY_PLAN_FIELDS } from '../utils/safety-plan-seal';

/** What happened to the values in one place. */
export interface ColumnSummary {
  seen: number;
  /** Opened by the current key already. */
  current: number;
  /** Opened only by a retired key, and sealed again (or, in a dry run, would be). */
  resealed: number;
  /** Not sealed at all: a value from before sealing existed, left as it is. */
  unsealed: number;
  /** No configured key opens it. Never touched. Do not retire a key while this is above zero. */
  unreadable: number;
  /** Changed while this ran, or the new seal did not read back. Run again. */
  skipped: number;
}

export interface RotationSummary {
  dryRun: boolean;
  columns: Record<string, ColumnSummary>;
}

const BATCH = 200;

interface StringColumn {
  /** The name it has in the summary. */
  label: string;
  /** The Prisma delegate. */
  model: 'dvSafeMessage' | 'healthEntry' | 'medication' | 'healthNote' | 'healthBooking' | 'user';
  column: string;
  purpose: KeyPurpose;
  /** False for a column that is never null, because Prisma refuses `not: null` on it. */
  nullable: boolean;
  /** A value that is not sealed is something older than sealing, and is left as it is. */
  mayBeUnsealed: boolean;
  /** Models whose rows carry an updatedAt that a rotation should not move. */
  keepsUpdatedAt: boolean;
}

const STRING_COLUMNS: StringColumn[] = [
  { label: 'safeChatMessages', model: 'dvSafeMessage', column: 'content', purpose: 'safe-chat', nullable: false, mayBeUnsealed: false, keepsUpdatedAt: false },
  { label: 'healthEntries', model: 'healthEntry', column: 'payload', purpose: 'health', nullable: false, mayBeUnsealed: false, keepsUpdatedAt: true },
  { label: 'medications', model: 'medication', column: 'details', purpose: 'health', nullable: false, mayBeUnsealed: false, keepsUpdatedAt: true },
  { label: 'healthNotes', model: 'healthNote', column: 'content', purpose: 'health', nullable: false, mayBeUnsealed: false, keepsUpdatedAt: true },
  { label: 'bookingReasons', model: 'healthBooking', column: 'reason', purpose: 'health', nullable: true, mayBeUnsealed: false, keepsUpdatedAt: true },
  { label: 'authenticatorSeeds', model: 'user', column: 'twoFactorSecret', purpose: 'secret', nullable: true, mayBeUnsealed: true, keepsUpdatedAt: true },
];

const emptySummary = (): ColumnSummary => ({ seen: 0, current: 0, resealed: 0, unsealed: 0, unreadable: 0, skipped: 0 });

type Row = Record<string, unknown> & { id: string };

/** The few Prisma calls this makes, typed loosely so one loop can serve every model. */
interface Delegate {
  findMany(args: Record<string, unknown>): Promise<Row[]>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}

const delegate = (model: string): Delegate => (prisma as unknown as Record<string, Delegate>)[model];

/** The purposes that need a real key, for whatever this run is about to touch. */
function requireRealKeys(): void {
  const purposes: Array<[KeyPurpose, string]> = [
    ['safe-chat', 'DV_ENCRYPTION_KEY'],
    ['health', 'HEALTH_ENCRYPTION_KEY or DV_ENCRYPTION_KEY'],
    ['secret', 'TOTP_ENCRYPTION_KEY or DV_ENCRYPTION_KEY'],
  ];
  for (const [purpose, names] of purposes) {
    if (!hasConfiguredKey(purpose)) {
      throw new Error(
        `${names} must be set to the 64-character hex key the server runs with before anything is sealed again`
      );
    }
    // The API refuses a placeholder key in production, and sealing under one
    // here, from a shell where NODE_ENV is usually unset, would write every row
    // under a key the API then cannot start with.
    const problem = configuredKeyProblem(purpose);
    if (problem) {
      throw new Error(
        `${problem}, so nothing is sealed under it. Generate a random key with \`openssl rand -hex 32\` and set it as the current key.`
      );
    }
  }
}

/**
 * What to do with one sealed value. `replacement` is what to write, or null when
 * the value should be left alone; `failed` is true when the value needed
 * sealing again and the new seal did not read back, so the row it is in must
 * not be written at all. Counts the outcome either way.
 */
function reseal(
  purpose: KeyPurpose,
  stored: string,
  summary: ColumnSummary
): { replacement: string | null; failed: boolean } {
  const opened = openSealedText(purpose, stored);
  if (opened === null) {
    summary.unreadable += 1;
    return { replacement: null, failed: false };
  }
  if (!opened.usedPreviousKey) {
    summary.current += 1;
    return { replacement: null, failed: false };
  }

  const sealed = sealText(purpose, opened.text);
  const readBack = openSealedText(purpose, sealed);
  if (readBack === null || readBack.usedPreviousKey || readBack.text !== opened.text) {
    summary.skipped += 1;
    return { replacement: null, failed: true };
  }
  return { replacement: sealed, failed: false };
}

async function rotateStringColumn(spec: StringColumn, dryRun: boolean, take: number): Promise<ColumnSummary> {
  const summary = emptySummary();
  const model = delegate(spec.model);

  let cursor: string | undefined;
  for (;;) {
    const rows = await model.findMany({
      where: spec.nullable ? { [spec.column]: { not: null } } : {},
      select: { id: true, [spec.column]: true, ...(spec.keepsUpdatedAt ? { updatedAt: true } : {}) },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const stored = row[spec.column];
      if (typeof stored !== 'string' || stored === '') continue;
      summary.seen += 1;

      if (spec.mayBeUnsealed && !isSealed(stored)) {
        summary.unsealed += 1;
        continue;
      }

      const { replacement } = reseal(spec.purpose, stored, summary);
      if (replacement === null) continue;

      if (dryRun) {
        summary.resealed += 1;
        continue;
      }

      // Matched on the value that was read. If she changed it between the read
      // and this write, nothing is written and her newer value stands. The row's
      // own updatedAt is carried over so that a rotation does not make every
      // record look as though she had just edited it.
      const { count } = await model.updateMany({
        where: { id: row.id, [spec.column]: stored },
        data: { [spec.column]: replacement, ...(spec.keepsUpdatedAt ? { updatedAt: row.updatedAt } : {}) },
      });
      if (count === 0) summary.skipped += 1;
      else summary.resealed += 1;
    }

    if (rows.length < take) break;
  }

  return summary;
}

async function rotateSafetyPlans(dryRun: boolean, take: number): Promise<ColumnSummary> {
  const summary = emptySummary();
  const plans = delegate('safetyPlan');

  let cursor: string | undefined;
  for (;;) {
    const rows = await plans.findMany({
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const data: Record<string, string> = {};
      let verified = true;

      for (const field of SAFETY_PLAN_FIELDS) {
        const stored = row[field];
        // A part she wrote before plans were sealed is a plain list, and sealing
        // it is the other script's job (seal-safety-plans.ts), not a rotation's.
        if (typeof stored !== 'string' || !isSealed(stored)) continue;
        summary.seen += 1;

        const { replacement, failed } = reseal('safety-plan', stored, summary);
        if (failed) {
          // A part that would not read back stops the row, so a plan is never
          // left half re-sealed by this run.
          verified = false;
          break;
        }
        if (replacement !== null) data[field] = replacement;
      }

      const parts = Object.keys(data).length;
      if (!verified || parts === 0) continue;

      if (dryRun) {
        summary.resealed += parts;
        continue;
      }

      // Matched on when she last saved it, as seal-safety-plans.ts does: a plan
      // she saved a moment ago is not replaced by a re-sealed copy of the older
      // one. updatedAt is carried over, so the plan does not look edited.
      const { count } = await plans.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { ...data, updatedAt: row.updatedAt },
      });
      if (count === 0) summary.skipped += parts;
      else summary.resealed += parts;
    }

    if (rows.length < take) break;
  }

  return summary;
}

export async function rotateEncryptionKeys(options: { dryRun?: boolean; batchSize?: number } = {}): Promise<RotationSummary> {
  requireRealKeys();

  const dryRun = options.dryRun !== false;
  const take = options.batchSize ?? BATCH;
  const columns: Record<string, ColumnSummary> = {};

  for (const spec of STRING_COLUMNS) {
    columns[spec.label] = await rotateStringColumn(spec, dryRun, take);
  }
  columns.safetyPlanParts = await rotateSafetyPlans(dryRun, take);

  return { dryRun, columns };
}

if (require.main === module) {
  rotateEncryptionKeys({ dryRun: !process.argv.includes('--apply') })
    .then((summary) => {
      logger.info('Encryption key rotation finished', { ...summary });
      console.log(JSON.stringify(summary, null, 2));

      const totals = Object.values(summary.columns).reduce(
        (sum, column) => ({
          resealed: sum.resealed + column.resealed,
          unreadable: sum.unreadable + column.unreadable,
          skipped: sum.skipped + column.skipped,
        }),
        { resealed: 0, unreadable: 0, skipped: 0 }
      );

      if (summary.dryRun) {
        console.log('Dry run: nothing was written. Run again with --apply to seal these under the current key.');
      }
      if (totals.unreadable > 0) {
        console.log(
          'Some values could not be opened with any configured key and were left untouched. A retired key is missing from the *_PREVIOUS variables; do not retire any key until this is zero.'
        );
      }
      if (totals.skipped > 0) {
        console.log('Some rows changed while this ran, or did not read back. Run it again until skipped is zero.');
      }
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Encryption key rotation failed', { error: error instanceof Error ? error.message : String(error) });
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
