class LocationsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.map = null;
        this.marker = null;
        this.isInitialLoad = true;
        this.init();
    }

    async init() {
        this.initMap();
        await this.loadDevicesList();
        
        if (!this.activeDeviceId) return;
        
        // 1. Pehle Check Karo GPS ON hai ya OFF
        await this.checkGpsStatus();

        // 2. Location Fetch Karo
        await this.fetchLocations();
        
        // 3. Har 15 second me background update
        setInterval(() => this.fetchLocations(), 15000); 
    }

    initMap() {
        // Default center out in space (India)
        this.map = L.map('map').setView([20.5937, 78.9629], 5); 
        
        // 🚀 SMART FIX: High-Res Satellite View (Esri World Imagery)
        // Yeh bina API key ke kaam karta hai aur sadak/ghar clear dikhata hai.
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri Satellite Radar',
            maxZoom: 19
        }).addTo(this.map);

        // Add a red crosshair marker icon
        this.customIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    }

    async loadDevicesList() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();

            if (result.status === 'success') {
                const selectEl = document.getElementById('device-select');
                if (selectEl) {
                    selectEl.innerHTML = ''; 
                    result.data.forEach(dev => {
                        const option = document.createElement('option');
                        option.value = dev.id;
                        option.textContent = dev.name;
                        selectEl.appendChild(option);
                    });

                    if (!this.activeDeviceId && result.data.length > 0) {
                        this.activeDeviceId = result.data[0].id;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                    }
                    selectEl.value = this.activeDeviceId;

                    selectEl.addEventListener('change', (e) => {
                        this.activeDeviceId = e.target.value;
                        localStorage.setItem('active_device_id', this.activeDeviceId);
                        this.isInitialLoad = true; // Agle device par change hote hi wapas fly karega
                        this.init(); 
                    });
                }
            }
        } catch (e) { console.error("Failed to load devices:", e); }
    }

    // 🚀 NEW: Check GPS Permission Status Live
    async checkGpsStatus() {
        try {
            const configRes = await fetch('/api/config');
            const config = await configRes.json();
            
            const permRes = await fetch(`${config.supabase_url}/rest/v1/permissions?device_id=eq.${this.activeDeviceId}&order=created_at.desc&limit=1`, {
                headers: { 'apikey': config.supabase_key, 'Authorization': `Bearer ${config.supabase_key}` }
            });
            
            const data = await permRes.json();
            
            // Agar permission table me location FALSE hai (ya off hai)
            if (data && data.length > 0) {
                if (data[0].location === false) {
                    document.getElementById('gps-warning').style.display = 'flex';
                }
            }
        } catch (error) {
            console.error("GPS Check Failed:", error);
        }
    }

    async fetchLocations() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/locations?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            const listEl = document.getElementById('location-list');
            
            if (result.status === 'success' && result.data.length > 0) {
                const latestLoc = result.data[0];
                const latLng = [latestLoc.latitude, latestLoc.longitude];
                
                // Set marker
                if (this.marker) {
                    this.marker.setLatLng(latLng);
                } else {
                    this.marker = L.marker(latLng, {icon: this.customIcon}).addTo(this.map);
                }
                
                // 🚀 FLY-TO EFFECT: Sirf pehli baar load hone par cinematic fly-in karega
                if (this.isInitialLoad) {
                    this.map.flyTo(latLng, 19, {
                        animate: true,
                        duration: 2.5 // Udkar aane me 2.5 seconds lagenge
                    });
                    this.isInitialLoad = false;
                }
                
                this.marker.bindPopup(`<b>Target Lock</b><br>Seen: ${new Date(latestLoc.timestamp).toLocaleTimeString()}`).openPopup();

                // List Render
                listEl.innerHTML = result.data.map((loc, index) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${index === 0 ? '#00bcd4' : '#333'}; cursor: pointer;" onclick="window.locationsEngine.panTo(${loc.latitude}, ${loc.longitude})">
                        <div>
                            <div style="color: #fff; font-weight: bold; font-family: monospace;">Lat: ${loc.latitude.toFixed(5)}, Lng: ${loc.longitude.toFixed(5)}</div>
                            <div style="color: #aaa; font-size: 0.8rem; margin-top: 4px;">Accuracy: ${loc.accuracy} meters</div>
                        </div>
                        <div style="color: #00bcd4; font-size: 0.85rem; font-weight: bold;">
                            ${new Date(loc.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                `).join('');

            } else {
                listEl.innerHTML = '<div style="color: #e74c3c; text-align: center; padding: 20px;">No GPS data recorded yet.</div>';
            }
        } catch (e) { console.error("Fetch Locations Error:", e); }
    }

    // Agar purani location click kare list me, toh map wahan jayega
    panTo(lat, lng) {
        this.map.flyTo([lat, lng], 19, { animate: true, duration: 1.5 });
    }
}

// Global hook
window.locationsEngine = null;
document.addEventListener('DOMContentLoaded', () => {
    window.locationsEngine = new LocationsEngine();
});
