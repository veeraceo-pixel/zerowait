/* ================================
   ZeroWait – Client Logic
================================ */

/* ---------- Elements ---------- */
const modal = document.getElementById("serviceModal");
const openModalBtn = document.getElementById("openServiceModal");
const closeModalBtn = document.querySelector(".close-modal");
const categoryCards = document.querySelectorAll(".category-card");

/* ---------- Location ---------- */
function getUserLocation(callback) {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        callback();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            localStorage.setItem("userLocation", JSON.stringify(location));
            callback();
        },
        () => {
            alert("Location access denied. Showing nearby results.");
            callback();
        }
    );
}

/* ---------- Modal Controls ---------- */
openModalBtn.addEventListener("click", () => {
    modal.classList.add("active");
});

closeModalBtn.addEventListener("click", () => {
    modal.classList.remove("active");
});

/* ---------- Service Selection ---------- */
categoryCards.forEach(card => {
    card.addEventListener("click", () => {
        const serviceType = card.dataset.service;

        localStorage.setItem("serviceType", serviceType);
        modal.classList.remove("active");

        getUserLocation(() => {
            window.location.href = "nearby.html";
        });
    });
});


let selectedServiceName = "";

function openQueueModal(serviceName) {
  selectedServiceName = serviceName;
  document.getElementById("queueModal").style.display = "flex";
}

function closeQueueModal() {
  document.getElementById("queueModal").style.display = "none";
}

function confirmQueue() {
  const name = document.getElementById("userName").value.trim();
  const phone = document.getElementById("userPhone").value.trim();

  if (!name || !phone) {
    alert("Please enter name and phone");
    return;
  }

  alert(
    `✅ Queue Joined!\n\n` +
    `Service: ${selectedServiceName}\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}`
  );

  document.getElementById("userName").value = "";
  document.getElementById("userPhone").value = "";
  closeQueueModal();
}

