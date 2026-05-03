# skipQs — Supabase Deployment Guide

## What changed from Firebase

| Firebase (old)           | Supabase (new)                  |
|--------------------------|---------------------------------|
| Firebase Auth            | Supabase Auth                   |
| Firestore                | Supabase Postgres (via JS SDK)  |
| Firebase Storage         | Supabase Storage (`menus` bucket)|
| Firestore `onSnapshot`   | Supabase Realtime channels      |
| `firebase-config.js`     | `supabase-config.js`            |
| Google Maps Places API   | ❌ Removed — Nominatim (free)   |
| Google Maps Geometry     | ❌ Removed — Haversine formula  |
| Google Maps Tiles        | ❌ Removed — OpenStreetMap/Leaflet|

**Zero billing. Zero Google API keys.**

---

## Step 1 — Create a Supabase project

1. Go to https://app.supabase.com and sign up (free tier is generous).
2. Click **New Project**, choose a region close to your users.
3. Save the **database password** somewhere safe.

---

## Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor → New Query**.
2. Paste the entire contents of `SUPABASE_SCHEMA.sql`.
3. Click **Run**. All tables, RLS policies, Realtime publications, and the storage bucket will be created.

---

## Step 3 — Configure your API keys

1. Go to **Project Settings → API** in Supabase.
2. Copy your **Project URL** and **anon public** key.
3. Open `public/supabase-config.js` and replace:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
```

> ✅ The anon key is safe to expose in client-side code — it is restricted by Row Level Security (RLS) policies.

---

## Step 4 — Enable Email Auth

1. Go to **Authentication → Providers** in Supabase.
2. Make sure **Email** is enabled.
3. Optionally enable **Confirm email** (users will get a verification email).
4. Set your site URL under **Authentication → URL Configuration → Site URL** to your deployment URL.

---

## Step 5 — Deploy the site

### Option A — Netlify (recommended, free)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy the public folder
cd skipqs_supabase
netlify deploy --dir=public --prod
```

Or drag-and-drop the `public/` folder at https://app.netlify.com.

### Option B — Vercel

```bash
npm install -g vercel
cd skipqs_supabase/public
vercel --prod
```

### Option C — Any static host

The `public/` folder is 100% static HTML/CSS/JS — upload it anywhere:
- GitHub Pages
- Cloudflare Pages
- AWS S3 + CloudFront
- Any web server (nginx, Apache)

---

## Step 6 — Update the QR code URL

In `provider-dashboard.html`, the QR code URL is dynamically built as:

```js
const url = window.location.origin + '/join-queue.html?id=' + curUid;
```

This will automatically use your deployment domain. No changes needed.

---

## Step 7 — (Optional) Custom domain

Both Netlify and Vercel offer free custom domains. Configure your DNS as they instruct, then update your Supabase **Site URL** setting to match.

---

## Troubleshooting

### "row violates row-level security policy"
Make sure you ran the full SQL schema including all `CREATE POLICY` statements.

### Realtime not updating
Go to **Database → Replication** in Supabase and confirm that `queues`, `providers`, and `services` tables are added to `supabase_realtime` publication. The schema SQL does this automatically.

### Storage upload fails
Go to **Storage → Policies** and check that the `menus` bucket has an insert policy for authenticated users.

### Geocoding (address lookup) not working
The app uses [Nominatim](https://nominatim.openstreetmap.org/) — a free OSM geocoding API. It has a rate limit of 1 request/second and requires a valid `User-Agent`. For high-traffic production use, consider self-hosting Nominatim or using Photon.

### Nearby map not showing POIs
POI search uses the [Overpass API](https://overpass-api.de/) — free and open. If it times out, results fall back to cached Supabase data. No API key needed.

---

## Environment overview

```
skipqs_supabase/
├── SUPABASE_SCHEMA.sql       ← Run this in Supabase SQL editor
├── DEPLOYMENT_GUIDE.md       ← This file
└── public/
    ├── supabase-config.js    ← ⚠️  Fill in your URL + anon key
    ├── index.html
    ├── login.html
    ├── signup.html
    ├── dashboard.html        ← Customer "My Queues" view
    ├── provider-signup.html
    ├── provider-dashboard.html
    ├── join-queue.html
    ├── nearby.html           ← Leaflet + OpenStreetMap + Overpass API
    ├── about.html
    ├── how-it-works.html
    ├── terms.html
    ├── privacy.html
    ├── 404.html
    ├── script.js
    └── style.css
```
