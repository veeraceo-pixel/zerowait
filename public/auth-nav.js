/* ============================================================
   skipQs – Shared Auth Nav Helper  (role-aware)
   Include after supabase-config.js on any page.

   Role detection:
   - If the logged-in user owns a row in `providers`
       → they are a PROVIDER
       → Hospital provider → hospital-dashboard.html
       → Business provider → provider-dashboard.html
   - Otherwise → CUSTOMER → dashboard.html

   Role is cached in sessionStorage (key: sq_role_cache) so we
   only hit the database once per browser session.
   ============================================================ */

(function () {
  'use strict';

  const CACHE_KEY = 'sq_role_cache';

  /* ── XSS sanitiser ──────────────────────────────────────────────
     FIX: rawName and initial come from user-controlled metadata
     (display_name / full_name fields set at sign-up). They must be
     escaped before being placed into innerHTML / HTML attributes.
  ─────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /* ── Role lookup (cached) ───────────────────────────────────── */
  async function getRoleInfo(userId) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }

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
        dashUrl    : isHospital ? 'hospital-dashboard.html' : 'provider-dashboard.html',
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

  /* ── Build a self-contained logged-in cluster ─────────────────
     Works on ANY background colour:
     - dashLink: light pill  (#f7f8f8 bg, dark text) — always visible
     - avatar:   accent circle (#23e5db bg, dark text) — always visible
     - logout:   ghost pill (white/25% bg, white text) — visible on dark or light bg

     FIX: rawName and initial are escaped via esc() before being
     written into HTML attribute values and text nodes.
  ─────────────────────────────────────────────────────────────── */
  function buildCluster(initial, rawName, dashUrl, dashLabel) {
    const logoutFn = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";
    const div = document.createElement('div');
    div.className = 'sq-auth-cluster';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    // FIX: esc() applied to all user-supplied values in HTML attributes and content.
    div.innerHTML =
      '<a href="' + esc(dashUrl) + '" class="sq-dash-link" style="padding:8px 16px;border-radius:50px;font-size:13px;font-weight:700;background:#23e5db;color:#002f34;text-decoration:none;white-space:nowrap;border:none;">' + esc(dashLabel) + '</a>' +
      '<div class="sq-avatar" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;cursor:default;border:2px solid rgba(255,255,255,.4);" title="' + esc(rawName) + '">' + esc(initial) + '</div>' +
      '<button onclick="' + logoutFn + '" style="padding:8px 16px;border-radius:50px;font-size:13px;font-weight:700;background:rgba(255,255,255,.15);color:white;border:1.5px solid rgba(255,255,255,.35);cursor:pointer;font-family:inherit;white-space:nowrap;">Logout</button>';
    return div;
  }

  /* ── Light-background variant (for white-header content pages) ── */
  function buildClusterLight(initial, rawName, dashUrl, dashLabel) {
    const logoutFn = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";
    const div = document.createElement('div');
    div.className = 'sq-auth-cluster';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    // FIX: esc() applied to all user-supplied values.
    div.innerHTML =
      '<a href="' + esc(dashUrl) + '" style="padding:8px 16px;border-radius:50px;font-size:13px;font-weight:700;background:#23e5db;color:#002f34;text-decoration:none;white-space:nowrap;">' + esc(dashLabel) + '</a>' +
      '<div style="width:34px;height:34px;border-radius:50%;background:#23e5db;color:#002f34;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;cursor:default;border:2px solid rgba(0,47,52,.15);" title="' + esc(rawName) + '">' + esc(initial) + '</div>' +
      '<button onclick="' + logoutFn + '" style="padding:8px 16px;border-radius:50px;font-size:13px;font-weight:700;background:#f7f8f8;color:#002f34;border:1.5px solid #e2e8f0;cursor:pointer;font-family:inherit;white-space:nowrap;">Logout</button>';
    return div;
  }

  /* ── Detect if a header has a dark background ─────────────────── */
  function headerIsDark(header) {
    if (!header) return false;
    const bg = (header.style.background || header.style.backgroundColor || '').toLowerCase();
    // Check inline style for white/light background keywords
    if (bg.includes('white') || bg.includes('#fff') || bg.includes('rgb(255')) return false;
    // Check computed background
    try {
      const computed = window.getComputedStyle(header).backgroundColor;
      if (!computed || computed === 'rgba(0, 0, 0, 0)' || computed === 'transparent') return true;
      const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const brightness = (parseInt(m[1]) * 299 + parseInt(m[2]) * 587 + parseInt(m[3]) * 114) / 1000;
        return brightness < 128;
      }
    } catch (_) {}
    return true; // default to dark if unsure (skipQs brand is dark)
  }

  /* ── Apply to all nav elements ──────────────────────────────── */
  function applyLoggedIn(info, userMeta) {
    const { dashUrl, dashLabel } = info;
    const { rawName, initial }   = userMeta;
    const logoutFn = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";

    /* ─── INDEX.HTML — dedicated IDs pattern ─────────────────────
       index.html uses #dashBtn + #loginLink + #logoutLink.
       We show #dashBtn (My Queues pill), insert avatar, style logout.
       Pattern 10 is explicitly skipped for this page.
    ─────────────────────────────────────────────────────────────── */
    const dashBtn   = document.getElementById('dashBtn');
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');

    if (dashBtn && loginLink && logoutLink) {
      // Show "My Queues" pill (reuse #loginLink which already has pill class)
      loginLink.textContent = dashLabel;
      loginLink.href        = dashUrl;

      // Insert avatar next to it if not already present
      if (!document.getElementById('sq-idx-avatar')) {
        const avatar = document.createElement('div');
        avatar.id = 'sq-idx-avatar';
        // FIX: use textContent / title property (not innerHTML) so no escaping needed.
        avatar.title = rawName;
        avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#23e5db;color:#002f34;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;cursor:default;';
        avatar.textContent = initial;
        loginLink.insertAdjacentElement('afterend', avatar);
      } else {
        document.getElementById('sq-idx-avatar').textContent = initial;
        document.getElementById('sq-idx-avatar').title = rawName;
      }

      // Style & show logout link for dark header
      logoutLink.style.cssText = 'display:inline;color:rgba(255,255,255,.75);font-size:.82rem;font-weight:600;padding:7px 12px;border-radius:8px;text-decoration:none;cursor:pointer;';
      logoutLink.textContent   = 'Logout';

      // Keep #dashBtn hidden (loginLink already serves as My Queues)
      dashBtn.style.display = 'none';
    }

    /* ─── Pattern 8 – sector pages: .header-actions (desktop) ─── */
    document.querySelectorAll('.header-actions').forEach(function (el) {
      // Avoid double-injection
      if (el.querySelector('.sq-auth-cluster')) return;
      // Remove old login/signup links
      el.innerHTML = '';
      el.appendChild(buildCluster(initial, rawName, dashUrl, dashLabel));
    });

    /* ─── Pattern 9 – sector pages: .mobile-actions ─────────────── */
    document.querySelectorAll('.mobile-actions').forEach(function (el) {
      if (el.querySelector('.sq-auth-cluster')) return;
      el.innerHTML = '';
      const logoutFnStr = "(async()=>{await window.sb.auth.signOut();window.location.href='index.html';})()";
      // FIX: dashUrl/dashLabel escaped; these values originate from
      // our own code (not user input) but we escape defensively.
      el.innerHTML =
        '<a href="' + esc(dashUrl) + '" style="padding:8px 18px;border-radius:50px;font-size:13px;font-weight:700;background:#23e5db;color:#002f34;text-decoration:none;">' + esc(dashLabel) + '</a>' +
        '<button onclick="' + logoutFnStr + '" style="padding:8px 18px;border-radius:50px;font-size:13px;font-weight:700;background:rgba(255,255,255,.15);color:white;border:1.5px solid rgba(255,255,255,.3);cursor:pointer;font-family:inherit;">Logout</button>';
    });

    /* ─── Pattern 10 – content pages with inline login/signup links
       ONLY fires when index.html-specific IDs are NOT present.
       Detects header background to choose dark or light cluster.
    ─────────────────────────────────────────────────────────────── */
    if (!dashBtn) {
      var header = document.querySelector('header');
      if (header) {
        // Remove any previously-injected cluster first
        header.querySelectorAll('.sq-auth-cluster').forEach(function(c){ c.remove(); });

        var loginAnchor  = header.querySelector('a[href="login.html"]');
        var signupAnchor = header.querySelector('a[href="signup.html"]');

        if (loginAnchor) {
          var parent  = loginAnchor.parentElement;
          if (signupAnchor && signupAnchor.parentElement === parent) signupAnchor.remove();
          var isDark   = headerIsDark(header);
          var cluster  = isDark ? buildCluster(initial, rawName, dashUrl, dashLabel)
                                : buildClusterLight(initial, rawName, dashUrl, dashLabel);
          parent.replaceChild(cluster, loginAnchor);
        }
      }
    }

    /* ─── Mobile drawer login/signup links (content pages) ──────── */
    document.querySelectorAll('.hiw-mobile-drawer a[href="login.html"], .mob-drawer a[href="login.html"]').forEach(function(a){
      a.textContent = '👤 ' + dashLabel;
      a.href = dashUrl;
    });
    document.querySelectorAll('.hiw-mobile-drawer a[href="signup.html"], .mob-drawer a[href="signup.html"]').forEach(function(a){
      a.style.display = 'none';
    });

    /* ─── Pattern 2 – #authBtn (join-queue.html style) ──────────── */
    const authBtn = document.getElementById('authBtn');
    if (authBtn) { authBtn.textContent = dashLabel; authBtn.href = dashUrl; }

    /* ─── Pattern 4 – #mobileLoginBtn (index.html bottom mobile nav) */
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
      mobileLoginBtn.href = dashUrl;
      const p = mobileLoginBtn.querySelector('p');
      if (p) p.textContent = dashLabel;
    }

    /* ─── Pattern 4b – #mobNavLoginBtn (index.html mobile dropdown) */
    const mobNavLoginBtn = document.getElementById('mobNavLoginBtn');
    if (mobNavLoginBtn) {
      mobNavLoginBtn.textContent = dashLabel;
      mobNavLoginBtn.href = dashUrl;
      // Hide the Sign Up button in the same actions row
      const actionsRow = mobNavLoginBtn.parentElement;
      if (actionsRow) {
        const signupBtn = actionsRow.querySelector('a[href="signup.html"]');
        if (signupBtn) signupBtn.style.display = 'none';
      }
    }

    /* ─── Pattern 5 – #loginBtn / #myQueuesBtn pair ─────────────── */
    const loginBtn2   = document.getElementById('loginBtn');
    const myQueuesBtn = document.getElementById('myQueuesBtn');
    if (loginBtn2)    loginBtn2.style.display = 'none';
    if (myQueuesBtn) {
      myQueuesBtn.textContent = dashLabel;
      myQueuesBtn.href        = dashUrl;
      myQueuesBtn.style.display = 'inline-flex';
    }
  }

  /* ── Restore logged-out state ───────────────────────────────── */
  function applyLoggedOut() {
    // index.html IDs
    const dashBtn    = document.getElementById('dashBtn');
    const loginLink  = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');
    if (loginLink) { loginLink.textContent = 'Login'; loginLink.href = 'login.html'; }
    if (dashBtn)   dashBtn.style.display   = 'none';
    if (logoutLink) logoutLink.style.display = 'none';
    // Remove injected avatar
    const av = document.getElementById('sq-idx-avatar');
    if (av) av.remove();

    // Sector pages: restore header-actions
    document.querySelectorAll('.header-actions .sq-auth-cluster').forEach(function(c){ c.remove(); });
    document.querySelectorAll('.mobile-actions .sq-auth-cluster').forEach(function(c){ c.remove(); });

    // Content pages: restore cluster → login/signup links
    document.querySelectorAll('header .sq-auth-cluster').forEach(function(c){
      const loginA  = document.createElement('a');
      loginA.href   = 'login.html';
      loginA.textContent = 'Login';
      loginA.style.cssText = 'padding:9px 18px;border-radius:50px;font-size:13px;font-weight:700;background:#f7f8f8;color:#002f34;border:1.5px solid #e2e8f0;text-decoration:none;';
      c.parentElement.insertBefore(loginA, c);
      c.remove();
    });

    // Pattern 2
    const authBtn = document.getElementById('authBtn');
    if (authBtn) { authBtn.textContent = 'Login'; authBtn.href = 'login.html'; }

    // Pattern 4
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
      mobileLoginBtn.href = 'login.html';
      const p = mobileLoginBtn.querySelector('p');
      if (p) p.textContent = 'Account';
    }

    // Pattern 5
    const loginBtn2   = document.getElementById('loginBtn');
    const myQueuesBtn = document.getElementById('myQueuesBtn');
    if (loginBtn2)    loginBtn2.style.display   = 'inline-flex';
    if (myQueuesBtn)  myQueuesBtn.style.display  = 'none';
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
    // FIX: initial derived from rawName; both will be escaped in buildCluster/buildClusterLight.
    const userMeta = { rawName, initial: rawName.charAt(0).toUpperCase() };
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
