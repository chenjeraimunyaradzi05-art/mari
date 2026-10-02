/**
 * What SendGrid tells us about addresses it could not deliver to, and the proof
 * that it was SendGrid that told us.
 *
 * Until this existed nothing here ever learned that a message had bounced. A
 * mistyped address at sign-up left an account nobody could confirm, mailed again
 * by every resend; a closed mailbox went on being sent password resets; and a
 * member who marked our mail as spam was mailed again, which is what damages the
 * sender's name with every inbox provider and ends with real members' mail going
 * to junk. The Event Webhook is how SendGrid reports these, and a row in
 * EmailSuppression is how the sender (utils/email.ts) stops.
 *
 * Only what is permanent is recorded. A temporary block (a full mailbox, a
 * greylisting, a provider that is slow today) is not a reason to stop writing to
 * somebody for good, and recording one would lock a real member out of her own
 * password reset.
 */

import crypto from 'crypto';
import { prisma } from '../utils/prisma';

export type SuppressionReason = 'bounce' | 'dropped' | 'spamreport';

export interface SuppressionEntry {
  email: string;
  reason: SuppressionReason;
}

/** An address as it is stored and looked up: trimmed and lower-case. */
export function normaliseAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim().toLowerCase();
  // Not a validator, only a guard against writing garbage into a unique column:
  // one @, something either side, no spaces, within the length an address can have.
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(address)) return null;
  return address;
}

/**
 * Whether `signature` is SendGrid's signature of this exact delivery.
 *
 * SendGrid signs the timestamp followed by the raw request body with an ECDSA
 * key (P-256, SHA-256) and shows the matching public key, base64 of its DER
 * encoding, when the Signed Event Webhook is switched on. The body has to be the
 * bytes that arrived: parsing and re-serialising it changes them, which is why
 * the route reads it raw.
 *
 * There is no freshness window on the timestamp. The effect of a replayed
 * delivery is a suppression that is already there, and a window would turn a
 * receiver outage into events SendGrid retries and we keep refusing.
 *
 * Never throws: a key or signature that cannot be read is a failed check.
 */
export function verifySendGridSignature(
  publicKey: string,
  rawBody: Buffer,
  signature: string,
  timestamp: string
): boolean {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey.trim(), 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      'sha256',
      Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]),
      key,
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * The reasons SendGrid gives for dropping a message that are about the address
 * and so will be the same next time. Others (a spam-filter hit on the content,
 * an unsubscribed group) are about the message or the member's choice, and
 * suppressing the address for them would be wrong.
 */
const ADDRESS_LEVEL_DROP = /bounced address|spam reporting address|invalid/i;

/**
 * The events in one Event Webhook delivery that mean "do not write to this
 * address again", and nothing else. Delivered, opened, clicked, deferred and
 * processed events, and blocks, are skipped.
 */
export function suppressionsFromEvents(events: unknown): SuppressionEntry[] {
  if (!Array.isArray(events)) return [];

  const found = new Map<string, SuppressionEntry>();
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const event = raw as Record<string, unknown>;
    const email = normaliseAddress(event.email);
    if (!email) continue;

    let reason: SuppressionReason | null = null;
    if (event.event === 'bounce') {
      // "blocked" is the receiving server refusing for now, not the mailbox
      // being gone, and a 4.x.x status is a temporary failure by definition.
      const status = typeof event.status === 'string' ? event.status : '';
      if (event.type !== 'blocked' && !status.startsWith('4')) reason = 'bounce';
    } else if (event.event === 'dropped') {
      if (typeof event.reason === 'string' && ADDRESS_LEVEL_DROP.test(event.reason)) reason = 'dropped';
    } else if (event.event === 'spamreport') {
      reason = 'spamreport';
    }

    if (reason) found.set(email, { email, reason });
  }
  return Array.from(found.values());
}

/**
 * Writes the suppressions, one row per address. An address already on the list
 * keeps its row and takes the newest reason, so the same delivery arriving
 * twice, which SendGrid does whenever it is not sure we received it, writes
 * nothing new. Returns how many addresses were handled.
 */
export async function recordSuppressions(entries: SuppressionEntry[]): Promise<number> {
  for (const entry of entries) {
    await prisma.emailSuppression.upsert({
      where: { email: entry.email },
      create: { email: entry.email, reason: entry.reason, source: 'sendgrid' },
      update: { reason: entry.reason },
    });
  }
  return entries.length;
}
