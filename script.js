/* ================================
   ZeroWait – Core Client Logic
   Generic & Scalable
================================ */

/* ---------- Location Handling ---------- */
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
            callback(location);
        },
        () => {
            alert("Please allow location access to find nearby places.");
        }
    );
}

/* ---------- Hero Buttons ---------- */
const findNearbyBtn = document.getElementById("findNearbyBtn");
const checkWaitBtn = document.getElementById("checkWaitBtn");

if (findNearbyBtn) {
    findNearbyBtn.addEventListener("click", () => {
        // Default service (salon) unless user selects another
        localStorage.setItem("serviceType", "salon");

        getUserLocation(() => {
            window.location.href = "nearby.html";
        });
    });
}

if (checkWaitBtn) {
    checkWaitBtn.addEventListener("click", () => {
        localStorage.setItem("serviceType", "salon");

        getUserLocation(() => {
            window.location.href = "nearby.html";
        });
    });
}

/* ---------- Category Selection ---------- */
document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
        const serviceType = card.dataset.service;
        localStorage.setItem("serviceType", serviceType);

        getUserLocation(() => {
            window.location.href = "nearby.html";
        });
    });
});

/* ---------- Booking / Queue Buttons ---------- */
document.querySelectorAll(".primary").forEach(button => {
    button.addEventListener("click", () => {
        alert("Queue-based booking will be available soon!");
    });
});
