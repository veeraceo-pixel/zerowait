// script.js
//
// FIX: The previous version of this file unconditionally fired a POST request
// to /api/logout on every page load, silently logging the user out whenever
// any page that included script.js was visited. That was unintentional.
//
// If you need a global logout helper, call window.sb.auth.signOut() directly
// (it is already wired up in auth-nav.js and the individual page scripts).
//
// This file is retained as a placeholder. Add any truly page-agnostic
// initialisation here if needed in the future.
