# skipQs SEO Action Plan

## Files included in this bundle
- sitemap.xml       → put in /public/sitemap.xml
- robots.txt        → put in /public/robots.txt
- seo-heads.html    → copy the relevant block into each page's <head>

---

## IMMEDIATE (do today)

### 1. Deploy sitemap.xml and robots.txt
Copy both files to your /public/ folder and push to GitHub.
Then go to Google Search Console → Sitemaps → Submit new sitemap:
https://skipqs.com/sitemap.xml

### 2. Add SEO head blocks to every page
Open seo-heads.html and copy the relevant block into each page.
Replace the existing <title> and <meta name="description"> with the new ones.
Add the OG, Twitter, canonical, and schema tags that are missing.

### 3. Submit to Google Search Console
Go to https://search.google.com/search-console
Add property → URL prefix → https://skipqs.com
Verify via HTML file or DNS TXT record.
Request indexing for your homepage and top 5 pages.

### 4. Submit to Bing Webmaster Tools (free, 10% of UK searches)
Go to https://www.bing.com/webmasters
Add your site, submit sitemap.

---

## THIS WEEK

### 5. Create og-image.png
Every page references https://skipqs.com/images/og-image.png
Create a 1200×630px image showing your logo + tagline.
When shared on WhatsApp, Twitter, LinkedIn — this is what people see.
Simple: dark background (#002f34), skipQs logo, "Live Wait Times. No More Queuing."

### 6. Add structured data to business-detail.html
When a real business page loads, inject LocalBusiness schema dynamically:

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "[business_name from DB]",
  "address": { "@type": "PostalAddress", "streetAddress": "[address]" },
  "telephone": "[phone]",
  "openingHoursSpecification": [...]
}
</script>

This can be done in business-detail.html JS after fetching provider data:
  const schema = { "@context": "https://schema.org", "@type": "LocalBusiness", ... };
  document.head.insertAdjacentHTML('beforeend',
    '<script type="application/ld+json">' + JSON.stringify(schema) + '<\/script>');

### 7. Add hreflang if you expand to India
<link rel="alternate" hreflang="en-GB" href="https://skipqs.com/">
<link rel="alternate" hreflang="en-IN" href="https://skipqs.com/">

---

## PAGE SPEED (Core Web Vitals — affects ranking)

Run https://pagespeed.web.dev/ on skipqs.com and fix:
- Preconnect to Google Fonts: <link rel="preconnect" href="https://fonts.googleapis.com">
- Preload Supabase JS: <link rel="preload" href="https://cdn.jsdelivr.net/..." as="script">
- Add width/height to any <img> tags to prevent layout shift
- Consider lazy loading images: <img loading="lazy" ...>

---

## CONTENT SEO (biggest long-term wins)

### 8. Blog posts that rank for long-tail keywords
Write these articles (300-800 words each):
- "How to skip the A&E queue in the UK" → targets "A&E wait times"
- "How virtual queues work at NHS hospitals" → targets "NHS queue management"
- "Best apps for skipping queues at salons and barbers" → targets "salon queue app"
- "How to check hospital wait times before you go" → targets "hospital wait time checker"
- "Virtual queue vs appointment booking — which is better?" → targets "virtual queue app"

Each post should link back to the relevant sector page (hospitals.html, salons.html etc.)

### 9. City pages — expand beyond London/Manchester/Birmingham
High-value cities for local SEO:
- Leeds, Sheffield, Liverpool, Bristol, Edinburgh, Glasgow, Cardiff
- Each page targets "[city] hospital wait times" and "[city] queue"

Template: copy london.html, change city name throughout.

### 10. Add "Register Your [Category] Free" pages
- /register-salon.html → "Register your salon on skipQs — free virtual queue"
- /register-clinic.html → "Add your clinic to skipQs — live wait times"
These pages rank for "queue management system for salons" etc.

---

## BACKLINKS (off-page SEO)

### Free backlinks to get:
- Submit to Product Hunt (huge traffic, strong DA backlink)
- Submit to BetaList, Indie Hackers
- List on Capterra, G2, GetApp (free business software directories)
- List on AlternativeTo.net (appears in "alternatives to" searches)
- NHS innovation directory (if you have hospital clients)
- UK tech startup directories: TechRound, Beauhurst (free listings)
- Contact local Manchester/Birmingham news sites — "local startup helping NHS queues"

### Guest posts (free):
- Write for NHS blogs about queue management
- Write for local business association blogs about reducing customer wait times

---

## QUICK WINS SUMMARY

| Action | Time | Impact |
|--------|------|--------|
| Add sitemap.xml + robots.txt | 5 min | High — Google finds all pages |
| Add SEO heads to all pages | 30 min | High — proper titles rank better |
| Submit to Search Console | 10 min | High — triggers indexing |
| Create og-image.png | 20 min | Medium — better social sharing |
| Write 3 blog posts | 3 hours | Very High (long term) |
| Product Hunt launch | 1 hour | Very High — backlinks + users |
| Add LocalBusiness schema | 1 hour | Medium — rich results |
| Submit to Bing | 5 min | Low-Medium — free 10% more reach |

---

## TRACKING

Set these up now so you can measure progress:
1. Google Search Console (free) — shows exactly which queries bring traffic
2. Google Analytics 4 (free) — shows which pages convert
3. Check rankings weekly: search "virtual queue UK", "hospital wait times app", "skip queue near me"
