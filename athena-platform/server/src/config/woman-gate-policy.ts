/**
 * Which parts of ATHENA need the women-only check completed, and which only
 * need that a reviewer has not refused her. Written down once, with the reason
 * for each, so that "who may be in this room" has one answer a person can read.
 *
 * There are two levels, and the difference is what each one promises:
 *
 *   MEMBER    The floor, and it is central. Everyone self-attests when she
 *             registers, so the only account the floor can turn away is one a
 *             reviewer has already looked at and refused. `authenticate`
 *             refuses that account on every write (middleware/account-standing.ts),
 *             except the few routes she needs to appeal, to exercise her
 *             privacy rights and to reach safety help. No route asks for it
 *             one by one, so a route added tomorrow has it on the day it is
 *             mounted.
 *
 *   VERIFIED  A completed check: a reviewer has approved the evidence she
 *             sent (womanVerificationStatus = VERIFIED). It costs her a few
 *             minutes and a person's time, so it is asked only where the
 *             promise is made to other members, in a room where a stranger is
 *             told that the people in it are who they say they are.
 *
 * The first two surfaces below are enforced always. The last two are the
 * ones the founder has to decide: the check needs a person to review it, and
 * turning them on before that queue is staffed would shut every new member out
 * of private groups and every creator out of her payouts until someone gets
 * to her. They are off until WOMAN_VERIFIED_REQUIRED_FOR names them, so
 * "not yet decided" is written down in docs/security/authorisation-matrix.md
 * (the decision, the steps to take it, and who it is waiting for), and a name
 * that matches no surface is warned about at start, rather than being
 * something that is quietly true. /health/launch-readiness does not report it.
 *
 * A surface is asked at every door into the room, not only the front one: a
 * member asking to join is held to it by womanVerifiedRefusal, and a member an
 * admin approves, adds or has suggested into a private group is held to it by
 * mayBeAdmittedTo (middleware/woman-gate-surfaces.ts).
 */

export type WomanGateLevel = 'MEMBER' | 'VERIFIED';

export type WomanGateSurface =
  | 'mentor_publication'
  | 'confidential_housing'
  | 'private_groups'
  | 'creator_payouts';

export interface WomanGateSurfacePolicy {
  surface: WomanGateSurface;
  /** What the member is trying to do, in the words the refusal and the matrix use. */
  label: string;
  /** What the surface needs once it is switched on. */
  level: 'VERIFIED';
  /**
   * `always`: enforced in the code today, whatever the configuration says.
   * `configurable`: enforced only when WOMAN_VERIFIED_REQUIRED_FOR names it.
   */
  enforcement: 'always' | 'configurable';
  /** Why a completed check is asked here and not only the floor. */
  why: string;
}

export const WOMAN_GATE_SURFACES: readonly WomanGateSurfacePolicy[] = [
  {
    surface: 'mentor_publication',
    label: 'Publishing a mentor profile',
    level: 'VERIFIED',
    enforcement: 'always',
    why: 'A mentor profile asks other women to trust her with their careers and, for a paid mentor, their money. Publishing it is a statement to strangers.',
  },
  {
    surface: 'confidential_housing',
    label: 'Seeing confidential, DV-safe housing listings',
    level: 'VERIFIED',
    enforcement: 'always',
    why: 'The addresses and availability behind these listings protect women who are leaving violence. Safe Mode is the one deliberate exception (mayEnterConfidentialSpace): a woman who needs a bed tonight cannot wait for a review.',
  },
  {
    surface: 'private_groups',
    label: 'Asking to join a private group',
    level: 'VERIFIED',
    enforcement: 'configurable',
    why: 'A private group is a closed room whose members are approved by its admins, who may reasonably expect that the woman asking has been checked.',
  },
  {
    surface: 'creator_payouts',
    label: 'Requesting a creator payout',
    level: 'VERIFIED',
    enforcement: 'configurable',
    why: 'ATHENA pays out of other members\' gifts and subscriptions. Paying an account whose womanhood nobody has checked is the one place the platform spends members\' money on the self-attestation alone.',
  },
];

const BY_SURFACE = new Map(WOMAN_GATE_SURFACES.map((policy) => [policy.surface, policy]));

/** The configuration variable that switches the configurable surfaces on, a comma-separated list. */
export const WOMAN_VERIFIED_REQUIRED_ENV = 'WOMAN_VERIFIED_REQUIRED_FOR';

/**
 * The surfaces the environment switches on. Unknown names are reported rather
 * than ignored: a typo here would otherwise leave a surface open while whoever
 * set it believed it closed. `all` switches every configurable surface on.
 */
export function configuredSurfaces(raw: string | undefined): { on: Set<WomanGateSurface>; unknown: string[] } {
  const on = new Set<WomanGateSurface>();
  const unknown: string[] = [];
  for (const word of (raw ?? '').split(',').map((part) => part.trim().toLowerCase()).filter(Boolean)) {
    if (word === 'all') {
      for (const policy of WOMAN_GATE_SURFACES) on.add(policy.surface);
      continue;
    }
    const policy = BY_SURFACE.get(word as WomanGateSurface);
    if (policy) on.add(policy.surface);
    else unknown.push(word);
  }
  return { on, unknown };
}

/** Whether a completed women-only check is needed for this surface right now. */
export function verifiedRequiredFor(
  surface: WomanGateSurface,
  env: Record<string, string | undefined> = process.env
): boolean {
  const policy = BY_SURFACE.get(surface);
  if (!policy) return false;
  if (policy.enforcement === 'always') return true;
  return configuredSurfaces(env[WOMAN_VERIFIED_REQUIRED_ENV]).on.has(surface);
}

/**
 * Writes that read a signed-in member from `optionalAuth` instead of
 * `authenticate`, and so are never seen by the account-standing check in
 * `authenticate`. Each is here because a member of any standing doing it is
 * harmless, and says why. src/__tests__/route-standing-coverage.test.ts fails
 * on one that is not named, so a new one is a decision made in review.
 */
export interface StandingExemptWrite {
  /** `METHOD /api/path` as Express registers it. */
  route: string;
  reason: string;
}

export const STANDING_EXEMPT_OPTIONAL_AUTH_WRITES: readonly StandingExemptWrite[] = [];
