/**
 * Who to contact, and under what legal name — in one place.
 *
 * ## Why this exists
 *
 * The app published ten different `@athena.com` mailboxes — support, privacy,
 * dpo, legal, regulatory, copyright, disputes, sales, founder — across marketing
 * pages, the privacy centre and the binding legal documents. ATHENA does not own
 * athena.com. Production still deploys to a Netlify subdomain, so no custom
 * domain exists yet.
 *
 * That is not a cosmetic problem. `privacy@athena.com` and `dpo@athena.com` were
 * published as the statutory contact points for data-subject requests, so a
 * member exercising a GDPR right would have sent their identity documents and
 * their request to a stranger's mail server, and ATHENA would never have seen
 * it — an unanswered DSAR is itself a breach.
 *
 * ## The rule this module enforces
 *
 * An address is only ever rendered for a domain we actually own. Until
 * NEXT_PUBLIC_CONTACT_DOMAIN is set, every contact point resolves to an
 * in-product route that genuinely works instead — routes which, unlike a
 * stranger's inbox, reach the team.
 *
 * When the domain is bought, set NEXT_PUBLIC_CONTACT_DOMAIN and every surface
 * switches over at once. Nothing else needs editing.
 */

function cleanEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The domain we own. Deliberately unset by default: a wrong value here is worse
 * than no value, because it silently sends legal correspondence elsewhere.
 */
export const CONTACT_DOMAIN = cleanEnv(process.env.NEXT_PUBLIC_CONTACT_DOMAIN);

/** Whether we can publish email addresses at all. */
export const HAS_OWNED_DOMAIN = CONTACT_DOMAIN !== null;

/**
 * Legal identity. `ATHENA Platform Pty Ltd` is asserted in the terms of service
 * already; the ABN and registered office are NOT invented here. Australian
 * consumer law requires a real registered office for formal notices, and
 * terms.md is honest that one will be published before launch — so these stay
 * null until someone supplies the real values.
 */
export const ORGANISATION = {
  legalName: 'ATHENA Platform Pty Ltd',
  shortName: 'ATHENA',
  abn: cleanEnv(process.env.NEXT_PUBLIC_ORG_ABN),
  acn: cleanEnv(process.env.NEXT_PUBLIC_ORG_ACN),
  registeredOffice: cleanEnv(process.env.NEXT_PUBLIC_ORG_ADDRESS),
  jurisdiction: 'Queensland, Australia',
} as const;

/** True once the company details a customer could serve notice at are published. */
export const HAS_LEGAL_IDENTITY =
  ORGANISATION.abn !== null && ORGANISATION.registeredOffice !== null;

export type Mailbox =
  | 'support'
  | 'privacy'
  | 'dpo'
  | 'legal'
  | 'regulatory'
  | 'copyright'
  | 'disputes'
  | 'sales'
  | 'founder';

/**
 * Where each contact point goes when we cannot publish an address. These are
 * real, working routes — verified against the app's route table — not
 * aspirations.
 */
const IN_PRODUCT_ROUTE: Record<Mailbox, { href: string; label: string }> = {
  support: { href: '/help', label: 'Visit the help centre' },
  privacy: { href: '/privacy-center', label: 'Open the privacy centre' },
  dpo: { href: '/privacy-center', label: 'Open the privacy centre' },
  legal: { href: '/contact', label: 'Contact us' },
  regulatory: { href: '/contact', label: 'Contact us' },
  copyright: { href: '/report', label: 'Report it' },
  disputes: { href: '/help/appeal', label: 'Appeal a decision' },
  sales: { href: '/contact-sales', label: 'Talk to us' },
  founder: { href: '/contact', label: 'Contact us' },
};

const LOCAL_PART: Record<Mailbox, string> = {
  support: 'support',
  privacy: 'privacy',
  dpo: 'dpo',
  legal: 'legal',
  regulatory: 'regulatory',
  copyright: 'copyright',
  disputes: 'disputes',
  sales: 'sales',
  founder: 'hello',
};

/** The address, or null when we have no domain to put it on. */
export function contactEmail(box: Mailbox): string | null {
  return CONTACT_DOMAIN ? `${LOCAL_PART[box]}@${CONTACT_DOMAIN}` : null;
}

/**
 * An href and a label that are always safe to render: a mailto once we own a
 * domain, otherwise the in-product route that actually reaches someone.
 */
export function contactLink(
  box: Mailbox,
  options: { subject?: string } = {}
): { href: string; label: string; isEmail: boolean } {
  const email = contactEmail(box);
  if (email) {
    const query = options.subject ? `?subject=${encodeURIComponent(options.subject)}` : '';
    return { href: `mailto:${email}${query}`, label: email, isEmail: true };
  }
  return { ...IN_PRODUCT_ROUTE[box], isEmail: false };
}

/**
 * The public site origin. Falls back to the deployed app URL rather than naming
 * a domain we do not control.
 */
export function siteOrigin(): string {
  if (CONTACT_DOMAIN) return `https://${CONTACT_DOMAIN}`;
  return cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || '';
}

/** The API origin quoted in developer documentation. */
export function apiOrigin(): string {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_API_URL) ||
    (CONTACT_DOMAIN ? `https://api.${CONTACT_DOMAIN}` : '')
  );
}

/**
 * Substitutes the tokens used by the legal markdown in src/content/legal.
 *
 * Those documents are contractual, so they cannot hardcode a domain we do not
 * own, and they must not silently render an empty string where a company
 * address belongs. Anything still unknown resolves to an explicit
 * "to be published before launch" so a reader can see it is outstanding rather
 * than reading a sentence with a hole in it.
 */
export function renderLegalTokens(markdown: string): string {
  const pending = 'to be published before public launch';

  /**
   * A full contact line, so the document never reads "Email: the privacy
   * centre". When an address exists it is labelled as an email; when one does
   * not, the sentence names the route instead and stays grammatical.
   */
  const line = (box: Mailbox, route: string, description: string): string => {
    const email = contactEmail(box);
    return email ? `Email: ${email}` : `${description} — ${route}`;
  };

  const values: Record<string, string> = {
    'org.legalName': ORGANISATION.legalName,
    'org.shortName': ORGANISATION.shortName,
    'org.abn': ORGANISATION.abn ? `ABN ${ORGANISATION.abn}` : `ABN ${pending}`,
    'org.address': ORGANISATION.registeredOffice ?? `Registered office ${pending}`,
    'org.jurisdiction': ORGANISATION.jurisdiction,
    'site.domain': CONTACT_DOMAIN ?? (siteOrigin().replace(/^https?:\/\//, '') || pending),

    // Whole lines, used where the document is listing a way to reach us.
    'contact.privacy': line('privacy', '/privacy-center', 'Through the privacy centre'),
    'contact.dpo': line('dpo', '/privacy-center', 'Through the privacy centre'),
    'contact.support': line('support', '/help', 'Through the help centre'),
    'contact.legal': line('legal', '/contact', 'Through the contact form'),
    'contact.copyright': line('copyright', '/report', 'Through the report form'),

    // Bare values, used mid-sentence.
    'email.privacy': contactEmail('privacy') ?? 'the privacy centre at /privacy-center',
    'email.dpo': contactEmail('dpo') ?? 'the privacy centre at /privacy-center',
    'email.support': contactEmail('support') ?? 'the help centre at /help',
    'email.legal': contactEmail('legal') ?? 'the contact form at /contact',
    'email.copyright': contactEmail('copyright') ?? 'the report form at /report',
  };

  return markdown.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole
  );
}
