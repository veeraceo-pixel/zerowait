# skipQs AI — Installation Guide

## Files included
- skipqs-ai.js   → Core AI engine (statistics, prediction, anomaly detection)
- ai-widget.js   → Customer-facing: best time heatmap + prediction badge
- ai-provider.js → Provider dashboard: analytics tab + anomaly alerts

## Step 1 — Copy files to your public/ folder
Place all 3 files in your public/ directory alongside app.js, auth-nav.js etc.

## Step 2 — Add to business-detail.html
Find the closing </body> tag and add BEFORE it:

  <script src="skipqs-ai.js"></script>
  <script src="ai-widget.js"></script>

## Step 3 — Add to provider-dashboard.html
Find the closing </body> tag and add BEFORE it:

  <script src="skipqs-ai.js"></script>
  <script src="ai-provider.js"></script>

## Step 4 — Expose curUid globally in provider-dashboard.html
The AI module needs to know the current provider's ID.
Find this line in provider-dashboard.html:

  let curUid, currentCapacity = 1, cfg = null;

Change it to:

  let curUid, currentCapacity = 1, cfg = null;
  // (no other change needed — the AI reads window.curUid automatically)

Then find where curUid is first set (inside the auth session callback):

  curUid = session.user.id;

Add this line right after it:

  window.curUid = curUid;

## That's it — push to GitHub and it's live.

## What you'll see immediately (cold start, no data yet)
- business-detail.html: heatmap built from category priors (salon = busy weekends etc.)
- provider-dashboard: "AI is learning" message with a nice empty state
- Anomaly alerts: active immediately using prior-based thresholds

## What improves over time (with real queue data)
- Week 1: prediction accuracy improves as service durations are learned
- Week 2+: hourly patterns emerge, heatmap reflects real customer behaviour
- Month 1+: anomaly detection uses real Z-scores instead of prior thresholds
