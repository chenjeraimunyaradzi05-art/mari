/**
 * Small secrets at rest: the authenticator seed behind two-factor sign-in.
 *
 * A TOTP secret is the second factor; stored in the clear, a copy of the
 * users table is a copy of every second factor too. It is sealed with
 * AES-256-GCM under TOTP_ENCRYPTION_KEY, falling back to DV_ENCRYPTION_KEY so
 * a deployment that already protects the safe chats protects these, and
 * marked with a prefix so a value written before sealing existed is still
 * read as it is. Production refuses to run without a real key.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

let cached: { source: string; key: Buffer } | null = null;

function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY || process.env.DV_ENCRYPTION_KEY || '';
  const valid = /^[0-9a-fA-F]{64}$/.test(hex);
  const source = valid ? hex : 'dev';
  if (cached && cached.source === source) return cached.key;
  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOTP_ENCRYPTION_KEY (or DV_ENCRYPTION_KEY) must be a 64-character hex key in production');
    }
    cached = { source, key: scryptSync('dev-only-insecure-key', 'athena-secret-box-salt', 32) };
    return cached.key;
  }
  cached = { source, key: Buffer.from(hex, 'hex') };
  return cached.key;
}

/** Whether a stored value was written by sealSecret. */
export function isSealed(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function sealSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

/**
 * The secret as it was sealed. A value without the prefix predates sealing
 * and is returned as it is; a sealed value this host cannot open (wrong key,
 * tampered bytes) is null, which reads as "no second factor matches".
 */
export function openSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isSealed(stored)) return stored;

  try {
    const key = getKey();
    const data = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const body = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(body) + decipher.final('utf8');
  } catch {
    return null;
  }
}
