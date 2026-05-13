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

  /* ── Build logged-in nav cluster (inline-styled, works anywhere) ── */
  function buildCluster(initial, rawName, dashUrl, dashLabel, small) {
    const logoutFn = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";
    const sz = small ? '28px' : '34px';
    const fs = small ? '12px' : '14px';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    div.innerHTML =
      '<a href="' + dashUrl + '" style="padding:7px 14px;border-radius:50px;font-size:13px;font-weight:700;background:#f7f8f8;color:#002f34;border:1.5px solid #e2e8f0;text-decoration:none;">' + dashLabel + '</a>' +
      '<div style="width:' + sz + ';height:' + sz + ';border-radius:50%;background:#23e5db;color:#002f34;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:' + fs + ';flex-shrink:0;cursor:default;" title="' + rawName + '">' + initial + '</div>' +
      '<button onclick="' + logoutFn + '" style="padding:7px 14px;border-radius:50px;font-size:13px;font-weight:700;background:transparent;color:#002f34;border:1.5px solid #e2e8f0;cursor:pointer;font-family:inherit;">Logout</button>';
    return div;
  }

  /* ── Apply to all nav elements ──────────────────────────────── */
  function applyLoggedIn(info, userMeta) {
    const { dashUrl, dashLabel } = info;
    const rawName = userMeta.rawName;
    const initial = userMeta.initial;
    const logoutFn = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";

    // Pattern 8 – sector pages: .header-actions (desktop) ← NEW
    document.querySelectorAll('.header-actions').forEach(function (el) {
      el.innerHTML =
        '<a href="' + dashUrl + '" class="btn btn-ghost">' + dashLabel + '</a>' +
        '<div style="width:34px;height:34px;border-radius:50%;background:#23e5db;color:#002f34;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;cursor:default;" title="' + rawName + '">' + initial + '</div>' +
        '<button onclick="' + logoutFn + '" class="btn btn-ghost" style="cursor:pointer;border:none;font-family:inherit;">Logout</button>';
    });

    // Pattern 9 – sector pages: .mobile-actions (mobile nav) ← NEW
    document.querySelectorAll('.mobile-actions').forEach(function (el) {
      el.innerHTML =
        '<a href="' + dashUrl + '" class="btn btn-ghost">' + dashLabel + '</a>' +
        '<button onclick="' + logoutFn + '" class="btn btn-primary" style="cursor:pointer;border:none;font-family:inherit;">Logout</button>';
    });

    // Pattern 10 – content pages: <a href="login.html"> inside <header>
    //   Replace the login link (and nearby signup link) with a logged-in cluster ← NEW
    var header = document.querySelector('header');
    if (header) {
      var loginAnchor  = header.querySelector('a[href="login.html"]');
      var signupAnchor = header.querySelector('a[href="signup.html"]');
      if (loginAnchor && !loginAnchor.closest('.header-actions')) {
        var parent = loginAnchor.parentElement;
        if (signupAnchor && signupAnchor.parentElement === parent) signupAnchor.remove();
        var cluster = buildCluster(initial, rawName, dashUrl, dashLabel, false);
        parent.replaceChild(cluster, loginAnchor);
      }
    }

    // Pattern 1 – any remaining <a href="login.html"> links NOT yet handled above
    document.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach(function (a) {
      // Skip links inside mobile-nav / hamburger menus (already handled or left as-is)
      if (a.closest('.mobile-nav') || a.closest('.header-actions')) return;
      a.textContent = dashLabel;
      a.href = dashUrl;
    });

    // Hide any remaining signup links that are navigation buttons (not footer or CTA)
    document.querySelectorAll('a[href="signup.html"]').forEach(function (a) {
      if (a.closest('header') || a.closest('nav')) a.style.display = 'none';
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
    const user    = session.user;
    const email   = user.email || '';
    const rawName = (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name))
                    || email.split('@')[0] || '?';
    const userMeta = { rawName: rawName, initial: rawName.charAt(0).toUpperCase() };
    try {
      const info = await getRoleInfo(user.id);
      applyLoggedIn(info, userMeta);
    } catch (_e) {
      applyLoggedIn({ dashUrl: 'dashboard.html', dashLabel: 'My Queues' }, userMeta);
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
