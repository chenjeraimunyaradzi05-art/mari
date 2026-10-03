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
import { recordFailure } from '../../utils/ops-metrics';

export function encryptJson(value: unknown): string {
  return sealText('health', JSON.stringify(value));
}

/**
 * The record a sealed value holds, or null when it cannot be read. Null is the
 * answer, not an error: the member is shown "unreadable" and the page goes on.
 * But a record nobody can open is also the first sign that the key on this host
 * is not the key the records were sealed under (a rotation that skipped the
 * `_PREVIOUS` step, a restore onto a host with a different key), so each one is
 * counted where the operations screen reads (utils/ops-metrics), with no id
 * and no content. A quiet null used to be the only trace.
 */
export function decryptJson<T = Record<string, unknown>>(payload: string): T | null {
  const text = openText('health', payload);
  if (text === null) {
    if (payload) recordFailure('health.record_unreadable', new Error('a health record could not be opened under the keys this host holds'));
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    recordFailure('health.record_unreadable', new Error('a health record opened but did not hold JSON'));
    return null;
  }
}
