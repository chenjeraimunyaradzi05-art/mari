/**
 * Health records are encrypted at rest with AES-256-GCM under
 * HEALTH_ENCRYPTION_KEY, falling back to DV_ENCRYPTION_KEY so a deployment
 * that already protects the safe chats protects these too. The database
 * holds the kind and the day of an entry in the clear, for indexing, and
 * nothing else. A record written under a key this host no longer has is
 * returned as unreadable rather than as an error.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cached: { source: string; key: Buffer } | null = null;

function getKey(): Buffer {
  const hex = process.env.HEALTH_ENCRYPTION_KEY || process.env.DV_ENCRYPTION_KEY || '';
  const valid = /^[0-9a-fA-F]{64}$/.test(hex);
  const source = valid ? hex : 'dev';
  if (cached && cached.source === source) return cached.key;
  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HEALTH_ENCRYPTION_KEY (or DV_ENCRYPTION_KEY) must be a 64-character hex key in production');
    }
    cached = { source, key: scryptSync('dev-only-insecure-key', 'athena-health-salt', 32) };
    return cached.key;
  }
  cached = { source, key: Buffer.from(hex, 'hex') };
  return cached.key;
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptJson<T = Record<string, unknown>>(payload: string): T | null {
  try {
    const key = getKey();
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const body = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    const text = decipher.update(body) + decipher.final('utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
