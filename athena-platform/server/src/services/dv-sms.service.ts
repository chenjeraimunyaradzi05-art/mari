/**
 * The one SMS channel this platform has. It exists for a single reason.
 *
 * The panic button could only ever send email. The emergency-contact form on
 * the phone — the place a woman is most likely to set this up, and the place
 * the button matters most — asks for a name, a phone number and how she knows
 * them, and never for an email address. So every contact added from the phone
 * fell straight into `unreachableContacts`, nothing was sent to anybody, and
 * the screen still told her help had been alerted. This module is the channel
 * that can actually carry that message to a phone number.
 *
 * It is deliberately not a general-purpose messaging service. There is one
 * exported sender, it takes the finished text, and nothing here queues,
 * retries or templates. A panic alert is worth one immediate attempt and an
 * honest answer about whether it landed; a queue that retries in ten minutes
 * is no use to the woman standing in the room.
 *
 * It is off unless TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
 * TWILIO_FROM_NUMBER are all set. When it is off, `isSmsConfigured()` is false
 * and `sendSms()` refuses rather than pretending — the caller then reports the
 * contact as not reached, which is the only honest answer and the one she can
 * act on by ringing them herself.
 *
 * Nothing here logs the message body or the credentials. The body of a panic
 * alert names the member and says she is in trouble; a destination number
 * belongs to someone she chose to trust. Both stay out of the log, and the
 * number is masked where it has to appear at all.
 */

import { logger } from '../utils/logger';
import { recordFailure, recordSuccess } from '../utils/ops-metrics';

/** Twilio's REST endpoint. Form-encoded, basic auth, no SDK needed. */
const TWILIO_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

/**
 * Short on purpose. A panic alert that is still waiting on a network timeout
 * is worse than one that has already come back "not sent", because the second
 * answer tells her to pick up the phone herself.
 */
const TIMEOUT_MS = 8000;

export interface SmsResult {
  sent: boolean;
  /**
   * Why it did not go, for the log and for the caller's own reporting. Never
   * shown to a member verbatim — the caller decides what she is told.
   */
  reason?: 'not-configured' | 'unusable-number' | 'rejected' | 'failed';
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/**
 * Whether a text message can be sent at all on this deployment. Callers ask
 * before they promise anything: the panic result says `smsAvailable: false`
 * when this is false, so a client cannot draw "we texted them" over a channel
 * that does not exist.
 */
export function isSmsConfigured(): boolean {
  return twilioConfig() !== null;
}

/**
 * An Australian mobile or landline in the form Twilio will accept, or null
 * when the digits cannot be read as one.
 *
 * Emergency contacts are typed by hand on a phone, so they arrive as
 * "0400 000 000", "(07) 3000 0000", "+61 400 000 000" and every spacing in
 * between. Returning null rather than guessing matters here: a number sent to
 * the wrong place is a panic alert delivered to a stranger, and the caller
 * reports an unreadable number as not reached, which sends her to ring them
 * herself.
 */
export function toE164Australian(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  // Keep a leading + and throw away every separator people type: spaces,
  // brackets, dots and dashes.
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Already international. Trust it only if it is a plausible length; a
  // seven-digit string with a + in front of it is a typo, not a number.
  if (plus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  // 61... written without the plus, as people often do when copying a number.
  if (digits.startsWith('61') && digits.length === 11) {
    return `+${digits}`;
  }

  // The ordinary Australian form: a leading 0 and nine more digits, mobile or
  // landline with its area code.
  if (digits.startsWith('0') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }

  return null;
}

/** Enough of the number to recognise in a log line, and not enough to ring. */
function maskNumber(e164: string): string {
  return e164.length <= 5 ? '***' : `${e164.slice(0, 4)}***${e164.slice(-2)}`;
}

/**
 * Sends one text message and says plainly whether it went.
 *
 * Never throws: the caller is part-way through a panic alert to several
 * contacts, and one contact's bad number must not stop the message reaching
 * the others.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const config = twilioConfig();
  if (!config) {
    // Not an error condition. A deployment without SMS credentials is a
    // deployment whose panic button is email-only, and the caller says so.
    return { sent: false, reason: 'not-configured' };
  }

  const number = toE164Australian(to);
  if (!number) {
    logger.warn('Emergency contact number could not be read as a phone number', { length: to?.length ?? 0 });
    return { sent: false, reason: 'unusable-number' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${TWILIO_BASE}/${encodeURIComponent(config.accountSid)}/Messages.json`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: number, From: config.from, Body: body }).toString(),
    });

    if (!response.ok) {
      // Twilio's error body names the number it rejected, so only the status
      // and its own error code are kept.
      const detail = await response.text().catch(() => '');
      const code = detail.match(/"code"\s*:\s*(\d+)/)?.[1] ?? null;
      logger.error('Safety alert text message was rejected', { status: response.status, twilioCode: code, to: maskNumber(number) });
      recordFailure('dv.panic.sms', `Twilio answered ${response.status}${code ? ` (code ${code})` : ''}`);
      return { sent: false, reason: 'rejected' };
    }

    recordSuccess('dv.panic.sms');
    logger.info('Safety alert text message sent', { to: maskNumber(number) });
    return { sent: true };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    logger.error('Safety alert text message failed', {
      to: maskNumber(number),
      error: aborted ? `no answer within ${TIMEOUT_MS}ms` : error instanceof Error ? error.message : String(error),
    });
    recordFailure('dv.panic.sms', error);
    return { sent: false, reason: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

export default { isSmsConfigured, sendSms, toE164Australian };
