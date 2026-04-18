/// <reference lib="webworker" />

/**
 * Compatibility service worker for legacy ATHENA deployments.
 *
 * We no longer cache the app shell by default because stale service-worker
 * responses were keeping old layouts, icons, and API behavior alive in
 * production after new deploys. This worker now acts as a cleanup layer:
 * it clears ATHENA caches during activation and lets the network handle
 * requests directly.
 */

declare const self: ServiceWorkerGlobalScope;

// Background Sync API types (not in default lib)
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
    periodicsync: PeriodicSyncEvent;
  }
}

const CACHE_PREFIX = 'athena-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  interface ServiceWorkerNotificationOptions extends NotificationOptions {
    vibrate?: number[];
    actions?: Array<{ action: string; title: string; icon?: string }>;
    renotify?: boolean;
  }
  const options: ServiceWorkerNotificationOptions = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data.data,
    },
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'ATHENA', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
}) as EventListener);

self.addEventListener('periodicsync', ((event: PeriodicSyncEvent) => {
  if (event.tag === 'refresh-feed') {
    event.waitUntil(refreshFeed());
  }
}) as EventListener);

async function syncMessages(): Promise<void> {
  console.log('[SW] Background sync is disabled in compatibility mode.');
}

async function syncPosts(): Promise<void> {
  console.log('[SW] Background sync is disabled in compatibility mode.');
}

async function refreshFeed(): Promise<void> {
  console.log('[SW] Periodic feed refresh is disabled in compatibility mode.');
}

export {};
