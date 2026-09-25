/**
 * Where a tapped notification takes her.
 *
 * Every push the server sends carries a `link` in its data payload —
 * push.service.ts copies it out of the notification row, socket.service.ts
 * sets it to /dashboard/messages?user=... for a direct message. Those links
 * are paths on the *web* app. The phone's deep-link table speaks a different
 * set of paths (`messages`, `groups`, `jobs/:jobId`), and nothing translated
 * between them, so the app registered no notification listener at all: a tap
 * reopened whatever screen happened to be on screen last and the link was
 * thrown away. A woman who taps "Someone replied to you" and lands back on
 * the feed has been told the notification meant nothing.
 *
 * This maps the links the server actually emits onto the routes the app
 * registers, and sends everything else — the admin console, the employer
 * console, the pillars that only exist on the web — to the web app in the
 * browser, which is the handoff the app already makes for those screens. It
 * always resolves to somewhere: no tap is allowed to do nothing.
 *
 * Kept free of imports so it can be exercised as a plain function; App.tsx
 * turns the result into either a deep link for React Navigation or a browser
 * hand-off.
 */

export type NotificationDestination =
  /** A path in the app's own deep-link table, without a leading slash. */
  | { kind: 'app'; path: string }
  /** A path on the web app, to be opened in the browser. */
  | { kind: 'web'; path: string };

/** The parts of an Expo notification this module reads. */
export interface NotificationPayload {
  link?: unknown;
  conversationId?: unknown;
  [key: string]: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** "/dashboard/groups/abc?tab=requests#top" -> ["dashboard", "groups", "abc"] */
function segmentsOf(link: string): string[] {
  const withoutOrigin = link.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  const withoutQuery = withoutOrigin.split('?')[0].split('#')[0];
  return withoutQuery.split('/').filter(Boolean);
}

/** A path segment that could be an id rather than a fixed word. */
function isIdish(segment: string | undefined): segment is string {
  return typeof segment === 'string' && segment.length > 0;
}

/**
 * The app path for a web link, or null when the app has no native screen for
 * it and the browser should take it.
 *
 * Only the routes App.tsx registers in its linking config appear here. Adding
 * a native screen means adding it in both places, and a path that is in this
 * table but not in that one silently drops the member on the default screen —
 * which is the failure this whole module exists to end.
 */
function appPathFor(link: string, conversationId?: string): string | null {
  const parts = segmentsOf(link);
  const [first, second, third] = parts;

  if (first === 'dashboard') {
    switch (second) {
      case 'messages':
        // The message pushes carry the conversation, so the tap opens the
        // thread itself rather than the inbox. A message *request* has no
        // thread to open yet and lands on the inbox, which is where the
        // accept/decline lives.
        return conversationId && !link.includes('tab=requests') ? `messages/${conversationId}` : 'messages';
      case 'notifications':
        return 'notifications';
      case 'applications':
        return 'applications';
      case 'apprenticeships':
        return 'apprenticeships';
      case 'groups':
        return isIdish(third) ? `groups/${third}` : 'groups';
      case 'mentors':
        return 'mentors';
      case 'settings':
        return third === 'profile' ? 'profile/edit' : null;
      default:
        return null;
    }
  }

  switch (first) {
    case 'messages':
      return isIdish(second) ? `messages/${second}` : 'messages';
    case 'notifications':
      return 'notifications';
    case 'jobs':
      // /jobs/<id>/applications is the employer's list of applicants and has
      // no screen on the phone; /jobs/<id> is the job itself.
      return isIdish(second) && !third ? `jobs/${second}` : null;
    case 'posts':
      return isIdish(second) ? `posts/${second}` : null;
    case 'groups':
      return isIdish(second) ? `groups/${second}` : 'groups';
    case 'skills-marketplace':
      if (second === 'orders') return 'skills-marketplace/orders';
      return isIdish(second) ? `skills-marketplace/${second}` : 'skills-marketplace';
    case 'learning':
      return 'learning';
    case 'mentors':
      return 'mentors';
    case 'safety':
      return 'safety';
    case 'pricing':
      return 'pricing';
    case 'apprenticeships':
      return 'apprenticeships';
    default:
      return null;
  }
}

/**
 * The destination for a notification's data payload, or null when it carries
 * no link at all — in which case opening the app is all the tap can mean.
 */
export function destinationForNotification(data: NotificationPayload | null | undefined): NotificationDestination | null {
  if (!data) return null;
  const link = asString(data.link);
  if (!link) return null;

  const conversationId = asString(data.conversationId);
  const path = appPathFor(link, conversationId);
  if (path) return { kind: 'app', path };

  // Everything the phone has no screen for goes to the web app at the very
  // path the server chose, rather than nowhere.
  return { kind: 'web', path: link.startsWith('/') ? link : `/${link}` };
}
