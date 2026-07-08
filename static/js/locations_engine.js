// static/js/locations_engine.js

class LocationsEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.map = null;
        this.marker = null;
        this.init();
    }

    async init() {
        this.initMap();
        await this.loadDevicesList();
        
        if (!this.activeDeviceId) return;
        
        await this.fetchLocations();
        setInterval(() => this.fetchLocations(), 15000); // 15s refresh for Map to save resources
    }

    initMap() {
        // Map ko default world view pe set karo
        this.map = L.map('map').setView([20.5937, 78.9629], 5); // Default: India
        
        // OpenStreetMap free tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
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
                    if (result.data.length === 0) {
                        selectEl.innerHTML = '<option value="">No Devices Found</option>';
                        return;
                    }

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
                        this.fetchLocations(); 
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load devices:", e);
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
                
                // Map Par Pin Update Karo
                const latLng = [latestLoc.latitude, latestLoc.longitude];
                
                if (this.marker) {
                    this.marker.setLatLng(latLng);
                } else {
                    this.marker = L.marker(latLng).addTo(this.map);
                }
                
                // Camera ko latest location par zoom karo
                this.map.setView(latLng, 16);
                this.marker.bindPopup(`Last seen: ${new Date(latestLoc.timestamp).toLocaleTimeString()}`).openPopup();

                // Niche List render karo
                listEl.innerHTML = result.data.map((loc, index) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${index === 0 ? '#00bcd4' : '#555'};">
                        <div>
                            <div style="color: #fff; font-weight: bold;">Lat: ${loc.latitude.toFixed(6)}, Lng: ${loc.longitude.toFixed(6)}</div>
                            <div style="color: #aaa; font-size: 0.8rem; margin-top: 4px;">Accuracy: ${loc.accuracy} meters</div>
                        </div>
                        <div style="color: #888; font-size: 0.9rem;">
                            ${new Date(loc.timestamp).toLocaleString()}
                        </div>
                    </div>
                `).join('');

            } else {
                listEl.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No GPS data recorded yet.</div>';
            }
        } catch (e) {
            console.error("Fetch Locations Error:", e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LocationsEngine();
});
