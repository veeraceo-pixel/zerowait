/* ============================================================
   skipQs – Shared Auth Nav Helper
   Include after supabase-config.js on any page.
   Automatically updates Login → My Queues when signed in,
   and vice versa when signed out.
   ============================================================ */

(function () {
  'use strict';

  function updateNav(session) {
    // Any anchor pointing at login.html becomes "My Queues → dashboard.html"
    document.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach(a => {
      if (session) {
        a.textContent = 'My Queues';
        a.href = 'dashboard.html';
        // Keep existing classes (btn-ghost, btn-primary, etc.)
      } else {
        a.textContent = 'Login';
        a.href = 'login.html';
      }
    });

    // Support pages that use a dedicated #authBtn element (nearby.html style)
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      if (session) {
        authBtn.textContent = 'Dashboard';
        authBtn.href = 'dashboard.html';
      } else {
        authBtn.textContent = 'Login';
        authBtn.href = 'login.html';
      }
    }

    // Support pages that use #loginLink (index.html)
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
      if (session) {
        loginLink.textContent = 'My Queues';
        loginLink.href = 'dashboard.html';
      } else {
        loginLink.textContent = 'Login';
        loginLink.href = 'login.html';
      }
    }

    // Support mobile nav login button (index.html #mobileLoginBtn)
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
      const p = mobileLoginBtn.querySelector('p');
      if (session) {
        mobileLoginBtn.href = 'dashboard.html';
        if (p) p.textContent = 'My Queues';
      } else {
        mobileLoginBtn.href = 'login.html';
        if (p) p.textContent = 'Account';
      }
    }
  }

  // Wait until Supabase client is ready (sb is set by supabase-config.js)
  function run() {
    if (!window.sb) { setTimeout(run, 50); return; }
    // Check current session
    window.sb.auth.getSession().then(({ data: { session } }) => updateNav(session));
    // React to sign-in / sign-out in any tab
    window.sb.auth.onAuthStateChange((_event, session) => updateNav(session));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
