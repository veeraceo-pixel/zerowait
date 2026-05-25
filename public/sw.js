/* ============================================================
   skipQs Service Worker — Queue Timer & Lock-Screen Notifications
   v2: adds Web Push (server → locked screen), offline cache,
       and generic SHOW_NOTIFICATION for Leave Now alerts.
   ============================================================ */

// SW_VERSION drives cache naming — bump ONLY this string to invalidate all caches
const SW_VERSION  = 'skipqs-sw-v2';
const CACHE_NAME  = `skipqs-cache-${SW_VERSION}`;  // tied to SW_VERSION — never out of sync

// Core shell — extend this list as new critical pages are added
const CACHE_URLS  = [
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
  '/nearby.html',
  '/hospitals.html',
  '/how-it-works.html',
  '/business-pricing.html',
  '/supabase-config.js',
  '/auth-nav.js',
  '/sector-config.js',
  '/sector-listing.js',
];

/* ── Install: pre-cache ──────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

/* ── Activate: prune old caches ──────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

/* ── Fetch: network-first, cache fallback ────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ── Web Push (from server / Supabase Edge Fn) ───────── */
self.addEventListener('push', event => {
  let payload = { title: 'skipQs', body: 'You have a queue update', url: '/dashboard.html', tag: 'skipqs-queue' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:             payload.body,
      icon:             '/icon-192.png',
      badge:            '/icon-192.png',
      tag:              payload.tag,
      renotify:         true,
      requireInteraction: payload.requireInteraction || false,
      vibrate:          [200, 100, 200, 100, 200],
      data:             { url: payload.url }
    })
  );
});

/* ── Message handler (called from main page) ─────────────────── */
self.addEventListener('message', async e => {
  const msg = e.data || {};

  // ── Generic notification (Leave Now, any alert) ──
  if (msg.type === 'SHOW_NOTIFICATION') {
    try {
      await self.registration.showNotification(msg.title || 'skipQs', {
        body:             msg.body || '',
        icon:             '/icon-192.png',
        badge:            '/icon-192.png',
        tag:              msg.tag || 'skipqs',
        renotify:         true,
        requireInteraction: msg.requireInteraction || false,
        vibrate:          [200, 100, 200],
        data:             { url: msg.url || '/dashboard.html' }
      });
    } catch (err) { console.warn('[skipQs SW] showNotification:', err); }
    return;
  }

  // ── Show / update the queue notification ──
  if (msg.type === 'SHOW_QUEUE_NOTIFICATION') {
    const { bizName, deptName, waitMins, status, trackingToken } = msg;

    let title, body;

    if (status === 'serving') {
      title = '🔔 Your turn — please come in!';
      body  = `${bizName}${deptName ? ' — ' + deptName : ''} is ready for you.`;
    } else {
      const mins = Math.max(0, Math.ceil(waitMins || 0));
      title = mins === 0 ? `⏳ Almost your turn!` : `⏱ ~${mins} min wait`;
      body  = `${bizName}${deptName ? ' — ' + deptName : ''} · Tap to track your position`;
    }

    const notifOptions = {
      body,
      icon            : '/favicon.ico',
      badge           : '/favicon.ico',
      tag             : 'skipqs-queue',   // replaces any previous queue notification
      renotify        : status === 'serving',
      silent          : status !== 'serving',
      requireInteraction: status === 'serving', // stays until tapped on serving
      vibrate         : status === 'serving' ? [200, 100, 200] : [],
      data            : {
        url: trackingToken
          ? (self.location.origin + '/patient-track.html?t=' + trackingToken)
          : (self.location.origin + '/dashboard.html')
      }
    };

    try {
      await self.registration.showNotification(title, notifOptions);
    } catch (err) {
      console.warn('[skipQs SW] showNotification failed:', err);
    }
    return;
  }

  // ── Dismiss queue notification (page came back to foreground) ──
  if (msg.type === 'HIDE_QUEUE_NOTIFICATION') {
    try {
      const existing = await self.registration.getNotifications({ tag: 'skipqs-queue' });
      existing.forEach(n => n.close());
    } catch {}
    return;
  }
});

/* ── Notification click → focus or open the app ─────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || self.location.origin + '/';

  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // If the app is already open, focus it and navigate
        for (const wc of windowClients) {
          if (wc.url.includes(self.location.origin)) {
            wc.navigate(targetUrl);
            return wc.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
