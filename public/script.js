/* ================================
   skipQs – Client Logic (Supabase)
================================ */

/* ---------- Location ---------- */
function getUserLocation(callback) {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    if (callback) callback();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      try {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        localStorage.setItem('userLocation', JSON.stringify(location));
        if (callback) callback();
      } catch (err) {
        console.error('Error saving location:', err);
        if (callback) callback();
      }
    },
    (error) => {
      console.error('Location access denied:', error);
      if (callback) callback();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ---------- Modal Controls ---------- */
const modal       = document.getElementById('serviceModal');
const openModalBtn  = document.getElementById('openServiceModal');
const closeModalBtn = document.querySelector('.close-modal');

if (openModalBtn)  openModalBtn.addEventListener('click',  () => modal?.classList.add('active'));
if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal?.classList.remove('active'));

/* ---------- Service Selection ---------- */
const categoryCards = document.querySelectorAll('.category-card');
if (categoryCards?.length) {
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      try {
        const serviceType = card.dataset.service;
        if (!serviceType) { console.error('Service type not found'); return; }
        localStorage.setItem('serviceType', serviceType);
        modal?.classList.remove('active');
        getUserLocation(() => { window.location.href = 'nearby.html'; });
      } catch (err) {
        console.error('Error selecting service:', err);
        alert('Error selecting service. Please try again.');
      }
    });
  });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  console.log('skipQs script loaded');

  // Update auth nav links on any page that has #authBtn
  if (window.sb) {
    sb.auth.getSession().then(({ data: { session } }) => {
      const btn = document.getElementById('authBtn');
      if (!btn) return;
      if (session) { btn.textContent = 'Dashboard'; btn.href = 'dashboard.html'; }
    });
  }
});
