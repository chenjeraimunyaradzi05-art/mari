/**
 * Health records are encrypted at rest with AES-256-GCM under
 * HEALTH_ENCRYPTION_KEY, falling back to DV_ENCRYPTION_KEY so a deployment
 * that already protects the safe chats protects these too. The database
 * holds the kind and the day of an entry in the clear, for indexing, and
 * nothing else. A record written under a key this host no longer has is
 * returned as unreadable rather than as an error.
 *
 * The key, its production checks and the retired keys a rotation leaves behind
 * are in utils/encryption-key.ts; docs/runbooks/ENCRYPTION.md says what this
 * protects and what it does not. It is encryption at rest: ATHENA's servers
 * decrypt a record to show it to the member who wrote it.
 */

import { openText, sealText } from '../../utils/encryption-key';

export function encryptJson(value: unknown): string {
  return sealText('health', JSON.stringify(value));
}

export function decryptJson<T = Record<string, unknown>>(payload: string): T | null {
  const text = openText('health', payload);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
