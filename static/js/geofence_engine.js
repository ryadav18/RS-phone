/**
 * Smart Geofence Map Vector Interpolation Controller.
 * Handles Leaflet map spatial clicks and posts coordinates safely to server cache.
 */
let map;
let geofenceCircle = null;

// Fallback coordinate mappings (Default center initialization: Patna, India spatial region)
let currentLat = 25.611;
let currentLng = 85.141;

document.addEventListener("DOMContentLoaded", function() {
    // Render OpenStreetMap vectors inside placeholder container shell
    map = L.map('map').setView([currentLat, currentLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    document.getElementById('fence-lat').value = currentLat;
    document.getElementById('fence-lng').value = currentLng;
    
    updateVisualCircleFence();

    // Catch manual interactive click parameters directly on map viewport layer
    map.on('click', function(e) {
        currentLat = e.latlng.lat;
        currentLng = e.latlng.lng;
        document.getElementById('fence-lat').value = currentLat;
        document.getElementById('fence-lng').value = currentLng;
        updateVisualCircleFence();
    });

    // Handle real-time radius updates inside input parameters input elements
    document.getElementById('fence-radius').addEventListener('input', updateVisualCircleFence);
});

function updateVisualCircleFence() {
    const rad = parseFloat(document.getElementById('fence-radius').value) || 300;
    
    if (geofenceCircle) {
        map.removeLayer(geofenceCircle);
    }
    
    // Paints clean dynamic polygon overlay vectors
    geofenceCircle = L.circle([currentLat, currentLng], {
        color: '#2ecc71',
        fillColor: '#2ecc71',
        fillOpacity: 0.25,
        radius: rad
    }).addTo(map);
}

function saveGeofenceDataToServer() {
    const radius = parseFloat(document.getElementById('fence-radius').value);
    const activeDeviceToken = localStorage.getItem("active_device_token") || "mock_device_token";

    fetch(`/api/geofence/settings?token=${activeDeviceToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: currentLat, longitude: currentLng, radius: radius })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            alert("Safe zone spatial bounds securely synchronized into rules engine database.");
        }
    })
    .catch(err => console.error("Geofence post pipeline failure: ", err));
}
