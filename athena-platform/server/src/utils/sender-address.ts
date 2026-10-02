/**
 * Whether SENDGRID_FROM_EMAIL names a mailbox ATHENA could actually send from.
 *
 * The sender used to default to noreply@athena.com, a domain the venture does
 * not own (client/src/lib/contact.ts and config/region.config.ts both say so).
 * SendGrid refuses a message from a sender it has not authenticated, so a
 * deployment that never set the variable looked configured and could not send a
 * single verification or reset email; and one that did set it from a template
 * sent from a domain nobody here can put DNS records on, which no receiving
 * server will believe.
 *
 * A variable cannot prove a domain is authenticated with SendGrid; the first
 * send does, and the auth-email failure alert makes a refusal visible within
 * minutes. What a variable can prove is that the value is a single plain
 * address and is not one of the well-known domains that belong to someone else
 * or to nobody. That is all this checks.
 */

/**
 * Domains that are never ours to send from. A subdomain of any of them is
 * refused too: mail.athena.com is as unowned as athena.com.
 */
const UNOWNED_SENDER_DOMAINS = [
  'athena.com',
  // The billing mailbox used to default to billing@athena.app. The mobile build
  // config records that this domain resolves to third-party infrastructure.
  'athena.app',
  'example.com',
  'example.org',
  'example.net',
  'example.invalid',
  'your-domain.com',
  'yourdomain.com',
  'domain.com',
  'localhost',
  'invalid',
  'test',
];

/** One mailbox: no display name, no list, no angle brackets, a dotted domain. */
const PLAIN_MAILBOX = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})$/;

/**
 * Why this cannot be used as the From address, or null when it can. The reason
 * is written to be read by whoever is setting the variable.
 */
export function senderAddressProblem(value: string | undefined | null): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'is not set';

  const match = PLAIN_MAILBOX.exec(trimmed);
  if (!match) return 'is not a single plain email address such as noreply@mail.your-own-domain.example';

  const domain = match[1].toLowerCase();
  const unowned = UNOWNED_SENDER_DOMAINS.find((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
  if (unowned) {
    return `uses ${unowned}, which is not a domain ATHENA owns, so SendGrid will not send from it`;
  }
  return null;
}

/** Whether the value could be a verified sender. */
export function isUsableSenderAddress(value: string | undefined | null): boolean {
  return senderAddressProblem(value) === null;
}
