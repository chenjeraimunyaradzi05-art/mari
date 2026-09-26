/**
 * The people a ban was for, rather than the accounts.
 *
 * Banning an account used to suspend that one row. The person banned for
 * threatening a member could register again the same afternoon with the same
 * address and carry on, which on a platform many women use to get away from
 * someone means "banned" did not mean anything. This module is what lets a ban
 * close the door on the person: staff record one when they ban, and every
 * registration path asks it before an account is created.
 *
 * Addresses are never stored. What is kept is a keyed hash of the address in a
 * normalised form, so the table can be checked at every sign-up without being a
 * plain-text list of everyone ever banned — the kind of list that would itself
 * be worth stealing.
 *
 * The key. BANNED_IDENTITY_HASH_KEY is used when it is set, and should be: it
 * is the only thing that makes these hashes stable for the life of the
 * platform. Without it the key is derived from JWT_SECRET with a label, so the
 * two uses cannot collide — but rotating JWT_SECRET then silently unbans
 * everyone, because no stored hash will match again. That is logged loudly at
 * the first use rather than left to be discovered.
 */

import { createHmac } from 'crypto';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const DERIVATION_LABEL = 'athena:banned-identity:v1';

let warnedAboutDerivedKey = false;

function hashKey(): string {
  const dedicated = process.env.BANNED_IDENTITY_HASH_KEY;
  if (dedicated && dedicated.trim()) return dedicated.trim();

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Refusing is the only safe answer. A ban check that silently hashes with
    // an empty key would match nothing and let every banned person back in.
    throw new Error('Neither BANNED_IDENTITY_HASH_KEY nor JWT_SECRET is set, so bans cannot be checked or recorded');
  }

  if (!warnedAboutDerivedKey) {
    warnedAboutDerivedKey = true;
    logger.warn(
      'BANNED_IDENTITY_HASH_KEY is not set; ban hashes are derived from JWT_SECRET. Rotating JWT_SECRET will unban everyone. Set a dedicated key.'
    );
  }
  return createHmac('sha256', jwtSecret).update(DERIVATION_LABEL).digest('hex');
}

/**
 * The address as the ban should see it.
 *
 * Case and surrounding whitespace never make a different mailbox. A "+tag" is
 * a different spelling of the same inbox at essentially every provider, so it
 * is dropped. Gmail also ignores dots in the local part; that rule is applied
 * to Gmail only, because at other providers a dot can be a different person.
 * None of this stops someone who opens a genuinely new mailbox — nothing an
 * email check does can — but it does stop the one-character change.
 */
export function normaliseEmailForBan(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);

  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('.').join('');

  return `${local}@${domain}`;
}

export function hashEmailForBan(email: string): string {
  return createHmac('sha256', hashKey()).update(normaliseEmailForBan(email)).digest('hex');
}

/** Whether this address belongs to someone who has been banned. */
export async function isBannedEmail(email: string): Promise<boolean> {
  const found = await prisma.bannedIdentity.findUnique({
    where: { emailHash: hashEmailForBan(email) },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Records that this address may not come back.
 *
 * Idempotent on the address, so banning the same person twice — or a second
 * account of hers — updates nothing and raises nothing.
 */
export async function recordBannedIdentity(input: {
  email: string;
  userId?: string | null;
  reportId?: string | null;
  createdById: string;
  reason?: string | null;
}): Promise<void> {
  const emailHash = hashEmailForBan(input.email);
  await prisma.bannedIdentity.upsert({
    where: { emailHash },
    create: {
      emailHash,
      userId: input.userId ?? null,
      reportId: input.reportId ?? null,
      createdById: input.createdById,
      reason: input.reason ?? null,
    },
    update: {},
  });
}

/**
 * The wording a refused registration gets.
 *
 * Deliberately says no more than that the address cannot be used. Confirming
 * "this address was banned" would tell anyone who typed someone else's address
 * into the sign-up form that the owner had been banned.
 */
export const BANNED_REGISTRATION_MESSAGE =
  'An account cannot be created with this email address. If you think this is a mistake, contact support.';
