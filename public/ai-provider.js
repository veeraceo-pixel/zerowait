/* ============================================================
   skipQs AI Provider Module  — ai-provider.js
   Adds to provider-dashboard.html:
   1. New "🤖 AI Insights" nav section
   2. Anomaly alert toast when queue spikes
   3. Hourly + daily busyness charts
   4. Trend analysis + today's forecast
   Include after skipqs-ai.js, supabase-config.js, sector-config.js
   ============================================================ */

(function () {
  'use strict';

  /* ── Inject styles ─────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('sqai-prov-styles')) return;
    const s = document.createElement('style');
    s.id = 'sqai-prov-styles';
    s.textContent = `
      /* Anomaly toast */
      .sqai-anomaly-toast {
        position: fixed; top: 16px; left: 50%;
        transform: translateX(-50%) translateY(-120px);
        z-index: 9999; min-width: 300px; max-width: 480px;
        background: #7c2d12; color: white;
        border: 1.5px solid #f97316; border-radius: 14px;
        padding: 1rem 1.2rem; display: flex; gap: .8rem;
        align-items: flex-start; box-shadow: 0 8px 32px rgba(0,0,0,.25);
        transition: transform .4s cubic-bezier(.34,1.56,.64,1);
        font-family: 'Inter', sans-serif;
      }
      .sqai-anomaly-toast.show {
        transform: translateX(-50%) translateY(0);
      }
      .sqai-anomaly-toast.medium { background: #78350f; border-color: #fbbf24; }
      .sqai-anomaly-toast.high   { background: #7c2d12; border-color: #f97316; }
      .sqai-anomaly-toast.critical{ background: #450a0a; border-color: #ef4444; }
      .sqai-at-icon { font-size: 1.4rem; flex-shrink: 0; }
      .sqai-at-body { flex: 1; }
      .sqai-at-title { font-weight: 800; font-size: .9rem; margin-bottom: .2rem; }
      .sqai-at-msg   { font-size: .78rem; opacity: .85; }
      .sqai-at-close { background: none; border: none; color: white; cursor: pointer; font-size: 1.1rem; opacity: .6; padding: 0; align-self: flex-start; }
      .sqai-at-close:hover { opacity: 1; }

      /* AI Insights section */
      .sqai-insights { padding: 0; }
      .sqai-kpi-row {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: .8rem; padding: 1.2rem 1.4rem; border-bottom: 1px solid #e2e8f0;
      }
      .sqai-kpi {
        background: #f8fafc; border-radius: 12px;
        padding: .9rem 1rem; text-align: center;
      }
      .sqai-kpi-val {
        font-size: 1.6rem; font-weight: 800; line-height: 1;
        color: #002f34;
      }
      .sqai-kpi-lbl {
        font-size: .65rem; color: #64748b; font-weight: 700;
        text-transform: uppercase; letter-spacing: .4px;
        margin-top: .3rem;
      }
      .sqai-kpi-trend {
        font-size: .72rem; font-weight: 700; margin-top: .25rem;
      }
      .sqai-kpi-trend.up   { color: #dc2626; }
      .sqai-kpi-trend.down { color: #059669; }
      .sqai-kpi-trend.flat { color: #64748b; }

      /* Charts */
      .sqai-chart-wrap {
        padding: 1.2rem 1.4rem; border-bottom: 1px solid #e2e8f0;
      }
      .sqai-chart-title {
        font-size: .8rem; font-weight: 800; color: #002f34;
        margin-bottom: .8rem; display: flex; align-items: center; gap: .4rem;
      }
      .sqai-h-bars {
        display: flex; align-items: flex-end; gap: 3px; height: 70px;
      }
      .sqai-h-bar-wrap {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; gap: 3px;
      }
      .sqai-h-bar {
        width: 100%; border-radius: 3px 3px 0 0;
        background: linear-gradient(to top, #23e5db, #1bcabf);
        min-height: 3px; transition: height .5s ease;
      }
      .sqai-h-bar.now-hour { background: linear-gradient(to top, #ffce32, #f59e0b); }
      .sqai-h-lbl {
        font-size: .52rem; color: #94a3b8; font-weight: 600;
        text-align: center;
      }
      .sqai-d-bars {
        display: flex; align-items: flex-end; gap: 6px; height: 60px;
        margin-top: .5rem;
      }
      .sqai-d-bar-wrap {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
      }
      .sqai-d-bar {
        width: 100%; border-radius: 4px 4px 0 0;
        background: linear-gradient(to top, #002f34, #005959);
        min-height: 3px;
      }
      .sqai-d-bar.today { background: linear-gradient(to top, #23e5db, #1bcabf); }
      .sqai-d-lbl { font-size: .65rem; color: #94a3b8; font-weight: 700; }

      /* Forecast */
      .sqai-forecast {
        padding: 1rem 1.4rem;
        background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
        margin: 0 1.4rem 1.2rem; border-radius: 12px;
        border: 1.5px solid #bbf7d0;
        display: flex; align-items: center; gap: .8rem;
      }
      .sqai-forecast-icon { font-size: 1.8rem; }
      .sqai-forecast-text {}
      .sqai-forecast-main { font-weight: 800; font-size: .92rem; color: #065f46; }
      .sqai-forecast-sub  { font-size: .75rem; color: #047857; margin-top: .1rem; }
      .sqai-no-data {
        padding: 3rem 1.4rem; text-align: center; color: #94a3b8;
      }
      .sqai-no-data-icon { font-size: 2.5rem; margin-bottom: .6rem; }
      .sqai-no-data h3 { font-size: 1rem; color: #002f34; margin-bottom: .4rem; }
      .sqai-no-data p { font-size: .82rem; max-width: 280px; margin: 0 auto; line-height: 1.5; }

      @media(max-width:540px){
        .sqai-kpi-row { grid-template-columns: repeat(2, 1fr); }
        .sqai-kpi-val { font-size: 1.3rem; }
        .sqai-h-lbl { font-size: .45rem; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Anomaly toast ─────────────────────────────────────── */
  let anomalyToastEl = null;
  let anomalyTimer = null;

  function showAnomalyToast(anomaly) {
    if (!anomalyToastEl) {
      anomalyToastEl = document.createElement('div');
      anomalyToastEl.className = 'sqai-anomaly-toast';
      anomalyToastEl.innerHTML = `
        <div class="sqai-at-icon" id="sqaiAtIcon">⚠️</div>
        <div class="sqai-at-body">
          <div class="sqai-at-title" id="sqaiAtTitle"></div>
          <div class="sqai-at-msg"  id="sqaiAtMsg"></div>
        </div>
        <button class="sqai-at-close" onclick="this.closest('.sqai-anomaly-toast').classList.remove('show')">×</button>`;
      document.body.appendChild(anomalyToastEl);
    }

    const icons = { medium: '📈', high: '⚠️', critical: '🚨' };
    document.getElementById('sqaiAtIcon').textContent  = icons[anomaly.severity] || '⚠️';
    document.getElementById('sqaiAtTitle').textContent = 'Queue Surge Detected';
    document.getElementById('sqaiAtMsg').textContent   = anomaly.message;

    anomalyToastEl.className = `sqai-anomaly-toast ${anomaly.severity}`;
    requestAnimationFrame(() => anomalyToastEl.classList.add('show'));

    clearTimeout(anomalyTimer);
    anomalyTimer = setTimeout(() => anomalyToastEl?.classList.remove('show'), 8000);
  }

  /* ── Render AI insights section HTML ───────────────────── */
  function renderInsights(section, insights) {
    if (!insights.hasData) {
      section.innerHTML = `
        <div class="sqai-no-data">
          <div class="sqai-no-data-icon">🤖</div>
          <h3>AI is learning your patterns</h3>
          <p>${insights.message || 'Serve your first customers to unlock AI-powered insights and predictions.'}</p>
        </div>`;
      return;
    }

    const trendIcon  = insights.trend === 'improving' ? '⬇️' : insights.trend === 'slower' ? '⬆️' : '➡️';
    const trendClass = insights.trend === 'improving' ? 'down' : insights.trend === 'slower' ? 'up' : 'flat';
    const trendText  = insights.trend === 'improving'
      ? `${insights.trendPct}% faster recently`
      : insights.trend === 'slower'
        ? `${insights.trendPct}% slower recently`
        : 'Stable';

    const currentHour = new Date().getHours();
    const currentDay  = new Date().getDay();

    // KPI cards
    section.innerHTML = `
      <div class="sqai-kpi-row">
        <div class="sqai-kpi">
          <div class="sqai-kpi-val">${insights.avgServiceMins}m</div>
          <div class="sqai-kpi-lbl">Avg Service</div>
          <div class="sqai-kpi-trend ${trendClass}">${trendIcon} ${trendText}</div>
        </div>
        <div class="sqai-kpi">
          <div class="sqai-kpi-val">${insights.totalServed}</div>
          <div class="sqai-kpi-lbl">Total Served</div>
          <div class="sqai-kpi-trend flat">~${insights.avgPerDay}/day avg</div>
        </div>
        <div class="sqai-kpi">
          <div class="sqai-kpi-val">${insights.peakHourLabel}</div>
          <div class="sqai-kpi-lbl">Peak Hour</div>
          <div class="sqai-kpi-trend flat">Busiest time</div>
        </div>
      </div>

      <!-- Today's forecast -->
      <div style="padding:.8rem 1.4rem 0;">
        <div class="sqai-forecast">
          <div class="sqai-forecast-icon">🔮</div>
          <div class="sqai-forecast-text">
            <div class="sqai-forecast-main">Today: ~${insights.todayForecast} customers expected</div>
            <div class="sqai-forecast-sub">Based on same day in previous weeks</div>
          </div>
        </div>
      </div>

      <!-- Hourly chart -->
      <div class="sqai-chart-wrap">
        <div class="sqai-chart-title">⏰ Busy Hours</div>
        <div class="sqai-h-bars" id="sqaiHBars"></div>
      </div>

      <!-- Daily chart -->
      <div class="sqai-chart-wrap">
        <div class="sqai-chart-title">📅 Busiest Days</div>
        <div class="sqai-d-bars" id="sqaiDBars"></div>
      </div>`;

    // Hourly bars (7am–9pm)
    const hBars = document.getElementById('sqaiHBars');
    if (hBars) {
      insights.hourlyData
        .filter(d => d.hour >= 7 && d.hour <= 21)
        .forEach(d => {
          const isNow = d.hour === currentHour;
          const wrap = document.createElement('div');
          wrap.className = 'sqai-h-bar-wrap';
          wrap.innerHTML = `
            <div class="sqai-h-bar${isNow ? ' now-hour' : ''}"
                 style="height:${Math.max(4, d.pct * 0.68)}px"
                 title="${d.label}: ${d.count || '~'} customers"></div>
            <div class="sqai-h-lbl">${d.hour % 2 === 0 ? d.label : ''}</div>`;
          hBars.appendChild(wrap);
        });
    }

    // Daily bars
    const dBars = document.getElementById('sqaiDBars');
    if (dBars) {
      insights.dailyData.forEach(d => {
        const isToday = d.day === currentDay;
        const wrap = document.createElement('div');
        wrap.className = 'sqai-d-bar-wrap';
        wrap.innerHTML = `
          <div class="sqai-d-bar${isToday ? ' today' : ''}"
               style="height:${Math.max(4, d.pct * 0.58)}px"
               title="${d.label}: ${d.count || '~'} customers"></div>
          <div class="sqai-d-lbl">${d.label}</div>`;
        dBars.appendChild(wrap);
      });
    }
  }

  /* ── Inject AI nav button and section ──────────────────── */
  function injectDashboardSection() {
    const sidebar = document.getElementById('sidebar');
    const logoutBtn = sidebar?.querySelector('button[onclick="handleLogout()"]');
    if (!logoutBtn || document.getElementById('sec-ai')) return;

    // Add nav button before logout
    const aiNavBtn = document.createElement('button');
    aiNavBtn.className = 'nav-link';
    aiNavBtn.innerHTML = '<span class="nav-icon">🤖</span><span>AI Insights</span>';
    aiNavBtn.onclick = () => {
      if (typeof showSection === 'function') showSection('ai', aiNavBtn);
      loadAIInsights();
    };
    sidebar.insertBefore(aiNavBtn, logoutBtn);

    // Add section to main
    const main = document.querySelector('main');
    if (!main) return;

    const sec = document.createElement('section');
    sec.id = 'sec-ai';
    sec.className = 'content-card sqai-insights';
    sec.style.display = 'none';
    sec.innerHTML = `
      <div class="card-header">
        <span>🤖 AI Insights</span>
        <span style="font-size:.72rem;color:#64748b;font-weight:600;">Updates as you serve customers</span>
      </div>
      <div id="sqaiInsightsBody">
        <div class="sqai-no-data">
          <div class="sqai-no-data-icon">⏳</div>
          <h3>Loading insights…</h3>
        </div>
      </div>`;
    main.appendChild(sec);
  }

  /* ── Load and render insights ─────────────────────────── */
  async function loadAIInsights() {
    if (!window.SkipQsAI || !window.sb || !window.curUid) return;
    const body = document.getElementById('sqaiInsightsBody');
    if (!body) return;

    // Get category
    const { data: prov } = await window.sb
      .from('providers').select('category').eq('id', window.curUid).maybeSingle();
    const category = prov?.category || 'default';

    const insights = await window.SkipQsAI.getProviderInsights(window.sb, window.curUid, category);
    renderInsights(body, insights);
  }

  /* ── Anomaly polling ───────────────────────────────────── */
  let lastAnomalyTime = 0;
  const ANOMALY_COOLDOWN = 5 * 60 * 1000; // max one alert per 5 mins

  async function pollAnomalies() {
    if (!window.SkipQsAI || !window.sb || !window.curUid) return;
    if (Date.now() - lastAnomalyTime < ANOMALY_COOLDOWN) return;

    const { data: prov } = await window.sb
      .from('providers').select('category').eq('id', window.curUid).maybeSingle();
    const category = prov?.category || 'default';

    const result = await window.SkipQsAI.detectAnomaly(window.sb, window.curUid, category);
    if (result.isAnomaly) {
      lastAnomalyTime = Date.now();
      showAnomalyToast(result);
    }
  }

  /* ── Boot ──────────────────────────────────────────────── */
  function init() {
    if (!window.SkipQsAI) return;
    injectStyles();
    injectDashboardSection();

    // Poll for anomalies every 2 minutes
    setInterval(pollAnomalies, 2 * 60 * 1000);
    // First check after 30 seconds (give dashboard time to fully load)
    setTimeout(pollAnomalies, 30 * 1000);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

})();
