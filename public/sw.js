/* ============================================================
   skipQs Service Worker — Queue Timer Lock-Screen Notifications
   Receives postMessage from the main page and shows/updates
   a persistent notification that stays visible on the lock screen.
   ============================================================ */

const SW_VERSION = 'skipqs-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* ── Message handler (called from main page) ─────────────────── */
self.addEventListener('message', async e => {
  const msg = e.data || {};

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
