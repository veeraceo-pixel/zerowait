// login.js
//
// FIX: The previous version contained a login() function with hardcoded
// placeholder credentials ('your_email' / 'your_password') and used
// require('axios') which is a Node.js API unavailable in browsers.
// That code was dead (never called) and has been removed entirely.
//
// Authentication is handled directly in login.html via the Supabase client
// (window.sb) that is initialised by supabase-config.js.
//
// If you need shared login helpers in the future, add them to api.js
// (which already exports login() and signup() functions) and import from there.
