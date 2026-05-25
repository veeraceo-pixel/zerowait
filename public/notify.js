/**
 * skipQs — Notification Engine  (notify.js)
 *
 * Provides:
 *   skipQsNotify.init()                    → registers SW + asks permission
 *   skipQsNotify.send(title, body, opts)   → show notification via SW
 *   skipQsNotify.requestPermission()       → ask user for permission
 *   skipQsNotify.isSupported()             → true if SW + Notification available
 *
 * HOW LOCK-SCREEN NOTIFICATIONS WORK
 * ─────────────────────────────────────────────────────────────────
 * Phase 1 (this file — works now):
 *   • When skipQs is open in the browser (even minimised / screen dim),
 *     the SW receives a postMessage and shows a system notification.
 *   • On Android Chrome this appears on the lock screen if the browser
 *     process is alive in background.
 *
 * Phase 2 (optional, for fully closed browser):
 *   • Requires Web Push VAPID keys + a tiny backend (Supabase Edge Fn).
 *   • See PUSH_SETUP_GUIDE below.
 * ─────────────────────────────────────────────────────────────────
 *
 * PUSH_SETUP_GUIDE
 * ─────────────────────────────────────────────────────────────────
 * 1. Generate VAPID keys (run once in Node.js):
 *       npm i -g web-push && web-push generate-vapid-keys
 *    Copy the PUBLIC key into VAPID_PUBLIC_KEY below.
 *    Store the PRIVATE key as a Supabase secret (VAPID_PRIVATE_KEY).
 *
 * 2. Store push subscriptions:
 *    Create table in Supabase:
 *      push_subscriptions (id uuid, user_id uuid, subscription jsonb, created_at timestamptz)
 *
 * 3. Deploy Supabase Edge Function:
 *    supabase/functions/send-push/index.ts
 *    (See end of this file for the full Edge Function code as a comment)
 *
 * 4. Trigger the Edge Function on queue status change via a Supabase
 *    DB Webhook: Table: queues, Event: UPDATE, URL: your Edge Function URL
 * ─────────────────────────────────────────────────────────────────
 */

/* ── Replace with your own VAPID public key after running web-push ── */
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

window.skipQsNotify = (function () {
  'use strict';

  let _swReg = null;

  /* ── Is notification + SW supported? ─── */
  function isSupported() {
    return 'serviceWorker' in navigator && 'Notification' in window;
  }

  /* ── Register the service worker ─────── */
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    if (_swReg) return _swReg;
    try {
      _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return _swReg;
    } catch (e) {
      console.warn('[skipQs] SW registration failed:', e);
      return null;
    }
  }

  /* ── Ask for notification permission ─── */
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied')  return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  /* ── Initialise: register SW + request permission quietly ─── */
  async function init() {
    if (!isSupported()) return false;
    const reg = await registerSW();
    if (!reg) return false;
    // Don't auto-prompt permission — wait for user action or first queue join
    return true;
  }

  /* ── Send a notification via the SW ─── */
  async function send(title, body, opts = {}) {
    const granted = await requestPermission();
    if (!granted) return false;

    const reg = await registerSW();
    if (!reg) return false;

    const sw = reg.active || reg.waiting || reg.installing;
    if (!sw) return false;

    sw.postMessage({
      type:             opts.type || 'SHOW_NOTIFICATION',
      title:            title,
      body:             body,
      tag:              opts.tag              || 'skipqs',
      url:              opts.url              || '/dashboard.html',
      requireInteraction: opts.requireInteraction || false
    });
    return true;
  }

  /* ── Subscribe to Web Push (Phase 2) ─── */
  async function subscribePush(userId) {
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith('BEl62')) {
      console.warn(
        '[skipQs] Web Push is NOT active. VAPID_PUBLIC_KEY in notify.js is still the placeholder value.\n' +
        'Run: npm i -g web-push && web-push generate-vapid-keys\n' +
        'Then replace VAPID_PUBLIC_KEY at the top of notify.js with your own public key.\n' +
        'Store the private key as a Supabase secret (VAPID_PRIVATE_KEY).'
      );
      return null;
    }
    if (!('PushManager' in window)) return null;
    const granted = await requestPermission();
    if (!granted) return null;

    const reg = await registerSW();
    if (!reg) return null;

    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) return existing;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:    true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Store subscription in Supabase
      if (window.sb && userId) {
        await window.sb.from('push_subscriptions').upsert({
          user_id:      userId,
          subscription: sub.toJSON(),
          updated_at:   new Date().toISOString()
        }, { onConflict: 'user_id' });
      }

      return sub;
    } catch (e) {
      console.warn('[skipQs] Push subscription failed:', e);
      return null;
    }
  }

  /* ── Helper: base64 → Uint8Array (for VAPID key) ─── */
  function urlBase64ToUint8Array(base64String) {
    const padding  = '='.repeat((4 - base64String.length % 4) % 4);
    const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData  = atob(base64);
    const output   = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
    return output;
  }

  return { isSupported, init, requestPermission, send, subscribePush };
})();


/*
═══════════════════════════════════════════════════════════════════
  SUPABASE EDGE FUNCTION  (deploy once — free tier)
  File: supabase/functions/send-push/index.ts
═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

webpush.setVapidDetails(
  "mailto:veeraceo@gmail.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

serve(async (req) => {
  const { user_id, title, body, url } = await req.json();

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", user_id);

  const results = await Promise.allSettled(
    (subs || []).map(row =>
      webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title, body, url: url || "/dashboard.html" })
      )
    )
  );

  return new Response(JSON.stringify({ sent: results.length }), { status: 200 });
});

═══════════════════════════════════════════════════════════════════
*/
