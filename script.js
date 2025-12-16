/* ================================
   ZeroWait – Client Logic
================================ */

/* ---------- Elements ---------- */
const modal = document.getElementById("serviceModal");
const openModalBtn = document.getElementById("openServiceModal");
const closeModalBtn = document.querySelector(".close-modal");

/* ---------- Location ---------- */
function getUserLocation(callback) {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
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
            alert("Please allow location access to continue.");
        }
    );
}

/* ---------- Modal Open / Close ---------- */
openModalBtn.addEventListener("click", () => {
    modal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

/* ---------- Service Selection ---------- */
document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
        const serviceType = card.dataset.service;
        localStorage.setItem("serviceType", serviceType);

        modal.style.display = "none";

        getUserLocation(() => {
            window.location.href = "nearby.html";
        });
    });
});
