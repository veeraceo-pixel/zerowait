/* ============================================================
   skipQs – Sector Listing Engine
   Shared logic for all sector landing pages
   (hospitals.html, salons.html, banks.html, etc.)

   Usage in each sector page:
     <body data-category="Hospital">
       ...content slot with #hero, #grid, etc...
     <script src="sector-config.js"></script>
     <script src="sector-listing.js"></script>
   ============================================================ */

(function () {
  'use strict';

  const category = document.body.dataset.category;
  if (!category) {
    console.error('sector-listing.js: data-category missing on <body>');
    return;
  }
  const cfg = window.getSectorConfig(category);
  let allItems = [];

  // Populate static sector chrome (title, hero text, etc.)
  document.title = cfg.plural + ' | skipQs';
  setTextIfPresent('sectorTitle',  cfg.plural + ' on skipQs');
  setTextIfPresent('sectorTagline', cfg.tagline);
  setTextIfPresent('sectorIcon',   cfg.icon);
  setTextIfPresent('sectorUnitPlural', cfg.unitPlural.toLowerCase());

  // Set signup button href + text consistently for every sector page
  const signupHref = (category === 'Hospital')
    ? 'hospital-signup.html'
    : 'business-signup.html?category=' + encodeURIComponent(category);
  const signupText = '+ Register ' + cfg.label;

  document.querySelectorAll('[data-signup-link]').forEach(a => {
    a.href = signupHref;
    a.textContent = signupText;
  });

  function setTextIfPresent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }


  // Format raw address/postcode into readable text
  function formatAddr(addr) {
    if (!addr) return 'Address not set';
    // If it looks like a raw postcode (no spaces, letters+numbers, short)
    // try to make it readable
    if (addr.length < 10 && /^[a-z0-9]+$/i.test(addr.replace(/\s/g,''))) {
      // Format postcode: insert space before last 3 chars
      const clean = addr.replace(/\s/g,'').toUpperCase();
      return clean.length > 4 ? clean.slice(0,-3) + ' ' + clean.slice(-3) : clean;
    }
    // General cleanup: fix comma spacing, capitalise
    return addr.replace(/,([^\s])/g, ', $1').replace(/\s+/g,' ').trim();
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Demo businesses shown when no real data in DB ──────────────────
  const DEMO_BUSINESSES = {
    Hospital:   [['Manchester Royal Infirmary','Oxford Road, Manchester M13 9WL'],['St. Thomas\'s Hospital','Westminster Bridge Rd, London SE1 7EH'],['Birmingham City Hospital','Dudley Rd, Birmingham B18 7QH'],['Leeds General Infirmary','Great George St, Leeds LS1 3EX']],
    Clinic:     [['The Lister Clinic','Chelsea Bridge Rd, London SW1W 8RH'],['BMI Manchester Clinic','Alexandra Rd, Manchester M16 8NT'],['Spire Leeds Hospital','Jackson Ave, Leeds LS8 1NT'],['Nuffield Health Birmingham','Vincent Dr, Birmingham B15 2TT']],
    Salon:      [['Toni & Guy Academy','Market Street, Manchester M1 1PW'],['Rush Hair & Beauty','Oxford Street, London W1C 2JL'],['Vidal Sassoon School','Davies St, London W1K 3DG'],['The Beauty Loft','Deansgate, Manchester M3 4LQ']],
    Barber:     [['Ruffians Barbers','Carnaby St, London W1F 7DW'],['Huckle The Barber','Monmouth St, London WC2H 9EP'],['Brazen Barbers','Piccadilly, Manchester M1 1HP'],['The Grooming Co.','New St, Birmingham B2 4QA']],
    Bank:       [['HSBC Manchester Branch','St. Ann Street, Manchester M2 7LG'],['Barclays London Central','Regent St, London W1B 5LT'],['NatWest Birmingham','Colmore Row, Birmingham B3 2AQ'],['Lloyds Bank Leeds','Park Row, Leeds LS1 1JS']],
    Restaurant: [['Nando\'s Manchester Piccadilly','The Printworks, Manchester M4 2BS'],['Dishoom Covent Garden','Monmouth St, London WC2H 9EP'],['Gaucho Leeds','Park Row, Leeds LS1 5HP'],['Purnell\'s Birmingham','Cornwall St, Birmingham B3 2DH']],
    Gym:        [['PureGym Manchester City','Deansgate, Manchester M3 4LQ'],['David Lloyd London','The Westway, London W2 4TH'],['Anytime Fitness Birmingham','Broad St, Birmingham B1 2DS'],['Virgin Active Leeds','Albion St, Leeds LS1 5ER']],
    CarWash:    [['Gleam Auto Wash','Trafford Way, Manchester M17 1SN'],['Sheen Car Wash','Great West Rd, London TW8 9BA'],['Sparkle Valeting','Tyburn Rd, Birmingham B24 0TQ'],['Elite Auto Valet','York Rd, Leeds LS9 9BB']],
    Government: [['Manchester City Council','Town Hall, Albert Square, Manchester M60 2LA'],['Westminster Services','Victoria St, London SW1H 0ET'],['Birmingham City Services','Council House, Birmingham B1 1BB'],['Leeds City Council','Civic Hall, Calverley St, Leeds LS1 1UR']],
    Repair:     [['iSmash Manchester','Market St, Manchester M1 1PW'],['Phone Fix Birmingham','New St, Birmingham B2 4QA'],['Tech Savvy Repairs','Oxford St, London W1D 1AN'],['Leeds Fix It','Briggate, Leeds LS1 6HD']],
    Pharmacy:   [['Boots Manchester Arndale','Market St, Manchester M1 1WP'],['Lloyds Pharmacy London','Oxford St, London W1A 1AB'],['Well Pharmacy Birmingham','New St, Birmingham B2 4RJ'],['Rowlands Pharmacy Leeds','Briggate, Leeds LS1 6HD']],
  };
  // Deterministic wait-time variation (no Math.random — stable on reload)
  const WAIT_OFFSETS = [5, 0, 10, -5, 3, 8, -3, 12];

  function buildDemos() {
    const businesses = DEMO_BUSINESSES[category] || DEMO_BUSINESSES.Clinic;
    const presets = cfg.presets || [];
    return businesses.map(([name, address], idx) => {
      const depts = presets.slice(0, 3).map(([icon, deptName, baseWait], di) => ({
        id: `demo-d-${idx}-${di}`,
        name: deptName, icon,
        wait_minutes: Math.max(0, baseWait + WAIT_OFFSETS[(idx * 3 + di) % WAIT_OFFSETS.length]),
        is_open: true, display_order: di
      }));
      return { id: `demo-${idx}`, business_name: name, address, is_open: true, departments: depts, isDemo: true };
    });
  }

  async function loadAll() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    let q = sb.from('providers')
      .select('id, business_name, address, is_open, lat, lng, phone, capacity, category, is_hospital');

    // Hospital is special — match either is_hospital flag OR category
    if (category === 'Hospital') {
      q = q.or('is_hospital.eq.true,category.eq.Hospital');
    } else {
      q = q.eq('category', category);
    }

    const { data: providers, error } = await q.order('business_name', { ascending: true });
    if (error) { console.error(error); showEmpty('Could not load.'); return; }

    if (!providers?.length) {
      // No real data → show plausible demo cards so the page never looks empty
      allItems = buildDemos();
      updateStats();
      render(allItems);
      return;
    }

    // Pull all departments for these providers in one query
    const ids = providers.map(p => p.id);
    const { data: depts } = await sb.from('departments').select('*').in('provider_id', ids);
    const byProvider = {};
    (depts||[]).forEach(d => { (byProvider[d.provider_id] ||= []).push(d); });

    allItems = providers.map(p => ({
      ...p,
      departments: (byProvider[p.id] || []).sort((a,b)=>(a.display_order||0)-(b.display_order||0))
    }));

    updateStats();
    render(allItems);
  }

  function updateStats() {
    const allDepts = allItems.flatMap(h => h.departments);
    const openDepts = allDepts.filter(d => d.is_open);
    const isDemo = allItems[0]?.isDemo;
    setTextIfPresent('statTotal',    isDemo ? '—' : allItems.length);
    setTextIfPresent('statUnits',    isDemo ? '—' : allDepts.length);
    setTextIfPresent('statAvgWait',  openDepts.length ? Math.round(openDepts.reduce((s,d)=>s+(d.wait_minutes||0),0)/openDepts.length) : '—');
    setTextIfPresent('statShortest', openDepts.length ? Math.min(...openDepts.map(d=>d.wait_minutes||0)) : '—');
  }

  function render(items) {
    const grid = document.getElementById('grid');
    if (!items.length) { showEmpty('No matches. Try a different search.'); return; }
    grid.innerHTML = items.map(card).join('');
  }

  function card(p) {
    const isOpen = p.is_open;
    const depts = p.departments;
    const visible = depts
      .filter(d => d.is_open)
      .sort((a,b)=>(a.wait_minutes||0)-(b.wait_minutes||0))
      .slice(0, 4);
    const moreCount = Math.max(0, depts.length - visible.length);

    const deptRows = visible.length
      ? visible.map(d => {
          const w = d.wait_minutes || 0;
          const cls = w === 0 ? 'wait-low' : w > 60 ? 'wait-high' : w > 30 ? 'wait-med' : 'wait-low';
          return `<div class="dept-row"><div class="dept-name">${esc(d.icon||cfg.icon)} ${esc(d.name)}</div><div class="dept-wait ${cls}">${w} min</div></div>`;
        }).join('')
      : `<div class="dept-row"><div class="dept-name" style="color:var(--text-muted);">No open ${cfg.unitPlural.toLowerCase()}</div></div>`;

    const more = moreCount ? `<div class="dept-row" style="border:none;color:var(--text-muted);font-size:.78rem;">+ ${moreCount} more</div>` : '';

    // Route hospitals to hospital-detail, all others to business-detail
    // Demo items link to signup page (no real ID to fetch)
    const detailPage = p.isDemo
      ? null  // Demo cards are not clickable
      : ((category === 'Hospital' || p.is_hospital) ? 'hospital-detail.html' : 'business-detail.html') + '?id=' + esc(p.id);

    const demoOverlay = p.isDemo
      ? `<div style="position:absolute;top:10px;right:10px;background:var(--accent2);color:var(--primary);font-size:.6rem;font-weight:800;letter-spacing:.8px;padding:3px 8px;border-radius:20px;text-transform:uppercase;z-index:2;">SAMPLE</div>`
      : '';
    const demoNote = p.isDemo
      ? `<div style="font-size:.7rem;color:var(--text-muted);margin-top:.4rem;">📋 Sample data — <a href="provider-signup.html" style="color:var(--accent);font-weight:700;">Register your business</a> to appear here</div>`
      : '';
    const ctaText = p.isDemo ? 'Register your business →' : 'View &amp; join queue →';
    const businessName = esc(p.business_name || 'Business').replace(/\w/g, c => c.toUpperCase());
    const statusPill = isOpen
      ? `<div class="status-pill"><div class="live-dot"></div> OPEN</div>`
      : `<div class="status-pill closed">CLOSED</div>`;

    const inner = `
      ${demoOverlay}
      <div class="h-card-top">
        <h3>${businessName}</h3>
        <div class="addr">📍 ${esc(formatAddr(p.address || ''))}</div>
        ${statusPill}
      </div>
      <div class="h-card-body">
        ${deptRows}${more}
      </div>
      <div class="h-card-foot">
        <span class="meta">${depts.length} ${depts.length===1?cfg.unitSingular.toLowerCase():cfg.unitPlural.toLowerCase()}</span>
        <span class="cta-text">${ctaText}</span>
      </div>
      ${demoNote}`;

    if (p.isDemo) {
      return `<div class="h-card" style="position:relative;cursor:default;">${inner}</div>`;
    }
    return `<a href="${detailPage}" class="h-card" style="position:relative;">${inner}</a>`;
  }

  function showEmpty(msg) {
    const grid = document.getElementById('grid');
    if (!grid) return;
    msg = msg || `No ${cfg.plural.toLowerCase()} registered yet.`;
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1;">
        <h3>${msg}</h3>
        <p>Be the first to register and let customers see live wait times.</p>
        <a href="business-signup.html?category=${encodeURIComponent(category)}" class="btn btn-primary" style="margin-top:1rem;">Register a ${esc(cfg.label)} →</a>
      </div>`;
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keyup', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) return render(allItems);
      const filtered = allItems.filter(p =>
        (p.business_name||'').toLowerCase().includes(q) ||
        (p.address||'').toLowerCase().includes(q)
      );
      render(filtered);
    });
  }

  // Realtime
  sb.channel('sector-' + category)
    .on('postgres_changes', {event:'*', schema:'public', table:'departments'}, ()=> loadAll())
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'providers'}, ()=> loadAll())
    .subscribe();

  loadAll();

  // ── Auth: swap Login → My Queues when user is signed in ──────────────
  function updateAuthNav(session) {
    // Desktop + mobile: find all links pointing at login.html
    document.querySelectorAll('a[href="login.html"]').forEach(a => {
      if (session) {
        a.textContent = 'My Queues';
        a.href = 'dashboard.html';
      } else {
        a.textContent = 'Login';
        a.href = 'login.html';
      }
    });
  }

  // Check on load
  sb.auth.getSession().then(({ data: { session } }) => updateAuthNav(session));
  // Keep in sync if they sign in/out in another tab
  sb.auth.onAuthStateChange((_event, session) => updateAuthNav(session));
})();
