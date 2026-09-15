/**
 * What happens to a session is announced here, so the parts of the server
 * that hold a live connection for it can let go. The session service and
 * the auth routes announce; the socket service listens. Kept apart from both
 * so neither has to import the other.
 */

import { EventEmitter } from 'events';

export interface SessionRevokedEvent {
  /** The account whose sessions were revoked. */
  userId: string;
  /** One session, when only one was revoked; undefined when all of them were. */
  sessionId?: string;
  /** A session to leave alone: the one doing the revoking. */
  exceptSessionId?: string;
  reason: 'logout' | 'revoked' | 'password-changed' | 'password-reset' | 'suspended' | 'reuse-detected';
}

class SessionEvents extends EventEmitter {
  announceRevoked(event: SessionRevokedEvent): void {
    this.emit('revoked', event);
  }

  onRevoked(listener: (event: SessionRevokedEvent) => void): () => void {
    this.on('revoked', listener);
    return () => this.off('revoked', listener);
  }
}

export const sessionEvents = new SessionEvents();
