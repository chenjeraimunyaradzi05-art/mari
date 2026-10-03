/**
 * The keys that seal what a member keeps private, and the one place that reads
 * them.
 *
 * Four kinds of value are sealed at rest with AES-256-GCM: safe-chat messages,
 * health records, the authenticator seed behind two-factor sign-in, and the
 * personal safety plan. Each used to load its key on its own, in four near
 * copies (dv-safe.service.ts, wellness/health-crypto.ts, secret-box.ts), and the
 * copies had already drifted: one cached by key, one did not, and not one of
 * them refused a key that was valid hex and nothing else. The all-zero key the
 * example env file used to ship is 64 valid hex characters.
 *
 * What this module decides, for all four:
 *
 *  - The key is 64 hex characters. In production it must also be a value
 *    somebody generated (see secret-strength.ts), and a missing, short, or
 *    placeholder key throws the first time anything is sealed or opened, so a
 *    host that skipped the boot check still cannot write a message under a key
 *    printed in the repository. Outside production any 64-hex key is accepted,
 *    and with none set a fixed development key is used so a laptop works
 *    without setup. That key is in the source: nothing sealed under it is
 *    private, which is why production never reaches it.
 *
 *  - A sealed value is marked `enc:v1:` (the format: AES-256-GCM, base64 of
 *    iv, tag and ciphertext). A value written before the mark existed is the
 *    same bytes without it, and is still opened, so adding the mark changed
 *    nothing already stored.
 *
 *  - Keys can be retired without losing what they sealed. Each key variable has
 *    a `_PREVIOUS` companion holding the keys it replaced, comma separated.
 *    Sealing always uses the current key; opening tries the current key and then
 *    the previous ones. A retired key is therefore a configuration change and
 *    a re-seal (scripts/rotate-encryption-keys.ts), not a day on which every
 *    sealed row becomes unreadable. docs/runbooks/ENCRYPTION.md is the
 *    procedure, and says what happens if the key is simply lost.
 *
 * This protects data at rest against someone who reads the database, or a copy
 * of it. It is not end-to-end: the server holds the key and opens a value
 * whenever the member asks for it, and anyone who holds both the database and
 * the key can read everything in it. The runbook sets out what that does and
 * does not defend against, and the copy members read says the same.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from './logger';
import { secretWeakness } from './secret-strength';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, the length GCM is designed around
const AUTH_TAG_LENGTH = 16;
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/** Marks a value sealed in the current format. Anything else is read as the older, unmarked one. */
export const SEALED_PREFIX = 'enc:v1:';

/**
 * What a key protects. Purposes that share a key variable still cache and fail
 * separately, and each has its own development-only salt so a development
 * database never has two purposes sharing one derived key.
 */
export type KeyPurpose = 'safe-chat' | 'health' | 'secret' | 'safety-plan';

interface PurposeConfig {
  /** Variables to read, first one that is set wins. */
  envNames: string[];
  devSalt: string;
}

const PURPOSES: Record<KeyPurpose, PurposeConfig> = {
  'safe-chat': { envNames: ['DV_ENCRYPTION_KEY'], devSalt: 'athena-dv-salt' },
  // Health records fall back to the safe-chat key, so a deployment that
  // protects the one protects the other.
  health: { envNames: ['HEALTH_ENCRYPTION_KEY', 'DV_ENCRYPTION_KEY'], devSalt: 'athena-health-salt' },
  secret: { envNames: ['TOTP_ENCRYPTION_KEY', 'DV_ENCRYPTION_KEY'], devSalt: 'athena-secret-box-salt' },
  // Only ever the safe-chat key, never the authenticator key. A second factor
  // can be re-enrolled, so rotating TOTP_ENCRYPTION_KEY is a routine thing to
  // do; a plan sealed under it would be lost with no way for her to know until
  // she opened it.
  'safety-plan': { envNames: ['DV_ENCRYPTION_KEY'], devSalt: 'athena-safety-plan-salt' },
};

/** Every variable that can hold a key or a retired key, for the boot and readiness checks. */
export const ENCRYPTION_KEY_VARIABLES = [
  'DV_ENCRYPTION_KEY',
  'HEALTH_ENCRYPTION_KEY',
  'TOTP_ENCRYPTION_KEY',
] as const;

/** The variable holding the keys `name` replaced. */
export const previousKeyVariable = (name: string): string => `${name}_PREVIOUS`;

/**
 * The key variables as they are now. Each is spelled out rather than computed
 * from a name, because scripts/check-env.js decides whether a variable in an env
 * file is "obsolete" by looking for the literal `process.env.NAME` in src/, and
 * a retired-key variable it could not see would be reported as one nothing reads
 * in the middle of the rotation it exists for.
 */
function keyVariables(): Record<string, string | undefined> {
  return {
    DV_ENCRYPTION_KEY: process.env.DV_ENCRYPTION_KEY,
    DV_ENCRYPTION_KEY_PREVIOUS: process.env.DV_ENCRYPTION_KEY_PREVIOUS,
    HEALTH_ENCRYPTION_KEY: process.env.HEALTH_ENCRYPTION_KEY,
    HEALTH_ENCRYPTION_KEY_PREVIOUS: process.env.HEALTH_ENCRYPTION_KEY_PREVIOUS,
    TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY,
    TOTP_ENCRYPTION_KEY_PREVIOUS: process.env.TOTP_ENCRYPTION_KEY_PREVIOUS,
  };
}

interface KeyRing {
  current: Buffer;
  /** Keys that used to be current, still tried when opening. Never used to seal. */
  previous: Buffer[];
}

const rings = new Map<KeyPurpose, { signature: string; ring: KeyRing }>();
const reported = new Set<string>();

/** Says a thing once per process, so a bad setting is loud without filling the log. */
function reportOnce(message: string, meta: Record<string, unknown>): void {
  if (reported.has(message)) return;
  reported.add(message);
  logger.error(message, meta);
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** The keys in one `_PREVIOUS` variable: hex values separated by commas or whitespace. */
function parsePreviousKeys(name: string, raw: string | undefined): Buffer[] {
  const keys: Buffer[] = [];
  for (const entry of (raw ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (KEY_PATTERN.test(entry)) {
      keys.push(Buffer.from(entry, 'hex'));
    } else {
      // Never the value: it would be a key, or something close to one.
      reportOnce(`${name} holds a value that is not a 64-character hex key; it is ignored, so anything sealed under it cannot be opened.`, { variable: name });
    }
  }
  return keys;
}

function ringFor(purpose: KeyPurpose): KeyRing {
  const { envNames, devSalt } = PURPOSES[purpose];
  const production = isProduction();

  const variables = keyVariables();
  const currentName = envNames.find((name) => Boolean(variables[name]));
  const hex = currentName ? (variables[currentName] as string) : '';
  const previousRaw = envNames.map((name) => variables[previousKeyVariable(name)] ?? '');

  const signature = [production ? 'production' : 'other', currentName ?? '', hex, ...previousRaw].join('\u0000');
  const cached = rings.get(purpose);
  if (cached && cached.signature === signature) return cached.ring;

  const valid = KEY_PATTERN.test(hex);
  let current: Buffer;

  if (valid) {
    // The shape is not the standard. A run of zeros is 64 valid hex characters.
    const weakness = production ? secretWeakness(hex, 64) : null;
    if (weakness) {
      throw new Error(
        `${currentName} must be a 64-character hex key in production, and a random one: it is ${weakness}. ` +
          'Generate one with `openssl rand -hex 32`.'
      );
    }
    current = Buffer.from(hex, 'hex');
  } else if (production) {
    const [first, ...others] = envNames;
    throw new Error(
      `${first}${others.length ? ` (or ${others.join(' or ')})` : ''} must be a 64-character hex key in production`
    );
  } else {
    current = scryptSync('dev-only-insecure-key', devSalt, 32);
  }

  const previous: Buffer[] = [];
  envNames.forEach((name, index) => {
    for (const key of parsePreviousKeys(previousKeyVariable(name), previousRaw[index])) {
      if (!key.equals(current) && !previous.some((kept) => kept.equals(key))) previous.push(key);
    }
  });

  const ring = { current, previous };
  rings.set(purpose, { signature, ring });
  return ring;
}

/**
 * Whether a real key is configured for this purpose: 64 hex characters in a
 * variable it reads. The development fallback does not count. For tooling that
 * must not seal anything under a key anyone can read in the source.
 */
export function hasConfiguredKey(purpose: KeyPurpose): boolean {
  const variables = keyVariables();
  return PURPOSES[purpose].envNames.some((name) => KEY_PATTERN.test(variables[name] ?? ''));
}

/**
 * Why the key configured for this purpose is not one to seal under, or null when
 * it is: not set, not 64 hex characters, or a placeholder or repeating pattern.
 * It asks the question production asks, whatever NODE_ENV is, which sealText
 * deliberately does not (a laptop works with any key). For tooling that writes
 * to a real database from a shell where NODE_ENV is usually unset, and so must
 * not seal under a key the API would refuse to start with. Never says the value.
 */
export function configuredKeyProblem(purpose: KeyPurpose): string | null {
  const variables = keyVariables();
  const name = PURPOSES[purpose].envNames.find((candidate) => Boolean(variables[candidate]));
  if (!name) return 'no key is set';
  const hex = variables[name] as string;
  if (!KEY_PATTERN.test(hex)) return `${name} is not 64 hexadecimal characters`;
  const weakness = secretWeakness(hex, 64);
  return weakness ? `${name} is ${weakness}` : null;
}

/** Whether a stored value carries the mark that sealText writes. */
export function isSealed(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(SEALED_PREFIX);
}

/**
 * Seals text under the current key. Throws in production when there is no
 * usable key; a write that cannot be sealed must fail, never be stored plain.
 */
export function sealText(purpose: KeyPurpose, plain: string): string {
  const { current } = ringFor(purpose);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, current, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return SEALED_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export interface OpenedText {
  text: string;
  /** True when only a retired key could open it: it should be sealed again under the current one. */
  usedPreviousKey: boolean;
}

function decryptWith(key: Buffer, body: Buffer): string | null {
  try {
    const iv = body.subarray(0, IV_LENGTH);
    const tag = body.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = body.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    // A wrong key and damaged bytes fail the same way, on purpose.
    return null;
  }
}

/**
 * Opens a sealed value, with or without the mark, trying the current key and
 * then the retired ones. Null when nothing opens it: the key it was sealed
 * under is gone, the bytes were damaged, or the host has no usable key. It never
 * throws and never returns ciphertext, so a caller that shows what it gets back
 * cannot show a member a wall of base64.
 */
export function openSealedText(purpose: KeyPurpose, stored: string | null | undefined): OpenedText | null {
  if (typeof stored !== 'string' || stored === '') return null;

  let ring: KeyRing;
  try {
    ring = ringFor(purpose);
  } catch (error) {
    // Opening is quiet about a key it cannot use (it answers null), so the
    // reason is put in the log where an operator will find it.
    reportOnce('Sealed data cannot be opened: the encryption key is not usable.', {
      purpose,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const body = Buffer.from(isSealed(stored) ? stored.slice(SEALED_PREFIX.length) : stored, 'base64');
  const text = decryptWith(ring.current, body);
  if (text !== null) return { text, usedPreviousKey: false };

  for (const key of ring.previous) {
    const older = decryptWith(key, body);
    if (older !== null) return { text: older, usedPreviousKey: true };
  }
  return null;
}

/** The text a sealed value holds, or null when it cannot be opened. See openSealedText. */
export function openText(purpose: KeyPurpose, stored: string | null | undefined): string | null {
  return openSealedText(purpose, stored)?.text ?? null;
}
