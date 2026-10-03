/**
 * The rules behind the verification badges, in code rather than in a reviewer's
 * head.
 *
 * A badge is a statement to other members: this was checked. It only means
 * something if the thing that issues it can say what it checked, and if a
 * member cannot write the answer herself. Three things live here.
 *
 *  1. What an application may carry. The member's own words (an organisation,
 *     a role, a link) go in; the fields ATHENA writes about a check (the
 *     provider, the Stripe session, whether a document passed) are refused.
 *     They used to be stored exactly as sent, so a member could put
 *     `provider: stripe_identity` and a `documentCheckPassedAt` into a badge
 *     and the reviewer would read it as Stripe's evidence.
 *
 *  2. Who may apply at all, where ATHENA holds the facts. A creator badge is
 *     for 10,000 followers and 90 days on the platform, and both are counted
 *     from the follower rows and the account's own creation date. The mentor
 *     badge has no rule: nothing here can check a mentor's background, so it is
 *     reviewed by a person and called that.
 *
 *  3. What a reviewer is shown. For an employer or educator badge the
 *     applicant's confirmed email domain is set against the organisation's
 *     website, and the ABN is checked against its checksum and, when the ABR
 *     is configured, against the register. These are prompts for the person who
 *     decides; none of them approves anything.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { digitsOnly, isConfigured as abrIsConfigured, isValidAbn, lookupAbn } from './abr.service';

export type BadgeType = 'IDENTITY' | 'EMPLOYER' | 'EDUCATOR' | 'MENTOR' | 'CREATOR';

// ------------------------------------------------------------------ metadata

/**
 * Fields ATHENA itself writes onto a badge when it records a check, or that
 * the women-only review reads as evidence. An application that names one is
 * refused rather than quietly trimmed: nobody fills these in by accident.
 */
export const RESERVED_BADGE_METADATA_KEYS: readonly string[] = [
  'purpose',
  'provider',
  'sessionId',
  'startedAt',
  'submittedAt',
  'documentCheckPassedAt',
  'documentName',
  'documentType',
  'documentAgeFlag',
  'redactedAt',
  'statement',
];

const ORGANISATION_FIELDS = ['organisation', 'role', 'evidenceUrl', 'organizationId', 'organizationName', 'abn', 'website'];

/** What a member may say in an application for each badge. Anything else is dropped. */
const ALLOWED_BADGE_METADATA_KEYS: Record<BadgeType, readonly string[]> = {
  IDENTITY: ['note'],
  EMPLOYER: ORGANISATION_FIELDS,
  EDUCATOR: ORGANISATION_FIELDS,
  MENTOR: ['role', 'evidenceUrl', 'note'],
  CREATOR: ['evidenceUrl', 'note'],
};

const LINK_FIELDS = new Set(['evidenceUrl', 'website']);
const MAX_TEXT_LENGTH = 300;
const MAX_LINK_LENGTH = 500;

/**
 * The metadata that may be stored for an application, or a 400 saying why not.
 * Returns undefined when nothing usable was sent, so the column stays empty
 * rather than holding `{}`.
 */
export function sanitiseBadgeMetadata(type: BadgeType, metadata: unknown): Record<string, string> | undefined {
  if (metadata === undefined || metadata === null) return undefined;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ApiError(400, 'The application details must be a set of named fields');
  }

  const input = metadata as Record<string, unknown>;
  const reserved = RESERVED_BADGE_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (reserved.length > 0) {
    throw new ApiError(400, `${reserved.join(', ')} can only be set by ATHENA when it records a check, not in an application`);
  }

  const allowed = new Set(ALLOWED_BADGE_METADATA_KEYS[type]);
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string') {
      throw new ApiError(400, `${key} must be text`);
    }
    const text = value.trim();
    if (!text) continue;
    const limit = LINK_FIELDS.has(key) ? MAX_LINK_LENGTH : MAX_TEXT_LENGTH;
    if (text.length > limit) {
      throw new ApiError(400, `${key} is too long (most ${limit} characters)`);
    }
    clean[key] = text;
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

// ------------------------------------------------------------------- creator

export const CREATOR_MIN_FOLLOWERS = 10_000;
export const CREATOR_MIN_ACCOUNT_AGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CreatorEligibility = {
  eligible: boolean;
  followers: number;
  minFollowers: number;
  accountAgeDays: number;
  minAccountAgeDays: number;
};

/**
 * Whether this member has the audience and the history the creator badge is
 * for. Followers are counted from the Follow rows, because
 * CreatorProfile.followerCount is a column nothing writes, and the history is
 * the age of the account on ATHENA, the only history this platform can see.
 */
export async function creatorEligibility(userId: string, now: Date = new Date()): Promise<CreatorEligibility> {
  const [user, followers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.follow.count({ where: { followingId: userId } }),
  ]);
  const accountAgeDays = user ? Math.max(0, Math.floor((now.getTime() - user.createdAt.getTime()) / DAY_MS)) : 0;

  return {
    eligible: Boolean(user) && followers >= CREATOR_MIN_FOLLOWERS && accountAgeDays >= CREATOR_MIN_ACCOUNT_AGE_DAYS,
    followers,
    minFollowers: CREATOR_MIN_FOLLOWERS,
    accountAgeDays,
    minAccountAgeDays: CREATOR_MIN_ACCOUNT_AGE_DAYS,
  };
}

/**
 * Why an account does not meet the creator rule, in words that read the same to
 * the member applying and to the reviewer deciding.
 */
export function creatorRefusal(eligibility: CreatorEligibility): string {
  const needs: string[] = [];
  if (eligibility.followers < eligibility.minFollowers) {
    needs.push(
      `${eligibility.minFollowers.toLocaleString('en-AU')} followers on ATHENA (this account has ${eligibility.followers.toLocaleString('en-AU')})`
    );
  }
  if (eligibility.accountAgeDays < eligibility.minAccountAgeDays) {
    needs.push(`at least ${eligibility.minAccountAgeDays} days on ATHENA (this account is ${eligibility.accountAgeDays} days old)`);
  }
  return `The creator badge is for accounts with ${needs.join(' and ')}.`;
}

// ------------------------------------------------------------ reviewer's checks

export type ReviewerCheck = {
  key: 'email-domain' | 'abn';
  label: string;
  /**
   * `pass` is a match worth a reviewer's trust, `warn` is something to look at
   * before approving, `info` is context, and `unavailable` is a check that
   * could not be run (not a failed one).
   */
  status: 'pass' | 'warn' | 'info' | 'unavailable';
  detail: string;
};

/** Mail providers anyone can open an address with, so the domain says nothing about an employer. */
const PERSONAL_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.au',
  'ymail.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'bigpond.com',
  'bigpond.net.au',
  'optusnet.com.au',
  'iinet.net.au',
  'tpg.com.au',
]);

/** A host from a website or link as people type it, with "www." and any port removed. */
export function hostOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

/** True when two hosts are the same organisation's: equal, or one is a subdomain of the other. */
export function sameOrganisationHost(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export function emailDomainCheck(args: {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
  websites: Array<string | null | undefined>;
}): ReviewerCheck {
  const label = 'Her confirmed email address against the organisation\'s website';
  const domain = typeof args.email === 'string' && args.email.includes('@') ? args.email.split('@').pop()!.toLowerCase() : null;
  if (!domain) return { key: 'email-domain', label, status: 'unavailable', detail: 'There is no email address on the account to compare.' };

  if (!args.emailVerified) {
    return {
      key: 'email-domain',
      label,
      status: 'warn',
      detail: `Her email address (${domain}) has not been confirmed, so it proves nothing about where she works.`,
    };
  }
  if (PERSONAL_MAIL_DOMAINS.has(domain)) {
    return {
      key: 'email-domain',
      label,
      status: 'warn',
      detail: `She applied from a personal mail provider (${domain}), which anyone can open, so the address does not show she works there. Ask for evidence another way.`,
    };
  }

  const hosts = args.websites.map(hostOf).filter((host): host is string => Boolean(host));
  if (hosts.length === 0) {
    return {
      key: 'email-domain',
      label,
      status: 'info',
      detail: `Her confirmed address is at ${domain}, but there is no website on the application or the organisation page to compare it with.`,
    };
  }
  const match = hosts.find((host) => sameOrganisationHost(domain, host));
  if (match) {
    return {
      key: 'email-domain',
      label,
      status: 'pass',
      detail: `Her confirmed address is at ${domain}, which matches the website (${match}).`,
    };
  }
  return {
    key: 'email-domain',
    label,
    status: 'warn',
    detail: `Her confirmed address is at ${domain}, which does not match the website (${hosts.join(', ')}).`,
  };
}

const normaliseName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|incorporated|the|trust|trading|as)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function namesAgree(claimed: string, registered: string[]): boolean {
  const wanted = normaliseName(claimed);
  if (!wanted) return false;
  return registered.some((name) => {
    const candidate = normaliseName(name);
    return Boolean(candidate) && (candidate.includes(wanted) || wanted.includes(candidate));
  });
}

export async function abnCheck(args: {
  abn: string | null | undefined;
  organisationName: string | null | undefined;
}): Promise<ReviewerCheck> {
  const label = 'ABN';
  const abn = digitsOnly(args.abn);
  if (!abn) return { key: 'abn', label, status: 'info', detail: 'No ABN was given on the application.' };
  if (!isValidAbn(abn)) {
    return { key: 'abn', label, status: 'warn', detail: `${abn} is not a valid ABN: it fails the ABN checksum, so it is mistyped or invented.` };
  }
  if (!abrIsConfigured()) {
    return {
      key: 'abn',
      label,
      status: 'info',
      detail: `${abn} has a valid ABN checksum. The live register lookup is not switched on for this server (ABR_GUID), so check it on ABN Lookup.`,
    };
  }

  let entity: Awaited<ReturnType<typeof lookupAbn>>;
  try {
    entity = await lookupAbn(abn);
  } catch (error) {
    const reason = error instanceof ApiError ? error.message : 'The register did not answer.';
    return { key: 'abn', label, status: 'unavailable', detail: `${reason} Check ${abn} on ABN Lookup.` };
  }
  if (!entity) {
    return { key: 'abn', label, status: 'warn', detail: `${abn} has a valid checksum but the register has no record of it.` };
  }

  const registered = [entity.entityName, ...entity.businessNames].filter(Boolean);
  const active = /^active$/i.test(entity.abnStatus);
  if (!active) {
    return {
      key: 'abn',
      label,
      status: 'warn',
      detail: `The register lists ${entity.entityName || abn} with the status "${entity.abnStatus}", not Active.`,
    };
  }
  if (args.organisationName && !namesAgree(args.organisationName, registered)) {
    return {
      key: 'abn',
      label,
      status: 'warn',
      detail: `Active on the register as ${registered.join(' / ')}, which does not look like "${args.organisationName}".`,
    };
  }
  return {
    key: 'abn',
    label,
    status: 'pass',
    detail: `Active on the register as ${registered.join(' / ') || abn}${entity.state ? ` (${entity.state})` : ''}.`,
  };
}

/**
 * What can be checked for a badge from what ATHENA already holds. Only the
 * employer and educator badges have anything: the others have no data to check
 * against, and say so by returning no checks.
 */
export async function reviewerChecks(badge: {
  type: string;
  metadata: unknown;
  user: { email: string | null; emailVerified: boolean | null };
}): Promise<ReviewerCheck[]> {
  if (badge.type !== 'EMPLOYER' && badge.type !== 'EDUCATOR') return [];

  const metadata =
    badge.metadata && typeof badge.metadata === 'object' && !Array.isArray(badge.metadata)
      ? (badge.metadata as Record<string, unknown>)
      : {};
  const text = (key: string): string | null => {
    const value = metadata[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  const organizationId = text('organizationId');
  const organisation = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, website: true, abn: true },
      })
    : null;

  // The website she gave and the one on the organisation's own page. Not the
  // "where we can confirm it" link, which is as often a LinkedIn page as a
  // company site and would make an unrelated host look like a mismatch.
  const websites = [text('website'), organisation?.website];

  return [
    emailDomainCheck({ email: badge.user.email, emailVerified: badge.user.emailVerified, websites }),
    await abnCheck({
      abn: text('abn') ?? organisation?.abn,
      organisationName: text('organizationName') ?? organisation?.name ?? text('organisation'),
    }),
  ];
}
