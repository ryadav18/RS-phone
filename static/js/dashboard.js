// CORE DASHBOARD ENGINE (Optimized for Hub Architecture)
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        if (!this.activeDeviceId) return;
        // Sirf basic telemetry load hogi. Heavy data ab dedicated pages par shift ho gaya hai.
        await this.loadDeviceMetrics();
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
        const badge = document.getElementById('online-badge');
        if (badge) badge.className = dev.online_status ? 'status-dot online' : 'status-dot';

        const metrics = {
            'metric-battery': `${dev.battery_level}%`,
            'metric-charging': dev.is_charging ? 'Charging' : 'Discharging',
            'metric-temp': `${dev.temperature}°C`,
            'metric-net': dev.network_type,
            'metric-storage': dev.storage_used,
            'info-name': dev.name,
            'info-model': dev.model,
            'info-os': `Android ${dev.android_version}`,
            'info-version': `v${dev.app_version}`,
            'info-id': dev.device_id,
            'info-connected': new Date(dev.created_at).toLocaleDateString()
        };

        for (const [id, value] of Object.entries(metrics)) {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'info-name') {
                    el.innerHTML = `
                        <span style="margin-right: 15px;">${value}</span>
                        <button onclick="deleteDevice('${dev.id}')" style="background: #ff3b30; color: white; border: none; border-radius: 5px; padding: 5px 12px; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: all 0.3s ease;">
                            Remove Device
                        </button>
                    `;
                } else {
                    el.textContent = value;
                }
            }
        }
    }
}

// Global Device Deletion Method
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

document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});
