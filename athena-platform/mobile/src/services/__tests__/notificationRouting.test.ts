/**
 * Where a tapped notification goes.
 *
 * Nothing in the app read a notification response, so every tap reopened
 * whatever screen was last on screen and the `link` the server had chosen was
 * discarded. These pin the translation from the server's web paths to the
 * app's own, and — just as importantly — that a link the phone has no screen
 * for still resolves to somewhere rather than to nothing.
 */
import { describe, it, expect } from '@jest/globals';

import { destinationForNotification } from '../notificationRouting';

describe('the destination for a tapped notification', () => {
  it('opens the thread itself for a direct message', () => {
    expect(
      destinationForNotification({ type: 'MESSAGE', link: '/dashboard/messages?user=u1', conversationId: 'c9' })
    ).toEqual({ kind: 'app', path: 'messages/c9' });
  });

  it('falls back to the inbox when the message push carries no conversation', () => {
    expect(destinationForNotification({ type: 'MESSAGE', link: '/dashboard/messages' })).toEqual({
      kind: 'app',
      path: 'messages',
    });
  });

  it('sends a message request to the inbox, where the accept and decline live', () => {
    expect(
      destinationForNotification({ type: 'MESSAGE', link: '/dashboard/messages?tab=requests', conversationId: 'c9' })
    ).toEqual({ kind: 'app', path: 'messages' });
  });

  it('maps the notification, group, post and job links the server emits', () => {
    expect(destinationForNotification({ link: '/dashboard/notifications#follow-requests' })).toEqual({
      kind: 'app',
      path: 'notifications',
    });
    expect(destinationForNotification({ link: '/dashboard/groups/g1?tab=requests' })).toEqual({
      kind: 'app',
      path: 'groups/g1',
    });
    expect(destinationForNotification({ link: '/posts/p1' })).toEqual({ kind: 'app', path: 'posts/p1' });
    expect(destinationForNotification({ link: '/jobs/j1' })).toEqual({ kind: 'app', path: 'jobs/j1' });
    expect(destinationForNotification({ link: '/dashboard/applications' })).toEqual({
      kind: 'app',
      path: 'applications',
    });
    expect(destinationForNotification({ link: '/dashboard/settings/profile' })).toEqual({
      kind: 'app',
      path: 'profile/edit',
    });
    expect(destinationForNotification({ link: '/skills-marketplace/orders/o1' })).toEqual({
      kind: 'app',
      path: 'skills-marketplace/orders',
    });
  });

  it('hands the screens the phone does not have to the web app rather than dropping them', () => {
    expect(destinationForNotification({ link: '/admin/moderation#safety-concerns' })).toEqual({
      kind: 'web',
      path: '/admin/moderation#safety-concerns',
    });
    expect(destinationForNotification({ link: '/dashboard/formation/r1' })).toEqual({
      kind: 'web',
      path: '/dashboard/formation/r1',
    });
    // The employer's applicant list is not a screen on the phone; the job is.
    expect(destinationForNotification({ link: '/jobs/j1/applications' })).toEqual({
      kind: 'web',
      path: '/jobs/j1/applications',
    });
  });

  it('resolves nothing only when there is no link to follow', () => {
    expect(destinationForNotification(null)).toBeNull();
    expect(destinationForNotification({})).toBeNull();
    expect(destinationForNotification({ link: '   ' })).toBeNull();
    expect(destinationForNotification({ link: 42 })).toBeNull();
  });

  it('understands an absolute link as well as a path', () => {
    expect(destinationForNotification({ link: 'https://athena.app/dashboard/notifications' })).toEqual({
      kind: 'app',
      path: 'notifications',
    });
  });
});
