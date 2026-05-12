/* ============================================================
   skipQs – Shared Auth Nav Helper  (role-aware)
   Include after supabase-config.js on any page.

   Role detection:
   - If the logged-in user owns a row in `providers`
       → they are a PROVIDER
       → Hospital provider → hospital-dashboard.html
       → Business provider → business-dashboard.html
   - Otherwise → CUSTOMER → dashboard.html

   Role is cached in sessionStorage (key: sq_role_cache) so we
   only hit the database once per browser session.
   ============================================================ */

(function () {
  'use strict';

  const CACHE_KEY = 'sq_role_cache';

  /* ── Role lookup (cached) ───────────────────────────────────── */
  async function getRoleInfo(userId) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }

    // Support both NEW registrations (user_id = auth uid) and
    // OLD registrations (id = auth uid, from legacy provider-dashboard flow)
    const { data } = await window.sb
      .from('providers')
      .select('is_hospital, category')
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    let info;
    if (data) {
      const isHospital = data.is_hospital === true || data.category === 'Hospital';
      info = {
        isProvider : true,
        isHospital,
        dashUrl    : isHospital ? 'hospital-dashboard.html' : 'business-dashboard.html',
        dashLabel  : 'Dashboard'
      };
    } else {
      info = {
        isProvider : false,
        isHospital : false,
        dashUrl    : 'dashboard.html',
        dashLabel  : 'My Queues'
      };
    }

    sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
    return info;
  }

  /* ── Apply to all nav elements ──────────────────────────────── */
  function applyLoggedIn(info) {
    const { dashUrl, dashLabel } = info;

    // Pattern 1 – any <a href="login.html"> link (most pages)
    document.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach(a => {
      a.textContent = dashLabel;
      a.href = dashUrl;
    });

    // Pattern 2 – #authBtn (join-queue.html style)
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.textContent = dashLabel;
      authBtn.href = dashUrl;
    }

    // Pattern 3 – #loginLink (index.html)
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
      loginLink.textContent = dashLabel;
      loginLink.href = dashUrl;
    }

    // Pattern 4 – #mobileLoginBtn (index.html mobile nav)
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
      mobileLoginBtn.href = dashUrl;
      const p = mobileLoginBtn.querySelector('p');
      if (p) p.textContent = dashLabel;
    }

    // Pattern 5 – #loginBtn / #myQueuesBtn pair (hospital-detail.html, business-detail.html)
    const loginBtn   = document.getElementById('loginBtn');
    const myQueuesBtn = document.getElementById('myQueuesBtn');
    if (loginBtn)    loginBtn.style.display = 'none';
    if (myQueuesBtn) {
      myQueuesBtn.textContent = dashLabel;
      myQueuesBtn.href        = dashUrl;
      myQueuesBtn.style.display = 'inline-flex';
    }

    // Pattern 6 – #dashBtn (index.html desktop nav — always update href/label)
    const dashBtn = document.getElementById('dashBtn');
    if (dashBtn) {
      dashBtn.href        = dashUrl;
      dashBtn.textContent = dashLabel;
    }

    // Pattern 7 – #logoutLink visibility (index.html)
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.style.display = 'inline';
  }

  function applyLoggedOut() {
    // Pattern 1
    document.querySelectorAll('a[href="hospital-dashboard.html"], a[href="business-dashboard.html"], a[href="dashboard.html"]').forEach(a => {
      // Only revert links that were originally login links (skip explicit nav items)
    });
    // Simplest approach: restore any link that looks like it was a dash link
    // Actually: just handle known element IDs

    // Pattern 2
    const authBtn = document.getElementById('authBtn');
    if (authBtn) { authBtn.textContent = 'Login'; authBtn.href = 'login.html'; }

    // Pattern 3
    const loginLink = document.getElementById('loginLink');
    if (loginLink) { loginLink.textContent = 'Login'; loginLink.href = 'login.html'; }

    // Pattern 4
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
      mobileLoginBtn.href = 'login.html';
      const p = mobileLoginBtn.querySelector('p');
      if (p) p.textContent = 'Account';
    }

    // Pattern 5
    const loginBtn    = document.getElementById('loginBtn');
    const myQueuesBtn = document.getElementById('myQueuesBtn');
    if (loginBtn)     loginBtn.style.display = 'inline-flex';
    if (myQueuesBtn)  myQueuesBtn.style.display = 'none';
  }

  /* ── Main update function ───────────────────────────────────── */
  async function updateNav(session) {
    if (!session) {
      sessionStorage.removeItem(CACHE_KEY);
      applyLoggedOut();
      return;
    }
    try {
      const info = await getRoleInfo(session.user.id);
      applyLoggedIn(info);
    } catch {
      // Network error or RLS block — fall back to customer view
      applyLoggedIn({ dashUrl: 'dashboard.html', dashLabel: 'My Queues' });
    }
  }

  /* ── Bootstrap ──────────────────────────────────────────────── */
  function run() {
    if (!window.sb) { setTimeout(run, 50); return; }

    window.sb.auth.getSession().then(({ data: { session } }) => updateNav(session));

    window.sb.auth.onAuthStateChange((_event, session) => {
      // Clear cache on any auth state change so role is re-fetched fresh
      sessionStorage.removeItem(CACHE_KEY);
      updateNav(session);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
