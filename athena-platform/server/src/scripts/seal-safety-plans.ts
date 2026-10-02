/**
 * Seal the safety plans that were written before plans were sealed.
 *
 * New saves are sealed by the route. A plan saved earlier still holds its parts
 * as readable lists until she next saves it, so this walks every row once and
 * seals what is left. It is safe to run twice, and again after a deploy: a part
 * that is already sealed, empty or not a list is left alone, and every sealed
 * part is opened again and compared with what it came from before anything is
 * written, so a key that cannot read back what it wrote changes nothing.
 *
 *   npm run seal:safety-plans -- --dry-run     count what would be sealed
 *   npm run seal:safety-plans                  seal it
 *
 * It opens the database through utils/prisma, so it writes to whatever
 * DATABASE_URL names (not DIRECT_DATABASE_URL, which only the migration
 * tooling reads). Set DATABASE_URL to the database you mean to seal, the value
 * the API host uses, before running it: a shell that still holds a development
 * URL would seal development rows and report success.
 *
 * It needs DV_ENCRYPTION_KEY set to the same 64-character hex key the server
 * runs with, whatever NODE_ENV is. The development fallback key would seal
 * plans under a key anyone can read in the source, so the script refuses it.
 * Sealed plans cannot be opened without that key: back it up before the first
 * real run.
 *
 * It prints counts and nothing else, never an id or a word of a plan.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { readPlanPart, sealPlanLines, SAFETY_PLAN_FIELDS, type SafetyPlanField } from '../utils/safety-plan-seal';

export interface SealSummary {
  dryRun: boolean;
  rowsSeen: number;
  rowsSealed: number;
  partsSealed: number;
  /** Parts that were already sealed and read back fine. */
  partsAlreadySealed: number;
  /** Sealed parts this key cannot open. They are never touched. */
  partsUnreadable: number;
  /** Parts that are neither a list nor text. Left where they are. */
  partsUnsupported: number;
  /** Rows she saved while this ran, or whose seal did not read back. Run again. */
  rowsSkipped: number;
}

const BATCH = 100;

function requireRealKey(): void {
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.DV_ENCRYPTION_KEY || '')) {
    throw new Error(
      'DV_ENCRYPTION_KEY must be set to the 64-character hex key the server runs with before plans are sealed'
    );
  }
}

export async function sealSafetyPlans(options: { dryRun?: boolean; batchSize?: number } = {}): Promise<SealSummary> {
  requireRealKey();

  const dryRun = options.dryRun === true;
  const take = options.batchSize ?? BATCH;
  const summary: SealSummary = {
    dryRun,
    rowsSeen: 0,
    rowsSealed: 0,
    partsSealed: 0,
    partsAlreadySealed: 0,
    partsUnreadable: 0,
    partsUnsupported: 0,
    rowsSkipped: 0,
  };

  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.safetyPlan.findMany({
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      summary.rowsSeen += 1;

      const data: Partial<Record<SafetyPlanField, string>> = {};
      let verified = true;

      for (const field of SAFETY_PLAN_FIELDS) {
        const part = readPlanPart((row as Record<string, unknown>)[field]);

        if (part.state === 'sealed') summary.partsAlreadySealed += 1;
        else if (part.state === 'unreadable') summary.partsUnreadable += 1;
        else if (part.state === 'unsupported') summary.partsUnsupported += 1;
        else if (part.state === 'plain' && part.lines) {
          const sealed = sealPlanLines(part.lines);
          const readBack = readPlanPart(sealed);
          if (
            readBack.state !== 'sealed' ||
            !readBack.lines ||
            readBack.lines.length !== part.lines.length ||
            readBack.lines.some((line, index) => line !== part.lines![index])
          ) {
            verified = false;
            break;
          }
          data[field] = sealed;
        }
      }

      const sealedFields = Object.keys(data).length;
      if (!verified) {
        summary.rowsSkipped += 1;
        continue;
      }
      if (sealedFields === 0) continue;

      if (dryRun) {
        summary.rowsSealed += 1;
        summary.partsSealed += sealedFields;
        continue;
      }

      // The row is matched on the updatedAt it was read with: if she saved
      // between the read and this write, nothing is written, and her newer
      // plan is not replaced by a sealed copy of the older one.
      const { count } = await prisma.safetyPlan.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: data as Prisma.SafetyPlanUpdateManyMutationInput,
      });
      if (count === 0) {
        summary.rowsSkipped += 1;
      } else {
        summary.rowsSealed += 1;
        summary.partsSealed += sealedFields;
      }
    }

    if (rows.length < take) break;
  }

  return summary;
}

if (require.main === module) {
  sealSafetyPlans({ dryRun: process.argv.includes('--dry-run') })
    .then((summary) => {
      logger.info('Safety plan sealing finished', { ...summary });
      console.log(JSON.stringify(summary, null, 2));
      if (summary.partsUnreadable > 0) {
        console.log('Some sealed parts could not be opened with this key. They were left untouched; check DV_ENCRYPTION_KEY.');
      }
      if (summary.rowsSkipped > 0) {
        console.log('Some rows were skipped because they changed while this ran. Run it again.');
      }
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Safety plan sealing failed', { error: error instanceof Error ? error.message : String(error) });
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
