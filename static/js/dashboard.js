// DASHBOARD CORE DATA POPULATOR
class DashboardEngine {
    constructor() {
        this.activeDeviceId = localStorage.getItem('active_device_id');
        this.init();
    }

    async init() {
        if (!this.activeDeviceId) return;
        await this.loadDeviceMetrics();
        await this.loadActivePermissions();
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
            console.error(e);
        }
    }

    populateMetadata(dev) {
        // Set dynamic network state labels
        const badge = document.getElementById('online-badge');
        if (badge) {
            badge.className = dev.online_status ? 'status-dot online' : 'status-dot';
        }

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
                // INFO-NAME ke aage REMOVE BUTTON inject kiya gaya hai
                if (id === 'info-name') {
                    el.innerHTML = `
                        <span style="margin-right: 15px;">${value}</span>
                        <button onclick="deleteDevice('${dev.id}')" style="background: #ff3b30; color: white; border: none; border-radius: 5px; padding: 5px 12px; cursor: pointer; font-size: 0.85rem; font-weight: bold; box-shadow: 0 4px 6px rgba(255, 59, 48, 0.2); transition: all 0.3s ease;">
                            Remove Device
                        </button>
                    `;
                } else {
                    el.textContent = value;
                }
            }
        }
    }

    async loadActivePermissions() {
        const token = localStorage.getItem('owner_token');
        try {
            const res = await fetch(`/api/permissions?device_id=${this.activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.evaluateSystemPermissionOverlays(result.data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    evaluateSystemPermissionOverlays(perms) {
        // Enforce active overlays for feature segments that are unauthorized on the physical device
        const config = {
            'calls-wrapper': perms.call_log,
            'sms-wrapper': perms.sms,
            'files-wrapper': perms.storage,
            'location-wrapper': perms.location
        };

        for (const [wrapperId, isGranted] of Object.entries(config)) {
            const target = document.getElementById(wrapperId);
            if (target && !isGranted) {
                this.applySectionProtectionOverlay(target);
            }
        }
    }

    applySectionProtectionOverlay(element) {
        element.classList.add('locked-section');
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay';
        overlay.innerHTML = `
            <i class="lucide-lock-keyhole"></i>
            <h4 style="color: #ff3b30; font-weight: 600;">Permission Not Granted</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; max-width: 250px; margin: 0 auto;">
                Enable permission profiles from the RS PHONE target context options.
            </p>
        `;
        element.appendChild(overlay);
    }
}

// Global scope function to handle the removal action properly
window.deleteDevice = async function(deviceId) {
    if (!confirm("WARNING: Are you sure you want to permanently remove this device and all its data? This action cannot be undone.")) {
        return;
    }

    const token = localStorage.getItem('owner_token');
    try {
        const res = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        const result = await res.json();
        if (result.status === 'success') {
            alert("Device removed successfully.");
            localStorage.removeItem('active_device_id'); 
            window.location.reload(); // Refresh to clean state or redirect to device selection page
        } else {
            alert("Failed to remove device: " + result.message);
        }
    } catch (e) {
        console.error("Delete Action Failed:", e);
        alert("A network error occurred while trying to remove the device.");
    }
};

// Instantiate dashboard scope logic on load sequence execution
document.addEventListener('DOMContentLoaded', () => {
    new DashboardEngine();
});
