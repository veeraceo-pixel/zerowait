// ============================================================
// skipQs — script.js
// Requires: supabase-config.js loaded before this file
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// WAIT TIME CALCULATION
// ------------------------------------------------------------

/**
 * Calculate estimated wait time from an array of queue rows.
 * @param {Array}  queueRows  – rows from the `queues` table (must include service_duration)
 * @param {number} capacity   – number of simultaneous serving spots
 * @returns {{ waitMins: number, people: number }}
 */
function calculateWaitTime(queueRows = [], capacity = 1) {
  if (!queueRows.length) return { waitMins: 0, people: 0 };

  const totalDuration = queueRows.reduce((sum, q) => sum + (q.service_duration || 15), 0);
  const effectiveCapacity = Math.max(1, capacity);

  return {
    waitMins: Math.ceil(totalDuration / effectiveCapacity),
    people: queueRows.length
  };
}

// ------------------------------------------------------------
// LIVE HOMEPAGE STATS BANNER
// ------------------------------------------------------------

async function loadLiveStats() {
  try {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Updating live...';

    const { data: providers } = await sb
      .from('providers')
      .select('id,is_open,capacity');

    const openBusinesses = providers.filter(p => p.is_open).length;

    const { data: queues } = await sb
      .from('queues')
      .select('provider_id,service_duration,status')
      .in('status', ['waiting', 'serving']);

    const peopleInQueue  = queues.length;
    const totalDuration  = queues.reduce((sum, q) => sum + (q.service_duration || 15), 0);
    const avgWait        = peopleInQueue ? Math.ceil(totalDuration / peopleInQueue) : 0;

    const today = new Date().toISOString().slice(0, 10);
    const { count } = await sb
      .from('queues')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('completed_date', today);

    if (document.getElementById('liveOpenCount'))   document.getElementById('liveOpenCount').textContent   = openBusinesses;
    if (document.getElementById('livePeopleCount')) document.getElementById('livePeopleCount').textContent = peopleInQueue;
    if (document.getElementById('liveAvgWait'))     document.getElementById('liveAvgWait').textContent     = avgWait;
    if (document.getElementById('liveServedToday')) document.getElementById('liveServedToday').textContent = count || 0;
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();

  } catch(err) {
    console.error(err);
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Live connection issue';
  }
}

// Run immediately, then refresh every 30 seconds
loadLiveStats();
setInterval(loadLiveStats, 30000);

// ------------------------------------------------------------
// WAIT-TIME POPUP
// ------------------------------------------------------------

/**
 * Show the wait-time popup for a given provider object.
 * provider must have: { id, business_name, waitTime, peopleInQueue }
 */
function showWaitPopup(provider) {
  document.getElementById('popupBusinessName').textContent = provider.business_name;
  document.getElementById('popupWait').textContent         = provider.waitTime     || 0;
  document.getElementById('popupPeople').textContent       = provider.peopleInQueue || 0;
  document.getElementById('popupJoinBtn').onclick = () => {
    window.location.href = `join-queue.html?provider=${provider.id}`;
  };
  document.getElementById('waitPopup').classList.remove('hidden');
}

function closeWaitPopup() {
  document.getElementById('waitPopup').classList.add('hidden');
}

// ------------------------------------------------------------
// DUPLICATE QUEUE GUARD  (call before inserting a queue row)
// ------------------------------------------------------------

/**
 * Returns true if the current user already has an active queue entry.
 * Usage: if (await hasActiveQueue(session.user.id)) { alert(...); return; }
 */
async function hasActiveQueue(userId) {
  const { data: existing } = await sb
    .from('queues')
    .select('id,status')
    .eq('user_id', userId)
    .in('status', ['waiting', 'serving'])
    .maybeSingle();
  return !!existing;
}

// ------------------------------------------------------------
// PROVIDER DASHBOARD — LIVE REFRESH
// ------------------------------------------------------------

// Call this in provider-dashboard.html after defining loadDashboard()
// setInterval(loadDashboard, 15000);

// ------------------------------------------------------------
// PUSH NOTIFICATIONS (optional, provider dashboard)
// ------------------------------------------------------------

function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}
