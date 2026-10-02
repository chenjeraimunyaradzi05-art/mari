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
  /**
   * Why, for the live socket's last message and the log. 'suspended' and 'banned' are a
   * moderator's decision, 'role-changed' is staff access given or taken away (the
   * member signs in again and gets a token that says what she now is), and
   * 'account-deleted' is the member closing her own account, and 'locked' is
   * the member freezing it herself because she suspects someone else has it.
   */
  reason:
    | 'logout'
    | 'revoked'
    | 'password-changed'
    | 'password-reset'
    | 'suspended'
    | 'banned'
    | 'role-changed'
    | 'account-deleted'
    | 'locked'
    | 'reuse-detected';
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
