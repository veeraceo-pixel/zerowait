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

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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
    if (!providers?.length) { showEmpty(); return; }

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
    setTextIfPresent('statTotal',    allItems.length);
    setTextIfPresent('statUnits',    allDepts.length);
    setTextIfPresent('statAvgWait',  openDepts.length ? Math.round(openDepts.reduce((s,d)=>s+(d.wait_minutes||0),0)/openDepts.length) : 0);
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
    const detailPage = (category === 'Hospital' || p.is_hospital) ? 'hospital-detail.html' : 'business-detail.html';

    return `
      <a href="${detailPage}?id=${p.id}" class="h-card">
        <div class="h-card-top">
          <h3>${esc(p.business_name)}</h3>
          <div class="addr">📍 ${esc(p.address || 'Address not set')}</div>
          <div class="status-pill ${isOpen?'':'closed'}">
            ${isOpen ? '<div class="live-dot"></div> OPEN' : 'CLOSED'}
          </div>
        </div>
        <div class="h-card-body">
          ${deptRows}${more}
        </div>
        <div class="h-card-foot">
          <span class="meta">${depts.length} ${depts.length===1?cfg.unitSingular.toLowerCase():cfg.unitPlural.toLowerCase()}</span>
          <span class="cta-text">View &amp; join queue →</span>
        </div>
      </a>`;
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
