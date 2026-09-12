/**
 * The mental health forums: what a post looks like to a reader when the
 * author chose to be anonymous, the crisis language that puts the lines
 * in front of the author the moment she posts, and the content warnings
 * a reader can choose to keep folded.
 */

import { CONTENT_WARNINGS, PRACTITIONER_KINDS } from './wellness-library';

export interface AuthorLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  role?: string | null;
  /** A verified practitioner profile, when the author has one. */
  practitionerProfile?: { isVerified: boolean; kind: string } | null;
}

export interface PublicAuthor {
  id: string | null;
  name: string;
  avatar: string | null;
  isAnonymous: boolean;
  isYou: boolean;
  isModerator: boolean;
  /** A registered practitioner whose profile the platform has verified. Never shown on an anonymous post. */
  isPractitioner: boolean;
  practitionerKind: string | null;
}

/**
 * An anonymous author is "A member" to everyone, and "You (anonymous)" to
 * herself. A verified practitioner is marked as one, so a reader can tell
 * a professional's reply from a peer's without anyone being diagnosed.
 */
export function presentAuthor(author: AuthorLike, isAnonymous: boolean, viewerId: string | null, isModerator = false): PublicAuthor {
  const isYou = viewerId !== null && author.id === viewerId;
  if (isAnonymous) {
    return { id: null, name: isYou ? 'You, anonymously' : 'A member', avatar: null, isAnonymous: true, isYou, isModerator: false, isPractitioner: false, practitionerKind: null };
  }
  const name = author.displayName || [author.firstName, author.lastName].filter(Boolean).join(' ') || 'A member';
  const profile = author.practitionerProfile && author.practitionerProfile.isVerified && author.practitionerProfile.kind !== 'SERVICE' ? author.practitionerProfile : null;
  const kindLabel = profile ? PRACTITIONER_KINDS.find((k) => k.key === profile.kind)?.label ?? profile.kind : null;
  return { id: author.id, name, avatar: author.avatar ?? null, isAnonymous: false, isYou, isModerator, isPractitioner: Boolean(profile), practitionerKind: kindLabel };
}

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill(ing)?\s+myself|end\s+(it\s+all|my\s+life)|take\s+my\s+(own\s+)?life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanted|wanting|going)\s+to\s+die\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(be\s+here|live|wake\s+up|go\s+on)\b/i,
  /\b(self[-\s]?harm(ing)?|hurt(ing)?\s+myself|cut(ting)?\s+myself)\b/i,
  /\b(overdos(e|ing)|no\s+reason\s+to\s+(live|go\s+on)|better\s+off\s+(dead|without\s+me))\b/i,
  /\b(can'?t|cannot)\s+(go\s+on|do\s+this\s+any\s*more)\b/i,
];

export interface CrisisCheck {
  flagged: boolean;
  matches: string[];
}

/** A conservative screen for language about suicide or self-harm. It reaches for the lines, it never blocks. */
export function detectCrisisLanguage(text: string): CrisisCheck {
  const matches: string[] = [];
  for (const p of CRISIS_PATTERNS) {
    const m = text.match(p);
    if (m) matches.push(m[0].toLowerCase().replace(/\s+/g, ' '));
  }
  return { flagged: matches.length > 0, matches: Array.from(new Set(matches)) };
}

export function normaliseWarning(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  const known = CONTENT_WARNINGS.find((w) => w.toLowerCase() === v.toLowerCase());
  return known ?? v.slice(0, 40);
}

export function isModeratorRole(role: string | null | undefined): boolean {
  return role === 'MODERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function excerpt(body: string, max = 200): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
