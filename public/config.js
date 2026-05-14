// config.js
//
// FIX: The previous version of this file used `require('axios')`, which is a
// Node.js/CommonJS API unavailable in browsers. It also duplicated Supabase
// credentials that are already managed by supabase-config.js.
//
// This file is intentionally left minimal. All Supabase configuration belongs
// in supabase-config.js. All API helpers belong in api.js.
//
// If you need a custom axios instance for a separate REST backend, install
// axios as an ES module and import it here:
//
//   import axios from 'https://esm.sh/axios';
//   const http = axios.create({ baseURL: 'https://your-api.com' });
//   export default http;
//
// Then import `http` in the files that need it.
