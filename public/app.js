// app.js
import { listProviders, getLandingStats } from './api.js';

const liveQueueList = document.getElementById('live-queue-list');
const heroProvidersCount = document.getElementById(
  'hero-live-providers-count'
);
const heroPeopleInLine = document.getElementById('hero-people-in-line');
const businessSnapshotEl = document.getElementById('business-snapshot');
const heroSearchForm = document.getElementById('hero-search-form');
const heroSearchInput = document.getElementById('hero-search-input');
const demoTimerEl = document.getElementById('demo-timer');
const demoEtaEl = document.getElementById('demo-eta');

// ── XSS sanitiser ────────────────────────────────────────────────
// All database-sourced strings must pass through esc() before
// being interpolated into innerHTML.
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

async function renderLiveQueues() {
  if (!liveQueueList) return;

  const providers = await listProviders({});
  liveQueueList.innerHTML = '';

  const openProviders = providers.filter((p) => p.is_open);

  if (!openProviders.length) {
    liveQueueList.innerHTML =
      '<p class="sq-subtle">No live queues right now. Check again soon.</p>';
    return;
  }

  openProviders.slice(0, 5).forEach((p) => {
    const card = document.createElement('article');
    card.className = 'sq-queue-card';

    // FIX: All DB values escaped through esc() to prevent XSS.
    // Numeric values cast with Number() so they can never contain markup.
    card.innerHTML = `
      <header class="sq-queue-card-header">
        <h3>${esc(p.business_name)}</h3>
        <span class="sq-badge">${esc(p.category || 'Service')}</span>
      </header>
      <p class="sq-subtle">${esc(p.address || '')}</p>
      <div class="sq-queue-status">
        <div>
          <span class="sq-label">People in line</span>
          <span class="sq-value">${Number(p.people_in_line) || 0}</span>
        </div>
        <div>
          <span class="sq-label">Current wait</span>
          <span class="sq-value">${Number(p.current_wait_mins) || 0} mins</span>
        </div>
      </div>
    `;
    liveQueueList.appendChild(card);
  });
}

async function renderLandingStats() {
  if (!heroProvidersCount || !heroPeopleInLine) return;
  const { liveProviders, peopleInLine } = await getLandingStats();
  heroProvidersCount.textContent = String(liveProviders);
  heroPeopleInLine.textContent = String(peopleInLine);
}

async function renderBusinessSnapshot() {
  if (!businessSnapshotEl) return;

  const providers = await listProviders({});
  businessSnapshotEl.innerHTML = '';

  if (!providers.length) {
    businessSnapshotEl.innerHTML =
      '<li class="sq-subtle">No providers yet. Sign up to start.</li>';
    return;
  }

  const byCategory = providers.reduce((acc, p) => {
    const cat = p.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, people: 0 };
    acc[cat].count += 1;
    acc[cat].people += p.people_in_line || 0;
    return acc;
  }, {});

  Object.entries(byCategory)
    .slice(0, 4)
    .forEach(([cat, stats]) => {
      const li = document.createElement('li');
      // FIX: category name escaped; counts are plain numbers (safe).
      li.innerHTML = `
        <span>${esc(cat)}</span>
        <span>${Number(stats.count)} providers · ${Number(stats.people)} in line</span>
      `;
      businessSnapshotEl.appendChild(li);
    });
}

function startDemoTimer() {
  if (!demoTimerEl || !demoEtaEl) return;

  let remainingSeconds = 7 * 60 + 30;

  function tick() {
    const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const secs = String(remainingSeconds % 60).padStart(2, '0');
    demoTimerEl.textContent = `${mins}:${secs}`;

    const etaMins = Math.ceil(remainingSeconds / 60);
    demoEtaEl.textContent = `${etaMins} mins`;

    if (remainingSeconds <= 0) {
      remainingSeconds = 7 * 60 + 30;
    } else {
      remainingSeconds -= 1;
    }
  }

  tick();
  setInterval(tick, 1000);
}

if (heroSearchForm && heroSearchInput) {
  heroSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = heroSearchInput.value.trim();
    const url = q
      ? `/find-services.html?q=${encodeURIComponent(q)}`
      : '/find-services.html';
    window.location.href = url;
  });
}

// Init
renderLiveQueues();
renderLandingStats();
renderBusinessSnapshot();
startDemoTimer();
setInterval(renderLiveQueues, 30_000);
setInterval(renderLandingStats, 30_000);
