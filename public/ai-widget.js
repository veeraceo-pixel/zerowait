/* ============================================================
   skipQs AI Widget  — ai-widget.js
   Injects into business-detail.html:
   1. AI wait prediction badge on each department card
   2. "Best time to visit" heatmap below the dept grid
   Include after skipqs-ai.js and supabase-config.js
   ============================================================ */

(function () {
  'use strict';

  /* Wait for the page's own JS to finish rendering dept cards,
     then layer AI predictions on top */
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Inject CSS once */
  function injectStyles() {
    if (document.getElementById('sqai-styles')) return;
    const s = document.createElement('style');
    s.id = 'sqai-styles';
    s.textContent = `
      /* ── AI Prediction Badge ── */
      .sqai-badge {
        display: inline-flex; align-items: center; gap: .3rem;
        background: linear-gradient(135deg, #002f34, #005959);
        color: #23e5db; font-size: .68rem; font-weight: 800;
        padding: .25rem .6rem; border-radius: 50px;
        letter-spacing: .3px; margin-top: .35rem;
        border: 1px solid rgba(35,229,219,.3);
      }
      .sqai-badge .sqai-icon { font-size: .75rem; }
      .sqai-badge.low-conf { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
      .sqai-badge.high-conf { background: linear-gradient(135deg,#002f34,#004d57); }

      /* ── Best Time To Visit ── */
      .sqai-bttv {
        background: white; border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 1.2rem 1.4rem; margin: 1.4rem 0;
      }
      .sqai-bttv-title {
        font-size: .88rem; font-weight: 800; margin-bottom: .25rem;
        display: flex; align-items: center; gap: .5rem;
      }
      .sqai-bttv-sub {
        font-size: .75rem; color: #64748b; margin-bottom: 1rem;
      }
      .sqai-bttv-row {
        display: flex; align-items: flex-end; gap: 3px;
        height: 60px; margin-bottom: .5rem;
      }
      .sqai-bar-wrap {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; gap: 3px;
      }
      .sqai-bar {
        width: 100%; border-radius: 3px 3px 0 0;
        min-height: 3px; transition: height .4s ease;
      }
      .sqai-bar.quiet    { background: #bbf7d0; }
      .sqai-bar.moderate { background: #fde68a; }
      .sqai-bar.busy     { background: #fca5a5; }
      .sqai-bar.now      { outline: 2px solid #002f34; outline-offset: 1px; }
      .sqai-bar-lbl {
        font-size: .55rem; color: #94a3b8; font-weight: 600;
        text-align: center; white-space: nowrap;
      }
      .sqai-bttv-legend {
        display: flex; gap: 1rem; flex-wrap: wrap; margin-top: .5rem;
      }
      .sqai-legend-item {
        display: flex; align-items: center; gap: .3rem;
        font-size: .72rem; color: #64748b;
      }
      .sqai-legend-dot {
        width: 10px; height: 10px; border-radius: 2px;
      }
      .sqai-bttv-tip {
        margin-top: .8rem; padding: .6rem .8rem;
        background: #f0fdf4; border-radius: 8px;
        font-size: .78rem; color: #065f46; font-weight: 600;
        display: flex; align-items: center; gap: .4rem;
      }
      .sqai-bttv-tip.busy-tip {
        background: #fff7ed; color: #c2410c;
      }
      @media(max-width:540px){
        .sqai-bar-lbl { font-size: .48rem; }
        .sqai-bttv-row { gap: 2px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Add AI badge to a single dept card ─────────────────── */
  function addPredictionBadge(card, predictedMins, confidence) {
    if (card.querySelector('.sqai-badge')) return; // already added
    const waitDisplay = card.querySelector('.wait-display');
    if (!waitDisplay) return;

    const badge = document.createElement('div');
    badge.className = 'sqai-badge' + (confidence === 'low' ? ' low-conf' : ' high-conf');

    const icon = confidence === 'high' ? '🤖' : '📊';
    const label = confidence === 'low' ? 'Est.' : 'AI';
    badge.innerHTML = `<span class="sqai-icon">${icon}</span>${label}: ~${predictedMins} min`;
    badge.title = confidence === 'high'
      ? 'AI prediction based on your recent queue history'
      : 'Estimated from typical service times for this category';

    waitDisplay.appendChild(badge);
  }

  /* ── Render best-time heatmap ───────────────────────────── */
  function renderBestTime(container, bttvData) {
    const currentHour = new Date().getHours();
    const { slots, quietHour, peakHour } = bttvData;

    // Only show business hours 7am-9pm (14 slots)
    const visible = slots.filter(s => s.hour >= 7 && s.hour <= 21);

    const isNowBusy   = slots[currentHour]?.level === 'busy';
    const isNowQuiet  = slots[currentHour]?.level === 'quiet';
    const tipText = isNowBusy
      ? `🔴 Currently busy — quieter around ${quietHour.label}`
      : isNowQuiet
        ? `✅ Good time to visit — it's quieter than usual right now`
        : `📊 Moderate traffic now — peak is around ${peakHour.label}`;

    container.innerHTML = `
      <div class="sqai-bttv">
        <div class="sqai-bttv-title">
          <span>📈</span> Best Time to Visit
        </div>
        <div class="sqai-bttv-sub">
          Predicted busyness by hour · Based on queue patterns
        </div>
        <div class="sqai-bttv-row" id="sqaiBars"></div>
        <div class="sqai-bttv-legend">
          <div class="sqai-legend-item"><div class="sqai-legend-dot" style="background:#bbf7d0"></div>Quiet</div>
          <div class="sqai-legend-item"><div class="sqai-legend-dot" style="background:#fde68a"></div>Moderate</div>
          <div class="sqai-legend-item"><div class="sqai-legend-dot" style="background:#fca5a5"></div>Busy</div>
        </div>
        <div class="sqai-bttv-tip ${isNowBusy ? 'busy-tip' : ''}">${tipText}</div>
      </div>`;

    const barsRow = container.querySelector('#sqaiBars');
    visible.forEach(slot => {
      const isNow = slot.hour === currentHour;
      const wrap = document.createElement('div');
      wrap.className = 'sqai-bar-wrap';
      const bar = document.createElement('div');
      bar.className = `sqai-bar ${slot.level}${isNow ? ' now' : ''}`;
      bar.style.height = Math.max(4, slot.score * 0.6) + 'px';
      bar.title = `${slot.label}: ${slot.level}`;
      const lbl = document.createElement('div');
      lbl.className = 'sqai-bar-lbl';
      // Only show label every 2 hours to avoid crowding
      lbl.textContent = slot.hour % 2 === 0 ? slot.label : '';
      if (isNow) lbl.textContent = 'Now';
      wrap.appendChild(bar);
      wrap.appendChild(lbl);
      barsRow.appendChild(wrap);
    });
  }

  /* ── Main init ──────────────────────────────────────────── */
  async function init() {
    if (!window.SkipQsAI || !window.sb) return;

    injectStyles();

    // Get provider ID from URL
    const params = new URLSearchParams(window.location.search);
    const providerId = params.get('id');
    if (!providerId) return;

    // Get provider category
    const { data: prov } = await window.sb
      .from('providers')
      .select('category, capacity')
      .eq('id', providerId)
      .maybeSingle();

    const category = prov?.category || 'default';
    const capacity = prov?.capacity || 1;

    // ── Inject Best Time To Visit heatmap after dept grid ──
    const deptGrid = document.getElementById('deptGrid');
    if (deptGrid) {
      const bttvContainer = document.createElement('div');
      bttvContainer.style.cssText = 'grid-column: 1 / -1;';
      deptGrid.parentNode.insertBefore(bttvContainer, deptGrid.nextSibling);

      // Load heatmap (show skeleton while loading)
      bttvContainer.innerHTML = `<div style="background:#f8fafc;border-radius:16px;height:140px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:.85rem;border:1px solid #e2e8f0;">📊 Loading visit patterns…</div>`;

      window.SkipQsAI.getBestTimeToVisit(window.sb, providerId, category)
        .then(data => renderBestTime(bttvContainer, data))
        .catch(() => { bttvContainer.innerHTML = ''; });
    }

    // ── Add AI prediction badges to dept cards ──
    // Watch for dept cards being rendered (they load async)
    const observer = new MutationObserver(async () => {
      const cards = document.querySelectorAll('.dept-card:not([data-ai-done])');
      if (!cards.length) return;

      // Get current queue depth to calculate position
      const { data: queue } = await window.sb
        .from('queues')
        .select('department_id')
        .eq('provider_id', providerId)
        .in('status', ['waiting', 'serving']);

      const queueDepth = queue?.length || 0;
      const position = queueDepth + 1; // next person to join

      for (const card of cards) {
        card.dataset.aiDone = '1';
        // Get the wait mins shown on the card as a starting point
        const waitNumEl = card.querySelector('.wait-num');
        const currentWait = waitNumEl ? parseInt(waitNumEl.textContent) || 0 : 0;

        // Get department id from the join button href if available
        const deptId = card.dataset.deptId || null;
        const deptQueue = queue?.filter(q => q.department_id === deptId).length || 0;
        const deptPosition = deptQueue + 1;

        try {
          const prediction = await window.SkipQsAI.predictWait(
            window.sb, providerId, category, deptPosition, capacity
          );
          // Only show badge if our prediction differs meaningfully from displayed wait
          const diff = Math.abs(prediction.predictedMins - currentWait);
          if (diff >= 3 || prediction.confidence !== 'low') {
            addPredictionBadge(card, prediction.predictedMins, prediction.confidence);
          }
        } catch (_) {}
      }
    });

    if (deptGrid) {
      observer.observe(deptGrid, { childList: true, subtree: true });
      // Also run immediately in case cards already rendered
      observer.takeRecords();
    }
  }

  onReady(() => {
    // Small delay to let the page's own Supabase queries finish first
    setTimeout(init, 800);
  });

})();
