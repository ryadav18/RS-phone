// CORE DASHBOARD ENGINE (Optimized for Bento Grid & Real-time Telemetry)
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        if (!this.activeDeviceId) return;
        
        // Initial load
        await this.loadDeviceMetrics();
        
        // Real-time Zinda Polling (Har 10 second mein auto-update)
        setInterval(() => this.loadDeviceMetrics(), 10000);
    }

    async loadDeviceMetrics() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch('/api/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                const dev = result.data.find(d => d.id === this.activeDeviceId);
                if (dev) {
                    this.populateMetadata(dev);
                }
            }
        } catch (e) {
            console.error("Telemetry Fetch Error:", e);
        }
    }

    populateMetadata(dev) {
        // 1. Zinda Online Status Badge Update
        const badge = document.getElementById('online-badge');
        if (badge) {
            badge.style.color = dev.online_status ? '#30d158' : '#ff3b30';
            badge.innerText = dev.online_status ? '● ONLINE' : '○ OFFLINE';
        }

        // 2. Battery Update with Charging Color Logic
        const batteryEl = document.getElementById('metric-battery');
        if (batteryEl) {
            batteryEl.textContent = `${dev.battery_level}%`;
            // Agar charge ho raha hai toh text green ho jayega
            batteryEl.style.color = dev.is_charging ? '#30d158' : 'white'; 
        }

        // 3. Storage Update
        const storageEl = document.getElementById('metric-storage');
        if (storageEl) {
            storageEl.textContent = dev.storage_used || 'N/A';
        }

        // 4. Device Name, Model & Remove Button (Merged Logic)
        const nameEl = document.getElementById('info-name');
        if (nameEl) {
            nameEl.innerHTML = `
                <div style="font-size: 1.1rem; margin-bottom: 12px; color: white;">
                    ${dev.name} <span style="color: #888; font-size: 0.9rem;">(${dev.model})</span>
                </div>
                <button onclick="deleteDevice('${dev.id}')" style="background: rgba(255, 59, 48, 0.1); color: #ff3b30; border: 1px solid #ff3b30; border-radius: 6px; padding: 6px 15px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: all 0.3s ease;">
                    Remove Device
                </button>
            `;
        }
    }
}

// Global Device Deletion Method (Unchanged & Secure)
window.deleteDevice = async function(deviceId) {
    if (!confirm("WARNING: Are you sure you want to permanently remove this device and all its data? This action cannot be undone.")) return;

    const token = localStorage.getItem('owner_token');
    try {
        const res = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert("Device removed successfully.");
            localStorage.removeItem('active_device_id'); 
            window.location.reload(); 
        } else {
            alert("Failed to remove device: " + result.message);
        }
    } catch (e) {
        console.error("Delete Action Failed:", e);
    }
};

// Initialize Engine on Page Load
document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});
