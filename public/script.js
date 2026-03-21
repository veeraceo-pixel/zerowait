/* ================================
   ZeroWait - Client Logic
================================ */

/* ---------- Elements ---------- */
const modal = document.getElementById('serviceModal');
const openModalBtn = document.getElementById('openServiceModal');
const closeModalBtn = document.querySelector('.close-modal');
const categoryCards = document.querySelectorAll('.category-card');

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
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        localStorage.setItem('userLocation', JSON.stringify(location));
        if (callback) callback();
      } catch (err) {
        console.error('Error saving location:', err);
        if (callback) callback();
      }
    },
    (error) => {
      console.error('Location access denied:', error);
      alert('Location access denied. Showing nearby results.');
      if (callback) callback();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ---------- Modal Controls ---------- */
if (openModalBtn) {
  openModalBtn.addEventListener('click', () => {
    if (modal) modal.classList.add('active');
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    if (modal) modal.classList.remove('active');
  });
}

/* ---------- Service Selection ---------- */
if (categoryCards && categoryCards.length > 0) {
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      try {
        const serviceType = card.dataset.service;
        if (!serviceType) {
          console.error('Service type not found');
          return;
        }
        localStorage.setItem('serviceType', serviceType);
        if (modal) modal.classList.remove('active');
        getUserLocation(() => {
          window.location.href = 'nearby.html';
        });
      } catch (err) {
        console.error('Error selecting service:', err);
        alert('Error selecting service. Please try again.');
      }
    });
  });
}

/* ---------- Queue Management ---------- */
let selectedServiceName = '';

function openQueueModal(serviceName) {
  selectedServiceName = serviceName;
  const queueModal = document.getElementById('queueModal');
  if (queueModal) {
    queueModal.style.display = 'flex';
  }
}

function closeQueueModal() {
  const queueModal = document.getElementById('queueModal');
  if (queueModal) {
    queueModal.style.display = 'none';
  }
}

function confirmQueue() {
  // Legacy modal removed — join-queue.html handles real queue joins via Firebase.
  window.location.href = 'nearby.html';
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Script loaded successfully');
  });
} else {
  console.log('Script loaded successfully');
}
