// skipQs script.js — Supabase-connected

// Footer year
(function(){ const y = document.getElementById("year"); if(y) y.textContent = new Date().getFullYear(); })();

// Auth nav update
window.addEventListener("DOMContentLoaded", async () => {
  if (!window.sb) return;
  const { data: { session } } = await sb.auth.getSession();
  const btn = document.getElementById("loginBtn");
  if (btn && session) { btn.textContent = "Dashboard"; btn.href = "my-queues.html"; }

  const path = window.location.pathname.split("/").pop() || "index.html";
  if (path === "index.html" || path === "") initIndex();
  else if (path === "find-services.html") initFindServices();
  else if (path === "my-queues.html") initMyQueues();
  else if (path === "forgot-password.html") initResetPassword();
  else if (path === "provider-add-service.html") initAddService();
  else if (path === "provider-manage-queue.html") initManageQueue();
  else if (path === "contact.html") initContact();
  else if (["salons.html","clinics.html","banks.html","gyms.html"].includes(path)) initCategoryPage(path);
  else if (["manchester.html","london.html","birmingham.html"].includes(path)) initCityPage(path);
});

/* === INDEX === */
async function initIndex() {
  const form = document.getElementById("search-form");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    const q = document.getElementById("search-query")?.value || "";
    const loc = document.getElementById("search-location")?.value || "";
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (loc) p.set("location", loc);
    window.location.href = "find-services.html?" + p.toString();
  });

  // Live queue preview from Supabase
  const list = document.getElementById("homepage-queues");
  if (!list || !window.sb) return;
  try {
    const { data } = await sb.from("providers").select("id,business_name,address,category,is_open,current_wait_mins,people_in_line").eq("is_open", true).limit(4);
    if (!data?.length) { list.innerHTML = '<li><span style="color:#9ca3af">No live queues yet — be the first to register!</span></li>'; return; }
    list.innerHTML = "";
    data.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<div><strong>${esc(p.business_name)}</strong><span>${esc(p.address||p.category||"")}</span></div><div class="queue-meta"><span>Wait: ${p.current_wait_mins||0} min</span><span>In queue: ${p.people_in_line||0}</span></div>`;
      list.appendChild(li);
    });
  } catch(e) { list.innerHTML = '<li><span style="color:#9ca3af">Could not load live data.</span></li>'; }
}

/* === FIND SERVICES === */
async function initFindServices() {
  const container = document.getElementById("find-services-results");
  const form = document.getElementById("find-services-form");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  await loadProviders(container, params.get("q")||"", params.get("location")||"");

  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    await loadProviders(container, document.getElementById("find-query")?.value||"", document.getElementById("find-location")?.value||"");
  });
}

async function loadProviders(container, q, loc) {
  container.innerHTML = '<p style="color:#6b7280;padding:1rem 0;">Searching…</p>';
  if (!window.sb) { container.innerHTML = '<p>Supabase not configured.</p>'; return; }
  try {
    let query = sb.from("providers").select("id,business_name,address,category,current_wait_mins,people_in_line,is_open").eq("is_open", true);
    if (q) query = query.ilike("business_name", `%${q}%`);
    const { data } = await query.limit(12);
    if (!data?.length) { container.innerHTML = '<p style="color:#6b7280;">No services found. Try a different search.</p>'; return; }
    container.innerHTML = data.map(p => `
      <article class="card">
        <h3>${esc(p.business_name)}</h3>
        <p style="color:#6b7280;font-size:.85rem;">📍 ${esc(p.address||"Location not set")} · ${esc(p.category||"Service")}</p>
        <p>Estimated wait: <strong>${p.current_wait_mins||0} min</strong> · ${p.people_in_line||0} in queue</p>
        <a href="join-queue.html?id=${p.id}" class="btn btn-primary" style="margin-top:.5rem;">View &amp; join queue</a>
      </article>`).join("");
  } catch(e) { container.innerHTML = '<p style="color:#ef4444;">Error loading services.</p>'; }
}

/* === MY QUEUES === */
async function initMyQueues() {
  const container = document.getElementById("my-queues-list");
  if (!container || !window.sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { container.innerHTML = '<p>Please <a href="login.html" style="color:#6366f1;">log in</a> to see your queues.</p>'; return; }
  const { data } = await sb.from("queues").select("*").eq("user_id", session.user.id).order("joined_at", { ascending: false }).limit(20);
  if (!data?.length) { container.innerHTML = '<p style="color:#6b7280;">No queues yet. <a href="find-services.html" style="color:#6366f1;">Find a service</a> to join.</p>'; return; }
  container.innerHTML = data.map(q => `
    <article class="card">
      <h3>${esc(q.business_name||"Service")}</h3>
      <p style="color:#6b7280;font-size:.85rem;">${esc(q.selected_service||"")}</p>
      <p>Status: <strong style="color:${q.status==='waiting'?'#f59e0b':q.status==='serving'?'#10b981':'#6b7280'}">${q.status}</strong></p>
      <p style="font-size:.8rem;color:#9ca3af;">Joined: ${new Date(q.joined_at).toLocaleString()}</p>
      ${q.status !== 'completed' ? `<a href="join-queue.html?id=${q.provider_id}" class="btn btn-outline-dark" style="margin-top:.5rem;color:#111827;">Track position</a>` : ''}
    </article>`).join("");
}

/* === RESET PASSWORD === */
async function initResetPassword() {
  const form = document.getElementById("reset-form");
  const msg = document.getElementById("reset-message");
  if (!form || !window.sb) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (msg) msg.textContent = "Sending reset link…";
    const email = document.getElementById("reset-email")?.value;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/login.html" });
    if (msg) msg.textContent = error ? error.message : "Reset link sent! Check your email.";
  });
}

/* === ADD SERVICE === */
async function initAddService() {
  const form = document.getElementById("add-service-form");
  const msg = document.getElementById("add-service-message");
  if (!form || !window.sb) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (msg) msg.textContent = "Saving…";
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { if (msg) msg.textContent = "Please log in as a provider."; return; }
    const { error } = await sb.from("services").insert({
      provider_id: session.user.id,
      name: document.getElementById("service-name")?.value,
      duration: parseInt(document.getElementById("service-duration")?.value||"15"),
      price: parseFloat(document.getElementById("service-price")?.value||"0")
    });
    if (msg) msg.textContent = error ? error.message : "Service saved! ✓";
    if (!error) form.reset();
  });
}

/* === MANAGE QUEUE === */
async function initManageQueue() {
  if (!window.sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }

  const list = document.getElementById("manage-queue-list");
  const meta = document.getElementById("manage-queue-meta");
  const stats = document.getElementById("manage-queue-stats");

  async function refresh() {
    const { data: rows } = await sb.from("queues").select("*").eq("provider_id", session.user.id).in("status",["waiting","serving"]).order("joined_at",{ascending:true});
    if (meta) meta.textContent = `Customers in queue: ${rows?.length||0}`;
    if (!list) return;
    if (!rows?.length) { list.innerHTML = '<li><span style="color:#9ca3af">No customers waiting.</span></li>'; return; }
    list.innerHTML = "";
    rows.forEach(q => {
      const li = document.createElement("li");
      li.innerHTML = `<div><strong>${esc(q.customer_name)}</strong><span>${esc(q.selected_service||"")} · ${esc(q.customer_phone||"")}</span></div>
        <div class="queue-meta">
          <button onclick="serveCustomer('${q.id}')" class="btn btn-primary" style="font-size:.75rem;padding:.3rem .7rem;">${q.status==='serving'?'Finish ✓':'Start Serving'}</button>
        </div>`;
      list.appendChild(li);
    });
    const today = new Date().toISOString().split("T")[0];
    const { count } = await sb.from("queues").select("id",{count:"exact",head:true}).eq("provider_id",session.user.id).eq("status","completed").eq("completed_date",today);
    if (stats) stats.textContent = `Served today: ${count||0}`;
  }

  refresh();
  sb.channel("manage-q").on("postgres_changes",{event:"*",schema:"public",table:"queues",filter:"provider_id=eq."+session.user.id},refresh).subscribe();

  const pauseBtn = document.getElementById("queue-pause");
  const closeBtn = document.getElementById("queue-close");
  if (pauseBtn) pauseBtn.onclick = () => alert("Queue paused. Customers will see a pause message.");
  if (closeBtn) closeBtn.onclick = () => { if(confirm("Close queue for today?")) window.location.href = "provider-dashboard.html"; };
}

window.serveCustomer = async function(id) {
  if (!window.sb) return;
  const { data: q } = await sb.from("queues").select("status").eq("id",id).single();
  if (q?.status === "serving") {
    const today = new Date().toISOString().split("T")[0];
    await sb.from("queues").update({status:"completed",completed_at:new Date().toISOString(),completed_date:today}).eq("id",id);
  } else {
    await sb.from("queues").update({status:"serving",served_at:new Date().toISOString()}).eq("id",id);
  }
};

/* === CONTACT FORM === */
function initContact() {
  const form = document.getElementById("contact-form");
  const msg = document.getElementById("contact-msg");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (msg) msg.textContent = "Thanks for your message! We'll be in touch within 1–2 business days.";
    form.reset();
  });
}

/* === CATEGORY / CITY PAGES === */
const CAT_MAP = { "salons.html":"Salon", "clinics.html":"Clinic", "banks.html":"Bank", "gyms.html":"Gym" };
const CITY_MAP = { "manchester.html":"Manchester", "london.html":"London", "birmingham.html":"Birmingham" };

async function initCategoryPage(path) {
  const container = document.getElementById("category-results");
  if (!container || !window.sb) return;
  const cat = CAT_MAP[path];
  const { data } = await sb.from("providers").select("id,business_name,address,current_wait_mins,people_in_line").eq("category",cat).eq("is_open",true).limit(9);
  renderProviderCards(container, data);
}

async function initCityPage(path) {
  const container = document.getElementById("city-results");
  if (!container || !window.sb) return;
  const city = CITY_MAP[path];
  const { data } = await sb.from("providers").select("id,business_name,address,category,current_wait_mins,people_in_line").ilike("address",`%${city}%`).eq("is_open",true).limit(9);
  renderProviderCards(container, data);
}

function renderProviderCards(container, data) {
  if (!data?.length) { container.innerHTML = '<p style="color:#6b7280;">No registered businesses here yet. <a href="provider-signup.html" style="color:#6366f1;">Register yours →</a></p>'; return; }
  container.innerHTML = data.map(p => `
    <article class="card">
      <h3>${esc(p.business_name)}</h3>
      <p style="color:#6b7280;font-size:.85rem;">📍 ${esc(p.address||"")}</p>
      <p>Estimated wait: <strong>${p.current_wait_mins||0} min</strong></p>
      <a href="join-queue.html?id=${p.id}" class="btn btn-outline-dark" style="margin-top:.5rem;">View &amp; join queue</a>
    </article>`).join("");
}

function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
