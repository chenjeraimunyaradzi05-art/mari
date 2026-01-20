/// <reference lib="webworker" />

/**
 * Service Worker for ATHENA PWA
 * Phase 3: Web Client - Super App Core
 * 
 * Features:
 * - Offline support with cache-first strategy for static assets
 * - Network-first for API calls
 * - Background sync for messages
 * - Push notifications
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

const CACHE_NAME = 'athena-v1';
const STATIC_CACHE = 'athena-static-v1';
const DYNAMIC_CACHE = 'athena-dynamic-v1';
const API_CACHE = 'athena-api-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon.svg',
];

// API routes to cache
const CACHEABLE_API_ROUTES = [
  '/api/user/profile',
  '/api/feed',
  '/api/notifications',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('athena-') &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== API_CACHE
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages - network first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else - stale while revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  // Extended type to include properties valid for service worker notifications but not in TS's NotificationOptions
  interface ServiceWorkerNotificationOptions extends NotificationOptions {
    vibrate?: number[];
    actions?: Array<{ action: string; title: string; icon?: string }>;
    renotify?: boolean;
  }
  const options: ServiceWorkerNotificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'ATHENA', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  // Handle action clicks
  if (event.action) {
    switch (event.action) {
      case 'open':
        break;
      case 'dismiss':
        return;
      case 'reply':
        // Handle quick reply
        break;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
}) as EventListener);

// Periodic background sync
self.addEventListener('periodicsync', ((event: PeriodicSyncEvent) => {
  if (event.tag === 'refresh-feed') {
    event.waitUntil(refreshFeed());
  }
}) as EventListener);

// Helper functions

function isStaticAsset(pathname: string): boolean {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithCache(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function networkFirstWithOfflineFallback(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise;
}

async function syncMessages(): Promise<void> {
  // Get pending messages from IndexedDB and send them
  console.log('[SW] Syncing messages...');
  // Implementation would use IndexedDB to get queued messages
  // and POST them to the API
}

async function syncPosts(): Promise<void> {
  // Get pending posts from IndexedDB and send them
  console.log('[SW] Syncing posts...');
}

async function refreshFeed(): Promise<void> {
  // Refresh feed data in the background
  console.log('[SW] Refreshing feed...');
  try {
    const response = await fetch('/api/feed?limit=20');
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put('/api/feed', response);
    }
  } catch (error) {
    console.error('[SW] Failed to refresh feed:', error);
  }
}

export {};
