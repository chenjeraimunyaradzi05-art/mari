/**
 * The personal safety plan, sealed at rest.
 *
 * A plan holds the addresses she could go to, the people she would call and the
 * way out she has worked out, in seven columns of Json. Written as plain lists,
 * a copy of the table was a copy of every plan, and the schema comments and the
 * page both said "encrypted" for a good while before anything encrypted it.
 *
 * Each part is now kept as one sealed string: the list as JSON, sealed under
 * DV_ENCRYPTION_KEY (see secret-box.ts). The column stays Json, so no migration
 * is needed, and a row written before sealing, whose parts are still plain
 * lists, reads as it always did and is sealed the next time she saves it or
 * when scripts/seal-safety-plans.ts has run. Nothing here ever hands a sealed
 * string to the page: the page reads a string as lines of text, and a sealed
 * one it could not open would otherwise be shown to her, and saved back, as
 * though she had written it.
 */

import { Prisma } from '@prisma/client';
import { isSealed, openSafetyText, sealSafetyText } from './secret-box';

/** The seven parts of a plan, each a list of lines she wrote. */
export const SAFETY_PLAN_FIELDS = [
  'emergencyContacts',
  'safeLocations',
  'warningTriggers',
  'exitStrategies',
  'importantDocs',
  'financialPlan',
  'legalContacts',
] as const;

export type SafetyPlanField = (typeof SAFETY_PLAN_FIELDS)[number];

/**
 * What one stored part turned out to be.
 *
 * empty        nothing is kept in it
 * sealed       kept sealed, and opened
 * plain        kept as readable lists, from before sealing existed
 * unreadable   kept sealed, but this host cannot open it (the key it was sealed
 *              under is not the key it has now, or the bytes were damaged)
 * unsupported  kept as something that is neither a list nor text: the page has
 *              never been able to show it, so it reads as empty, and the seal
 *              script leaves it where it is rather than deciding what it was
 */
export type PlanPartState = 'empty' | 'sealed' | 'plain' | 'unreadable' | 'unsupported';

export interface PlanPart {
  lines: string[] | null;
  state: PlanPartState;
}

const asLines = (values: unknown[]): string[] =>
  values.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);

/** One stored part, read whichever way it was written. */
export function readPlanPart(stored: unknown): PlanPart {
  if (stored === null || stored === undefined) return { lines: null, state: 'empty' };

  if (Array.isArray(stored)) {
    // The route has only ever accepted lists of text since it validated its
    // body, but a row from before that may hold anything. An entry that is not
    // text cannot be carried into a sealed list without being dropped, and the
    // seal script must never throw part of a plan away, so such a part is left
    // exactly as it is and reported as one this file cannot seal.
    if (stored.some((entry) => entry !== null && typeof entry !== 'string')) return { lines: null, state: 'unsupported' };
    const lines = asLines(stored);
    return lines.length === 0 ? { lines: null, state: 'empty' } : { lines, state: 'plain' };
  }

  if (typeof stored === 'string') {
    if (isSealed(stored)) {
      const opened = openSafetyText(stored);
      if (opened === null) return { lines: null, state: 'unreadable' };
      try {
        const parsed: unknown = JSON.parse(opened);
        if (!Array.isArray(parsed)) return { lines: null, state: 'unreadable' };
        const lines = asLines(parsed);
        return lines.length === 0 ? { lines: null, state: 'empty' } : { lines, state: 'sealed' };
      } catch {
        return { lines: null, state: 'unreadable' };
      }
    }

    // Older rows may hold one block of text rather than a list; the page has
    // always split it on new lines.
    const lines = asLines(stored.split('\n'));
    return lines.length === 0 ? { lines: null, state: 'empty' } : { lines, state: 'plain' };
  }

  return { lines: null, state: 'unsupported' };
}

/** A list as the one string that goes into the Json column. */
export function sealPlanLines(lines: string[]): string {
  return sealSafetyText(JSON.stringify(lines));
}

/**
 * What to write for one part she sent: absent leaves the stored part alone,
 * and null or an empty list clears it, because there is nothing in it to
 * protect and "emptying a box deletes what was in it" is then literally true.
 */
export function planColumnValue(
  lines: string[] | null | undefined
): string | typeof Prisma.JsonNull | undefined {
  if (lines === undefined) return undefined;
  if (lines === null) return Prisma.JsonNull;
  const kept = asLines(lines);
  return kept.length === 0 ? Prisma.JsonNull : sealPlanLines(kept);
}

type PlanRow = { [key: string]: unknown };

export interface PresentedSafetyPlan {
  [key: string]: unknown;
  /** False while any part is still kept as readable lists. */
  encryptedAtRest: boolean;
  /**
   * Parts that are stored but cannot be shown: sealed under a key this host
   * does not have, or kept in a shape that is not a list of lines. Either way
   * the page shows nothing for them and must not save a blank over them.
   */
  unreadableParts: SafetyPlanField[];
}

/**
 * A stored plan as she should see it: every part opened into a list of lines
 * or null, plus two facts about how it is kept so the page never claims more
 * than is true of her own row.
 *
 * A part this file cannot read, for whatever reason, is named in
 * unreadableParts. The page treats an empty box for a named part as "left
 * alone", not "emptied", so what is stored survives a save she makes without
 * ever having seen it. Left unnamed, an unsupported part would read as empty
 * and her next save would clear it, which is throwing away a piece of her plan
 * on the strength of a shape the page could not show.
 */
export function presentSafetyPlan(row: PlanRow): PresentedSafetyPlan {
  const presented: PlanRow = { ...row };
  let encryptedAtRest = true;
  const unreadableParts: SafetyPlanField[] = [];

  for (const field of SAFETY_PLAN_FIELDS) {
    const part = readPlanPart(row[field]);
    presented[field] = part.lines;
    if (part.state === 'plain' || part.state === 'unsupported') encryptedAtRest = false;
    if (part.state === 'unreadable' || part.state === 'unsupported') unreadableParts.push(field);
  }

  return { ...presented, encryptedAtRest, unreadableParts };
}
