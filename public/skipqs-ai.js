/* ============================================================
   skipQs AI Engine  — skipqs-ai.js
   100% free. No external API. Runs in the browser.

   Features:
   1. Wait time prediction  (cold-start + history-weighted)
   2. Best time to visit    (hourly heatmap from history)
   3. Anomaly detection     (Z-score on queue growth rate)
   4. Provider insights     (trends, peak hours, avg service time)

   All models improve automatically as real queue data accumulates.
   With no history (cold start) they fall back to sensible defaults
   based on category and time of day.
   ============================================================ */

window.SkipQsAI = (function () {
  'use strict';

  /* ── COLD-START PRIORS ──────────────────────────────────────
     When there is no history, use these category-based defaults.
     Source: industry averages for each service type.
     Format: { avgServiceMins, peakHours: [hourStart, hourEnd], peakDays: [0-6] }
  ─────────────────────────────────────────────────────────── */
  const PRIORS = {
    Hospital:    { avgServiceMins: 25, peakHours: [9,12],  peakDays: [1,2,3,4,5] },
    Clinic:      { avgServiceMins: 20, peakHours: [9,11],  peakDays: [1,2,3,4,5] },
    Pharmacy:    { avgServiceMins: 8,  peakHours: [9,10],  peakDays: [1,2,3,4,5] },
    Salon:       { avgServiceMins: 40, peakHours: [11,14], peakDays: [5,6,0] },
    Barber:      { avgServiceMins: 25, peakHours: [10,13], peakDays: [5,6,0] },
    Bank:        { avgServiceMins: 12, peakHours: [10,12], peakDays: [1,2,3,4,5] },
    Restaurant:  { avgServiceMins: 30, peakHours: [12,14], peakDays: [5,6,0] },
    Gym:         { avgServiceMins: 45, peakHours: [7,9],   peakDays: [1,2,3,4,5] },
    Government:  { avgServiceMins: 35, peakHours: [10,12], peakDays: [1,2,3,4] },
    Kirana:      { avgServiceMins: 8,  peakHours: [17,20], peakDays: [5,6,0] },
    CarWash:     { avgServiceMins: 25, peakHours: [10,12], peakDays: [5,6,0] },
    Repair:      { avgServiceMins: 30, peakHours: [11,14], peakDays: [1,2,3,4,5] },
    default:     { avgServiceMins: 15, peakHours: [10,13], peakDays: [1,2,3,4,5] }
  };

  function getPrior(category) {
    return PRIORS[category] || PRIORS.default;
  }

  /* ── CACHE ──────────────────────────────────────────────────
     Cache predictions in localStorage so repeat visitors
     see instant predictions while fresh ones load in background.
  ─────────────────────────────────────────────────────────── */
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function cacheSet(key, value) {
    try {
      localStorage.setItem('sqai_' + key, JSON.stringify({ v: value, t: Date.now() }));
    } catch (_) {}
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem('sqai_' + key);
      if (!raw) return null;
      const { v, t } = JSON.parse(raw);
      if (Date.now() - t > CACHE_TTL) return null;
      return v;
    } catch (_) { return null; }
  }

  /* ── STATISTICS HELPERS ─────────────────────────────────── */

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, x) => s + x, 0) / arr.length;
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
  }

  // Exponential weighted moving average — recent data matters more
  function ewma(arr, alpha = 0.3) {
    if (!arr.length) return 0;
    if (arr.length === 1) return arr[0]; // single element — no smoothing to apply
    // Use first element as explicit initial accumulator so the formula is applied
    // correctly from index 1 onwards: alpha*x + (1-alpha)*prev
    return arr.slice(1).reduce(
      (acc, x) => alpha * x + (1 - alpha) * acc,
      arr[0]
    );
  }

  // Hour-of-day multiplier: how busy is this hour vs average?
  function hourMultiplier(hourCounts, currentHour) {
    const values = Object.values(hourCounts);
    if (!values.length) return 1;
    const avg = mean(values);
    if (!avg) return 1;
    return (hourCounts[currentHour] || avg) / avg;
  }

  /* ── 1. WAIT TIME PREDICTION ────────────────────────────────
     Uses:
     a) Completed queue entries (joined_at → completed_at) to learn
        actual service durations per provider
     b) Current queue depth + capacity for position math
     c) Hour-of-day multiplier learned from history
     d) Cold-start prior if no history available

     Returns: { predictedMins, confidence, source, breakdown }
  ─────────────────────────────────────────────────────────── */
  async function predictWait(sb, providerId, category, position, capacity) {
    const cacheKey = `wait_${providerId}_${position}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const prior = getPrior(category);
    const now = new Date();
    const currentHour = now.getHours();

    let avgServiceMins = prior.avgServiceMins;
    let confidence = 'low';
    let source = 'prior';
    let hourMult = 1;

    try {
      // Fetch last 200 completed entries for this provider
      const { data: history } = await sb
        .from('queues')
        .select('joined_at, completed_at, served_at, service_duration')
        .eq('provider_id', providerId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .not('joined_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (history && history.length >= 5) {
        // Calculate actual service durations from real data
        const durations = history
          .map(r => {
            const start = r.served_at || r.joined_at;
            const end = r.completed_at;
            if (!start || !end) return null;
            const mins = (new Date(end) - new Date(start)) / 60000;
            return mins > 0 && mins < 240 ? mins : null; // ignore outliers >4hrs
          })
          .filter(Boolean);

        if (durations.length >= 3) {
          // Weight recent entries more heavily
          avgServiceMins = ewma(durations.slice(0, 20).reverse(), 0.25);
          source = 'history';
          confidence = durations.length >= 20 ? 'high' : 'medium';
        }

        // Build hour-of-day frequency map from completed entries
        const hourCounts = {};
        history.forEach(r => {
          const h = new Date(r.joined_at).getHours();
          hourCounts[h] = (hourCounts[h] || 0) + 1;
        });
        hourMult = hourMultiplier(hourCounts, currentHour);
      }
    } catch (_) {
      // Network error — use prior
    }

    // Final prediction: position × avg service time ÷ capacity × hour multiplier
    const pos = Math.max(0, position - 1); // people ahead of us
    const raw = (pos * avgServiceMins) / Math.max(1, capacity);
    const predictedMins = Math.max(1, Math.round(raw * hourMult));

    const result = {
      predictedMins,
      confidence,
      source,
      avgServiceMins: Math.round(avgServiceMins),
      hourMultiplier: Math.round(hourMult * 100) / 100,
      breakdown: `${pos} ahead × ${Math.round(avgServiceMins)}min avg ÷ ${capacity} capacity`
    };

    cacheSet(cacheKey, result);
    return result;
  }

  /* ── 2. BEST TIME TO VISIT ──────────────────────────────────
     Returns a 24-slot array (one per hour) with busyness scores 0-100.
     Cold start: uses prior peak hours to shape the curve.
     With history: built from real joined_at timestamps.

     Returns: { slots: [{hour, label, score, level}], peakHour, quietHour }
  ─────────────────────────────────────────────────────────── */
  async function getBestTimeToVisit(sb, providerId, category) {
    const cacheKey = `bttv_${providerId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const prior = getPrior(category);
    const scores = new Array(24).fill(0);

    try {
      const { data: history } = await sb
        .from('queues')
        .select('joined_at')
        .eq('provider_id', providerId)
        .not('joined_at', 'is', null)
        .limit(500);

      if (history && history.length >= 10) {
        // Count queue entries per hour of day
        history.forEach(r => {
          const h = new Date(r.joined_at).getHours();
          scores[h]++;
        });
      } else {
        // Cold start: build a bell-curve around peak hours from prior
        const [peakStart, peakEnd] = prior.peakHours;
        const peakMid = (peakStart + peakEnd) / 2;
        for (let h = 0; h < 24; h++) {
          const dist = Math.abs(h - peakMid);
          scores[h] = Math.max(0, 10 - dist * 1.5);
        }
        // Business hours baseline (8am-8pm)
        for (let h = 8; h <= 20; h++) scores[h] = Math.max(scores[h], 2);
        // Closed hours
        for (let h = 0; h < 7; h++)  scores[h] = 0;
        for (let h = 21; h < 24; h++) scores[h] = 0;
      }
    } catch (_) {
      // Use cold start
      const [peakStart, peakEnd] = prior.peakHours;
      const peakMid = (peakStart + peakEnd) / 2;
      for (let h = 0; h < 24; h++) {
        scores[h] = Math.max(0, 10 - Math.abs(h - peakMid) * 1.5);
      }
    }

    // Normalise to 0-100
    const maxScore = Math.max(...scores, 1);
    const normalised = scores.map(s => Math.round((s / maxScore) * 100));

    const slots = normalised.map((score, hour) => {
      const h = hour % 12 || 12;
      const ampm = hour < 12 ? 'am' : 'pm';
      let level = 'quiet';
      if (score > 70) level = 'busy';
      else if (score > 40) level = 'moderate';
      return { hour, label: `${h}${ampm}`, score, level };
    });

    // Find best and worst hours (during business hours 7am-9pm)
    const business = slots.filter(s => s.hour >= 7 && s.hour <= 21);
    const quietHour = business.reduce((a, b) => a.score <= b.score ? a : b);
    const peakHour  = business.reduce((a, b) => a.score >= b.score ? a : b);

    const result = { slots, peakHour, quietHour };
    cacheSet(cacheKey, result);
    return result;
  }

  /* ── 3. ANOMALY DETECTION ───────────────────────────────────
     Watches the rate at which people are joining the queue.
     If the current rate is more than 2 standard deviations above
     the historical average for this hour, fire an anomaly alert.

     Returns: { isAnomaly, severity, message, currentRate, expectedRate }
  ─────────────────────────────────────────────────────────── */
  async function detectAnomaly(sb, providerId, category) {
    const prior = getPrior(category);
    const now = new Date();
    const currentHour = now.getHours();

    try {
      // Count how many joined in the last 10 minutes (current rate)
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      const { count: recentCount } = await sb
        .from('queues')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .gte('joined_at', tenMinsAgo);

      const currentRate = (recentCount || 0) * 6; // extrapolate to per-hour

      // Get historical rates for this hour across past 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
      const { data: historical } = await sb
        .from('queues')
        .select('joined_at')
        .eq('provider_id', providerId)
        .gte('joined_at', thirtyDaysAgo);

      if (!historical || historical.length < 10) {
        // Not enough history — use prior to set expectation
        const isPeak = currentHour >= prior.peakHours[0] && currentHour <= prior.peakHours[1];
        const expectedRate = isPeak ? 8 : 3;
        if (currentRate > expectedRate * 2.5) {
          return {
            isAnomaly: true, severity: 'high',
            message: `Queue growing ${Math.round(currentRate / expectedRate)}× faster than normal for this time`,
            currentRate, expectedRate
          };
        }
        return { isAnomaly: false, currentRate, expectedRate };
      }

      // Group historical entries by (date, hour) to get hourly rates
      const hourlyRates = {};
      historical.forEach(r => {
        const d = new Date(r.joined_at);
        const h = d.getHours();
        if (h !== currentHour) return;
        const dayKey = d.toISOString().slice(0, 10);
        hourlyRates[dayKey] = (hourlyRates[dayKey] || 0) + 1;
      });

      const rates = Object.values(hourlyRates);
      if (rates.length < 3) {
        return { isAnomaly: false, currentRate, expectedRate: mean(rates) || 3 };
      }

      const expectedRate = mean(rates);
      const sd = stddev(rates);
      const zScore = sd > 0 ? (currentRate - expectedRate) / sd : 0;

      let isAnomaly = false, severity = 'none', message = '';

      if (zScore > 3) {
        isAnomaly = true; severity = 'critical';
        message = `🚨 Extremely unusual surge — queue filling ${Math.round(zScore)}σ above normal`;
      } else if (zScore > 2) {
        isAnomaly = true; severity = 'high';
        message = `⚠️ Queue growing much faster than usual for this hour`;
      } else if (zScore > 1.5) {
        isAnomaly = true; severity = 'medium';
        message = `📈 Busier than normal — consider increasing capacity`;
      }

      return { isAnomaly, severity, message, currentRate, expectedRate: Math.round(expectedRate), zScore: Math.round(zScore * 10) / 10 };

    } catch (_) {
      return { isAnomaly: false, currentRate: 0, expectedRate: 0 };
    }
  }

  /* ── 4. PROVIDER INSIGHTS ───────────────────────────────────
     Computes analytics for the provider dashboard:
     - Average service time (trend: improving / worsening)
     - Busiest hours chart data
     - Busiest days of week
     - Today's forecast vs same day last week
     - Total served, avg per day

     Returns a rich object the dashboard renders directly.
  ─────────────────────────────────────────────────────────── */
  async function getProviderInsights(sb, providerId, category) {
    const cacheKey = `insights_${providerId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const prior = getPrior(category);
    const empty = {
      hasData: false,
      avgServiceMins: prior.avgServiceMins,
      trend: 'stable',
      trendPct: 0,
      peakHour: prior.peakHours[0],
      peakHourLabel: fmtHour(prior.peakHours[0]),
      hourlyData: buildColdStartHourly(prior),
      dailyData: buildColdStartDaily(prior),
      totalServed: 0,
      avgPerDay: 0,
      todayForecast: Math.round(prior.avgServiceMins * 8),
      message: 'Not enough data yet — insights improve as customers use your queue.'
    };

    try {
      const { data: rows } = await sb
        .from('queues')
        .select('joined_at, completed_at, served_at, service_duration, status')
        .eq('provider_id', providerId)
        .in('status', ['completed'])
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(500);

      if (!rows || rows.length < 5) {
        cacheSet(cacheKey, empty);
        return empty;
      }

      // ── Service duration trend ──
      const durations = rows
        .map(r => {
          const s = r.served_at || r.joined_at;
          const e = r.completed_at;
          if (!s || !e) return null;
          const m = (new Date(e) - new Date(s)) / 60000;
          return m > 0 && m < 240 ? m : null;
        })
        .filter(Boolean);

      const avgServiceMins = Math.round(ewma(durations.slice(0, 30).reverse(), 0.25));
      const oldAvg = durations.length > 20 ? mean(durations.slice(20, 40)) : avgServiceMins;
      const trendPct = oldAvg ? Math.round(((avgServiceMins - oldAvg) / oldAvg) * 100) : 0;
      const trend = trendPct < -5 ? 'improving' : trendPct > 5 ? 'slower' : 'stable';

      // ── Hourly distribution ──
      const hourCounts = new Array(24).fill(0);
      rows.forEach(r => { hourCounts[new Date(r.joined_at).getHours()]++; });
      const maxH = Math.max(...hourCounts, 1);
      const hourlyData = hourCounts.map((count, h) => ({
        hour: h, label: fmtHour(h),
        count, pct: Math.round((count / maxH) * 100)
      }));
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

      // ── Daily distribution (0=Sun … 6=Sat) ──
      const dayCounts = new Array(7).fill(0);
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      rows.forEach(r => { dayCounts[new Date(r.joined_at).getDay()]++; });
      const maxD = Math.max(...dayCounts, 1);
      const dailyData = dayCounts.map((count, d) => ({
        day: d, label: dayNames[d],
        count, pct: Math.round((count / maxD) * 100)
      }));

      // ── Today's forecast vs same day last week ──
      const todayDow = new Date().getDay();
      const sameDayLastWeek = rows.filter(r => new Date(r.joined_at).getDay() === todayDow);
      const todayForecast = sameDayLastWeek.length
        ? Math.round(mean(sameDayLastWeek.map(r => 1)) * dayCounts[todayDow])
        : dayCounts[todayDow] || 0;

      // ── Total stats ──
      const dates = new Set(rows.map(r => r.completed_at?.slice(0,10)));
      const avgPerDay = dates.size ? Math.round(rows.length / dates.size) : rows.length;

      const result = {
        hasData: true,
        avgServiceMins,
        trend,
        trendPct: Math.abs(trendPct),
        peakHour,
        peakHourLabel: fmtHour(peakHour),
        hourlyData,
        dailyData,
        totalServed: rows.length,
        avgPerDay,
        todayForecast: dayCounts[todayDow] || avgPerDay,
        message: null
      };

      cacheSet(cacheKey, result);
      return result;

    } catch (_) {
      return empty;
    }
  }

  /* ── HELPERS ────────────────────────────────────────────── */
  function fmtHour(h) {
    const h12 = h % 12 || 12;
    return h12 + (h < 12 ? 'am' : 'pm');
  }

  function buildColdStartHourly(prior) {
    const [ps, pe] = prior.peakHours;
    const mid = (ps + pe) / 2;
    return Array.from({ length: 24 }, (_, h) => {
      const score = Math.max(0, Math.round(100 - Math.abs(h - mid) * 12));
      const inHours = h >= 7 && h <= 21;
      return { hour: h, label: fmtHour(h), count: 0, pct: inHours ? score : 0 };
    });
  }

  function buildColdStartDaily(prior) {
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return names.map((label, d) => ({
      day: d, label, count: 0,
      pct: prior.peakDays.includes(d) ? 80 : 30
    }));
  }

  /* ── PUBLIC API ─────────────────────────────────────────── */
  return { predictWait, getBestTimeToVisit, detectAnomaly, getProviderInsights };

})();
