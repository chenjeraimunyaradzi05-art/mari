/**
 * What the wellness pillar does when a woman's own words suggest she may be at
 * risk of harming herself: put the crisis lines in front of her, and, where
 * other people can read what she wrote, tell staff.
 *
 * This lived as one block inside the route that creates a forum post, so it was
 * the only place in the pillar that did either. A reply, an edit, a support
 * circle's check-in and a circle's own description were written, shown to other
 * members, and never looked at: a woman writing "I can't go on" in a reply to
 * somebody else's thread was not shown a number and raised nothing.
 *
 * Two kinds of surface, and the difference is a promise to her.
 *
 * - Shared: a forum post or reply, a circle's check-in, name or description.
 *   Other members, or staff, can read it. The answer carries the lines, and a
 *   HIGH safety concern is raised for staff (raiseWellnessCrisisFlag).
 * - Private: a mental load task, a daily check-in's note. The wellness pages
 *   tell her these are shown to nobody but her unless she shares them (no other
 *   member, no moderator or admin screen; a practitioner only through a share
 *   link she made), so the answer carries the lines and nothing is raised. A
 *   flag from a private record would break the promise on the page, and she
 *   would stop writing in it, which is the opposite of help.
 *
 * It is a phrase screen. It reaches for the lines; it never blocks, rewrites or
 * refuses what she wrote (see detectCrisisLanguage).
 */

import { prisma } from '../../utils/prisma';
import { bestEffort } from '../../utils/best-effort';
import { notifyAdmins } from '../admin-notify.service';
import { detectCrisisLanguage, type CrisisCheck } from './forum.service';
import { distressLines, type CrisisLine } from './wellness-library';

/** Where the words were, in the words staff read. */
export type CrisisSurface =
  | 'forum post'
  | 'forum post edit'
  | 'forum reply'
  | 'forum reply edit'
  | 'support circle check-in'
  | 'support circle name or description';

/** What the response to her carries: nothing when calm, the lines when not. */
export type CrisisAnswer = { flagged: false } | { flagged: true; message: string; lines: CrisisLine[] };

/** Screen several pieces of her text as one. Empty and missing pieces are skipped. */
export function screenText(...texts: Array<string | null | undefined>): CrisisCheck {
  return detectCrisisLanguage(texts.filter((text): text is string => typeof text === 'string' && text.trim().length > 0).join('\n'));
}

const HARD = 'It sounds like things are very hard right now.';
const LINES_NOW = 'These lines are staffed this minute.';

/**
 * The answer for a shared surface. It says what is true: it is saved or up, and,
 * only if the concern really was put in front of staff (`told`), that because
 * other people can read it a moderator has been told too. The flag is best
 * effort, so a database that refused it must not leave her reading a sentence
 * that is not so; she still has the lines either way. Nothing she wrote, and no
 * name, goes to the moderator in the notification; the words stay where she put
 * them.
 */
export function sharedCrisisAnswer(check: CrisisCheck, saved: string, told: boolean): CrisisAnswer {
  if (!check.flagged) return { flagged: false };
  return {
    flagged: true,
    message: `${HARD} ${saved} ${LINES_NOW}${told ? ' Because others can read it, a moderator has been told too.' : ''}`,
    lines: distressLines(),
  };
}

/**
 * The answer for a private record. Nobody else has been told and the answer
 * says so, because that is the promise the page makes and the reason she wrote
 * it there.
 *
 * It used to say "only you can read it". A check-in note is encrypted before it
 * is stored, but ATHENA's servers hold the key and open it to show it to her,
 * and a mental load task is stored as she typed it; neither is something only
 * she can read, and docs/runbooks/ENCRYPTION.md bans the phrase for that
 * reason. What is true, and what she needs to hear, is that it is hers alone on
 * ATHENA: not shown to any other member or to staff, and nothing was raised.
 *
 * "Unless you share it" is not a hedge. A practitioner share link whose scope
 * includes the mental load (GET /api/wellness/share/:token) lists the tasks she
 * logged, this one among them if the link is open when she logs it, so a
 * sentence without the qualifier would be untrue for the very record this
 * answer is about. It is the same sentence every wellness page uses.
 */
export function privateCrisisAnswer(check: CrisisCheck): CrisisAnswer {
  if (!check.flagged) return { flagged: false };
  return {
    flagged: true,
    message: `${HARD} What you wrote is saved and is shown to nobody but you unless you share it; nobody has been told. ${LINES_NOW}`,
    lines: distressLines(),
  };
}

/**
 * Raises the staff safety concern for words on a shared surface: a HIGH
 * SAFETY_CONCERN AdminFlag on her account, and a note to the admins.
 *
 * flaggedById is 'system' because nobody reported this; a phrase matched, as in
 * raiseChatCrisisFlag (ai-safety.service). `notes` carries where it was, the
 * record's id, and the phrases that matched, never the sentence around them: a
 * staff member who needs the context opens the post, where it is, and a circle
 * check-in, which staff cannot open, is not copied into an admin table to give
 * them any.
 *
 * bestEffort, because her post, reply or check-in is already saved and the
 * answer with the lines in it must reach her whatever the database does; a flag
 * that could not be written lands in the log under its label. It answers whether
 * the flag was written, so that what she is told afterwards (see
 * sharedCrisisAnswer) is never "a moderator has been told" when none was. The
 * admins' note is a second, separate best effort: the flag is in the queue staff
 * work whether or not the bell rang, and a bell that failed does not un-raise it.
 */
export async function raiseWellnessCrisisFlag(
  userId: string | undefined,
  input: { surface: CrisisSurface; resourceId: string; matches: string[] }
): Promise<boolean> {
  // Every caller is behind `authenticate`; a request with no member on it has no
  // account to raise a concern about.
  if (!userId) return false;
  const flag = await bestEffort(
    'wellness crisis safety flag',
    () =>
      prisma.adminFlag.create({
        data: {
          userId,
          type: 'SAFETY_CONCERN',
          severity: 'HIGH',
          flaggedById: 'system',
          reason: `Language about suicide or self-harm in a wellness ${input.surface}; the crisis lines were shown to the author`,
          notes: `${input.surface} ${input.resourceId}${input.matches.length ? `. Matched: ${input.matches.join(', ')}` : ''}`,
        },
      }),
    null
  );
  if (!flag) return false;
  // Raising the flag used to be the whole of the response, and AdminFlag had
  // no reader at all: a HIGH row nobody would open. It is a queue staff work
  // now (GET /api/safety/moderation/flags, shown above the report queue at
  // /admin/moderation), and raising one tells the admins, as every other
  // urgent queue here does. No name and none of her words in the message: it
  // lands in every admin's inbox, while the account sits behind the staff role.
  // notifyAdmins never throws; it logs what it could not do.
  await notifyAdmins({
    title: 'A safety concern needs a person now',
    message: `A wellness ${input.surface} used language about suicide or self-harm. The crisis lines were shown to the author. It is waiting at the top of the safety queue.`,
    link: '/admin/moderation#safety-concerns',
    data: { flagId: flag.id, flagType: 'SAFETY_CONCERN', severity: 'HIGH' },
  });
  return true;
}

/**
 * Screen-and-answer for words on a shared surface, in one call: nothing for calm
 * words, and for words that sound like crisis the staff flag and then the answer,
 * which says a moderator has been told only if the flag was written.
 */
export async function answerSharedWords(
  userId: string | undefined,
  check: CrisisCheck,
  where: { surface: CrisisSurface; resourceId: string },
  saved: string
): Promise<CrisisAnswer> {
  if (!check.flagged) return { flagged: false };
  const told = await raiseWellnessCrisisFlag(userId, { ...where, matches: check.matches });
  return sharedCrisisAnswer(check, saved, told);
}
